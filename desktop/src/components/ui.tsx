import type { ButtonHTMLAttributes, ReactNode } from "react";
import { AnimatePresence, motion, useMotionValue, useSpring } from "framer-motion";
import { Check as CheckIcon } from "lucide-react";
import { iconDataUri, letters, tileGradient } from "../lib/tiles";
import type { CatalogApp } from "../lib/api";
import { cn } from "../lib/cn";

/**
 * Flat premium controls: fixed heights, no box containers on secondary actions,
 * metallic sheen on primary/chips. Sizes never change (no layout shift).
 */
export function Btn({
  variant = "ghost",
  className,
  ...props
}: {
  variant?: "brand" | "ghost" | "danger";
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-0 text-sm font-semibold transition-all duration-150",
        "disabled:pointer-events-none disabled:opacity-40",
        "active:scale-[0.98]",
        variant === "brand" &&
          "metal text-white shadow-lg shadow-blue-900/30 hover:-translate-y-px hover:shadow-blue-900/50 brand-btn",
        variant === "ghost" && "text-[var(--text)] hover:bg-[var(--hover)]",
        variant === "danger" && "text-red-400 hover:bg-red-500/10",
        className,
      )}
    />
  );
}

/** Uppercase micro-label, Spire-style section header (no container). */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[11px] font-bold tracking-[0.09em] whitespace-nowrap text-[var(--muted)] uppercase">
      {children}
    </h3>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="truncate text-[22px] font-semibold tracking-wide">
      {children}
    </h2>
  );
}

export function Progress({ value, live }: { value: number; live?: boolean }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/15 dark:bg-white/10">
      <div
        className={cn(
          "brand-grad h-full rounded-full transition-[width] duration-300",
          live && "progress-live",
        )}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

/** Magnetic hover: element leans toward the cursor (v0-style micro-interaction). */
export function Magnetic({
  children,
  strength = 5,
  className,
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 15, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 220, damping: 15, mass: 0.4 });
  return (
    <motion.div
      style={{ x: sx, y: sy }}
      className={cn("inline-block", className)}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        x.set(((e.clientX - r.left) / r.width - 0.5) * 2 * strength);
        y.set(((e.clientY - r.top) / r.height - 0.5) * 2 * strength);
      }}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}

/** Custom checkbox: accent fill + spring checkmark draw. Fixed 20px. */
export function Check({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className="flex size-5 shrink-0 items-center justify-center rounded-[7px] transition-all duration-200 hover:scale-110 active:scale-90"
      style={
        checked
          ? {
              background: "var(--accent)",
              boxShadow:
                "0 2px 14px color-mix(in srgb, var(--accent) 60%, transparent)",
            }
          : {
              border: "1.5px solid var(--check-border)",
              background: "transparent",
            }
      }
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {checked && (
          <motion.svg
            key="tick"
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={{ type: "spring", stiffness: 600, damping: 28 }}
          >
            <motion.path
              d="M3.5 8.5l3 3 6-7"
              stroke="white"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            />
          </motion.svg>
        )}
      </AnimatePresence>
    </button>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="block h-5 truncate text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}

export function SelectNative({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      className="h-10 w-full max-w-56 truncate border-b border-[var(--border)] bg-transparent px-1 text-sm text-[var(--text)] outline-none transition-colors focus:border-[var(--accent)]"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      placeholder={placeholder}
      className="h-10 w-full border-b border-[var(--border)] bg-transparent px-1 text-sm text-[var(--text)] outline-none transition-colors placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
    />
  );
}

/** App tile: real brand icon (SVG or PNG), gradient-letter fallback. */
export function AppTile({
  app,
  size = 52,
  installed = false,
  installedTitle,
}: {
  app: CatalogApp;
  size?: number;
  installed?: boolean;
  installedTitle?: string;
}) {
  const src = app.icon_svg
    ? iconDataUri(app.icon_svg)
    : app.icon_png
      ? `data:image/png;base64,${app.icon_png}`
      : null;
  const fallback = letters(app.nameEn);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="flex items-center justify-center overflow-hidden rounded-[14px] bg-[#F1F5F9]"
        style={
          src
            ? { width: size, height: size }
            : {
                width: size,
                height: size,
                background: tileGradient(app.category),
              }
        }
      >
        {src ? (
          <img
            src={src}
            alt=""
            draggable={false}
            style={{ width: size * 0.7, height: size * 0.7 }}
          />
        ) : (
          <span
            className="font-bold text-white select-none"
            style={{ fontSize: size * 0.34 }}
          >
            {fallback}
          </span>
        )}
      </div>
      <AnimatePresence>
        {installed && (
          <motion.span
            key="installed"
            title={installedTitle}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 550, damping: 22 }}
            className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full bg-green-500 text-white shadow-lg"
          >
            <CheckIcon size={12} strokeWidth={3.2} />
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

const DOT: Record<string, string> = {
  queued: "bg-neutral-400",
  running: "bg-blue-500 animate-pulse",
  succeeded: "bg-green-500",
  failed: "bg-red-500",
  skipped: "bg-amber-500",
  cancelled: "bg-neutral-500",
};

export function StatusPill({ status, text }: { status: string; text: string }) {
  return (
    <span className="inline-flex h-5 items-center gap-1.5 truncate text-[13px] text-[var(--muted)]">
      <span className={`size-2 shrink-0 rounded-full ${DOT[status] ?? DOT.queued}`} />
      <span className="truncate">{text}</span>
    </span>
  );
}

export function InfoBar({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-12 flex-wrap items-center gap-3 rounded-xl bg-amber-500/[0.07] px-4 py-2.5 text-sm">
      <span className="min-w-0 flex-1">{children}</span>
      {action}
    </div>
  );
}

export function EmptyState({
  text,
  action,
}: {
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-4 py-10 text-center">
      <p className="max-w-md truncate text-sm opacity-60">{text}</p>
      {action}
    </div>
  );
}
