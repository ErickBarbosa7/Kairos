import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { forTenant, TenantScopeError } from "../src/db/tenant-scope.js";

const prisma = new PrismaClient();

let A: string, B: string; // tenants
let storeA: string, storeB: string;
let rewardA: string, rewardB: string;
let walletA: string, walletB: string;

async function reset() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE tenants, consumers, super_admins, refresh_tokens, audit_logs RESTART IDENTITY CASCADE`,
  );
}

beforeAll(async () => {
  await prisma.$executeRawUnsafe(`ALTER TABLE point_transactions DISABLE TRIGGER point_transactions_immutable`);
  await reset();
  await prisma.$executeRawUnsafe(`ALTER TABLE point_transactions ENABLE TRIGGER point_transactions_immutable`);

  const [ta, tb] = await Promise.all([
    prisma.tenant.create({ data: { name: "Cafetería A", slug: "a" } }),
    prisma.tenant.create({ data: { name: "Cafetería B", slug: "b" } }),
  ]);
  A = ta.id;
  B = tb.id;
  storeA = (await prisma.store.create({ data: { tenantId: A, name: "Sucursal A" } })).id;
  storeB = (await prisma.store.create({ data: { tenantId: B, name: "Sucursal B" } })).id;
  rewardA = (await prisma.reward.create({ data: { tenantId: A, title: "Café A", pointsCost: 50 } })).id;
  rewardB = (await prisma.reward.create({ data: { tenantId: B, title: "Galleta B", pointsCost: 30, stock: 1 } })).id;
  const consumer = await prisma.consumer.create({ data: { email: "user@example.com" } });
  walletA = (await prisma.wallet.create({ data: { tenantId: A, consumerId: consumer.id, balance: 100 } })).id;
  walletB = (await prisma.wallet.create({ data: { tenantId: B, consumerId: consumer.id, balance: 100 } })).id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("aislamiento por tenant (extensión Prisma)", () => {
  it("lista solo filas del tenant", async () => {
    const rewards = await forTenant(prisma, A).reward.findMany();
    expect(rewards.map((r) => r.id)).toEqual([rewardA]);
  });

  it("no lee por id una fila de otro tenant", async () => {
    const db = forTenant(prisma, A);
    expect(await db.reward.findUnique({ where: { id: rewardB } })).toBeNull();
    expect(await db.wallet.findFirst({ where: { id: walletB } })).toBeNull();
    expect(await db.reward.count()).toBe(1);
  });

  it("no modifica filas de otro tenant", async () => {
    const db = forTenant(prisma, A);
    await expect(db.reward.update({ where: { id: rewardB }, data: { title: "hack" } })).rejects.toThrow();
    const many = await db.reward.updateMany({ where: { id: rewardB }, data: { title: "hack" } });
    expect(many.count).toBe(0);
    expect((await prisma.reward.findUnique({ where: { id: rewardB } }))?.title).toBe("Galleta B");
  });

  it("no borra filas de otro tenant", async () => {
    const db = forTenant(prisma, A);
    await expect(db.reward.delete({ where: { id: rewardB } })).rejects.toThrow();
    expect((await db.reward.deleteMany({ where: { id: rewardB } })).count).toBe(0);
    expect(await prisma.reward.count({ where: { id: rewardB } })).toBe(1);
  });

  it("un tenantId inyectado en el where no expone otro tenant", async () => {
    const rows = await forTenant(prisma, A).reward.findMany({ where: { tenantId: B } });
    expect(rows.every((r) => r.tenantId === A)).toBe(true);
    const viaOr = await forTenant(prisma, A).reward.findMany({ where: { OR: [{ tenantId: B }, { id: rewardB }] } });
    expect(viaOr).toEqual([]);
  });

  it("create asigna el tenant y rechaza uno distinto", async () => {
    const db = forTenant(prisma, A);
    const r = await db.reward.create({ data: { title: "Nuevo", pointsCost: 10 } as any });
    expect(r.tenantId).toBe(A);
    await expect(db.reward.create({ data: { tenantId: B, title: "x", pointsCost: 1 } })).rejects.toThrow(
      TenantScopeError,
    );
  });

  it("rechaza tenantId vacío", () => {
    expect(() => forTenant(prisma, "")).toThrow(TenantScopeError);
  });
});

describe("aislamiento impuesto por PostgreSQL", () => {
  it("máquina de A no puede apuntar a sucursal de B (FK compuesta)", async () => {
    await expect(
      prisma.machine.create({
        data: { tenantId: A, storeId: storeB, label: "m", publicKey: "pk" },
      }),
    ).rejects.toThrow(/Foreign key/i);
    await expect(
      prisma.machine.create({ data: { tenantId: A, storeId: storeA, label: "m", publicKey: "pk" } }),
    ).resolves.toBeTruthy();
  });

  it("cupón de A no puede usar billetera ni premio de B", async () => {
    const base = {
      tenantId: A,
      rewardTitle: "x",
      pointsCost: 1,
      code: "ABC123",
      expiresAt: new Date(Date.now() + 60_000),
    };
    await expect(prisma.coupon.create({ data: { ...base, walletId: walletB, rewardId: rewardA } })).rejects.toThrow(
      /Foreign key/i,
    );
    await expect(prisma.coupon.create({ data: { ...base, walletId: walletA, rewardId: rewardB } })).rejects.toThrow(
      /Foreign key/i,
    );
  });

  it("transacción de A no puede apuntar a billetera de B", async () => {
    await expect(
      prisma.pointTransaction.create({
        data: { tenantId: A, walletId: walletB, type: "EARN", points: 5, balanceAfter: 105 },
      }),
    ).rejects.toThrow(/Foreign key/i);
  });
});

describe("reglas de integridad", () => {
  it("saldo negativo es rechazado", async () => {
    await expect(prisma.wallet.update({ where: { id: walletA }, data: { balance: -1 } })).rejects.toThrow(
      /wallets_balance_non_negative/,
    );
  });

  it("libro de puntos es de solo inserción", async () => {
    const tx = await prisma.pointTransaction.create({
      data: { tenantId: A, walletId: walletA, type: "EARN", points: 5, balanceAfter: 105 },
    });
    await expect(prisma.pointTransaction.update({ where: { id: tx.id }, data: { points: 999 } })).rejects.toThrow(
      /solo inserción/,
    );
    await expect(prisma.pointTransaction.delete({ where: { id: tx.id } })).rejects.toThrow(/solo inserción/);
  });

  it("un jti no se puede acreditar dos veces (concurrente)", async () => {
    const machine = await prisma.machine.findFirstOrThrow({ where: { tenantId: A } });
    const consumer = await prisma.consumer.findFirstOrThrow();
    const claim = () =>
      prisma.qrClaim.create({
        data: {
          jti: "jti-1",
          tenantId: A,
          machineId: machine.id,
          consumerId: consumer.id,
          score: 100,
          pointsAwarded: 10,
          qrIssuedAt: new Date(),
        },
      });
    const results = await Promise.allSettled([claim(), claim(), claim()]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("cupón se canjea una sola vez aunque lleguen dos peticiones", async () => {
    await prisma.coupon.create({
      data: {
        tenantId: A,
        walletId: walletA,
        rewardId: rewardA,
        rewardTitle: "Café A",
        pointsCost: 50,
        code: "ZZZ999",
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const redeem = () =>
      forTenant(prisma, A).coupon.updateMany({
        where: { code: "ZZZ999", status: "PENDING", expiresAt: { gt: new Date() } },
        data: { status: "REDEEMED", redeemedAt: new Date() },
      });
    const [r1, r2] = await Promise.all([redeem(), redeem()]);
    expect(r1.count + r2.count).toBe(1);
  });

  it("cupón de A no se valida desde el contexto de B", async () => {
    await prisma.coupon.create({
      data: {
        tenantId: A,
        walletId: walletA,
        rewardId: rewardA,
        rewardTitle: "Café A",
        pointsCost: 50,
        code: "AAA111",
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const res = await forTenant(prisma, B).coupon.updateMany({
      where: { code: "AAA111", status: "PENDING" },
      data: { status: "REDEEMED" },
    });
    expect(res.count).toBe(0);
  });
});
