import Stripe from "stripe";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { app, loginTenant, makeTenant, prisma, resetDb } from "./helpers.js";

const stripeMock = vi.hoisted(() => ({
  prices: { list: vi.fn(), create: vi.fn() },
  customers: { create: vi.fn() },
  checkout: { sessions: { create: vi.fn() } },
  billingPortal: { sessions: { create: vi.fn() } },
  subscriptions: { retrieve: vi.fn() },
}));
vi.mock("../src/lib/stripe.js", async (orig) => {
  const real = await orig<typeof import("../src/lib/stripe.js")>();
  return { ...real, getStripe: () => ({ ...stripeMock, webhooks: new Stripe("sk_test_dummy").webhooks }) };
});

const SECRET = "whsec_test";
const DAY = 86_400_000;
const sub = (tenantId: string, over: Record<string, unknown> = {}) => ({
  id: "sub_1",
  object: "subscription",
  status: "active",
  metadata: { tenantId, plan: "PRO" },
  items: { data: [{ current_period_end: Math.floor((Date.now() + 30 * DAY) / 1000), price: { lookup_key: "kairos_pro_mxn_monthly" } }] },
  ...over,
});
function send(type: string, object: unknown, secret = SECRET) {
  const payload = JSON.stringify({ id: `evt_${Math.random()}`, object: "event", type, data: { object } });
  const header = new Stripe("sk_test_dummy").webhooks.generateTestHeaderString({ payload, secret });
  return request(app).post("/webhooks/stripe").set("content-type", "application/json").set("stripe-signature", header).send(payload);
}
const tenantOf = (slug: string) => prisma.tenant.findUniqueOrThrow({ where: { slug } });

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

describe("webhook de Stripe", () => {
  it("rechaza una firma inválida", async () => {
    const { tenant: t } = await makeTenant("aurora");
    const res = await send("customer.subscription.created", sub(t.id), "whsec_otro");
    expect(res.status).toBe(400);
    expect((await tenantOf("aurora")).plan).toBe("TRIAL");
  });

  it("activa el plan y la fecha al pagar, y es idempotente", async () => {
    const { tenant: t } = await makeTenant("aurora");
    const s = sub(t.id);
    expect((await send("customer.subscription.created", s)).status).toBe(200);
    expect((await send("customer.subscription.created", s)).status).toBe(200);
    const after = await tenantOf("aurora");
    expect(after).toMatchObject({ plan: "PRO", stripeSubscriptionId: "sub_1", stripeStatus: "active", requestedPlan: null });
    expect((after.subscriptionEndsAt!.getTime() - Date.now()) / DAY).toBeGreaterThan(29);
  });

  it("con pago fallido da 3 días de gracia sobre el fin del periodo", async () => {
    const { tenant: t } = await makeTenant("aurora");
    const end = Math.floor((Date.now() - DAY) / 1000);
    await send("customer.subscription.updated", sub(t.id, { status: "past_due", items: { data: [{ current_period_end: end, price: { lookup_key: "kairos_basic_mxn_monthly" } }] } }));
    const after = await tenantOf("aurora");
    expect(after.plan).toBe("BASIC");
    expect(after.subscriptionEndsAt!.getTime()).toBe(end * 1000 + 3 * DAY);
  });

  it("al cancelar corta el acceso sin pasar del periodo ya pagado", async () => {
    const { tenant: t } = await makeTenant("aurora");
    await send("customer.subscription.created", sub(t.id));
    await send("customer.subscription.deleted", sub(t.id, { status: "canceled" }));
    const after = await tenantOf("aurora");
    expect(after.stripeStatus).toBe("canceled");
    expect(after.subscriptionEndsAt!.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("ignora suscripciones sin negocio conocido", async () => {
    const res = await send("customer.subscription.created", sub("00000000-0000-0000-0000-000000000000"));
    expect(res.status).toBe(200);
  });
});

describe("pago de plan", () => {
  it("crea el cliente y la sesión de Checkout con el precio del plan", async () => {
    await makeTenant("aurora");
    const login = await loginTenant("aurora");
    stripeMock.prices.list.mockResolvedValue({ data: [] });
    stripeMock.prices.create.mockResolvedValue({ id: "price_pro" });
    stripeMock.customers.create.mockResolvedValue({ id: "cus_1" });
    stripeMock.checkout.sessions.create.mockResolvedValue({ url: "https://checkout.stripe.test/s" });

    const res = await request(app).post("/tenant/subscription/checkout").set("Authorization", `Bearer ${login.token}`).send({ plan: "PRO" });
    expect(res.status).toBe(201);
    expect(res.body.url).toBe("https://checkout.stripe.test/s");
    expect(stripeMock.prices.create).toHaveBeenCalledWith(expect.objectContaining({ currency: "mxn", unit_amount: 49900, lookup_key: "kairos_pro_mxn_monthly" }));
    expect(stripeMock.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({ mode: "subscription", customer: "cus_1" }));
    expect((await tenantOf("aurora")).stripeCustomerId).toBe("cus_1");
  });

  it("no acepta TRIAL ni planes inventados", async () => {
    await makeTenant("aurora");
    const login = await loginTenant("aurora");
    const res = await request(app).post("/tenant/subscription/checkout").set("Authorization", `Bearer ${login.token}`).send({ plan: "TRIAL" });
    expect(res.status).toBe(400);
  });

  it("el portal exige haber pagado antes", async () => {
    await makeTenant("aurora");
    const login = await loginTenant("aurora");
    const res = await request(app).post("/tenant/subscription/portal").set("Authorization", `Bearer ${login.token}`);
    expect(res.status).toBe(409);
  });
});
