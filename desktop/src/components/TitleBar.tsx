import { useState } from "react";
import { Minus, Square, X } from "lucide-react";
import type { Tab } from "../types";

export type { Tab };

// Raw window-plugin invoke (same proven pattern as Spire: no extra deps).
async function win(cmd: "minimize" | "toggle_maximize" | "close") {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke(`plugin:window|${cmd}`, { label: "main" });
  } catch (e) {
    console.error(`${cmd} failed`, e);
  }
}

export default function TitleBar() {
  return (
    <div className="relative z-50 flex h-[52px] shrink-0 items-center border-b border-[var(--border)] bg-[var(--card)] select-none">
      {/* LEFT — static logo, no popup */}
      <div className="relative z-[2] flex shrink-0 items-center gap-2.5 px-5">
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

function WinBtn({
  children,
  onClick,
  label,
  close,
}: {
  children: React.ReactNode;
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
