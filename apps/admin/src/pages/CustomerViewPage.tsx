import type { Mode } from "@kairos/design/theme-tenant";
import { Flame, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useBrand, useCampaigns, useEconomy, useRewards } from "../api/tenantPanel";
import { CustomerPreview } from "../components/CustomerPreview";
import { HelpHint } from "../components/HelpHint";
import { Card, cx, Field, Spinner } from "../components/ui";
import { isRunningNow } from "../lib/campaigns";
import { t } from "../strings";

export function CustomerViewPage() {
  const brand = useBrand();
  const rewards = useRewards();
  const economy = useEconomy();
  const campaigns = useCampaigns();
  const [balance, setBalance] = useState(120);
  const [mode, setMode] = useState<Mode | null>(null);

  if (brand.isPending || rewards.isPending || economy.isPending || campaigns.isPending) return <Spinner />;
  if (!brand.data || !rewards.data || !economy.data || !campaigns.data) return <p className="text-sm text-danger">{t.errors.generic}</p>;

  const active = campaigns.data.data.filter((c) => c.isActive);
  const running = active.filter((c) => isRunningNow(c));
  const visible = rewards.data.filter((r) => r.isActive && r.stock !== 0);
  const cheapest = visible.length ? Math.min(...visible.map((r) => r.pointsCost)) : null;
  const top = Math.max(100, ...visible.map((r) => r.pointsCost)) + 50;
  const shown: Mode = mode ?? (brand.data.themeMode === "DARK" ? "dark" : "light");
  const perGame = economy.data.maxPointsPerGame;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="font-display text-4xl font-extrabold tracking-tight">
          {t.customerView.title} <em className="k">{t.customerView.titleWord}</em> <HelpHint topic="customerView" />
        </h1>
        <p className="mt-2 max-w-2xl text-ink-2">{t.customerView.intro}</p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[22rem_1fr]">
        <CustomerPreview brand={brand.data} rewards={rewards.data} balance={balance} mode={shown} campaigns={running.map((c) => c.name)} />

        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-5 p-5">
            <Field label={t.customerView.balance(balance)} htmlFor="cv-balance">
              <input id="cv-balance" type="range" min={0} max={top} step={10} value={balance} onChange={(e) => setBalance(Number(e.target.value))} className="w-full accent-primary" />
            </Field>
            <div role="group" aria-label={t.customerView.theme} className="flex w-fit rounded-md border border-line p-0.5">
              {(["light", "dark"] as const).map((m) => (
                <button key={m} type="button" aria-pressed={shown === m} onClick={() => setMode(m)} className={cx("flex min-h-11 items-center gap-1.5 rounded-sm px-3 text-xs font-semibold", shown === m ? "bg-primary text-on-primary" : "text-ink-2")}>
                  {m === "light" ? <Sun size={14} aria-hidden /> : <Moon size={14} aria-hidden />} {t.preview[m]}
                </button>
              ))}
            </div>
          </Card>

          <Card className="flex flex-col gap-3 p-5">
            <h2 className="font-display text-xl font-bold">{t.customerView.rulesTitle}</h2>
            <ul className="flex flex-col gap-2 text-sm">
              <li>{t.customerView.perGame(perGame, economy.data.maxGamesPerDay)}</li>
              <li>{cheapest === null ? t.customerView.noPrizes : t.customerView.games(Math.ceil(cheapest / Math.max(1, perGame)))}</li>
              <li>{t.customerView.visiblePrizes(visible.length, rewards.data.length)}</li>
            </ul>
            <p className="text-xs text-ink-2">
              <Link to="/rewards" className="underline">{t.nav.rewards}</Link> · <Link to="/economy" className="underline">{t.nav.economy}</Link> · <Link to="/brand" className="underline">{t.nav.brand}</Link>
            </p>
          </Card>

          <Card className="flex flex-col gap-3 p-5">
            <h2 className="font-display text-xl font-bold">{t.customerView.campaignsTitle}</h2>
            {active.length === 0 ? (
              <p className="text-sm text-ink-2">{t.customerView.noCampaigns}</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {active.map((c) => {
                  const on = running.some((r) => r.id === c.id);
                  return (
                    <li key={c.id} className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2"><Flame size={14} aria-hidden /> <span className="truncate">{c.name}</span></span>
                      <span className={cx("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold", on ? "bg-success/10 text-success" : "bg-line/60 text-ink-2")}>
                        {on ? t.customerView.runningNow : t.customerView.outOfSchedule}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="text-xs text-ink-2">{t.customerView.sampleNote}</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
