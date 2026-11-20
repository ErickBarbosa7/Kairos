CREATE TYPE "EmailTokenPurpose" AS ENUM ('TENANT_RESET', 'TENANT_VERIFY', 'CONSUMER_RESET');
ALTER TABLE "tenant_users" ADD COLUMN "email_verified_at" TIMESTAMP(3);
-- Los usuarios que ya existían se consideran verificados.
UPDATE "tenant_users" SET "email_verified_at" = "created_at";
CREATE TABLE "email_tokens" (
  "id" UUID NOT NULL,
  "purpose" "EmailTokenPurpose" NOT NULL,
  "subject_id" UUID NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "email_tokens_token_hash_key" ON "email_tokens"("token_hash");
CREATE INDEX "email_tokens_purpose_subject_id_idx" ON "email_tokens"("purpose", "subject_id");
