import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./db/prisma.js";
import { expireCoupons } from "./modules/wallet/redeem.service.js";

const server = createApp().listen(env.PORT, () => {
  console.log(`Kairos API en http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

// Vence cupones y devuelve puntos (ESQUEMA.md 5.4).
const expiryTimer = setInterval(() => {
  expireCoupons().catch((err) => console.error("expireCoupons falló", err));
}, 60_000);

async function shutdown() {
  clearInterval(expiryTimer);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
