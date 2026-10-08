import "../config/env.js";
import { prisma } from "../db/prisma.js";
import { signConsumerToken } from "../lib/consumer-tokens.js";

// SOLO DESARROLLO. Crea un cliente de prueba y imprime su token para probar la acreditación de QR
// antes de que exista el inicio de sesión de la Wallet (OTP).
// Uso: pnpm --filter @kairos/api seed:consumer
if (process.env.NODE_ENV === "production") throw new Error("No usar en producción");

const consumer = await prisma.consumer.upsert({
  where: { email: "demo@kairos.local" },
  update: {},
  create: { email: "demo@kairos.local", displayName: "Cliente demo" },
});
const token = await signConsumerToken(consumer.id, 8 * 3600);
console.log(`Cliente demo (${consumer.email}) · token válido 8 h:\n\n${token}\n`);
console.log("Acreditar un QR (pega el contenido del QR en QR_TOKEN):");
console.log(`curl -s -X POST localhost:3000/wallet/claims -H "Authorization: Bearer ${token.slice(0, 12)}…" \\`);
console.log(`  -H 'content-type: application/json' -d "{\\"qr\\":\\"$QR_TOKEN\\"}"`);
await prisma.$disconnect();
