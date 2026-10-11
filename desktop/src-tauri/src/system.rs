use crate::engine::no_window;
use crate::queue::QueueState;
use tauri::State;
use tokio::process::Command;
use tokio::time::{timeout, Duration};

pub(crate) fn shell_cmd() -> Command {
    if let Ok(pwsh) = std::env::var("WINSETUPPRO_SHELL") {
        if !pwsh.trim().is_empty() {
            return Command::new(pwsh);
        }
    }
    for cand in ["pwsh", "powershell"] {
        let mut probe = std::process::Command::new(cand);
        probe.args(["-NoProfile", "-NonInteractive", "-Command", "$PSVersionTable.PSVersion.Major"]);
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            probe.creation_flags(0x08000000);
        }
        if let Ok(out) = probe.output() {
            if out.status.success() {
                return Command::new(cand);
            }
        }
    }
    Command::new("powershell")
}

async fn pwsh(script: &str, secs: u64) -> Result<String, String> {
    let mut cmd = shell_cmd();
    no_window(&mut cmd);
    cmd.args(["-NoProfile", "-NonInteractive", "-Command", script]);
    let out = timeout(Duration::from_secs(secs), cmd.output())
        .await
        .map_err(|_| "powershell timed out".to_string())?
        .map_err(|e| format!("spawn powershell: {e}"))?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}

#[tauri::command]
pub async fn is_admin() -> bool {
    pwsh(
        "[bool]([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)",
        15,
    )
    .await
    .map(|s| s == "True")
    .unwrap_or(false)
}

/// Best-effort restore point (needs admin). Never blocks the install flow.
#[tauri::command]
pub async fn create_restore_point() -> bool {
    pwsh(
        "Checkpoint-Computer -Description 'WinSetupPro bulk install' -RestorePointType 'MODIFY_SETTINGS'",
        120,
    )
    .await
    .is_ok()
}

#[tauri::command]
pub async fn restart_as_admin(state: State<'_, QueueState>) -> Result<String, String> {
    use std::sync::atomic::Ordering;
    if state.running.load(Ordering::SeqCst) {
        return Err("install running — cancel it before elevation".to_string());
    }
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    // PassThru returns the new PID only AFTER the user answers the UAC prompt.
    // On decline the cmdlet throws -> we return Err and STAY (never exit blindly).
    let script = format!(
        "try {{ $p = Start-Process -FilePath '{}' -Verb RunAs -PassThru; $p.Id }} catch {{ exit 1 }}",
        exe.to_string_lossy().replace('\'', "''")
    );
    let mut cmd = Command::new("powershell");
    no_window(&mut cmd);
    cmd.args(["-NoProfile", "-NonInteractive", "-Command", &script]);
    let out = timeout(Duration::from_secs(180), cmd.output())
        .await
        .map_err(|_| "timed out waiting for elevation".to_string())?
        .map_err(|e| format!("spawn powershell: {e}"))?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
        return Err(if err.is_empty() {
            "elevation declined".to_string()
        } else {
            err
        });
    }
    std::process::exit(0);
}

/// Official Scoop installer (https://get.scoop.sh). Takes a minute; frontend shows a spinner.
/// Uses TLS 1.2 explicitly. Note: get.scoop.sh is a bootstrap script without a pinned
/// hash (upstream rotates it); we fetch only over HTTPS and run with RemoteSigned scope.
#[tauri::command]
pub async fn install_scoop() -> Result<String, String> {
    pwsh(
        "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force; $u='https://get.scoop.sh'; if ($u -notmatch '^https://') { throw 'refusing non-https scoop url' }; Invoke-RestMethod -Uri $u | Invoke-Expression",
        600,
    )
    .await
    .map(|_| "ok".to_string())
}
