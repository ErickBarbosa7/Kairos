import type { Plan } from "@prisma/client";
import type Stripe from "stripe";
import { env } from "../../config/env.js";
import { prisma } from "../../db/prisma.js";
import { HttpError } from "../../lib/errors.js";
import { PLAN_CATALOG, PLAN_CURRENCY } from "../../lib/plans.js";
import { getStripe } from "../../lib/stripe.js";

export type PaidPlan = "BASIC" | "PRO";
const PLAN_NAME: Record<PaidPlan, string> = { BASIC: "Básico", PRO: "Pro" };
/** Días extra tras un cobro fallido mientras Stripe reintenta. */
export const GRACE_DAYS = 3;
const DAY_MS = 86_400_000;

const lookupKey = (plan: PaidPlan) => `kairos_${plan.toLowerCase()}_${PLAN_CURRENCY.toLowerCase()}_monthly`;
const planOfKey = (key: string | null | undefined): PaidPlan | null =>
  (["BASIC", "PRO"] as const).find((p) => lookupKey(p) === key) ?? null;

/** Precio mensual del plan en Stripe; se crea la primera vez y se reutiliza por `lookup_key`. */
async function priceFor(plan: PaidPlan): Promise<string> {
  const stripe = getStripe();
  const found = await stripe.prices.list({ lookup_keys: [lookupKey(plan)], active: true, limit: 1 });
  if (found.data[0]) return found.data[0].id;
  const price = await stripe.prices.create({
    currency: PLAN_CURRENCY.toLowerCase(),
    unit_amount: PLAN_CATALOG[plan].priceMonthly * 100,
    recurring: { interval: "month" },
    lookup_key: lookupKey(plan),
    product_data: { name: `Kairos ${PLAN_NAME[plan]}` },
  });
  return price.id;
}

async function customerFor(tenantId: string, email: string): Promise<string> {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true, stripeCustomerId: true } });
  if (tenant.stripeCustomerId) return tenant.stripeCustomerId;
  const customer = await getStripe().customers.create({ name: tenant.name, email, metadata: { tenantId } });
  await prisma.tenant.update({ where: { id: tenantId }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}

/** Sesión de pago alojada por Stripe. El plan se activa por webhook, no al volver. */
export async function createCheckout(tenantId: string, email: string, plan: PaidPlan): Promise<string> {
  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer: await customerFor(tenantId, email),
    line_items: [{ price: await priceFor(plan), quantity: 1 }],
    subscription_data: { metadata: { tenantId, plan } },
    client_reference_id: tenantId,
    success_url: `${env.ADMIN_URL}/plan?pago=ok`,
    cancel_url: `${env.ADMIN_URL}/plan?pago=cancelado`,
  });
  return session.url!;
}

/** Portal de Stripe: cambiar tarjeta, ver facturas y cancelar. */
export async function createPortal(tenantId: string): Promise<string> {
  const { stripeCustomerId } = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { stripeCustomerId: true } });
  if (!stripeCustomerId) throw new HttpError(409, "Aún no tienes una suscripción de pago", "no_customer");
  const s = await getStripe().billingPortal.sessions.create({ customer: stripeCustomerId, return_url: `${env.ADMIN_URL}/plan` });
  return s.url;
}

/**
 * Refleja una suscripción de Stripe en el negocio. Es la única vía que activa o corta el plan:
 * idempotente (mismo evento dos veces = mismo resultado) y tolerante al desorden de eventos.
 */
export async function syncSubscription(sub: Stripe.Subscription): Promise<void> {
  const item = sub.items.data[0];
  const tenantId = sub.metadata?.tenantId;
  if (!item || !tenantId) return;
  const plan: Plan = planOfKey(item.price.lookup_key) ?? (sub.metadata.plan === "PRO" ? "PRO" : "BASIC");
  const periodEnd = new Date(item.current_period_end * 1000);
  const now = new Date();

  const data: { plan?: Plan; subscriptionEndsAt: Date; stripeSubscriptionId: string; stripeStatus: string; requestedPlan: null; planRequestedAt: null } = {
    subscriptionEndsAt: periodEnd,
    stripeSubscriptionId: sub.id,
    stripeStatus: sub.status,
    requestedPlan: null,
    planRequestedAt: null,
  };
  if (sub.status === "active" || sub.status === "trialing") data.plan = plan;
  else if (sub.status === "past_due" || sub.status === "unpaid") {
    data.plan = plan;
    data.subscriptionEndsAt = new Date(periodEnd.getTime() + GRACE_DAYS * DAY_MS);
  } else {
    // canceled / incomplete_expired: conserva el plan hasta donde ya pagó, nunca más allá de ahora.
    data.subscriptionEndsAt = periodEnd < now ? periodEnd : now;
  }
  await prisma.tenant.updateMany({ where: { id: tenantId }, data });
}
