import "../config/env.js";
import { generateKeyPairSync } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../db/prisma.js";
import { hashPassword } from "../lib/password.js";

// SOLO DESARROLLO. Deja listo un negocio de prueba con sucursal, máquina Arcade (llave ES256),
// premios y un cajero, y escribe el machine.config.json para la terminal de Godot.
// Uso: WALLET_URL=http://192.168.1.50:5174 pnpm --filter @kairos/api seed:arcade
// Es idempotente: si el negocio ya existe lo reutiliza y crea una máquina nueva.
if (process.env.NODE_ENV === "production") throw new Error("No usar en producción");

const SLUG = "demo-arcade";
const walletUrl = process.env.WALLET_URL ?? "http://localhost:5174";
const apiUrl = process.env.API_URL ?? "http://localhost:3000";
const password = "Kairos-Test-2026!";

const tenant =
  (await prisma.tenant.findUnique({ where: { slug: SLUG } })) ??
  (await prisma.tenant.create({
    data: { name: "Demo Arcade", slug: SLUG, plan: "TRIAL", primaryColor: "#E11D48", scorePerPoint: 10, maxPointsPerGame: 50, maxGamesPerDay: 50 },
  }));
const store =
  (await prisma.store.findFirst({ where: { tenantId: tenant.id } })) ??
  (await prisma.store.create({ data: { tenantId: tenant.id, name: "Sucursal Centro" } }));

if ((await prisma.reward.count({ where: { tenantId: tenant.id, deletedAt: null } })) === 0) {
  await prisma.reward.createMany({
    data: [
      { tenantId: tenant.id, title: "Galleta gratis", pointsCost: 60 },
      { tenantId: tenant.id, title: "Café americano", pointsCost: 150, stock: 20 },
      { tenantId: tenant.id, title: "Pastel de la casa", pointsCost: 400, stock: 5 },
    ],
  });
}
await prisma.tenantUser.upsert({
  where: { tenantId_email: { tenantId: tenant.id, email: "cajero@demo-arcade.local" } },
  update: { passwordHash: await hashPassword(password), isActive: true },
  create: { tenantId: tenant.id, email: "cajero@demo-arcade.local", name: "Cajero demo", role: "TENANT_STAFF", passwordHash: await hashPassword(password) },
});

const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const machine = await prisma.machine.create({
  data: {
    tenantId: tenant.id,
    storeId: store.id,
    label: `Demo ${new Date().toISOString().slice(11, 19)}`,
    keyAlgorithm: "ES256",
    publicKey: publicKey.export({ type: "spki", format: "pem" }).toString(),
  },
});
const dir = path.resolve("secrets");
mkdirSync(dir, { recursive: true });
const keyPath = path.join(dir, "demo-arcade.private.pem");
writeFileSync(keyPath, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
const configPath = path.join(dir, "demo-arcade.machine.config.json");
writeFileSync(
  configPath,
  JSON.stringify(
    {
      api_url: apiUrl,
      wallet_url: walletUrl,
      store_id: store.id,
      machine_id: machine.id,
      private_key_path: keyPath,
      business_name: tenant.name,
      machine_label: machine.label,
      // Metas bajas para ver la ruleta sin jugar perfecto.
      qr_goals: { serpiente_golosa: 300, defensa_estelar: 1500 },
      kiosk: false,
    },
    null,
    2,
  ),
);
console.log(`Negocio ${tenant.name} · cajero cajero@demo-arcade.local / ${password} (slug ${SLUG})`);
console.log(`Terminal:  godot --path ../../../Kairos-Godot/kairos-arcade -- --config=${configPath}`);
await prisma.$disconnect();
