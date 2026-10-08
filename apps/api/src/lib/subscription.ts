import type { Plan } from "@prisma/client";

const DAY_MS = 86_400_000;

export interface SubscriptionState {
  plan: Plan;
  /** Vencimiento de la prueba o del plan. Null = sin vencimiento. */
  endsAt: Date | null;
  /** Días que quedan (redondeado hacia arriba). Null si no vence. */
  daysLeft: number | null;
  expired: boolean;
  onTrial: boolean;
  /** Plan de pago que el negocio pidió, a la espera de que el Super Admin lo active. */
  requestedPlan: Plan | null;
}

/** Estado de la suscripción de un negocio. Sin fecha de vencimiento nunca vence. */
export function subscriptionState(
  t: { plan: Plan; subscriptionEndsAt: Date | null; requestedPlan: Plan | null },
  now: Date = new Date(),
): SubscriptionState {
  const endsAt = t.subscriptionEndsAt;
  const expired = endsAt !== null && endsAt.getTime() <= now.getTime();
  return {
    plan: t.plan,
    endsAt,
    daysLeft: endsAt === null || expired ? (endsAt === null ? null : 0) : Math.ceil((endsAt.getTime() - now.getTime()) / DAY_MS),
    expired,
    onTrial: t.plan === "TRIAL",
    requestedPlan: t.requestedPlan,
  };
}
