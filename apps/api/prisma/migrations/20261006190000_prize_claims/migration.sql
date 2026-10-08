-- AlterTable
ALTER TABLE "coupons" ADD COLUMN     "qr_claim_id" UUID;

-- AlterTable
ALTER TABLE "qr_claims" ADD COLUMN     "reward_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "coupons_qr_claim_id_key" ON "coupons"("qr_claim_id");

-- AddForeignKey
ALTER TABLE "qr_claims" ADD CONSTRAINT "qr_claims_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "rewards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_qr_claim_id_fkey" FOREIGN KEY ("qr_claim_id") REFERENCES "qr_claims"("id") ON DELETE SET NULL ON UPDATE CASCADE;

