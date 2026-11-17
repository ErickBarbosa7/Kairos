import type { Campaign, Prisma } from "@prisma/client";
import { TZ } from "./analytics.service.js";

type Reader = Pick<Prisma.TransactionClient, "campaign">;

/** Día de la semana (0 = domingo) y hora local del negocio. */
export function localParts(now: Date): { weekday: number; hour: number } {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", hour: "2-digit", hour12: false }).formatToParts(now);
  const wd = p.find((x) => x.type === "weekday")!.value;
  const hour = Number(p.find((x) => x.type === "hour")!.value) % 24;
  return { weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd), hour };
}

/** ¿La campaña aplica en este instante? Pura: se prueba sin base de datos. */
export function isRunning(c: Pick<Campaign, "isActive" | "startsAt" | "endsAt" | "weekdays" | "startHour" | "endHour">, now: Date): boolean {
  if (!c.isActive) return false;
  if (c.startsAt && c.startsAt.getTime() > now.getTime()) return false;
  if (c.endsAt && c.endsAt.getTime() <= now.getTime()) return false;
  const { weekday, hour } = localParts(now);
  if (c.weekdays.length > 0 && !c.weekdays.includes(weekday)) return false;
  if (c.startHour !== null && c.endHour !== null && (hour < c.startHour || hour >= c.endHour)) return false;
  return true;
}

export interface Boost {
  /** Puntos que se suman por encima del tope por partida (primera visita). */
  bonus: number;
  /** Nombres de las campañas que intervinieron, para el libro de movimientos. */
  names: string[];
  points: number;
}

/**
 * Aplica las campañas vigentes a los puntos base de una partida. El multiplicador (el mayor, no se
 * acumulan) va antes del tope por partida; el bono de primera visita se suma después.
 */
export async function applyCampaigns(tx: Reader, tenantId: string, base: number, cap: number, isFirstVisit: boolean, now = new Date()) {
  const running = (await tx.campaign.findMany({ where: { tenantId, isActive: true } })).filter((c) => isRunning(c, now));
  const names: string[] = [];
  let points = base;
  const mult = running.filter((c) => c.type === "MULTIPLIER" && c.multiplierPct).sort((a, b) => b.multiplierPct! - a.multiplierPct!)[0];
  if (mult && base > 0) {
    points = Math.floor((base * mult.multiplierPct!) / 100);
    names.push(mult.name);
  }
  points = Math.min(points, cap);
  if (isFirstVisit) {
    for (const c of running.filter((x) => x.type === "FIRST_VISIT_BONUS")) {
      points += c.bonusPoints ?? 0;
      names.push(c.name);
    }
  }
  const unlock = running.filter((c) => c.type === "COMEBACK_UNLOCK").sort((a, b) => b.unlockHours! - a.unlockHours!)[0];
  return { points, names, unlockHours: unlock?.unlockHours ?? null, unlockName: unlock?.name ?? null };
}
