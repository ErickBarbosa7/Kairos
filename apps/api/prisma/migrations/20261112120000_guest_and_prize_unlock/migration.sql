-- Clientes invitados: se crean al escanear el primer QR, sin teléfono ni correo.
ALTER TABLE "consumers" ADD COLUMN "is_guest" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "consumers" DROP CONSTRAINT "consumers_identifier_required";
ALTER TABLE "consumers"
  ADD CONSTRAINT "consumers_identifier_required" CHECK ("is_guest" OR "phone" IS NOT NULL OR "email" IS NOT NULL);

-- Los cupones de ruleta pueden desbloquearse después, para invitar a volver al local.
ALTER TABLE "coupons" ADD COLUMN "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
