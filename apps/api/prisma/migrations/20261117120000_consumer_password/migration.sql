-- Cuenta de cliente con correo y contraseña (la Wallet permite seguir como invitado).
ALTER TABLE "consumers" ADD COLUMN "password_hash" TEXT;
