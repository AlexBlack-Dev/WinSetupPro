import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "../store/useStore";
import { useT } from "../i18n/useT";
import { categoryName } from "../lib/tiles";
import type { CatalogApp } from "../lib/api";
import { AppTile, Btn, Check, EmptyState, Magnetic } from "../components/ui";

function AppCard({ app, index }: { app: CatalogApp; index: number }) {
  const lang = useStore((s) => s.lang);
  const t = useT();
  const selected = useStore((s) => !!s.selected[app.id]);
  const installed = useStore((s) => s.installed[app.id]);
  const toggle = useStore((s) => s.toggle);

  const name = lang === "ru" ? app.nameRu : app.nameEn;
  const desc = lang === "ru" ? app.descriptionRu : app.descriptionEn;

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.3,
        delay: Math.min(index * 0.02, 0.4),
        ease: "easeOut",
      }}
      onClick={() => toggle(app.id)}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
        e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
      }}
      className={`spot flex h-[148px] w-[320px] cursor-pointer gap-2.5 rounded-[14px] p-3.5 transition-all duration-150 hover:-translate-y-0.5 ${
        selected ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--hover)]"
      }`}
      style={
        selected
          ? {
              boxShadow:
                "inset 2px 0 0 var(--accent), 0 8px 24px rgb(0 0 0 / 0.25)",
            }
          : undefined
      }
    >
      <AppTile
        app={app}
        size={52}
        installed={installed === true}
        installedTitle={installed === true ? t("installedBadge") : undefined}
      />
      <div className="min-w-0 flex-1">
        <p className="h-5 truncate text-sm font-semibold">{name}</p>
        <p className="mt-0.5 line-clamp-2 h-8 overflow-hidden text-xs leading-4 opacity-70">
          {desc}
        </p>
        <p className="mt-1 h-4 truncate text-[11px] opacity-60">
          {app.preferredEngine === "Scoop" ? "scoop" : "winget"}
          <span className="opacity-60"> · </span>
          {categoryName(app.category, lang)}
        </p>
      </div>
      <Check checked={selected} onChange={() => toggle(app.id)} />
    </motion.article>
  );
}

export default function Catalog({ onInstall }: { onInstall: () => void }) {
  const lang = useStore((s) => s.lang);
  const t = useT();
  const apps = useStore((s) => s.apps);
  const profiles = useStore((s) => s.profiles);
  const selected = useStore((s) => s.selected);
  const applyProfile = useStore((s) => s.applyProfile);
  const clearSelection = useStore((s) => s.clearSelection);
  const setSearch = useStore((s) => s.setSearch);
  const catalogUpdatedAt = useStore((s) => s.catalogUpdatedAt);

  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  useEffect(() => {
    const id = setTimeout(() => {
      setDq(q);
      setSearch(q);
    }, 250);
    return () => clearTimeout(id);
  }, [q, setSearch]);

  const filtered = useMemo(() => {
    const needle = dq.trim().toLowerCase();
    if (!needle) return apps;
    return apps.filter((a) =>
      [a.nameEn, a.nameRu, a.id, a.wingetId ?? "", a.scoopName ?? ""].some(
        (f) => f.toLowerCase().includes(needle),
      ),
    );
  }, [apps, dq]);

  const selectedCount = Object.keys(selected).length;

  return (
    <div className="space-y-4 pb-8">
      {/* Hero — fixed height, never shifts */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="hero-grad flex h-[188px] shrink-0 items-center gap-4 overflow-hidden rounded-[18px] border border-[var(--border)] p-6"
      >
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[22px] font-semibold tracking-wide">
            {t("heroTitle")}
          </h1>
          <p className="mt-1.5 line-clamp-2 h-10 truncate text-sm opacity-75">
            {t("heroSubtitle")}
          </p>
          <p className="mt-2 flex h-5 items-center gap-1.5 truncate text-sm font-semibold opacity-85">
            <span className="shrink-0">{t("selected")}:</span>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={selectedCount}
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -8, opacity: 0 }}
                transition={{ duration: 0.16 }}
                className="inline-block"
              >
                {selectedCount}
              </motion.span>
            </AnimatePresence>
          </p>
          <p className="h-4 truncate text-xs opacity-60">
            {apps.length} {t("apps")} · {profiles.length} {t("profilesWord")}
            {catalogUpdatedAt !== null &&
              ` · ${t("catalogUpdated")} ${new Date(catalogUpdatedAt * 1000).toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US")}`}
          </p>
        </div>
        <img
          src="/applogo.png"
          alt="WinSetupPro"
          draggable={false}
          className="size-24 shrink-0 rounded-3xl shadow-xl shadow-blue-900/20"
        />
      </motion.section>

      <input
        value={q}
        onChange={(e) => setQ(e.currentTarget.value)}
        placeholder={t("search")}
        className="h-10 w-full border-b border-[var(--border)] bg-transparent px-1 text-sm outline-none transition-colors placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
      />

      {/* Profiles — borderless chips, fixed height */}
      <section className="space-y-2">
        <h3 className="text-[11px] font-bold tracking-[0.09em] whitespace-nowrap text-[var(--muted)] uppercase">
          {t("profile")}
        </h3>
        <div className="flex h-9 items-center gap-2 overflow-x-auto">
          {profiles.map((p) => (
            <button
              key={p.id}
              onClick={() => applyProfile(p.id)}
              className="metal h-8 shrink-0 rounded-lg px-3.5 text-sm whitespace-nowrap transition-all hover:-translate-y-px hover:bg-[var(--hover)] active:translate-y-0"
            >
              {lang === "ru" ? p.nameRu : p.nameEn}
              <span className="opacity-60"> · {p.appIds.length}</span>
            </button>
          ))}
        </div>
        <div className="flex h-9 items-center gap-2">
          <Btn onClick={clearSelection}>{t("clearSelection")}</Btn>
          <Magnetic strength={4}>
            <div className="beam min-w-60">
              <Btn
                variant="brand"
                onClick={onInstall}
                className="metal h-[33px] w-full rounded-[10px] border-0"
              >
                {t("installSelected")}
              </Btn>
            </div>
          </Magnetic>
        </div>
      </section>

      {/* Cards — exactly 320×148, borderless, count adapts */}
      {filtered.length === 0 ? (
        <EmptyState text={t("emptyCatalog")} />
      ) : (
        <div
          key={dq}
          className="grid justify-center gap-4 [grid-template-columns:repeat(auto-fill,320px)]"
        >
          {filtered.map((app, i) => (
            <AppCard key={app.id} app={app} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
