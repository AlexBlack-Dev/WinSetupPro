import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Minus, Moon, Sun, Monitor, Square, X } from "lucide-react";
import { useStore } from "../store/useStore";
import { useT } from "../i18n/useT";
import type { ReactNode } from "react";

export type Tab = "catalog" | "queue" | "settings" | "installed";

// Raw window-plugin invoke (same proven pattern as Spire: no extra deps).
async function win(cmd: "minimize" | "toggle_maximize" | "close") {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke(`plugin:window|${cmd}`, { label: "main" });
  } catch (e) {
    console.error(`${cmd} failed`, e);
  }
}

export default function TitleBar({ tab, onNav }: { tab: Tab; onNav: (t: Tab) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const t = useT();
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const go = (id: Tab) => {
    onNav(id);
    setMenuOpen(false);
  };

  const themes: { id: string; icon: ReactNode; label: string }[] = [
    { id: "system", icon: <Monitor size={13} />, label: t("themeSystem") },
    { id: "dark", icon: <Moon size={13} />, label: t("themeDark") },
    { id: "light", icon: <Sun size={13} />, label: t("themeLight") },
  ];

  return (
    <div className="relative z-50 flex h-[52px] shrink-0 items-center border-b border-[var(--border)] bg-[var(--card)] select-none">
      {/* LEFT — logo + menu */}
      <div ref={menuRef} className="relative z-[2] shrink-0 px-3.5">
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors"
          style={{ background: menuOpen ? "var(--hover)" : "none" }}
        >
          <span className="relative block size-[26px] shrink-0">
            <span
              className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-11 rounded-full blur-md"
              style={{
                background:
                  "radial-gradient(circle, color-mix(in srgb, var(--accent) 12%, transparent) 0%, transparent 70%)",
              }}
            />
            <img
              src="/logo-transparent.png"
              width={26}
              height={26}
              alt="WinSetupPro"
              draggable={false}
              className="relative block rounded-[5px]"
              style={{
                filter:
                  "drop-shadow(0 0 4px color-mix(in srgb, var(--accent) 20%, transparent))",
              }}
            />
          </span>
          <span className="text-[15px] font-bold tracking-tight">
            WinSetupPro
          </span>
        </motion.button>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.13, ease: [0.16, 1, 0.3, 1] }}
              className="absolute top-[calc(100%+6px)] left-0 z-[100] min-w-56 rounded-xl border border-[var(--border)] bg-[var(--card)] p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.6)]"
            >
              <MenuRow
                label={t("catalog")}
                active={tab === "catalog"}
                onClick={() => go("catalog")}
              />
              <MenuRow
                label={t("queue")}
                active={tab === "queue"}
                onClick={() => go("queue")}
              />
              <MenuRow
                label={t("installed")}
                active={tab === "installed"}
                onClick={() => go("installed")}
              />
              <MenuRow
                label={t("settings")}
                active={tab === "settings"}
                onClick={() => go("settings")}
              />
              <div className="mx-1 my-1 h-px bg-[var(--border)]" />
              {themes.map((th) => (
                <MenuRow
                  key={th.id}
                  label={th.label}
                  icon={th.icon}
                  active={theme === th.id}
                  onClick={() => {
                    setTheme(th.id);
                    setMenuOpen(false);
                  }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* CENTER — drag region */}
      <div data-tauri-drag-region className="z-[1] h-full flex-1 cursor-default" />

      {/* RIGHT — window controls */}
      <div className="z-[2] flex shrink-0 gap-[3px] px-2.5">
        <WinBtn onClick={() => void win("minimize")} label="minimize">
          <Minus size={12} />
        </WinBtn>
        <WinBtn onClick={() => void win("toggle_maximize")} label="maximize">
          <Square size={11} />
        </WinBtn>
        <WinBtn close onClick={() => void win("close")} label="close">
          <X size={12} />
        </WinBtn>
      </div>
    </div>
  );
}

function MenuRow({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon?: ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-[7px] px-2.5 py-[7px] text-left text-[13px] transition-colors"
      style={{
        color: active ? "var(--accent)" : "var(--text)",
        background: "transparent",
        fontWeight: active ? 600 : 400,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--hover)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {active && <span className="size-1.5 rounded-full bg-[var(--accent)]" />}
    </button>
  );
}

function WinBtn({
  children,
  onClick,
  label,
  close,
}: {
  children: ReactNode;
  onClick: () => void;
  label: string;
  close?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      aria-label={label}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="flex size-[34px] shrink-0 cursor-pointer items-center justify-center rounded-[7px] border-none transition-all duration-150"
      style={{
        background: hover
          ? close
            ? "color-mix(in srgb, #f43f5e 18%, transparent)"
            : "var(--hover)"
          : "transparent",
        color: hover
          ? close
            ? "#fb7185"
            : "var(--text)"
          : "var(--muted)",
      }}
    >
      {children}
    </button>
  );
}
