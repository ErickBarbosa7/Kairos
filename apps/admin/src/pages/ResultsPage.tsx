import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import { useRetention, useRoi } from "../api/tenantPanel";
import { Card, Spinner } from "../components/ui";
import { t } from "../strings";

const pct = (n: number | null) => (n === null ? t.results.noData : `${n}%`);
const money = (n: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <p className="text-sm font-semibold text-ink-2">{label}</p>
      <p className="font-display text-4xl font-extrabold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-ink-2">{hint}</p>}
    </Card>
  );
}

/** Barras con CSS: el valor siempre va escrito, el color solo refuerza. */
function Bars({ items, title }: { items: { key: string; label: string; value: number }[]; title: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <Card className="flex flex-col gap-3 p-4">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-ink-2">{t.results.emptyChart}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((i) => (
            <li key={i.key} className="grid grid-cols-[3.5rem_minmax(0,1fr)_6rem] items-center gap-2 text-sm">
              <span className="font-mono text-xs text-ink-2">{i.label}</span>
              <span className="h-3 bg-line" aria-hidden>
                <span className="block h-full bg-primary" style={{ width: `${(i.value / max) * 100}%` }} />
              </span>
              <span className="text-right tabular-nums">{t.results.visitsLabel(i.value)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function RoiCard() {
  const { data, isPending, error } = useRoi();
  if (isPending) return <Spinner />;
  if (error instanceof ApiError && error.code === "plan_limit") {
    return (
      <Card className="flex flex-col gap-2 p-4">
        <h2 className="font-display text-xl font-bold">{t.results.upgradeTitle}</h2>
        <p className="text-sm text-ink-2">{t.results.upgradeBody}</p>
        <Link to="/plan" className="text-sm font-semibold underline">{t.results.upgradeCta}</Link>
      </Card>
    );
  }
  if (!data) return <p className="text-sm text-danger">{t.results.loadError}</p>;
  return (
    <Card className="flex flex-col gap-3 p-4">
      <h2 className="font-display text-xl font-bold">{t.results.roiTitle}</h2>
      <dl className="grid gap-3 sm:grid-cols-3">
        <div><dt className="text-sm text-ink-2">{t.results.cost}</dt><dd className="font-mono text-2xl font-bold tabular-nums">{money(data.programCost)}</dd></div>
        <div><dt className="text-sm text-ink-2">{t.results.revenue}</dt><dd className="font-mono text-2xl font-bold tabular-nums">{data.missing.includes("avgTicket") ? t.results.noData : money(data.attributedRevenue)}</dd></div>
        <div><dt className="text-sm text-ink-2">{t.results.roiValue}</dt><dd className="font-mono text-2xl font-bold tabular-nums">{data.roi === null ? t.results.noData : `${Math.round(data.roi * 100)}%`}</dd></div>
      </dl>
      <ul className="text-sm text-ink-2">
        {data.missing.includes("avgTicket") && <li>{t.results.roiNeedsAvgTicket} <Link to="/economy" className="font-semibold underline">{t.results.fixTicket}</Link></li>}
        {data.missing.includes("unitCost") && <li>{t.results.roiNeedsUnitCost} <Link to="/rewards" className="font-semibold underline">{t.results.fixCost}</Link></li>}
        {data.missing.length === 0 && data.programCost === 0 && <li>{t.results.roiNoCost}</li>}
      </ul>
      <p className="text-xs text-ink-2">{t.results.roiEstimated}</p>
    </Card>
  );
}

export function ResultsPage() {
  const { data, isPending, isError } = useRetention();
  if (isPending) return <Spinner />;
  if (isError || !data) return <p className="text-sm text-danger">{t.results.loadError}</p>;
  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="font-display text-4xl font-extrabold tracking-tight">
          {t.results.title} <em className="k">{t.results.titleWord}</em>
        </h1>
        <p className="mt-2 text-ink-2">{t.results.intro}</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t.results.newCustomers} value={data.newCustomers} />
        <Stat label={t.results.returningCustomers} value={data.returningCustomers} hint={t.results.returningHint} />
        <Stat label={t.results.return7} value={pct(data.return7)} hint={t.results.return7Hint} />
        <Stat label={t.results.return30} value={pct(data.return30)} hint={t.results.return30Hint} />
      </div>
      <RoiCard />
      <div className="grid gap-4 xl:grid-cols-2">
        <Bars title={t.results.visitsByDay} items={data.visitsByDay.map((d) => ({ key: d.date, label: d.date.slice(5), value: d.visits }))} />
        <Bars title={t.results.visitsByHour} items={data.visitsByHour.map((h) => ({ key: String(h.hour), label: `${String(h.hour).padStart(2, "0")}:00`, value: h.visits }))} />
      </div>
    </div>
  );
}
