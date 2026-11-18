import { deriveTenantTheme, isHex, type Mode } from "@kairos/design/theme-tenant";
import { Coins, Flame, Gift, House } from "lucide-react";
import { useState } from "react";
import type { Reward, TenantBrand } from "../api/types";
import { t } from "../strings";
import { SURFACES } from "./BrandPreview";
import { cx } from "./ui";

interface Props {
  brand: TenantBrand;
  rewards: Reward[];
  balance: number;
  mode: Mode;
  /** Nombres de las campañas que aplican ahora. */
  campaigns: string[];
}

/** Marco de teléfono que imita la Wallet con los datos reales del negocio y un saldo de ejemplo. */
export function CustomerPreview({ brand, rewards, balance, mode, campaigns }: Props) {
  const [tab, setTab] = useState<"home" | "prizes">("home");
  const s = SURFACES[mode];
  const theme = deriveTenantTheme(isHex(brand.primaryColor) ? brand.primaryColor : "#7C3AED", mode);
  const list = rewards.filter((r) => r.isActive).sort((a, b) => a.pointsCost - b.pointsCost);
  const buyable = list.filter((r) => r.stock !== 0);
  const next = buyable.find((r) => r.pointsCost > balance);
  const affordable = buyable.filter((r) => r.pointsCost <= balance).length;
  const card = { background: s.surface, border: `1px solid ${s.line}` };

  return (
    <div className="mx-auto w-full max-w-80 overflow-hidden rounded-[32px] border-4" style={{ background: s.bg, color: s.text, borderColor: s.line }}>
      <div className="flex min-h-[30rem] flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          {brand.logoUrl ? (
            <img src={brand.logoUrl} alt="" className="size-8 rounded-md object-contain" />
          ) : (
            <span className="size-8 rounded-md" style={{ background: theme.primary }} aria-hidden />
          )}
          <span className="truncate font-display text-base font-bold">{brand.name}</span>
        </div>

        {tab === "home" ? (
          <>
            <div className="rounded-lg p-4" style={{ background: theme.primary, color: theme.onPrimary }}>
              <p className="flex items-end gap-2 font-display text-5xl font-extrabold tabular-nums leading-none">
                {balance} <span className="pb-1 text-base font-semibold">{t.preview.pts}</span>
              </p>
              {next ? (
                <div className="mt-4">
                  <p className="text-xs font-semibold">{t.customerView.missing(next.pointsCost - balance, next.title)}</p>
                  <div className="mt-1.5 h-1.5 rounded-full" style={{ background: theme.onPrimary, opacity: 0.3 }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.round((balance / next.pointsCost) * 100)}%`, background: theme.onPrimary, opacity: 1 }} />
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-xs font-semibold">{buyable.length ? t.customerView.allReached : t.preview.noRewards}</p>
              )}
              {affordable > 0 && <p className="mt-3 text-xs font-semibold">{t.customerView.canRedeem(affordable)}</p>}
            </div>
            {campaigns.map((c) => (
              <p key={c} className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold" style={{ background: theme.primarySubtle, color: s.text }}>
                <Flame size={14} style={{ color: theme.primary }} aria-hidden /> {c}
              </p>
            ))}
          </>
        ) : list.length === 0 ? (
          <p className="text-xs" style={{ color: s.text2 }}>{t.preview.noRewards}</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {list.map((r) => {
              const soldOut = r.stock === 0;
              const missing = r.pointsCost - balance;
              return (
                <li key={r.id} className="rounded-md p-3" style={{ ...card, opacity: soldOut ? 0.6 : 1 }}>
                  <div className="flex items-center gap-3">
                    <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-sm" style={{ background: theme.primarySubtle }}>
                      {r.imageUrl ? <img src={r.imageUrl} alt="" className="size-full object-cover" /> : <Gift size={20} style={{ color: theme.primary }} aria-hidden />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-sm font-semibold">{r.title}</span>
                      <span className="block text-xs" style={{ color: s.text2 }}>
                        {r.pointsCost} {t.preview.pts} · {soldOut ? t.rewards.soldOut : missing > 0 ? t.preview.missingN(missing) : t.preview.canRedeem}
                      </span>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <nav aria-label={t.customerView.screens} className="mt-auto flex gap-2 pt-2">
          {([["home", House, t.customerView.tabHome], ["prizes", Coins, t.customerView.tabPrizes]] as const).map(([k, Icon, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={tab === k}
              onClick={() => setTab(k)}
              className={cx("flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-md text-xs font-semibold")}
              style={tab === k ? { background: theme.primary, color: theme.onPrimary } : { ...card, color: s.text2 }}
            >
              <Icon size={14} aria-hidden /> {label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
