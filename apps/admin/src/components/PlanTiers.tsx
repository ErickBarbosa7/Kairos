import { Check, Rocket, Sprout, Store, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { Plan, PlansCatalog } from "../api/types";
import { t } from "../strings";
import { cx } from "./ui";

const ICONS: LucideIcon[] = [Sprout, Store, Rocket];
/** Altura mínima por nivel en escritorio: forma una escalera que sube de Prueba a Pro. */
const STAIR = ["md:min-h-[27rem]", "md:min-h-[29rem]", "md:min-h-[31rem]"];

interface Props {
  /** "dark" para la banda oscura de la landing; "light" para el panel. */
  tone: "dark" | "light";
  /** Plan resaltado: el actual en el panel, o la prueba en la landing. */
  highlight?: Plan;
  /** Texto de la etiqueta del plan resaltado. */
  tag?: string;
  /** Plan que el negocio ya pidió (se marca con una palomita y texto). */
  requested?: Plan | null;
  /** Precios y límites de la API. Sin ellos las tarjetas muestran solo nombre y descripción. */
  catalog?: PlansCatalog;
  /** Lo que lleva usado el negocio; se muestra en el plan resaltado. */
  usage?: { stores: number; machines: number };
  /** Botón u otro contenido al pie de cada plan. */
  action?: (plan: Plan) => ReactNode;
}

/**
 * Los tres planes como una escalera de niveles, con lo que incluyen todos debajo.
 * Los planes hoy se diferencian solo por nombre: no se muestran precios ni límites distintos.
 */
export function PlanTiers({ tone, highlight, tag, requested, catalog, usage, action }: Props) {
  const dark = tone === "dark";
  const { plans, level, includedTitle, included } = t.landing.subs;
  return (
    <div>
      <ul className="grid items-end gap-4 md:grid-cols-3">
        {plans.map((plan, i) => {
          const key = plan.key as Plan;
          const Icon = ICONS[i] ?? Sprout;
          const lit = highlight === key;
          const extra = action?.(key);
          const info = catalog?.plans.find((p) => p.key === key);
          const used = lit ? usage : undefined;
          return (
            <li key={plan.key} className="flex">
              <article
                className={cx(
                  "relative flex w-full flex-col gap-4 rounded-md border-2 p-6 transition-transform duration-100 md:hover:-translate-y-1",
                  STAIR[i],
                  dark ? "text-paper" : "bg-surface text-ink",
                  dark
                    ? lit
                      ? "border-reward bg-paper/15 shadow-[6px_6px_0_0_var(--kairos-reward)]"
                      : "border-paper/40 bg-paper/10"
                    : lit
                      ? "border-primary shadow-[6px_6px_0_0_var(--kairos-primary)]"
                      : "border-line shadow-hard",
                )}
              >
                {lit && tag && (
                  <span
                    className={cx(
                      "absolute -top-3.5 right-4 inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-display text-xs font-black uppercase tracking-wider",
                      dark ? "bg-reward text-night" : "bg-primary text-on-primary",
                    )}
                  >
                    <Check size={13} aria-hidden /> {tag}
                  </span>
                )}
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={cx(
                      "inline-flex size-14 items-center justify-center rounded-md",
                      dark ? "bg-reward text-night" : "bg-primary text-on-primary",
                    )}
                  >
                    <Icon size={30} aria-hidden />
                  </span>
                  <span role="img" aria-label={level(i + 1)} className="mt-1 flex items-end gap-1">
                    {[0, 1, 2].map((n) => (
                      <span
                        key={n}
                        aria-hidden
                        style={{ height: `${10 + n * 8}px` }}
                        className={cx(
                          "w-2.5 rounded-sm",
                          n <= i ? (dark ? "bg-reward" : "bg-primary") : dark ? "bg-paper/25" : "bg-line",
                        )}
                      />
                    ))}
                  </span>
                </div>
                <div className="flex-1">
                  <h3 className="font-display text-4xl font-black uppercase tracking-wide">{plan.name}</h3>
                  <p className={cx("mt-2 leading-relaxed", dark ? "text-paper/80" : "text-ink-2")}>{plan.body}</p>
                </div>
                {info && (
                  <div>
                    <p className="flex items-baseline gap-1.5">
                      <span className="font-display text-5xl font-black leading-none">
                        {info.priceMonthly === 0 ? t.plan.free : t.plan.price(info.priceMonthly)}
                      </span>
                      <span className={cx("text-sm font-semibold", dark ? "text-paper/70" : "text-ink-2")}>
                        {info.priceMonthly === 0 ? t.plan.freeFor(catalog?.trialDays ?? 0) : t.plan.perMonth}
                      </span>
                    </p>
                    <ul className="mt-4 flex flex-col gap-1.5 text-sm font-semibold">
                      {[
                        { text: t.plan.limitStores(info.limits.stores), used: used?.stores },
                        { text: t.plan.limitMachines(info.limits.machines), used: used?.machines },
                      ].map((limit) => (
                        <li key={limit.text} className="flex items-center gap-2">
                          <Check size={15} aria-hidden className={dark ? "text-reward" : "text-primary"} />
                          <span>
                            {limit.text}
                            {limit.used !== undefined && <span className={dark ? "text-paper/70" : "text-ink-2"}> · {t.plan.inUse(limit.used)}</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {requested === key && (
                  <p className="inline-flex items-center gap-1.5 text-sm font-bold">
                    <Check size={16} aria-hidden /> {t.plan.requested}
                  </p>
                )}
                {extra}
              </article>
            </li>
          );
        })}
      </ul>

      {catalog && <p className={cx("mt-4 text-sm", dark ? "text-paper/70" : "text-ink-2")}>{t.plan.pricesNote}</p>}

      <section aria-label={includedTitle} className="mt-8">
        <h3 className={cx("mb-3 text-sm font-bold uppercase tracking-widest", dark ? "text-reward" : "text-primary")}>{includedTitle}</h3>
        <ul className="flex flex-wrap gap-2">
          {included.map((item) => (
            <li
              key={item}
              className={cx(
                "inline-flex items-center gap-1.5 rounded-md border-2 px-3 py-1.5 text-sm font-semibold",
                dark ? "border-paper/40 text-paper" : "border-line bg-surface text-ink",
              )}
            >
              <Check size={15} aria-hidden className={dark ? "text-reward" : "text-primary"} />
              {item}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
