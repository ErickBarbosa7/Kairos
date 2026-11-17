-- Campañas, aceptación de términos y resumen semanal (spec retencion-roi).
CREATE TYPE "CampaignType" AS ENUM ('MULTIPLIER', 'FIRST_VISIT_BONUS', 'COMEBACK_UNLOCK');

CREATE TABLE "campaigns" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CampaignType" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "multiplier_pct" INTEGER,
    "bonus_points" INTEGER,
    "unlock_hours" INTEGER,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "weekdays" INTEGER[],
    "start_hour" INTEGER,
    "end_hour" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "campaigns_tenant_id_is_active_idx" ON "campaigns"("tenant_id", "is_active");
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "campaigns"
  ADD CONSTRAINT "campaigns_multiplier_range" CHECK ("multiplier_pct" IS NULL OR ("multiplier_pct" BETWEEN 101 AND 500)),
  ADD CONSTRAINT "campaigns_bonus_range" CHECK ("bonus_points" IS NULL OR ("bonus_points" BETWEEN 1 AND 100000)),
  ADD CONSTRAINT "campaigns_unlock_range" CHECK ("unlock_hours" IS NULL OR ("unlock_hours" BETWEEN 0 AND 720)),
  ADD CONSTRAINT "campaigns_hours_range" CHECK (("start_hour" IS NULL AND "end_hour" IS NULL) OR ("start_hour" BETWEEN 0 AND 23 AND "end_hour" BETWEEN 1 AND 24 AND "start_hour" < "end_hour")),
  ADD CONSTRAINT "campaigns_period_order" CHECK ("starts_at" IS NULL OR "ends_at" IS NULL OR "starts_at" < "ends_at"),
  ADD CONSTRAINT "campaigns_type_fields" CHECK (
    ("type" = 'MULTIPLIER' AND "multiplier_pct" IS NOT NULL) OR
    ("type" = 'FIRST_VISIT_BONUS' AND "bonus_points" IS NOT NULL) OR
    ("type" = 'COMEBACK_UNLOCK' AND "unlock_hours" IS NOT NULL));

CREATE TABLE "terms_acceptances" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "version" TEXT NOT NULL,
    "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    CONSTRAINT "terms_acceptances_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "terms_acceptances_tenant_id_idx" ON "terms_acceptances"("tenant_id");
ALTER TABLE "terms_acceptances" ADD CONSTRAINT "terms_acceptances_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "weekly_reports" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "week_start" DATE NOT NULL,
    "headline" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "metrics" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "weekly_reports_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "weekly_reports_tenant_id_week_start_key" ON "weekly_reports"("tenant_id", "week_start");
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
