use std::path::Path;
use std::process::Stdio;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::Mutex;

#[cfg(target_os = "windows")]
pub(crate) fn no_window(cmd: &mut Command) {
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn no_window(_cmd: &mut Command) {}

pub fn resolve_winget() -> String {
    if let Ok(base) = std::env::var("LOCALAPPDATA") {
        let p = Path::new(&base).join(r"Microsoft\WindowsApps\winget.exe");
        if p.exists() {
            return p.to_string_lossy().into_owned();
        }
    }
    "winget".to_string()
}

/// How to launch an engine: directly, or via its PowerShell entry point
/// (scoop ships no .exe shim — only scoop.cmd/scoop.ps1, which need a shell).
#[derive(Debug, Clone)]
pub enum Resolved {
    Direct(String),
    PsScript(String),
}

pub fn resolve_scoop() -> Resolved {
    if let Ok(home) = std::env::var("USERPROFILE") {
        let dir = Path::new(&home).join(r"scoop\shims");
        for name in ["scoop.exe", "scoop.ps1"] {
            if dir.join(name).is_file() {
                let full = dir.join(name).to_string_lossy().into_owned();
                return if name.ends_with(".ps1") {
                    Resolved::PsScript(full)
                } else {
                    Resolved::Direct(full)
                };
            }
        }
    }
    Resolved::Direct("scoop".to_string())
}

fn base_command(resolved: &Resolved) -> Command {
    let mut cmd = match resolved {
        Resolved::Direct(exe) => Command::new(exe),
        Resolved::PsScript(ps1) => {
            let mut c = Command::new("powershell");
            c.args([
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                ps1,
            ]);
            c
        }
    };
    no_window(&mut cmd);
    cmd
}

pub async fn check_available(resolved: &Resolved) -> bool {
    let mut cmd = base_command(resolved);
    match cmd.arg("--version").output().await {
        Ok(o) => o.status.success(),
        Err(_) => false,
    }
}

/// Cancellation + child handle shared between the runner and `cancel_install`.
pub struct RunHandle {
    cancel: Arc<AtomicBool>,
    child: Arc<Mutex<Option<tokio::process::Child>>>,
}

impl RunHandle {
    pub fn new() -> Self {
        Self {
            cancel: Arc::new(AtomicBool::new(false)),
            child: Arc::new(Mutex::new(None)),
        }
    }
    pub fn reset(&self) {
        self.cancel.store(false, Ordering::Relaxed);
    }
    pub fn cancel(&self) {
        self.cancel.store(true, Ordering::Relaxed);
        if let Ok(mut g) = self.child.try_lock() {
            if let Some(mut c) = g.take() {
                let _ = c.start_kill();
            }
        }
    }
    pub fn is_cancelled(&self) -> bool {
        self.cancel.load(Ordering::Relaxed)
    }
}

pub async fn is_installed(resolved: &Resolved, winget: bool, id: &str) -> bool {
    let mut cmd = base_command(resolved);
    if winget {
        cmd.args(["list", "--exact", "--id", id, "--accept-source-agreements"]);
    } else {
        cmd.args(["list", id]);
    }
    match cmd.output().await {
        Ok(o) => {
            o.status.success()
                && String::from_utf8_lossy(&o.stdout)
                    .to_lowercase()
                    .contains(&id.to_lowercase())
        }
        Err(_) => false,
    }
}

enum StreamMsg {
    Line(String),
    Eof,
}

/// Runs the installer, streams every output line, honors cancellation.
/// Returns the raw exit success; callers verify with `is_installed` on failure.
pub async fn install(
    handle: &RunHandle,
    resolved: &Resolved,
    args: &[String],
    mut on_line: impl FnMut(String),
) -> bool {
    let label = match resolved {
        Resolved::Direct(exe) => exe.clone(),
        Resolved::PsScript(ps1) => format!("powershell {ps1}"),
    };
    let mut cmd = base_command(resolved);
    cmd.args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            on_line(format!("ERR: cannot start {label} ({e})"));
            return false;
        }
    };

    let stdout = child.stdout.take().map(BufReader::new);
    let stderr = child.stderr.take().map(BufReader::new);
    *handle.child.lock().await = Some(child);

    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<StreamMsg>();
    // Stdout and stderr have distinct types, so each gets its own reader task.
    if let Some(r) = stdout {
        let tx = tx.clone();
        tokio::spawn(async move {
            let mut lines = r.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                if tx.send(StreamMsg::Line(line)).is_err() {
                    break;
                }
            }
            let _ = tx.send(StreamMsg::Eof);
        });
    } else {
        let _ = tx.send(StreamMsg::Eof);
    }
    if let Some(r) = stderr {
        let tx = tx.clone();
        tokio::spawn(async move {
            let mut lines = r.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                if tx.send(StreamMsg::Line(line)).is_err() {
                    break;
                }
            }
            let _ = tx.send(StreamMsg::Eof);
        });
    } else {
        let _ = tx.send(StreamMsg::Eof);
    }
    drop(tx);

    // Watchdog: kill the child the moment cancellation arrives.
    let cancel_flag = handle.cancel.clone();
    let slot = handle.child.clone();
    tokio::spawn(async move {
        loop {
            if cancel_flag.load(Ordering::Relaxed) {
                let mut g = slot.lock().await;
                if let Some(mut c) = g.take() {
                    let _ = c.start_kill();
                }
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(80)).await;
        }
    });

    let mut eofs = 0u8;
    while let Some(msg) = rx.recv().await {
        if handle.is_cancelled() {
            on_line("ERR: cancelled, process killed.".to_string());
            break;
        }
        match msg {
            StreamMsg::Line(l) => on_line(l),
            StreamMsg::Eof => {
                eofs += 1;
                if eofs >= 2 {
                    break;
                }
            }
        }
    }
    match handle.child.lock().await.take() {
        Some(mut c) => c.wait().await.ok().and_then(|s| s.code()) == Some(0),
        None => false,
    }
}

#[tauri::command]
pub async fn check_installed(engine: crate::model::EngineKind, id: String) -> bool {
    use crate::model::EngineKind as K;
    match engine {
        K::Winget => {
            is_installed(
                &Resolved::Direct(resolve_winget()),
                true,
                &id,
            )
            .await
        }
        K::Scoop => is_installed(&resolve_scoop(), false, &id).await,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    /// winget serializes poorly under concurrent alias activation — run one at a time.
    static TEST_LOCK: Mutex<()> = Mutex::new(());

    #[tokio::test]
    async fn winget_is_available() {
        let _g = TEST_LOCK.lock().unwrap();
        if !check_available(&Resolved::Direct(resolve_winget())).await {
            eprintln!("SKIP: winget not present on this machine");
            return;
        }
    }

    #[tokio::test]
    async fn winget_sees_installed_app() {
        let _g = TEST_LOCK.lock().unwrap();
        if !check_available(&Resolved::Direct(resolve_winget())).await {
            eprintln!("SKIP: winget not present");
            return;
        }
        assert!(
            is_installed(&Resolved::Direct(resolve_winget()), true, "7zip.7zip").await
        );
    }

    #[tokio::test]
    async fn winget_reports_missing_app() {
        let _g = TEST_LOCK.lock().unwrap();
        if !check_available(&Resolved::Direct(resolve_winget())).await {
            eprintln!("SKIP: winget not present");
            return;
        }
        assert!(
            !is_installed(
                &Resolved::Direct(resolve_winget()),
                true,
                "NoSuch.Vendor123"
            )
            .await
        );
    }

    #[tokio::test]
    async fn scoop_resolves_to_runnable() {
        // Scoop ships no .exe shim: resolution must yield the .ps1 entry point.
        let _g = TEST_LOCK.lock().unwrap();
        match resolve_scoop() {
            Resolved::Direct(exe) => {
                if !check_available(&Resolved::Direct(exe.clone())).await {
                    eprintln!("SKIP: scoop not present");
                    return;
                }
            }
            Resolved::PsScript(ps1) => {
                assert!(Path::new(&ps1).is_file());
                if !check_available(&Resolved::PsScript(ps1)).await {
                    eprintln!("SKIP: scoop ps1 not runnable");
                    return;
                }
            }
        }
    }

    #[test]
    fn progress_parser_extracts_percent() {
        assert_eq!(
            crate::queue::parse_progress_for_test("Downloading 42.5% done"),
            Some(42.5)
        );
        assert_eq!(crate::queue::parse_progress_for_test("no percent"), None);
        assert_eq!(crate::queue::parse_progress_for_test("150%"), None);
    }
}
