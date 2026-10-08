import type { Plan } from "@prisma/client";
import { HttpError } from "./errors.js";

/**
 * Catálogo de planes: precio y límites. Es la ÚNICA fuente: la API aplica los límites y la landing
 * y el panel leen estos mismos valores de `GET /public/plans`, así lo que se promete es lo que se cumple.
 */
export const PLAN_CATALOG: Record<Plan, { priceMonthly: number; maxStores: number; maxMachines: number }> = {
  TRIAL: { priceMonthly: 0, maxStores: 1, maxMachines: 1 },
  BASIC: { priceMonthly: 149, maxStores: 2, maxMachines: 2 },
  PRO: { priceMonthly: 499, maxStores: 10, maxMachines: 10 },
};

export const PLAN_CURRENCY = "MXN";
export const PLAN_ORDER: Plan[] = ["TRIAL", "BASIC", "PRO"];

export type LimitedResource = "stores" | "machines";

const NAMES: Record<LimitedResource, { one: string; many: string }> = {
  stores: { one: "sucursal", many: "sucursales" },
  machines: { one: "máquina", many: "máquinas" },
};

export const limitOf = (plan: Plan, resource: LimitedResource) =>
  resource === "stores" ? PLAN_CATALOG[plan].maxStores : PLAN_CATALOG[plan].maxMachines;

/**
 * Lanza 403 `plan_limit` si ya se llegó al tope del plan. Los negocios que ya pasaban el tope
 * (por ejemplo, tras bajar de plan) conservan lo que tienen; solo se les impide crear más.
 */
export function assertWithinPlan(plan: Plan, resource: LimitedResource, current: number) {
  const max = limitOf(plan, resource);
  if (current >= max) {
    const n = NAMES[resource];
    throw new HttpError(
      403,
      `Tu plan permite hasta ${max} ${max === 1 ? n.one : n.many}. Sube de plan en la sección Plan para agregar más`,
      "plan_limit",
    );
  }
}
