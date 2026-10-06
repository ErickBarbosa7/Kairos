import { deriveTenantTheme, isHex, type Mode } from "@kairos/design/theme-tenant";
import { Coins, Moon, Sun, TriangleAlert } from "lucide-react";
import { useState } from "react";
import type { ThemeMode } from "../api/types";
import { t } from "../strings";
import { cx } from "./ui";

const SURFACES = {
  light: { bg: "#F8F7FC", surface: "#FFFFFF", line: "#E4E2F0", text: "#14132B", text2: "#4B4A6B" },
  dark: { bg: "#0B0B1A", surface: "#151530", line: "#2A2A4A", text: "#F4F3FF", text2: "#B8B6D6" },
};

export function BrandPreview({ name, primary, themeMode, logoUrl }: { name: string; primary: string; themeMode: ThemeMode; logoUrl?: string | null }) {
  const [manual, setManual] = useState<Mode | null>(null);
  const mode: Mode = manual ?? (themeMode === "DARK" ? "dark" : "light");
  const valid = isHex(primary);
  const theme = deriveTenantTheme(valid ? primary : "#7C3AED", mode);
  const s = SURFACES[mode];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-bold">{t.preview.title}</h3>
        <div role="group" aria-label={t.preview.title} className="flex rounded-md border border-line p-0.5">
          {(["light", "dark"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setManual(m)}
              className={cx(
                "flex min-h-9 items-center gap-1.5 rounded-sm px-3 text-xs font-semibold",
                mode === m ? "bg-primary text-on-primary" : "text-ink-2",
              )}
            >
              {m === "light" ? <Sun size={14} aria-hidden /> : <Moon size={14} aria-hidden />}
              {t.preview[m]}
            </button>
          ))}
        </div>
      </div>

      <div
        className="mx-auto w-full max-w-72 rounded-[28px] border-4 p-4"
        style={{ background: s.bg, color: s.text, borderColor: s.line }}
      >
        <div className="flex items-center gap-2">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="size-7 rounded-md object-contain" />
          ) : (
            <span className="size-7 rounded-md" style={{ background: theme.primary }} aria-hidden />
          )}
          <span className="truncate font-display text-sm font-bold">{name || "Tu negocio"}</span>
        </div>

        <div className="mt-5 rounded-md p-4" style={{ background: s.surface, border: `1px solid ${s.line}` }}>
          <p className="text-xs" style={{ color: s.text2 }}>{t.preview.balance}</p>
          <p className="mt-1 flex items-center gap-2 font-display text-4xl font-extrabold tabular-nums">
            <Coins size={26} style={{ color: "#FBBF24" }} aria-hidden />
            380
            <span className="text-sm font-semibold" style={{ color: s.text2 }}>{t.preview.pts}</span>
          </p>
        </div>

        <div className="mt-3 rounded-md p-4" style={{ background: s.surface, border: `1px solid ${s.line}` }}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{t.preview.reward}</span>
            <span className="font-mono text-xs" style={{ color: s.text2 }}>{t.preview.cost}</span>
          </div>
          <p className="mt-1 text-xs" style={{ color: s.text2 }}>{t.preview.missing}</p>
          <div className="mt-3 h-1.5 rounded-full" style={{ background: theme.primarySubtle }}>
            <div className="h-full w-3/4 rounded-full" style={{ background: theme.primary }} />
          </div>
        </div>

        <button
          type="button"
          tabIndex={-1}
          className="mt-4 min-h-11 w-full rounded-md text-sm font-semibold"
          style={{ background: theme.primary, color: theme.onPrimary }}
        >
          {t.preview.redeem}
        </button>
      </div>

      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-sm border border-line p-2.5">
          <dt className="text-ink-2">{t.preview.contrastText}</dt>
          <dd className="mt-0.5 font-mono text-sm font-medium tabular-nums">{theme.onPrimaryContrast.toFixed(1)}:1</dd>
        </div>
        <div className="rounded-sm border border-line p-2.5">
          <dt className="text-ink-2">{t.preview.contrastBg}</dt>
          <dd className="mt-0.5 font-mono text-sm font-medium tabular-nums">{theme.onBackgroundContrast.toFixed(1)}:1</dd>
        </div>
      </dl>

      {(theme.adjusted || theme.warnings.length > 0) && (
        <ul className="flex flex-col gap-1.5">
          {theme.warnings.map((w) => (
            <li key={w} className="flex items-start gap-2 rounded-sm bg-warning/10 px-3 py-2 text-xs font-medium text-warning">
              <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden /> {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
