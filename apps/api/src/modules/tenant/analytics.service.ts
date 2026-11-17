import { Prisma, type PrismaClient } from "@prisma/client";

/** Zona horaria del negocio (spec retencion-roi §6). Fija hasta que el esquema guarde la propia. */
export const TZ = "America/Mexico_City";

type Db = Pick<PrismaClient, "$queryRaw">;
const DAY_MS = 86_400_000;

/** Fecha local `YYYY-MM-DD` de un instante, en la zona del negocio. */
export const localDate = (d: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: TZ }).format(d);
export const shift = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS) + 1;

/**
 * Las columnas son `timestamp` sin zona y guardan UTC: hay que decirlo (`AT TIME ZONE 'UTC'`) antes de pasar a hora local.
 * Visitas-día: una por cliente y día local, por mucho que juegue. Toda consulta cruda lleva
 * `tenant_id` explícito: el filtro automático de `forTenant()` no alcanza al SQL crudo.
 */
const visits = (tenantId: string) => Prisma.sql`
  SELECT consumer_id, (created_at AT TIME ZONE 'UTC' AT TIME ZONE ${TZ})::date AS d
  FROM qr_claims WHERE tenant_id = ${tenantId}::uuid GROUP BY 1, 2`;

export interface Retention {
  from: string;
  to: string;
  newCustomers: number;
  returningCustomers: number;
  /** Porcentaje 0–100, o null si aún no hay clientes en esa cohorte. */
  return7: number | null;
  return30: number | null;
  visitsByDay: { date: string; visits: number }[];
  visitsByHour: { hour: number; visits: number }[];
}

/** Porcentaje de la cohorte (primera visita en [today-2w+1 .. today-w]) que volvió dentro de `w` días. */
async function returnRate(db: Db, tenantId: string, window: number, today: string): Promise<number | null> {
  const start = shift(today, -2 * window);
  const end = shift(today, -window);
  const rows = await db.$queryRaw<{ cohort: bigint; back: bigint }[]>`
    WITH v AS (${visits(tenantId)}),
    first AS (SELECT consumer_id, MIN(d) AS f FROM v GROUP BY 1)
    SELECT COUNT(*) AS cohort,
           COUNT(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM v WHERE v.consumer_id = first.consumer_id AND v.d > first.f AND v.d <= first.f + ${window}::int
           )) AS back
    FROM first WHERE f >= ${start}::date AND f <= ${end}::date`;
  const cohort = Number(rows[0]?.cohort ?? 0);
  return cohort === 0 ? null : Math.round((Number(rows[0]!.back) / cohort) * 1000) / 10;
}

export async function retention(db: Db, tenantId: string, from: string, to: string, today = localDate(new Date())): Promise<Retention> {
  const [counts, byDay, byHour, return7, return30] = await Promise.all([
    db.$queryRaw<{ new_customers: bigint; returning: bigint }[]>`
      WITH v AS (${visits(tenantId)}),
      first AS (SELECT consumer_id, MIN(d) AS f FROM v GROUP BY 1),
      inrange AS (SELECT consumer_id, COUNT(*) AS n FROM v WHERE d >= ${from}::date AND d <= ${to}::date GROUP BY 1)
      SELECT (SELECT COUNT(*) FROM first WHERE f >= ${from}::date AND f <= ${to}::date) AS new_customers,
             (SELECT COUNT(*) FROM inrange WHERE n >= 2) AS returning`,
    db.$queryRaw<{ d: string; n: bigint }[]>`
      SELECT d::text AS d, COUNT(*) AS n FROM (${visits(tenantId)}) v WHERE d >= ${from}::date AND d <= ${to}::date GROUP BY d ORDER BY d`,
    db.$queryRaw<{ h: number; n: bigint }[]>`
      SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC' AT TIME ZONE ${TZ})::int AS h, COUNT(*) AS n
      FROM qr_claims WHERE tenant_id = ${tenantId}::uuid
        AND (created_at AT TIME ZONE 'UTC' AT TIME ZONE ${TZ})::date >= ${from}::date AND (created_at AT TIME ZONE 'UTC' AT TIME ZONE ${TZ})::date <= ${to}::date
      GROUP BY 1 ORDER BY 1`,
    returnRate(db, tenantId, 7, today),
    returnRate(db, tenantId, 30, today),
  ]);
  return {
    from,
    to,
    newCustomers: Number(counts[0]?.new_customers ?? 0),
    returningCustomers: Number(counts[0]?.returning ?? 0),
    return7,
    return30,
    visitsByDay: byDay.map((r) => ({ date: r.d, visits: Number(r.n) })),
    visitsByHour: byHour.map((r) => ({ hour: r.h, visits: Number(r.n) })),
  };
}

export interface Roi {
  from: string;
  to: string;
  programCost: number;
  attributedRevenue: number;
  /** (ingreso − costo) / costo. Null si falta un dato o el costo es 0. */
  roi: number | null;
  missing: ("avgTicket" | "unitCost")[];
  /** El ingreso es una estimación (visitas de clientes recurrentes × ticket promedio). */
  estimated: true;
}

export async function roi(db: Db, tenantId: string, avgTicket: number | null, from: string, to: string): Promise<Roi> {
  const [cost, rec] = await Promise.all([
    db.$queryRaw<{ total: bigint | null; unpriced: bigint }[]>`
      SELECT SUM(r.unit_cost) AS total, COUNT(*) FILTER (WHERE r.unit_cost IS NULL) AS unpriced
      FROM coupons c JOIN rewards r ON r.id = c.reward_id AND r.tenant_id = c.tenant_id
      WHERE c.tenant_id = ${tenantId}::uuid AND c.status = 'REDEEMED'
        AND (c.redeemed_at AT TIME ZONE 'UTC' AT TIME ZONE ${TZ})::date >= ${from}::date AND (c.redeemed_at AT TIME ZONE 'UTC' AT TIME ZONE ${TZ})::date <= ${to}::date`,
    db.$queryRaw<{ n: bigint | null }[]>`
      WITH v AS (${visits(tenantId)}),
      per AS (SELECT consumer_id, COUNT(*) AS n FROM v WHERE d >= ${from}::date AND d <= ${to}::date GROUP BY 1)
      SELECT SUM(n) AS n FROM per WHERE n >= 2`,
  ]);
  const programCost = Number(cost[0]?.total ?? 0);
  const missing: Roi["missing"] = [];
  if (avgTicket === null) missing.push("avgTicket");
  if (Number(cost[0]?.unpriced ?? 0) > 0) missing.push("unitCost");
  const attributedRevenue = avgTicket === null ? 0 : Number(rec[0]?.n ?? 0) * avgTicket;
  const value = missing.length === 0 && programCost > 0 ? Math.round(((attributedRevenue - programCost) / programCost) * 1000) / 1000 : null;
  return { from, to, programCost, attributedRevenue, roi: value, missing, estimated: true };
}
