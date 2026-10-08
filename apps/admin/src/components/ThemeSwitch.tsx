import { Moon, Sun } from "lucide-react";
import { useTheme } from "../lib/theme";
import { t } from "../strings";
import { cx } from "./ui";

/** Interruptor claro/oscuro: la perilla se desliza y cambia entre sol y luna. */
export function ThemeSwitch({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={t.common.theme.label}
      title={dark ? t.common.theme.toLight : t.common.theme.toDark}
      onClick={toggle}
      className={cx(
        "relative inline-flex h-11 w-[4.5rem] shrink-0 items-center rounded-md border-2 border-ink bg-surface p-0.5 shadow-hard transition-colors duration-150",
        className,
      )}
    >
      <Sun size={14} aria-hidden className="absolute left-2 text-ink-3" />
      <Moon size={14} aria-hidden className="absolute right-2 text-ink-3" />
      <span
        aria-hidden
        className={cx(
          "relative z-10 inline-flex size-7 items-center justify-center rounded-sm bg-primary text-on-primary transition-transform duration-150",
          dark ? "translate-x-9" : "translate-x-0",
        )}
      >
        {dark ? <Moon size={16} /> : <Sun size={16} />}
      </span>
    </button>
  );
}
