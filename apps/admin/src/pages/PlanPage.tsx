import { Check, Lock } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../api/auth";
import { api, ApiError } from "../api/client";
import { usePlans, useSubscriptionDetail } from "../api/plans";
import type { Plan } from "../api/types";
import { useToast } from "../components/Toast";
import { PlanTiers } from "../components/PlanTiers";
import { Button } from "../components/ui";
import { formatDate } from "../lib/format";
import { t } from "../strings";

const PAID: Plan[] = ["BASIC", "PRO"];

/** Elegir plan al terminar la prueba. Todavía no hay cobro en línea: se pide y el Super Admin lo activa. */
export function PlanPage() {
  const { user, refreshMe } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const { data: catalog } = usePlans();
  const { data: detail } = useSubscriptionDetail();
  const [busy, setBusy] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Al entrar se vuelve a leer el estado: si ya activaron el plan, se nota sin volver a iniciar sesión.
  useEffect(() => {
    void refreshMe().catch(() => undefined);
  }, [refreshMe]);

  if (!user || !("subscription" in user)) return null;
  const sub = user.subscription;
  const isAdmin = user.role === "tenant_admin";

  async function request(plan: Plan) {
    if (busy) return;
    setBusy(plan);
    setError(null);
    try {
      await api("/tenant/subscription/request", { method: "POST", body: { plan } });
      await refreshMe();
      void qc.invalidateQueries({ queryKey: ["subscription"] });
      toast(t.plan.sent);
    } catch (err) {
      setError(err instanceof ApiError && err.status !== 0 ? t.plan.error : t.login.networkError);
    } finally {
      setBusy(null);
    }
  }

  const status = sub.expired
    ? null
    : sub.onTrial
      ? sub.daysLeft !== null
        ? t.plan.trialLeft(sub.daysLeft)
        : null
      : sub.endsAt
        ? t.plan.activeUntil(t.plan.plans[sub.plan], formatDate(sub.endsAt))
        : t.plan.activeNoEnd(t.plan.plans[sub.plan]);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="font-display text-4xl font-extrabold tracking-tight">
          {t.plan.title} <em className="k">{t.plan.titleWord}</em>
        </h1>
        {status && <p className="mt-2 text-ink-2">{status}</p>}
      </header>

      {sub.expired && (
        <div role="status" className="flex items-start gap-3 rounded-md border-2 border-danger bg-danger/10 p-4">
          <Lock size={22} aria-hidden className="mt-0.5 shrink-0 text-danger" />
          <div>
            <p className="font-display text-xl font-bold text-danger">{t.plan.expiredTitle}</p>
            <p className="mt-1 text-sm text-ink-2">{t.plan.expiredBody}</p>
          </div>
        </div>
      )}

      {sub.requestedPlan && (
        <p role="status" className="flex items-start gap-2 rounded-md border-2 border-success bg-success/10 p-4 text-sm font-medium">
          <Check size={18} aria-hidden className="mt-0.5 shrink-0 text-success" />
          {t.plan.requestedNote}
        </p>
      )}

      {!isAdmin && <p className="rounded-md border-2 border-line bg-surface p-4 text-sm text-ink-2">{t.plan.staffNote}</p>}

      <PlanTiers
        tone="light"
        highlight={sub.plan}
        tag={sub.expired ? t.plan.expiredTitle : t.plan.current}
        catalog={catalog}
        usage={detail?.usage}
        action={(key) =>
          isAdmin && PAID.includes(key) ? (
            <Button
              variant={sub.requestedPlan === key ? undefined : "primary"}
              disabled={busy !== null || sub.requestedPlan === key}
              aria-pressed={sub.requestedPlan === key}
              onClick={() => void request(key)}
            >
              {sub.requestedPlan === key ? (
                <>
                  <Check size={16} aria-hidden /> {t.plan.requested}
                </>
              ) : (
                t.plan.request
              )}
            </Button>
          ) : null
        }
      />

      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <p className="text-sm text-ink-2">{t.plan.payNote}</p>

      {!sub.expired && (
        <div>
          <Link to="/" className="inline-flex min-h-11 items-center rounded-md border-2 border-ink px-4 font-semibold hover:bg-ink hover:text-canvas">
            {t.plan.goPanel}
          </Link>
        </div>
      )}
    </div>
  );
}
