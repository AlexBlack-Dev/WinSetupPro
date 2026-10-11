import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useStore } from "../store/useStore";
import { useT } from "../i18n/useT";
import { categoryName } from "../lib/tiles";
import type { CatalogApp, JobStatus, UninstallItem } from "../lib/api";
import { api } from "../lib/api";
import { canUninstall, toUninstallItem } from "../lib/uninstall";
import { AppTile, Btn, EmptyState } from "../components/ui";

function waitForItem(id: string, timeoutMs: number): { promise: Promise<JobStatus>; cancel: () => void } {
  let cancel = () => {};
  const promise = new Promise<JobStatus>((resolve) => {
    let done = false;
    let unlisten: (() => void) | undefined;
    const finish = (status: JobStatus) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      unlisten?.();
      resolve(status);
    };
    cancel = () => finish("failed");
    const timer = window.setTimeout(() => finish("failed"), timeoutMs);
    void api.onInstallEvent((e) => {
      if (done || e.type !== "status" || e.item !== id) return;
      if (e.status === "succeeded" || e.status === "failed" || e.status === "cancelled" || e.status === "skipped") {
        finish(e.status);
      }
    }).then((u) => {
      unlisten = u;
      if (done) u();
    });
  });
  return { promise, cancel };
}

function InstalledCard({
  app,
  version,
  uninstall,
  busy,
  onUninstall,
}: {
  app: CatalogApp;
  version: string;
  uninstall: UninstallItem | null;
  busy: boolean;
  onUninstall: (item: UninstallItem, displayName: string) => void;
}) {
  const lang = useStore((s) => s.lang);
  const t = useT();
  return (
    <div className="spot flex h-[148px] w-[320px] gap-2.5 rounded-[14px] p-3.5 transition-all duration-150 hover:-translate-y-0.5 hover:bg-[var(--hover)]">
      <AppTile
        app={app}
        size={52}
        installed
        installedTitle={t("installedBadge")}
      />
      <div className="min-w-0 flex-1">
        <p className="h-5 truncate text-sm font-semibold">
          {lang === "ru" ? app.nameRu : app.nameEn}
        </p>
        <p className="mt-0.5 h-4 truncate font-mono text-xs opacity-70">
          {version}
        </p>
        <p className="mt-1 h-4 truncate text-[11px] opacity-60">
          {app.preferredEngine === "Scoop" ? "scoop" : "winget"}
          <span className="opacity-60"> · </span>
          {categoryName(app.category, lang)}
        </p>
        {uninstall && (
          <button
            onClick={() => onUninstall(uninstall, lang === "ru" ? app.nameRu : app.nameEn)}
            disabled={busy}
            className="mt-1 h-7 shrink-0 rounded-lg px-2.5 text-xs font-semibold text-red-400 transition-all hover:bg-red-500/10 disabled:pointer-events-none disabled:opacity-40"
          >
            {busy ? t("uninstallBusy") : t("uninstall")}
          </button>
        )}
      </div>
    </div>
  );
}

function OtherRow({
  name,
  version,
  publisher,
  source,
  uninstall,
  busy,
  onUninstall,
}: {
  name: string;
  version: string;
  publisher: string;
  source: string;
  uninstall: UninstallItem | null;
  busy: boolean;
  onUninstall: (item: UninstallItem, displayName: string) => void;
}) {
  const t = useT();
  return (
    <div className="vrow flex h-12 items-center gap-3 px-2">
      <p className="min-w-0 flex-1 truncate text-sm">{name}</p>
      {version && (
        <span className="mono hidden w-32 shrink-0 truncate text-right text-xs opacity-60 sm:block">
          {version}
        </span>
      )}
      {publisher && (
        <span className="hidden w-48 shrink-0 truncate text-right text-xs opacity-50 lg:block">
          {publisher}
        </span>
      )}
      <span className="w-16 shrink-0 text-right font-mono text-[11px] opacity-45">
        {source}
      </span>
      {uninstall && canUninstall({ wingetId: uninstall.wingetId, uninstallString: uninstall.uninstallString }) && (
        <button
          onClick={() => onUninstall(uninstall, name)}
          disabled={busy}
          className="h-7 shrink-0 rounded-lg px-2.5 text-xs font-semibold text-red-400 transition-all hover:bg-red-500/10 disabled:pointer-events-none disabled:opacity-40"
        >
          {busy ? t("uninstallBusy") : t("uninstall")}
        </button>
      )}
    </div>
  );
}

/** Full PC inventory: catalog matches + everything else found on disk. */
export default function Installed() {
  const lang = useStore((s) => s.lang);
  const t = useT();
  const apps = useStore((s) => s.apps);
  const scan = useStore((s) => s.scan);
  const scanning = useStore((s) => s.scanning);
  const scanSystem = useStore((s) => s.scanSystem);
  const toast = useStore((s) => s.toast);
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");

  useEffect(() => {
    if (!scan) void scanSystem().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setDq(q), 250);
    return () => clearTimeout(id);
  }, [q]);

  const { matched, rest } = useMemo(() => {
    if (!scan) return { matched: [], rest: [] };
    const byWinget = new Map(
      scan.apps
        .filter((a) => a.wingetId)
        .map((a) => [a.wingetId!.toLowerCase(), a]),
    );
    const byName = new Map(
      scan.apps.map((a) => [a.name.toLowerCase(), a]),
    );
    const matched: { app: CatalogApp; version: string; uninstall: UninstallItem | null }[] = [];
    const used = new Set<string>();
    for (const app of apps) {
      const hit =
        (app.wingetId && byWinget.get(app.wingetId.toLowerCase())) ||
        byName.get((lang === "ru" ? app.nameRu : app.nameEn).toLowerCase()) ||
        byName.get(app.nameEn.toLowerCase());
      if (hit) {
        used.add(hit.name.toLowerCase());
        const uninstall =
          app.wingetId || app.scoopName
            ? toUninstallItem(
                `uninstall:${app.id}`,
                lang === "ru" ? app.nameRu : app.nameEn,
                app.wingetId,
                app.scoopName,
                null,
              )
            : null;
        matched.push({ app, version: hit.version, uninstall });
      }
    }
    const needle = dq.trim().toLowerCase();
    const keep = (hay: string[]) =>
      !needle || hay.some((f) => f.toLowerCase().includes(needle));
    return {
      matched: matched.filter((m) =>
        keep([m.app.nameEn, m.app.nameRu, m.app.id]),
      ),
      rest: scan.apps.filter(
        (a) => !used.has(a.name.toLowerCase()) && keep([a.name, a.publisher]),
      ),
    };
  }, [scan, apps, lang, dq]);

  const [busyId, setBusyId] = useState<string | null>(null);

  const onUninstall = async (item: UninstallItem, displayName: string) => {
    if (busyId) return;
    if (!window.confirm(t("uninstallConfirm"))) return;
    setBusyId(item.id);
    const waiter = waitForItem(item.id, 600_000);
    try {
      await api.createRestorePoint().catch(() => false);
      await api.startUninstall([item]);
      const status = await waiter.promise;
      if (status === "cancelled") {
        toast(t("leftoversKept"), "info");
        return;
      }
      if (status !== "succeeded") {
        toast(t("uninstallFailed"), "err");
      }
      const hit = scan?.apps.find((a) => a.name === displayName);
      const rep = await api
        .scanLeftovers(displayName, hit?.publisher ?? "")
        .catch(() => null);
      if (rep && rep.registryKeys.length + rep.paths.length > 0) {
        const detail = `${rep.registryKeys.length} registry, ${rep.paths.length} files`;
        if (window.confirm(`${t("leftoversConfirm")} (${detail})`)) {
          const removed = await api
            .removeLeftovers(rep.registryKeys, rep.paths)
            .catch(() => null);
          if (removed) {
            toast(
              `${t("leftoversCleaned")} (${removed.removedRegistry}+${removed.removedPaths})`,
              "ok",
            );
            if (removed.errors.length > 0) {
              toast(removed.errors[0], "err");
            }
          } else {
            toast(t("uninstallFailed"), "err");
          }
        } else {
          toast(t("leftoversKept"), "info");
        }
      } else if (status === "succeeded") {
        toast(t("uninstallDone"), "ok");
      }
      await scanSystem().catch(() => {});
      useStore.getState().refreshInstalled();
    } catch (e) {
      waiter.cancel();
      toast(String(e), "err");
    } finally {
      setBusyId(null);
    }
  };

  const onRefresh = async () => {
    try {
      await scanSystem();
    } catch (e) {
      toast(String(e), "err");
    }
  };

  return (
    <div className="space-y-4 pb-8">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="hero-grad flex h-[148px] shrink-0 items-center gap-4 overflow-hidden rounded-[18px] border border-[var(--border)] p-6"
      >
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[22px] font-semibold tracking-wide">
            {t("installed")}
          </h1>
          <p className="mt-1.5 h-5 truncate text-sm opacity-75">
            {scanning
              ? t("scanning")
              : scan
                ? `${scan.total} · ${matched.length} ${t("fromCatalog")}`
                : ""}
          </p>
        </div>
        <Btn onClick={onRefresh} disabled={scanning} className="shrink-0">
          {t("refresh")}
        </Btn>
      </motion.section>

      <input
        value={q}
        onChange={(e) => setQ(e.currentTarget.value)}
        placeholder={t("search")}
        className="h-10 w-full border-b border-[var(--border)] bg-transparent px-1 text-sm outline-none transition-colors placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
      />

      {!scan && !scanning ? null : scanning && matched.length === 0 && rest.length === 0 ? (
        <div className="flex h-40 items-center justify-center">
          <motion.p
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.6, repeat: Infinity }}
            className="text-sm opacity-60"
          >
            {t("scanning")}
          </motion.p>
        </div>
      ) : (
        <>
          {matched.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-[11px] font-bold tracking-[0.09em] whitespace-nowrap text-[var(--muted)] uppercase">
                {t("fromCatalog")} · {matched.length}
              </h3>
              <div className="grid justify-center gap-4 [grid-template-columns:repeat(auto-fill,320px)]">
                {matched.map((m) => (
                  <InstalledCard
                    key={m.app.id}
                    app={m.app}
                    version={m.version}
                    uninstall={m.uninstall}
                    busy={busyId !== null}
                    onUninstall={onUninstall}
                  />
                ))}
              </div>
            </section>
          )}
          {rest.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-[11px] font-bold tracking-[0.09em] whitespace-nowrap text-[var(--muted)] uppercase">
                {t("otherApps")} · {rest.length}
              </h3>
              <div className="divide-y divide-[var(--border)]">
                {rest.map((a) => {
                  const u: UninstallItem | null =
                    a.wingetId || a.uninstallString
                      ? toUninstallItem(
                          `uninstall:scan:${a.source}:${a.name}`,
                          a.name,
                          a.wingetId,
                          null,
                          a.uninstallString ?? null,
                        )
                      : null;
                  return (
                    <OtherRow
                      key={`${a.source}:${a.name}`}
                      name={a.name}
                      version={a.version}
                      publisher={a.publisher}
                      source={a.source}
                      uninstall={u}
                      busy={busyId !== null}
                      onUninstall={onUninstall}
                    />
                  );
                })}
              </div>
            </section>
          )}
          {matched.length === 0 && rest.length === 0 && (
            <EmptyState text={t("emptyCatalog")} />
          )}
        </>
      )}
    </div>
  );
}
