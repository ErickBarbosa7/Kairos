import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Ban, CheckCircle2, Clock, PartyPopper, Search, XCircle } from "lucide-react";
import { type FormEvent, useState } from "react";
import { ApiError } from "../api/client";
import type { Coupon, CouponStatus } from "../api/types";
import { lookupCoupon, useRecentRedeemed, useRedeemCoupon } from "../api/tenantPanel";
import { Button, Card, cx, Field, Input, Spinner } from "../components/ui";
import { t } from "../strings";

const STATUS_UI: Record<CouponStatus, { Icon: typeof Clock; tone: string }> = {
  PENDING: { Icon: Clock, tone: "border-warning/50 bg-warning/10 text-warning" },
  REDEEMED: { Icon: CheckCircle2, tone: "border-success/50 bg-success/10 text-success" },
  EXPIRED: { Icon: XCircle, tone: "border-danger/50 bg-danger/10 text-danger" },
  CANCELLED: { Icon: Ban, tone: "border-line bg-line/40 text-ink-2" },
};

const groups = (c: string) => c.replace(/(.{3})(?=.)/g, "$1 ");
const time = new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit" });

export function CajaPage() {
  const qc = useQueryClient();
  const redeem = useRedeemCoupon();
  const recent = useRecentRedeemed();
  const [code, setCode] = useState("");
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [delivered, setDelivered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setCode("");
    setCoupon(null);
    setDelivered(false);
    setError(null);
  };

  async function find(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setDelivered(false);
    setCoupon(null);
    setBusy(true);
    try {
      setCoupon(await lookupCoupon(code));
    } catch (err) {
      setError(err instanceof ApiError && err.status === 404 ? t.caja.notFound : err instanceof ApiError && err.status === 429 ? err.message : t.errors.generic);
    } finally {
      setBusy(false);
    }
  }

  async function deliver() {
    if (!coupon) return;
    setError(null);
    try {
      setCoupon(await redeem.mutateAsync(coupon.code));
      setDelivered(true);
    } catch (err) {
      // Otro cajero pudo canjearlo primero: se refresca el estado real
      setError(err instanceof ApiError ? err.message : t.errors.generic);
      try {
        setCoupon(await lookupCoupon(coupon.code));
      } catch {
        /* se conserva lo mostrado */
      }
      void qc.invalidateQueries({ queryKey: ["coupons"] });
    }
  }

  const ui = coupon ? STATUS_UI[coupon.status] : null;
  const minutes = coupon ? Math.ceil((new Date(coupon.expiresAt).getTime() - Date.now()) / 60_000) : 0;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <header>
        <h1 className="font-display text-4xl font-extrabold tracking-tight">
          {t.caja.title} <em className="k">{t.caja.titleWord}</em>
        </h1>
        <p className="mt-2 text-ink-2">{t.caja.intro}</p>
      </header>

      <Card className="p-4 sm:p-6">
        <form onSubmit={find} className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <Field floating label={t.caja.code} htmlFor="code">
              <Input
                id="code"
                autoFocus
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                inputMode="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={12}
                className="h-14 text-center font-mono text-2xl font-medium tracking-[0.3em]"
              />
            </Field>
          </div>
          <Button type="submit" variant="primary" disabled={busy || code.replace(/[^A-Z0-9]/gi, "").length < 4} className="h-14 sm:px-6">
            <Search size={18} aria-hidden /> {t.caja.lookup}
          </Button>
        </form>

        {error && (
          <p role="alert" className="mt-4 flex items-center gap-2 rounded-md bg-danger/10 px-3 py-2.5 text-sm font-medium text-danger">
            <AlertCircle size={16} className="shrink-0" aria-hidden /> {error}
          </p>
        )}
      </Card>

      {coupon && ui && (
        <section aria-live="polite" className={cx("rounded-lg border-2 p-4 sm:p-6", delivered ? "border-success/50 bg-success/10" : ui.tone)}>
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
            {delivered ? <PartyPopper size={18} aria-hidden /> : <ui.Icon size={18} aria-hidden />}
            {delivered ? t.caja.delivered : t.caja.status[coupon.status]}
          </div>
          <p className="mt-3 break-words font-display text-3xl font-extrabold leading-tight text-ink sm:text-4xl">{coupon.rewardTitle}</p>
          <p className="mt-1 font-mono text-sm text-ink-2">
            {groups(coupon.code)} · {coupon.pointsCost} {t.rewards.pts}
          </p>
          {!delivered && <p className="mt-3 text-sm text-ink">{t.caja.statusHelp[coupon.status]}</p>}
          {!delivered && coupon.status === "PENDING" && <p className="mt-1 text-sm text-ink-2">{t.caja.expiresIn(minutes)}</p>}

          <div className="mt-6 flex flex-wrap gap-3">
            {coupon.status === "PENDING" && !delivered && (
              <Button variant="primary" onClick={() => void deliver()} disabled={redeem.isPending} className="h-14 flex-1 text-base">
                {redeem.isPending ? <Spinner label="" /> : <CheckCircle2 size={20} aria-hidden />} {t.caja.redeem}
              </Button>
            )}
            <Button onClick={reset} className="h-14">
              {t.caja.another}
            </Button>
          </div>
        </section>
      )}

      <section aria-labelledby="recent">
        <h2 id="recent" className="mb-3 font-display text-lg font-bold">
          {t.caja.recent}
        </h2>
        <Card>
          {recent.isPending ? (
            <div className="p-5">
              <Spinner />
            </div>
          ) : !recent.data?.length ? (
            <p className="p-5 text-sm text-ink-2">{t.caja.noRecent}</p>
          ) : (
            <ul className="divide-y divide-line">
              {recent.data.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{c.rewardTitle}</p>
                    <p className="font-mono text-xs text-ink-2">{groups(c.code)}</p>
                  </div>
                  <div className="min-w-0 max-w-full break-words text-xs text-ink-2 sm:text-right">
                    <p className="tabular-nums">{c.redeemedAt ? time.format(new Date(c.redeemedAt)) : ""}</p>
                    {c.redeemedBy && <p>{t.caja.by(c.redeemedBy)}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
