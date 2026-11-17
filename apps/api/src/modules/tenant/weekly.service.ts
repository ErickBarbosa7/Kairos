import type { PrismaClient } from "@prisma/client";
import { localDate, retention, roi, shift } from "./analytics.service.js";

type Db = Pick<PrismaClient, "$queryRaw" | "weeklyReport" | "tenant">;

/** Lunes (hora local) de la semana que ya terminó, a partir de `today` (YYYY-MM-DD local). */
export function lastWeekStart(today: string): string {
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 = domingo
  const thisMonday = shift(today, -((dow + 6) % 7));
  return shift(thisMonday, -7);
}

export interface Verdict {
  headline: string;
  recommendation: string;
}

const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

/** Reglas fijas, sin IA: el orden decide cuál se muestra (spec §8). */
export function judge(m: {
  roi: number | null;
  return7: number | null;
  visitsByHour: { hour: number; visits: number }[];
  weekVisits: number;
}): Verdict {
  if (m.weekVisits === 0) {
    return { headline: "Semana sin visitas", recommendation: "Revisa que tus máquinas estén activas y que el QR de la terminal lleve a la Wallet. Una campaña de bono de primera visita ayuda a arrancar." };
  }
  if (m.roi !== null && m.roi < 0) {
    return { headline: "El programa cuesta más de lo que devuelve", recommendation: "Sube el costo en puntos de los premios más canjeados o baja el costo para ti en los premios que menos atraen." };
  }
  if (m.return7 !== null && m.return7 < 20) {
    return { headline: "Muchos clientes no vuelven", recommendation: "Baja el costo del primer premio o activa una campaña de desbloqueo de regreso para darles motivo de volver." };
  }
  const hours = m.visitsByHour.filter((h) => h.visits > 0);
  if (hours.length >= 2) {
    const max = hours.reduce((a, b) => (b.visits > a.visits ? b : a));
    const min = hours.reduce((a, b) => (b.visits < a.visits ? b : a));
    if (max.visits >= 3 * min.visits) {
      return { headline: `Tu hora más floja es a las ${hh(min.hour)}`, recommendation: `Activa un multiplicador de puntos cerca de las ${hh(min.hour)} para repartir las visitas; tu hora pico es a las ${hh(max.hour)}.` };
    }
  }
  return { headline: "Programa estable", recommendation: "No hay alertas esta semana. Prueba una campaña para medir si sube el retorno." };
}

/** Crea (o rehace) el resumen de la semana ya terminada de un negocio. */
export async function buildWeeklyReport(db: Db, tenantId: string, today = localDate(new Date())) {
  const weekStart = lastWeekStart(today);
  const weekEnd = shift(weekStart, 6);
  const t = await db.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { avgTicket: true } });
  const [ret, ro] = await Promise.all([retention(db, tenantId, weekStart, weekEnd, today), roi(db, tenantId, t.avgTicket, weekStart, weekEnd)]);
  const weekVisits = ret.visitsByDay.reduce((n, d) => n + d.visits, 0);
  const verdict = judge({ roi: ro.roi, return7: ret.return7, visitsByHour: ret.visitsByHour, weekVisits });
  const metrics = { weekVisits, newCustomers: ret.newCustomers, returningCustomers: ret.returningCustomers, return7: ret.return7, roi: ro.roi, programCost: ro.programCost };
  const date = new Date(`${weekStart}T00:00:00Z`);
  return db.weeklyReport.upsert({
    where: { tenantId_weekStart: { tenantId, weekStart: date } },
    update: { ...verdict, metrics },
    create: { tenantId, weekStart: date, ...verdict, metrics },
  });
}

/** Trabajo programado: genera el resumen de cada negocio PRO activo que aún no lo tenga. Idempotente. */
export async function generateWeeklyReports(db: PrismaClient, today = localDate(new Date())) {
  const weekStart = new Date(`${lastWeekStart(today)}T00:00:00Z`);
  const tenants = await db.tenant.findMany({
    where: { plan: "PRO", status: "ACTIVE", deletedAt: null, weeklyReports: { none: { weekStart } } },
    select: { id: true },
  });
  for (const t of tenants) await buildWeeklyReport(db, t.id, today);
  return tenants.length;
}
