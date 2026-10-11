import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LayoutGrid, ListOrdered, Settings as SettingsIcon, HardDriveDownload, Gauge } from "lucide-react";
import { useStore } from "./store/useStore";
import { applyTheme } from "./store/helpers";
import { useT } from "./i18n/useT";
import { api } from "./lib/api";
import type { Tab } from "./types";
import TitleBar from "./components/TitleBar";
import Toasts from "./components/Toasts";
import Catalog from "./views/Catalog";
import Queue from "./views/Queue";
import Settings from "./views/Settings";
import Installed from "./views/Installed";
import Optimize from "./views/Optimize";

export default function App() {
  const booted = useStore((s) => s.booted);
  const boot = useStore((s) => s.boot);
  const theme = useStore((s) => s.theme);
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const selectedCount = useStore((s) => Object.keys(s.selected).length);
  const scanTotal = useStore((s) => s.scan?.total ?? 0);
  const syncQueue = useStore((s) => s.syncQueue);
  const handleEvent = useStore((s) => s.handleEvent);
  const t = useT();
  const bootedOnce = useRef(false);
  useEffect(() => {
    if (bootedOnce.current) return;
    bootedOnce.current = true;
    void boot();
    let unlisten: (() => void) | undefined;
    void api.onInstallEvent(handleEvent).then((u) => (unlisten = u));
    return () => unlisten?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    applyTheme(theme);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme(useStore.getState().theme);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  if (!booted) {
    return (
      <div className="flex h-full flex-col bg-[#101214]">
        <div className="h-[52px] shrink-0" data-tauri-drag-region />
        <div className="flex flex-1 items-center justify-center">
          <motion.img
            src="/logo-transparent.png"
            alt="WinSetupPro"
            className="size-20"
            draggable={false}
            animate={{ opacity: [0.4, 1, 0.4], scale: [0.96, 1, 0.96] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </div>
    );
  }

  const nav: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "catalog", label: t("catalog"), icon: <LayoutGrid size={16} /> },
    {
      id: "queue",
      label: t("queue"),
      icon: <ListOrdered size={16} />,
      badge: selectedCount,
    },
    {
      id: "installed",
      label: t("installed"),
      icon: <HardDriveDownload size={16} />,
      badge: scanTotal > 0 ? scanTotal : undefined,
    },
    { id: "optimize", label: t("optimize"), icon: <Gauge size={16} /> },
  ];

  return (
    <div className="flex h-full flex-col bg-[var(--bg)] text-[var(--text)]">
      <div className="aurora" aria-hidden="true">
        <span className="a1" />
        <span className="a2" />
        <span className="a3" />
      </div>
      <TitleBar />
      <div className="relative z-[1] flex min-h-0 flex-1">
        {/* Sidebar */}
        <aside className="relative flex w-60 shrink-0 flex-col gap-1 border-r border-[var(--border)] bg-[var(--card)] p-4">
          {nav.map((n) => (
            <button
              key={n.id}
              onClick={() => setTab(n.id)}
              className={`flex h-9 items-center gap-2.5 rounded-lg px-3 text-left text-sm transition-colors ${
                tab === n.id
                  ? "bg-[var(--hover)] font-medium shadow-[inset_2px_0_0_var(--accent)]"
                  : "opacity-80 hover:bg-[var(--hover)] hover:opacity-100"
              }`}
            >
              <span className="opacity-75">{n.icon}</span>
              <span className="flex-1">{n.label}</span>
              {n.badge != null && n.badge > 0 && (
                <span className="brand-grad rounded-[10px] px-2 py-0.5 text-xs font-semibold text-white">
                  {n.badge}
                </span>
              )}
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={() => setTab("settings")}
            className={`flex h-9 items-center gap-2.5 rounded-lg px-3 text-left text-sm transition-colors ${
              tab === "settings"
                ? "bg-[var(--hover)] font-medium shadow-[inset_2px_0_0_var(--accent)]"
                : "opacity-80 hover:bg-[var(--hover)] hover:opacity-100"
            }`}
          >
            <span className="opacity-75">
              <SettingsIcon size={16} />
            </span>
            {t("settings")}
          </button>
        </aside>

        {/* Content */}
        <main className="min-w-0 flex-1 overflow-y-auto px-6 pb-6 pt-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="mx-auto h-full max-w-[1200px]"
            >
              {tab === "catalog" && (
              <Catalog
                onInstall={() => {
                  syncQueue(true);
                  setTab("queue");
                }}
              />
              )}
              {tab === "queue" && <Queue onBack={() => setTab("catalog")} />}
              {tab === "installed" && <Installed />}
              {tab === "optimize" && <Optimize />}
              {tab === "settings" && <Settings />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <Toasts />
    </div>
  );
}
