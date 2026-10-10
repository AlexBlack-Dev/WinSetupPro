import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useStore } from "../store/useStore";
import type { Toast } from "../types";

const ICON = {
  ok: <CheckCircle2 size={15} className="text-green-400" />,
  err: <XCircle size={15} className="text-rose-400" />,
  info: <Info size={15} className="text-sky-400" />,
} satisfies Record<Toast["kind"], React.ReactNode>;

export default function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismissToast = useStore((s) => s.dismissToast);
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[200] flex w-80 flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.16 }}
            className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 py-2.5 text-[13px] shadow-[0_12px_40px_rgba(0,0,0,0.55)]"
          >
            {ICON[t.kind]}
            <span className="min-w-0 flex-1 truncate" title={t.text}>
              {t.text}
            </span>
            <button
              onClick={() => dismissToast(t.id)}
              className="opacity-50 transition-opacity hover:opacity-100"
              aria-label="dismiss"
            >
              <X size={13} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
