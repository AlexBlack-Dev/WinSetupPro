import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bug, Download, ExternalLink, RefreshCw, Upload } from "lucide-react";
import { useStore } from "../store/useStore";
import { useT } from "../i18n/useT";
import { ACCENTS } from "../types";
import type { AccentId, Lang } from "../types";
import { APP_VERSION } from "../version";
import { api } from "../lib/api";
import { buildIssueUrl, openExternal, openLocalPath } from "../lib/support";
import {
  Btn,
  SectionLabel,
  SectionTitle,
} from "../components/ui";

export default function Settings() {
  const lang = useStore((s) => s.lang);
  const t = useT();
  const theme = useStore((s) => s.theme);
  const setLang = useStore((s) => s.setLang);
  const setTheme = useStore((s) => s.setTheme);
  const accent = useStore((s) => s.accent);
  const setAccent = useStore((s) => s.setAccent);
  const engines = useStore((s) => s.engines);
  const refreshEngines = useStore((s) => s.refreshEngines);
  const installScoop = useStore((s) => s.installScoop);
  const doRestorePoint = useStore((s) => s.doRestorePoint);
  const exportPreset = useStore((s) => s.exportPreset);
  const importPreset = useStore((s) => s.importPreset);
  const statusLine = useStore((s) => s.statusLine);
  const update = useStore((s) => s.update);
  const checkingUpdate = useStore((s) => s.checkingUpdate);
  const checkUpdates = useStore((s) => s.checkUpdates);
  const toast = useStore((s) => s.toast);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void refreshEngines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openExt = (url: string) => {
    openExternal(url).catch((e: unknown) => toast(String(e), "err"));
  };

  const reportIssue = () => {
    const log = useStore.getState().log;
    openExt(buildIssueUrl(APP_VERSION, lang, log));
  };

  const openLogs = async () => {
    try {
      const dir = await api.openLogsDir();
      await openLocalPath(dir);
    } catch (e) {
      toast(String(e), "err");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="mx-auto max-w-[720px] space-y-7 pb-8"
    >
      <SectionTitle>{t("settings")}</SectionTitle>

      <section className="space-y-2">
        <SectionLabel>{t("version")}</SectionLabel>
        <div className="flex items-center justify-between gap-2.5">
          <span className="text-sm font-bold opacity-80">v{APP_VERSION}</span>
          <button
            onClick={() => void checkUpdates()}
            disabled={checkingUpdate}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] font-bold transition-all hover:brightness-110 disabled:opacity-50"
            style={{
              background: "color-mix(in srgb, var(--accent) 12%, transparent)",
              border: "1px solid color-mix(in srgb, var(--accent) 38%, transparent)",
              color: "var(--accent)",
            }}
          >
            <RefreshCw size={13} className={checkingUpdate ? "animate-spin" : undefined} />
            {checkingUpdate ? t("checkingUpdates") : t("updateCheck")}
          </button>
        </div>
        {update?.available && (
          <div className="space-y-2 rounded-xl border border-[var(--border)] p-3.5">
            <p className="text-sm font-semibold">new: {update.latest}</p>
            {update.notes && (
              <p className="line-clamp-4 text-xs leading-5 whitespace-pre-wrap opacity-70">
                {update.notes}
              </p>
            )}
            <Btn variant="brand" onClick={() => openExt(update.url)}>
              {t("download")}
            </Btn>
          </div>
        )}
        {update && !update.available && (
          <p className="h-5 truncate text-sm opacity-70">{t("updateLatest")}</p>
        )}
      </section>

      <section className="space-y-2">
        <SectionLabel>{t("language")}</SectionLabel>
        <div className="flex gap-2.5">
          {(
            [
              { value: "ru", label: "Русский" },
              { value: "en", label: "English" },
            ] as { value: Lang; label: string }[]
          ).map((o) => (
            <button
              key={o.value}
              onClick={() => setLang(o.value)}
              className="h-11 flex-1 rounded-[10px] text-sm transition-all"
              style={
                lang === o.value
                  ? {
                      background: "var(--hover)",
                      border: "1px solid var(--accent)",
                      fontWeight: 700,
                    }
                  : { border: "1px solid var(--border)", opacity: 0.65 }
              }
            >
              {o.label}
            </button>
          ))}
        </div>
        <SectionLabel>{t("theme")}</SectionLabel>
        <div className="flex gap-2.5">
          {(
            [
              { value: "system", label: t("themeSystem") },
              { value: "dark", label: t("themeDark") },
              { value: "light", label: t("themeLight") },
            ] as { value: string; label: string }[]
          ).map((o) => (
            <button
              key={o.value}
              onClick={() => setTheme(o.value)}
              className="h-11 flex-1 rounded-[10px] text-sm transition-all"
              style={
                theme === o.value
                  ? {
                      background: "var(--hover)",
                      border: "1px solid var(--accent)",
                      fontWeight: 700,
                    }
                  : { border: "1px solid var(--border)", opacity: 0.65 }
              }
            >
              {o.label}
            </button>
          ))}
        </div>
        <SectionLabel>{t("accent")}</SectionLabel>
        <div className="flex h-10 items-center gap-2.5">
          {(Object.keys(ACCENTS) as AccentId[]).map((id) => (
            <button
              key={id}
              title={ACCENTS[id].label}
              onClick={() => setAccent(id)}
              className={`metal size-10 shrink-0 overflow-hidden rounded-full transition-all duration-150 ${
                accent === id
                  ? "scale-110 ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg)]"
                  : "opacity-70 hover:scale-105 hover:opacity-100"
              }`}
              style={{ background: ACCENTS[id].bg }}
            />
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <SectionLabel>{t("developer")}</SectionLabel>
        <div className="flex items-center justify-between rounded-[10px] border border-[var(--border)] bg-[var(--card)] px-4 py-2.5">
          <span className="text-sm font-bold opacity-80">alex black</span>
          <button
            onClick={() => openExt("https://github.com/AlexBlack-Dev")}
            className="flex size-9 items-center justify-center rounded-lg opacity-70 transition-all hover:bg-[var(--hover)] hover:opacity-100"
          >
            <ExternalLink size={17} />
          </button>
        </div>
      </section>

      <div className="h-px bg-[var(--border)]" />

      <section className="space-y-2">
        <SectionLabel>{t("data")}</SectionLabel>
        <div className="flex gap-2.5">
          <button
            onClick={() => void exportPreset()}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[10px] border border-[var(--border)] text-sm font-bold opacity-90 transition-all hover:bg-[var(--hover)]"
          >
            <Download size={14} /> {t("exportPreset")}
          </button>
          <button
            onClick={() => void importPreset()}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[10px] border border-[var(--border)] text-sm font-bold opacity-90 transition-all hover:bg-[var(--hover)]"
          >
            <Upload size={14} /> {t("importPreset")}
          </button>
        </div>
      </section>

      <section className="space-y-2.5">
        <SectionLabel>{t("engines")}</SectionLabel>
        <div className="flex h-6 items-center gap-2.5">
          <span
            className={`size-3 shrink-0 rounded-full ${engines.winget ? "bg-green-500" : "bg-neutral-400"}`}
          />
          <span className="truncate text-sm">
            {t(engines.winget ? "wingetOk" : "wingetMissing")}
          </span>
        </div>
        <div className="flex h-9 items-center gap-2.5">
          <span
            className={`size-3 shrink-0 rounded-full ${engines.scoop ? "bg-green-500" : "bg-neutral-400"}`}
          />
          <span className="truncate text-sm">
            {t(engines.scoop ? "scoopOk" : "scoopMissing")}
          </span>
          {!engines.scoop && (
            <Btn
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await installScoop();
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "scoop…" : t("installScoop")}
            </Btn>
          )}
        </div>
      </section>

      <section className="space-y-2.5">
        <div className="flex h-9 flex-wrap items-center gap-2">
          <Btn onClick={() => void doRestorePoint()}>{t("createRestore")}</Btn>
          <Btn onClick={reportIssue}>
            <Bug size={14} /> {t("reportIssue")}
          </Btn>
          <Btn onClick={() => void openLogs()}>{t("openLogs")}</Btn>
        </div>
        {statusLine && (
          <p className="h-5 truncate text-sm opacity-70" title={statusLine}>
            {statusLine === "restore-ok"
              ? t("restoreCreated")
              : statusLine === "restore-fail"
                ? t("restoreFailed")
                : statusLine}
          </p>
        )}
        <p className="h-5 truncate text-xs opacity-50" title={t("logSaved")}>
          {t("logSaved")}
        </p>
      </section>

      <div className="flex items-center gap-3.5">
        <img
          src="/applogo.png"
          alt=""
          draggable={false}
          className="size-14 shrink-0 rounded-[14px] shadow-lg"
        />
        <p className="line-clamp-2 text-sm leading-5 opacity-70">{t("about")}</p>
      </div>

      <section className="space-y-2">
        <SectionLabel>{t("safetyTitle")}</SectionLabel>
        <p className="text-sm opacity-70">· {t("safety1")}</p>
        <p className="text-sm opacity-70">· {t("safety2")}</p>
        <p className="text-sm opacity-70">· {t("safety3")}</p>
      </section>
    </motion.div>
  );
}
