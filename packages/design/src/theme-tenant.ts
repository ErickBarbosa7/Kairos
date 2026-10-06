/**
 * Tema derivado del color del tenant (DISENO.md 4.2 y 4.3).
 * Función pura: (primario, modo) => variables. Se comparte entre Wallet y Panel Tenant.
 */

export type Mode = "light" | "dark";

const HEX = /^#[0-9a-f]{6}$/i;
const LIGHT_BG = "#F8F7FC";
const DARK_BG = "#0B0B1A";
export const ON_LIGHT = "#FFFFFF";
export const ON_DARK = "#14132B";

export const isHex = (v: string) => HEX.test(v);

function toRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Blanco o casi negro, el que dé mayor contraste sobre el color dado. */
export function pickOnColor(hex: string): string {
  return contrastRatio(hex, ON_LIGHT) >= contrastRatio(hex, ON_DARK) ? ON_LIGHT : ON_DARK;
}

function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = toRgb(hex).map((c) => c / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

/** Mezcla `hex` sobre `base` con la opacidad dada (0-1). */
export function mix(hex: string, base: string, alpha: number): string {
  const a = toRgb(hex);
  const b = toRgb(base);
  return (
    "#" +
    a
      .map((v, i) => Math.round(v * alpha + b[i]! * (1 - alpha)).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

export interface TenantTheme {
  primary: string;
  onPrimary: string;
  primaryHover: string;
  primarySubtle: string;
  /** true si hubo que ajustar la luminosidad para cumplir contraste */
  adjusted: boolean;
  /** Contraste del texto sobre el primario final */
  onPrimaryContrast: number;
  /** Contraste del primario final contra el fondo */
  onBackgroundContrast: number;
  warnings: string[];
}

/**
 * Deriva el tema. Reglas: texto sobre primario >= 4.5:1 y primario sobre el fondo >= 3:1.
 * Si no se cumple, se mueve la luminosidad hacia el lado que mejora el contraste con el fondo.
 */
export function deriveTenantTheme(primaryInput: string, mode: Mode): TenantTheme {
  const bg = mode === "light" ? LIGHT_BG : DARK_BG;
  const warnings: string[] = [];
  const original = primaryInput.toUpperCase();
  let primary = original;
  const [h, s, l0] = hexToHsl(primary);

  const ok = (c: string) => contrastRatio(c, bg) >= 3 && contrastRatio(c, pickOnColor(c)) >= 4.5;
  if (!ok(primary)) {
    const step = mode === "light" ? -0.01 : 0.01;
    let l = l0;
    for (let i = 0; i < 100 && !ok(primary); i++) {
      l = Math.min(0.97, Math.max(0.03, l + step));
      primary = hslToHex(h, s, l);
    }
  }
  const adjusted = primary !== original;
  if (adjusted) warnings.push("El color se ajustó para cumplir el contraste mínimo.");
  if (s < 0.12) warnings.push("Color casi gris: se distingue poco del fondo.");

  const onPrimary = pickOnColor(primary);
  const [ph, ps, pl] = hexToHsl(primary);
  const hover = hslToHex(ph, ps, Math.min(0.97, Math.max(0.03, pl + (mode === "light" ? -0.08 : 0.08))));

  return {
    primary,
    onPrimary,
    primaryHover: hover,
    primarySubtle: mix(primary, mode === "light" ? "#FFFFFF" : "#151530", 0.12),
    adjusted,
    onPrimaryContrast: contrastRatio(primary, onPrimary),
    onBackgroundContrast: contrastRatio(primary, bg),
    warnings,
  };
}
