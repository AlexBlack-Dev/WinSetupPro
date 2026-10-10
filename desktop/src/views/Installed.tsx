import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useStore } from "../store/useStore";
import { useT } from "../i18n/useT";
import { categoryName } from "../lib/tiles";
import type { CatalogApp } from "../lib/api";
import { AppTile, Btn, EmptyState } from "../components/ui";

function InstalledCard({ app, version }: { app: CatalogApp; version: string }) {
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
      </div>
    </div>
  );
}

function OtherRow({
  name,
  version,
  publisher,
  source,
}: {
  name: string;
  version: string;
  publisher: string;
  source: string;
}) {
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
    const matched: { app: CatalogApp; version: string }[] = [];
    const used = new Set<string>();
    for (const app of apps) {
      const hit =
        (app.wingetId && byWinget.get(app.wingetId.toLowerCase())) ||
        byName.get((lang === "ru" ? app.nameRu : app.nameEn).toLowerCase()) ||
        byName.get(app.nameEn.toLowerCase());
      if (hit) {
        used.add(hit.name.toLowerCase());
        matched.push({ app, version: hit.version });
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
                  <InstalledCard key={m.app.id} app={m.app} version={m.version} />
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
                {rest.map((a) => (
                  <OtherRow
                    key={`${a.source}:${a.name}`}
                    name={a.name}
                    version={a.version}
                    publisher={a.publisher}
                    source={a.source}
                  />
                ))}
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
