import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { useStore } from "../store/useStore";
import { useT } from "../i18n/useT";
import { statusText } from "../i18n/translations";
import { api } from "../lib/api";
import {
  AppTile,
  Btn,
  InfoBar,
  Magnetic,
  Progress,
  SectionTitle,
  StatusPill,
} from "../components/ui";

export default function Queue({ onBack }: { onBack: () => void }) {
  const lang = useStore((s) => s.lang);
  const t = useT();
  const jobs = useStore((s) => s.jobs);
  const overall = useStore((s) => s.overall);
  const running = useStore((s) => s.running);
  const needsAdmin = useStore((s) => s.needsAdmin);
  const log = useStore((s) => s.log);
  const runAll = useStore((s) => s.runAll);
  const cancel = useStore((s) => s.cancel);
  const removeJob = useStore((s) => s.removeJob);
  const clearFinished = useStore((s) => s.clearFinished);
  const toast = useStore((s) => s.toast);
  const [restartBusy, setRestartBusy] = useState(false);

  // Opening the tab mirrors the live catalog selection (no-op if unchanged).
  useEffect(() => {
    useStore.getState().syncQueue();
  }, []);

  const empty = jobs.length === 0;

  const onRestart = async () => {
    if (restartBusy) return;
    setRestartBusy(true);
    try {
      await api.restartAsAdmin();
    } catch (e) {
      toast(String(e), "err");
      setRestartBusy(false);
    }
  };

  const onSaveLog = () => {
    if (log.length === 0) return;
    const blob = new Blob([log.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "winsetuppro-log.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 pb-6">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="hero-grad shrink-0 rounded-[18px] p-6"
      >
        <div className="space-y-3">
          <SectionTitle>{t("queue")}</SectionTitle>
          {needsAdmin && (
            <InfoBar
              action={
                <Btn variant="ghost" onClick={onRestart} disabled={restartBusy}>
                  {t("restartAdmin")}
                </Btn>
              }
            >
              {t("needAdmin")}
            </InfoBar>
          )}
          {!empty && <Progress value={overall} />}
          <div className="flex h-9 items-center gap-2">
            <Magnetic strength={4}>
              <div className="beam min-w-36">
                <Btn
                  variant="brand"
                  onClick={() => void runAll()}
                  disabled={running || empty}
                  className="metal h-[33px] w-full rounded-[10px] border-0"
                >
                  {t("runAll")}
                </Btn>
              </div>
            </Magnetic>
            <Btn onClick={() => void cancel()} disabled={!running}>
              {t("cancel")}
            </Btn>
            <Btn onClick={clearFinished} disabled={running || empty}>
              {t("clearFinished")}
            </Btn>
            <Btn onClick={onSaveLog} disabled={running || log.length === 0}>
              log.txt
            </Btn>
          </div>
        </div>
      </motion.section>

      <div className="relative grid min-h-0 flex-1 gap-4 md:grid-cols-2">
        <div className="min-h-0 divide-y divide-[var(--border)] overflow-y-auto">
          {jobs.map((job, i) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.3) }}
              className="metal spot flex min-h-16 items-start gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-[var(--hover)]"
              onMouseMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
                e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
              }}
            >
              <AppTile app={job.app} size={40} />
              <div className="min-w-0 flex-1">
                <p className="h-5 truncate text-sm font-semibold">{job.name}</p>
                <StatusPill status={job.status} text={statusText(lang, job.status)} />
                  {job.status === "running" && (
                    <div className="mt-1">
                      <Progress value={job.progress} live />
                    </div>
                  )}
                {job.logTail && (
                  <p className="mono mt-0.5 h-4 truncate text-xs opacity-60">
                    {job.logTail}
                  </p>
                )}
              </div>
                <button
                  title={t("removeJob")}
                  disabled={running}
                  onClick={() => removeJob(job.id)}
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg text-lg leading-none opacity-60 transition-all hover:bg-red-500/15 hover:text-red-400 hover:opacity-100 disabled:pointer-events-none disabled:opacity-30"
                >
                  ×
                </button>
            </motion.div>
          ))}
        </div>

        {!empty && (
          <div className="min-h-0 overflow-y-auto rounded-xl bg-black/20 px-4 py-3 dark:bg-white/[0.03]">
            <div className="mono text-xs leading-relaxed whitespace-pre-wrap">
              {log.length === 0 ? (
                <span className="opacity-40">…</span>
              ) : (
                log.join("\n")
              )}
            </div>
          </div>
        )}

        {empty && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-5">
              <motion.div
                initial={{ opacity: 0, scale: 0.85, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 160, damping: 18 }}
              >
                <Trash2
                  size={76}
                  strokeWidth={1.1}
                  className="opacity-25"
                  aria-hidden="true"
                />
              </motion.div>
              <Magnetic strength={4}>
                <div className="beam min-w-50">
                  <Btn
                    variant="brand"
                    onClick={onBack}
                    className="metal h-[33px] w-full rounded-[10px] border-0"
                  >
                    {t("backToCatalog")}
                  </Btn>
                </div>
              </Magnetic>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
