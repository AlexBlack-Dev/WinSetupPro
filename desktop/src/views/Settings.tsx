import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useStore } from "../store/useStore";
import { useT } from "../i18n/useT";
import { ACCENTS } from "../types";
import type { AccentId, Lang } from "../types";
import {
  Btn,
  SectionLabel,
  SectionTitle,
  SelectNative,
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
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void refreshEngines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="mx-auto max-w-[720px] space-y-7 pb-8"
    >
      <SectionTitle>{t("settings")}</SectionTitle>

      <section className="space-y-4">
        <SectionLabel>{t("language")}</SectionLabel>
        <SelectNative
          value={lang}
          onChange={(v) => setLang(v as Lang)}
          options={[
            { value: "ru", label: "Русский" },
            { value: "en", label: "English" },
          ]}
        />
        <SectionLabel>{t("theme")}</SectionLabel>
        <SelectNative
          value={theme}
          onChange={setTheme}
          options={[
            { value: "system", label: t("themeSystem") },
            { value: "dark", label: t("themeDark") },
            { value: "light", label: t("themeLight") },
          ]}
        />
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
        <div className="flex h-9 items-center gap-2">
          <Btn onClick={() => void exportPreset()}>{t("exportPreset")}</Btn>
          <Btn onClick={() => void importPreset()}>{t("importPreset")}</Btn>
          <Btn onClick={() => void doRestorePoint()}>{t("createRestore")}</Btn>
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
    </motion.div>
  );
}
