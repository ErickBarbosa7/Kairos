import { Router } from "express";
import { tenantAuth } from "../../middleware/tenant.js";
import { brandRouter } from "./brand.routes.js";
import { couponsRouter } from "./coupons.routes.js";
import { machinesRouter } from "./machines.routes.js";
import { rewardsRouter } from "./rewards.routes.js";
import { staffRouter } from "./staff.routes.js";
import { storesRouter } from "./stores.routes.js";

/** Rutas del panel del negocio. Todo pasa por `req.db`, limitado al tenant del token. */
export function tenantRouter(opts: { rateLimit: boolean }) {
  const r = Router();
  r.use(...tenantAuth);
  r.use(brandRouter);
  r.use(rewardsRouter);
  r.use(couponsRouter(opts));
  r.use(storesRouter);
  r.use(machinesRouter);
  r.use(staffRouter);
  return r;
}
