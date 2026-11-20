import express, { Router } from "express";
import type Stripe from "stripe";
import { env } from "../../config/env.js";
import { getStripe } from "../../lib/stripe.js";
import { syncSubscription } from "./billing.service.js";

/** Webhook de Stripe. Necesita el cuerpo crudo para verificar la firma, por eso se monta antes de `express.json`. */
export const stripeWebhookRouter = Router();

stripeWebhookRouter.post("/stripe", express.raw({ type: "application/json", limit: "1mb" }), async (req, res) => {
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return void res.status(503).json({ error: { code: "billing_disabled", message: "Webhook sin configurar" } });
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(req.body as Buffer, req.header("stripe-signature") ?? "", secret);
  } catch {
    return void res.status(400).json({ error: { code: "bad_signature", message: "Firma inválida" } });
  }
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncSubscription(event.data.object);
      break;
    case "checkout.session.completed": {
      // La suscripción llega también por su propio evento; esto solo cubre que el pago ya esté confirmado al volver.
      const subId = event.data.object.subscription;
      if (typeof subId === "string") await syncSubscription(await getStripe().subscriptions.retrieve(subId));
      break;
    }
  }
  res.json({ received: true });
});
