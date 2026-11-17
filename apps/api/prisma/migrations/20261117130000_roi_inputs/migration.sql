-- Datos que el negocio aporta para estimar el ROI del programa (spec retencion-roi).
ALTER TABLE "tenants" ADD COLUMN "avg_ticket" INTEGER;
ALTER TABLE "rewards" ADD COLUMN "unit_cost" INTEGER;
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_avg_ticket_non_negative" CHECK ("avg_ticket" IS NULL OR "avg_ticket" >= 0);
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_unit_cost_non_negative" CHECK ("unit_cost" IS NULL OR "unit_cost" >= 0);
