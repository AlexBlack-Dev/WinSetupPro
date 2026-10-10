use crate::engine::{self, RunHandle};
use crate::model::{EngineKind, InstallEvent, InstallItem};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use tauri::{AppHandle, Emitter, State};

#[derive(Clone)]
pub struct QueueState {
    pub handle: Arc<RunHandle>,
    pub running: Arc<AtomicBool>,
}

impl QueueState {
    pub fn new() -> Self {
        Self {
            handle: Arc::new(RunHandle::new()),
            running: Arc::new(AtomicBool::new(false)),
        }
    }
}

fn emit(app: &AppHandle, ev: InstallEvent) {
    if let Err(e) = app.emit("install-event", ev) {
        eprintln!("emit install-event failed: {e}");
    }
}

fn parse_progress(line: &str) -> Option<f64> {
    let bytes = line.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i > 0 {
            let mut j = i - 1;
            while j > 0 && (bytes[j] == b' ' || bytes[j] == b'\t') {
                j -= 1;
            }
            let mut start = j;
            while start > 0 && (bytes[start - 1].is_ascii_digit() || bytes[start - 1] == b'.') {
                start -= 1;
            }
            if bytes[start].is_ascii_digit() {
                if let Ok(v) = line[start..=j].trim().parse::<f64>() {
                    if (0.0..=100.0).contains(&v) {
                        return Some(v);
                    }
                }
            }
        }
        i += 1;
    }
    None
}

#[cfg(test)]
pub fn parse_progress_for_test(line: &str) -> Option<f64> {
    parse_progress(line)
}

fn winget_args(id: &str) -> Vec<String> {
    [
        "install",
        "--exact",
        "--id",
        id,
        "--silent",
        "--disable-interactivity",
        "--accept-package-agreements",
        "--accept-source-agreements",
    ]
    .iter()
    .map(|s| s.to_string())
    .collect()
}

/// Sequential queue: one installer at a time (parallel MSI installs corrupt state).
#[tauri::command]
pub async fn start_install(
    app: AppHandle,
    state: State<'_, QueueState>,
    items: Vec<InstallItem>,
) -> Result<(), String> {
    if state.running.swap(true, Ordering::SeqCst) {
        return Err("install already running".to_string());
    }
    state.handle.reset();
    let st = state.inner().clone();
    let handle = st.handle.clone();

    tokio::spawn(async move {
        let total = items.len();
        let mut done = 0usize;
        for it in &items {
            if handle.is_cancelled() {
                emit(
                    &app,
                    InstallEvent::Status {
                        item: it.id.clone(),
                        status: "cancelled".to_string(),
                        progress: 0.0,
                    },
                );
                done += 1;
                emit(&app, InstallEvent::Overall { done, total });
                continue;
            }
            emit(
                &app,
                InstallEvent::Status {
                    item: it.id.clone(),
                    status: "running".to_string(),
                    progress: 0.0,
                },
            );
            run_one(&app, &handle, it).await;
            done += 1;
            emit(&app, InstallEvent::Overall { done, total });
        }
        emit(&app, InstallEvent::Finished);
        st.running.store(false, Ordering::SeqCst);
    });
    Ok(())
}

async fn run_one(app: &AppHandle, handle: &RunHandle, it: &InstallItem) {
    let app_clone = app.clone();
    let item_id = it.id.clone();
    let mut last_progress: f64 = 0.0;
    let log = |message: String| {
        let kind = if message.starts_with("ERR:") { "error" } else { "info" };
        emit(
            app,
            InstallEvent::Log {
                item: it.id.clone(),
                message: message.clone(),
                kind: kind.to_string(),
            },
        );
        if let Some(p) = parse_progress(&message) {
            if p >= last_progress {
                last_progress = p;
                emit(
                    &app_clone,
                    InstallEvent::Status {
                        item: item_id.clone(),
                        status: "running".to_string(),
                        progress: p,
                    },
                );
            }
        }
    };

    // Preferred engine first, the other as fallback.
    let mut order = vec![it.preferred_engine];
    for k in [EngineKind::Winget, EngineKind::Scoop] {
        if !order.contains(&k) {
            order.push(k);
        }
    }
    let mut plan: Option<(engine::Resolved, bool, String, Vec<String>)> = None;
    for k in order {
        match k {
            EngineKind::Winget => {
                if let Some(id) = &it.winget_id {
                    plan = Some((
                        engine::Resolved::Direct(engine::resolve_winget()),
                        true,
                        id.clone(),
                        winget_args(id),
                    ));
                    break;
                }
            }
            EngineKind::Scoop => {
                if let Some(name) = &it.scoop_name {
                    plan = Some((
                        engine::resolve_scoop(),
                        false,
                        name.clone(),
                        vec!["install".to_string(), name.clone()],
                    ));
                    break;
                }
            }
        }
    }
    let Some((resolved, winget, ref_id, args)) = plan else {
        emit(
            app,
            InstallEvent::Log {
                item: it.id.clone(),
                message: "ERR: no engine can handle this app".to_string(),
                kind: "error".to_string(),
            },
        );
        emit(
            app,
            InstallEvent::Status {
                item: it.id.clone(),
                status: "failed".to_string(),
                progress: 0.0,
            },
        );
        return;
    };

    if engine::is_installed(&resolved, winget, &ref_id).await {
        emit(
            app,
            InstallEvent::Log {
                item: it.id.clone(),
                message: "Already installed — skipped.".to_string(),
                kind: "success".to_string(),
            },
        );
        emit(
            app,
            InstallEvent::Status {
                item: it.id.clone(),
                status: "skipped".to_string(),
                progress: 100.0,
            },
        );
        return;
    }

    let mut log = log;
    log(format!(
        "{} {}",
        if winget { "winget install" } else { "scoop install" },
        ref_id
    ));
    let ok = engine::install(handle, &resolved, &args, &mut log).await;

    if ok {
        emit_done(app, &it.id, "succeeded", 100.0, "Installed cleanly.");
    } else if handle.is_cancelled() {
        emit_done(app, &it.id, "cancelled", 0.0, "Cancelled by user.");
    } else if engine::is_installed(&resolved, winget, &ref_id).await {
        // Non-zero exit but the app is present (e.g. winget "already installed" codes).
        emit_done(app, &it.id, "succeeded", 100.0, "Already present.");
    } else {
        emit_done(app, &it.id, "failed", 0.0, "Installer reported an error. See log above.");
    }
}

fn emit_done(app: &AppHandle, id: &str, status: &str, progress: f64, message: &str) {
    let kind = if status == "failed" { "error" } else { "success" };
    emit(
        app,
        InstallEvent::Log {
            item: id.to_string(),
            message: message.to_string(),
            kind: kind.to_string(),
        },
    );
    emit(
        app,
        InstallEvent::Status {
            item: id.to_string(),
            status: status.to_string(),
            progress,
        },
    );
}

#[tauri::command]
pub fn cancel_install(state: State<'_, QueueState>) -> Result<(), String> {
    state.handle.cancel();
    Ok(())
}
