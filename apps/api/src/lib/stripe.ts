import Stripe from "stripe";
import { env } from "../config/env.js";
import { HttpError } from "./errors.js";

let client: Stripe | null = null;

/** Cobro en línea disponible solo si hay llave configurada. */
export const billingEnabled = () => Boolean(env.STRIPE_SECRET_KEY);

export function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) throw new HttpError(503, "El cobro en línea no está configurado", "billing_disabled");
  return (client ??= new Stripe(env.STRIPE_SECRET_KEY));
}
