CREATE TYPE "MachineAuthMode" AS ENUM ('DEVICE_KEY', 'WEB_SESSION');

ALTER TABLE "machines"
  ALTER COLUMN "public_key" DROP NOT NULL,
  ADD COLUMN "auth_mode" "MachineAuthMode" NOT NULL DEFAULT 'DEVICE_KEY';

CREATE TABLE "terminal_pairings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" TEXT NOT NULL,
  "secret_hash" TEXT NOT NULL,
  "tenant_id" UUID,
  "machine_id" UUID,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "approved_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "terminal_pairings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "terminal_pairings_code_key" ON "terminal_pairings"("code");
CREATE UNIQUE INDEX "terminal_pairings_machine_id_key" ON "terminal_pairings"("machine_id");
CREATE INDEX "terminal_pairings_expires_at_idx" ON "terminal_pairings"("expires_at");
ALTER TABLE "terminal_pairings" ADD CONSTRAINT "terminal_pairings_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "terminal_pairings" ADD CONSTRAINT "terminal_pairings_machine_id_fkey"
  FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "terminal_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "machine_id" UUID NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "terminal_sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "terminal_sessions_token_hash_key" ON "terminal_sessions"("token_hash");
CREATE INDEX "terminal_sessions_machine_id_expires_at_idx" ON "terminal_sessions"("machine_id", "expires_at");
ALTER TABLE "terminal_sessions" ADD CONSTRAINT "terminal_sessions_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "terminal_sessions" ADD CONSTRAINT "terminal_sessions_machine_id_fkey"
  FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
