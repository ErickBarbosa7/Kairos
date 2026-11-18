import type { Campaign } from "../api/types";

/** Zona horaria fija del negocio; igual que en la API (`TZ` en analytics.service). */
const TZ = "America/Mexico_City";

function localParts(now: Date): { weekday: number; hour: number } {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", hour: "2-digit", hour12: false }).formatToParts(now);
  const wd = p.find((x) => x.type === "weekday")?.value ?? "Sun";
  const hour = Number(p.find((x) => x.type === "hour")?.value ?? 0) % 24;
  return { weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd), hour };
}

/** ¿La campaña aplica ahora? Misma regla que `isRunning` en la API. */
export function isRunningNow(c: Campaign, now = new Date()): boolean {
  if (!c.isActive) return false;
  if (c.startsAt && new Date(c.startsAt).getTime() > now.getTime()) return false;
  if (c.endsAt && new Date(c.endsAt).getTime() <= now.getTime()) return false;
  const { weekday, hour } = localParts(now);
  if (c.weekdays.length > 0 && !c.weekdays.includes(weekday)) return false;
  if (c.startHour !== null && c.endHour !== null && (hour < c.startHour || hour >= c.endHour)) return false;
  return true;
}
