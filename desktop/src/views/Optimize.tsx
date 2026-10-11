import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useStore } from "../store/useStore";
import { useT } from "../i18n/useT";
import { api } from "../lib/api";
import type {
  DefenderStatus,
  ProcInfo,
  StartupBackupMeta,
  StartupEntry,
  SystemInfo,
  TempTarget,
} from "../lib/api";
import { formatGb, formatMb, loadTweakCache, saveTweakCache, TWEAK_META } from "../lib/optimize";
import type { Lang } from "../types";
import { Btn, SectionLabel, SectionTitle } from "../components/ui";

export default function Optimize() {
  const lang = useStore((s) => s.lang);
  const t = useT();
  const toast = useStore((s) => s.toast);
  const [sys, setSys] = useState<SystemInfo | null>(null);
  const [procs, setProcs] = useState<ProcInfo[]>([]);
  const [startup, setStartup] = useState<StartupEntry[]>([]);
  const [defender, setDefender] = useState<DefenderStatus | null>(null);
  const [temps, setTemps] = useState<TempTarget[]>([]);
  const [tweaks, setTweaks] = useState<Record<string, boolean>>(() => loadTweakCache());
  const [backups, setBackups] = useState<StartupBackupMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const [s, p, st, d, tm, tw, bu] = await Promise.all([
        api.systemInfo().catch(() => null),
        api.listProcesses().catch(() => [] as ProcInfo[]),
        api.listStartup().catch(() => [] as StartupEntry[]),
        api.defenderStatus().catch(() => null),
        api.diskTemps().catch(() => [] as TempTarget[]),
        api.listTweaks().catch(() => []),
        api.listStartupBackups().catch(() => [] as StartupBackupMeta[]),
      ]);
      setSys(s);
      setProcs(p ?? []);
      setStartup(st ?? []);
      setDefender(d);
      setTemps(tm ?? []);
      setBackups(bu ?? []);
      const states: Record<string, boolean> = {};
      await Promise.all(
        (tw ?? []).map(async (twk) => {
          states[twk.id] = await api.tweakStatus(twk.id).catch(() => false);
        }),
      );
      setTweaks(states);
      saveTweakCache(states);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial data load on mount (same as Installed view).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, []);

  const run = async (key: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast(String(e), "err");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="hero-grad flex h-[148px] shrink-0 items-center gap-4 overflow-hidden rounded-[18px] border border-[var(--border)] p-6"
      >
        <div className="min-w-0 flex-1">
          <SectionTitle>{t("optimize")}</SectionTitle>
          <p className="mt-1.5 h-5 truncate text-sm opacity-75">
            {loading ? t("scanning") : (sys ? `${sys.os} · ${sys.cpu}` : "")}
          </p>
        </div>
        <Btn onClick={() => void refresh()} disabled={loading || busy !== null} className="shrink-0">
          {t("refresh")}
        </Btn>
      </motion.section>

      {sys && (
        <section className="space-y-2">
          <SectionLabel>{t("sysInfo")}</SectionLabel>
          <div className="grid gap-2 text-sm md:grid-cols-2">
            <InfoRow k="CPU" v={`${sys.cpu} · ${sys.cores}`} />
            <InfoRow
              k="RAM"
              v={`${formatGb(sys.ramFreeGb)} / ${formatGb(sys.ramTotalGb)}`}
            />
            <InfoRow k="GPU" v={sys.gpus.join(", ") || "—"} />
            <InfoRow k="Uptime" v={`${sys.uptimeHours} h`} />
            {sys.disks.map((d) => (
              <InfoRow
                key={d.name}
                k={`Disk ${d.name}`}
                v={`${formatGb(d.freeGb)} / ${formatGb(d.totalGb)}`}
              />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <SectionLabel>
          {t("defender")}
          {defender && (
            <span className="ml-2 opacity-70">
              {defender.available
                ? defender.realtime && defender.signaturesOk
                  ? "ok"
                  : defender.detail
                : defender.detail}
            </span>
          )}
        </SectionLabel>
      </section>

      <section className="space-y-2">
        <SectionLabel>
          {t("processes")} · {procs.length}
        </SectionLabel>
        <div className="divide-y divide-[var(--border)]">
          {procs.map((p) => (
            <div key={p.pid} className="vrow flex h-12 items-center gap-3 px-2">
              <p className="min-w-0 flex-1 truncate text-sm">
                {p.name}
                {p.suspicious && (
                  <span className="ml-2 text-xs text-amber-400">⚠ {p.reason}</span>
                )}
              </p>
              <span className="mono hidden w-20 shrink-0 truncate text-right text-xs opacity-60 sm:block">
                {p.cpu}% CPU
              </span>
              <span className="mono hidden w-24 shrink-0 truncate text-right text-xs opacity-60 sm:block">
                {formatMb(p.ramMb)}
              </span>
              <button
                title={p.company || p.path}
                disabled={busy !== null}
                onClick={() => {
                  if (!window.confirm(t("killConfirm"))) return;
                  void run(`kill:${p.pid}`, async () => {
                    const name = await api.killProcess(p.pid);
                    toast(`${name} ok`, "ok");
                    setProcs((xs) => xs.filter((x) => x.pid !== p.pid));
                  });
                }}
                className="h-7 shrink-0 rounded-lg px-2.5 text-xs font-semibold text-red-400 transition-all hover:bg-red-500/10 disabled:pointer-events-none disabled:opacity-40"
              >
                {busy === `kill:${p.pid}` ? t("uninstallBusy") : t("kill")}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <SectionLabel>
          {t("startup")} · {startup.length}
        </SectionLabel>
        <div className="divide-y divide-[var(--border)]">
          {startup.map((s) => (
            <div
              key={`${s.location}:${s.name}`}
              className="vrow flex h-12 items-center gap-3 px-2"
            >
              <p className="min-w-0 flex-1 truncate text-sm" title={s.command}>
                {s.name}
              </p>
              <span className="hidden w-40 shrink-0 truncate text-right font-mono text-[11px] opacity-45 lg:block">
                {s.location}
              </span>
              <button
                disabled={busy !== null}
                onClick={() => {
                  if (!window.confirm(t("disableConfirm"))) return;
                  void run(`st:${s.name}`, async () => {
                    await api.disableStartup(s.location, s.name);
                    toast("ok", "ok");
                    setStartup((xs) =>
                      xs.filter((x) => !(x.location === s.location && x.name === s.name)),
                    );
                  });
                }}
                className="h-7 shrink-0 rounded-lg px-2.5 text-xs font-semibold text-[var(--text)] transition-all hover:bg-[var(--hover)] disabled:pointer-events-none disabled:opacity-40"
              >
                {t("disable")}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <SectionLabel>
          {t("backups")} · {backups.length}
        </SectionLabel>
        {backups.length === 0 ? (
          <p className="truncate text-sm opacity-60">{t("backupEmpty")}</p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {backups.map((b) => (
              <div key={b.file} className="vrow flex h-12 items-center gap-3 px-2">
                <p className="min-w-0 flex-1 truncate text-sm" title={b.location}>
                  {b.name}
                </p>
                <button
                  disabled={busy !== null}
                  onClick={() =>
                    void run(`bu:${b.file}`, async () => {
                      await api.restoreStartupBackup(b.file);
                      toast(t("restored"), "ok");
                      setBackups(await api.listStartupBackups().catch(() => []));
                      setStartup(await api.listStartup().catch(() => []));
                    })
                  }
                  className="h-7 shrink-0 rounded-lg px-2.5 text-xs font-semibold text-[var(--text)] transition-all hover:bg-[var(--hover)] disabled:pointer-events-none disabled:opacity-40"
                >
                  {t("restore")}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <SectionLabel>{t("cleanup")}</SectionLabel>
        <div className="divide-y divide-[var(--border)]">
          {temps.map((x) => (
            <div key={x.id} className="vrow flex h-12 items-center gap-3 px-2">
              <p className="min-w-0 flex-1 truncate font-mono text-sm" title={x.path}>
                {x.id}
              </p>
              <span className="mono w-28 shrink-0 text-right text-xs opacity-60">
                {formatMb(x.mb)}
              </span>
              <button
                disabled={busy !== null}
                onClick={() => {
                  if (!window.confirm(t("cleanConfirm"))) return;
                  void run(`cl:${x.id}`, async () => {
                    const r = await api.cleanTemps([x.id]);
                    toast(`${r.removedFiles} · ${formatMb(r.freedMb)}`, "ok");
                    setTemps(await api.diskTemps().catch(() => []));
                  });
                }}
                className="h-7 shrink-0 rounded-lg px-2.5 text-xs font-semibold text-[var(--text)] transition-all hover:bg-[var(--hover)] disabled:pointer-events-none disabled:opacity-40"
              >
                {t("clean")}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <SectionLabel>{t("tweaks")}</SectionLabel>
        <div className="space-y-2">
          {Object.entries(TWEAK_META).map(([id, m]) => {
            const on = !!tweaks[id];
            const label = (lang as Lang) === "ru" ? m.ru : m.en;
            const desc = (lang as Lang) === "ru" ? m.descRu : m.descEn;
            return (
              <div key={id} className="vrow flex min-h-12 items-center gap-3 px-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{label}</p>
                  <p className="truncate text-xs opacity-60">{desc}</p>
                </div>
                <span
                  className={`size-2.5 shrink-0 rounded-full ${on ? "bg-green-500" : "bg-neutral-400"}`}
                />
                <span className="w-10 shrink-0 text-right text-xs opacity-60">
                  {on ? t("tweakOn") : t("tweakOff")}
                </span>
                <Btn
                  disabled={busy !== null}
                  onClick={() =>
                    void run(`tw:${id}`, async () => {
                      if (on) await api.revertTweak(id);
                      else await api.applyTweak(id);
                      setTweaks((s) => {
                        const next = { ...s, [id]: !on };
                        saveTweakCache(next);
                        return next;
                      });
                    })
                  }
                >
                  {on ? t("revert") : t("apply")}
                </Btn>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function InfoRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex h-10 items-center gap-3 rounded-xl px-3">
      <span className="w-24 shrink-0 truncate text-xs opacity-50">{k}</span>
      <span className="min-w-0 flex-1 truncate text-sm" title={v}>
        {v}
      </span>
    </div>
  );
}
