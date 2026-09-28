-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('TRIAL', 'BASIC', 'PRO');

-- CreateEnum
CREATE TYPE "ThemeMode" AS ENUM ('LIGHT', 'DARK', 'AUTO');

-- CreateEnum
CREATE TYPE "TenantRole" AS ENUM ('TENANT_ADMIN', 'TENANT_STAFF');

-- CreateEnum
CREATE TYPE "MachineStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "KeyAlgorithm" AS ENUM ('ES256', 'EDDSA');

-- CreateEnum
CREATE TYPE "TxType" AS ENUM ('EARN', 'REDEEM', 'REFUND', 'ADJUST');

-- CreateEnum
CREATE TYPE "CouponStatus" AS ENUM ('PENDING', 'REDEEMED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubjectType" AS ENUM ('SUPER_ADMIN', 'TENANT_USER', 'CONSUMER');

-- CreateTable
CREATE TABLE "super_admins" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "super_admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "plan" "Plan" NOT NULL DEFAULT 'TRIAL',
    "subscription_ends_at" TIMESTAMP(3),
    "logo_url" TEXT,
    "primary_color" TEXT NOT NULL DEFAULT '#7C3AED',
    "secondary_color" TEXT,
    "theme_mode" "ThemeMode" NOT NULL DEFAULT 'AUTO',
    "score_per_point" INTEGER NOT NULL DEFAULT 10,
    "max_points_per_game" INTEGER NOT NULL DEFAULT 50,
    "max_games_per_day" INTEGER NOT NULL DEFAULT 10,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stores" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "public_key" TEXT NOT NULL,
    "key_algorithm" "KeyAlgorithm" NOT NULL DEFAULT 'ES256',
    "status" "MachineStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_seen_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "machines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_users" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "store_id" UUID,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "TenantRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumers" (
    "id" UUID NOT NULL,
    "phone" TEXT,
    "phone_verified_at" TIMESTAMP(3),
    "email" TEXT,
    "email_verified_at" TIMESTAMP(3),
    "display_name" TEXT,
    "preferred_theme" "ThemeMode",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "consumers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "subject_type" "SubjectType" NOT NULL,
    "subject_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "family_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "consumer_id" UUID NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "lifetime_earned" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rewards" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "points_cost" INTEGER NOT NULL,
    "stock" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qr_claims" (
    "id" UUID NOT NULL,
    "jti" TEXT NOT NULL,
    "tenant_id" UUID NOT NULL,
    "machine_id" UUID NOT NULL,
    "consumer_id" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "points_awarded" INTEGER NOT NULL,
    "qr_issued_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qr_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "point_transactions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "type" "TxType" NOT NULL,
    "points" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "qr_claim_id" UUID,
    "coupon_id" UUID,
    "note" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "point_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "reward_id" UUID NOT NULL,
    "reward_title" TEXT NOT NULL,
    "points_cost" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "status" "CouponStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "redeemed_at" TIMESTAMP(3),
    "redeemed_by_id" UUID,
    "redeemed_store_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "actor_type" "SubjectType" NOT NULL,
    "actor_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" UUID,
    "metadata" JSONB,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "super_admins_email_key" ON "super_admins"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "stores_tenant_id_idx" ON "stores"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "stores_tenant_id_id_key" ON "stores"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "machines_tenant_id_store_id_idx" ON "machines"("tenant_id", "store_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_users_tenant_id_email_key" ON "tenant_users"("tenant_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "consumers_phone_key" ON "consumers"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "consumers_email_key" ON "consumers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_subject_type_subject_id_idx" ON "refresh_tokens"("subject_type", "subject_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

-- CreateIndex
CREATE INDEX "wallets_consumer_id_idx" ON "wallets"("consumer_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_tenant_id_consumer_id_key" ON "wallets"("tenant_id", "consumer_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_tenant_id_id_key" ON "wallets"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "rewards_tenant_id_is_active_idx" ON "rewards"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "rewards_tenant_id_id_key" ON "rewards"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "qr_claims_jti_key" ON "qr_claims"("jti");

-- CreateIndex
CREATE INDEX "qr_claims_tenant_id_created_at_idx" ON "qr_claims"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "qr_claims_consumer_id_tenant_id_created_at_idx" ON "qr_claims"("consumer_id", "tenant_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "point_transactions_qr_claim_id_key" ON "point_transactions"("qr_claim_id");

-- CreateIndex
CREATE INDEX "point_transactions_wallet_id_created_at_idx" ON "point_transactions"("wallet_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "point_transactions_tenant_id_created_at_idx" ON "point_transactions"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "coupons_wallet_id_created_at_idx" ON "coupons"("wallet_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "coupons_tenant_id_status_expires_at_idx" ON "coupons"("tenant_id", "status", "expires_at");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_created_at_idx" ON "audit_logs"("tenant_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machines" ADD CONSTRAINT "machines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machines" ADD CONSTRAINT "machines_tenant_id_store_id_fkey" FOREIGN KEY ("tenant_id", "store_id") REFERENCES "stores"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_consumer_id_fkey" FOREIGN KEY ("consumer_id") REFERENCES "consumers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_claims" ADD CONSTRAINT "qr_claims_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_claims" ADD CONSTRAINT "qr_claims_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_claims" ADD CONSTRAINT "qr_claims_consumer_id_fkey" FOREIGN KEY ("consumer_id") REFERENCES "consumers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_tenant_id_wallet_id_fkey" FOREIGN KEY ("tenant_id", "wallet_id") REFERENCES "wallets"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_qr_claim_id_fkey" FOREIGN KEY ("qr_claim_id") REFERENCES "qr_claims"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_tenant_id_wallet_id_fkey" FOREIGN KEY ("tenant_id", "wallet_id") REFERENCES "wallets"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_tenant_id_reward_id_fkey" FOREIGN KEY ("tenant_id", "reward_id") REFERENCES "rewards"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_redeemed_by_id_fkey" FOREIGN KEY ("redeemed_by_id") REFERENCES "tenant_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ───────── Reglas de integridad manuales (ver docs/ESQUEMA.md sección 4) ─────────

ALTER TABLE "tenants"
  ADD CONSTRAINT "tenants_primary_color_hex" CHECK ("primary_color" ~ '^#[0-9A-Fa-f]{6}$'),
  ADD CONSTRAINT "tenants_secondary_color_hex" CHECK ("secondary_color" IS NULL OR "secondary_color" ~ '^#[0-9A-Fa-f]{6}$'),
  ADD CONSTRAINT "tenants_points_config_positive" CHECK ("score_per_point" > 0 AND "max_points_per_game" > 0 AND "max_games_per_day" > 0);

ALTER TABLE "consumers"
  ADD CONSTRAINT "consumers_identifier_required" CHECK ("phone" IS NOT NULL OR "email" IS NOT NULL);

ALTER TABLE "wallets"
  ADD CONSTRAINT "wallets_balance_non_negative" CHECK ("balance" >= 0),
  ADD CONSTRAINT "wallets_lifetime_non_negative" CHECK ("lifetime_earned" >= 0);

ALTER TABLE "rewards"
  ADD CONSTRAINT "rewards_points_cost_positive" CHECK ("points_cost" > 0),
  ADD CONSTRAINT "rewards_stock_non_negative" CHECK ("stock" IS NULL OR "stock" >= 0);

ALTER TABLE "point_transactions"
  ADD CONSTRAINT "point_transactions_points_non_zero" CHECK ("points" <> 0),
  ADD CONSTRAINT "point_transactions_balance_after_non_negative" CHECK ("balance_after" >= 0);

-- Código de cupón único solo entre cupones vivos
CREATE UNIQUE INDEX "coupons_tenant_code_pending_key"
  ON "coupons" ("tenant_id", "code")
  WHERE "status" = 'PENDING';

-- Libro de puntos inmutable: solo INSERT
CREATE FUNCTION forbid_point_transactions_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'point_transactions es de solo inserción (% no permitido)', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER point_transactions_immutable
  BEFORE UPDATE OR DELETE ON "point_transactions"
  FOR EACH ROW EXECUTE FUNCTION forbid_point_transactions_mutation();
