import { randomUUID } from "node:crypto";
import { importPKCS8, SignJWT } from "jose";
import { keyPair, makeTenant, prisma } from "./helpers.js";

export type Alg = "ES256" | "EdDSA";

export async function setup(opts: { kind?: "ec" | "ed25519"; slug?: string } = {}) {
  const kind = opts.kind ?? "ec";
  const { tenant } = await makeTenant(opts.slug ?? "aurora");
  const store = await prisma.store.create({ data: { tenantId: tenant.id, name: "Centro" } });
  const keys = keyPair(kind);
  const machine = await prisma.machine.create({
    data: {
      tenantId: tenant.id,
      storeId: store.id,
      label: "Mostrador",
      publicKey: keys.pub,
      keyAlgorithm: kind === "ec" ? "ES256" : "EDDSA",
    },
  });
  return { tenant, store, machine, priv: keys.priv, alg: (kind === "ec" ? "ES256" : "EdDSA") as Alg };
}

export type Rig = Awaited<ReturnType<typeof setup>>;

/** Firma un QR como lo haría la terminal. `over` permite romper cualquier campo. */
export async function qr(rig: Rig, over: Record<string, unknown> = {}, opts: { priv?: string; alg?: Alg } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    store_id: rig.store.id,
    machine_id: rig.machine.id,
    score: 1000,
    iat: now,
    exp: now + 60,
    jti: randomUUID().replaceAll("-", ""),
    ...over,
  };
  const alg = opts.alg ?? rig.alg;
  return new SignJWT(claims).setProtectedHeader({ alg }).sign(await importPKCS8(opts.priv ?? rig.priv, alg));
}

