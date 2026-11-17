import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET debe tener al menos 32 caracteres"),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:5173,http://localhost:5174")
    .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean)),
  PUBLIC_API_URL: z.string().url().default("http://localhost:3000"),
  UPLOADS_DIR: z.string().default("uploads"),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  // Días de prueba gratis al registrarse un negocio
  // Horas que tarda en poder canjearse en caja un premio de ruleta (invita a volver). 0 = al instante.
  PRIZE_UNLOCK_HOURS: z.coerce.number().int().min(0).max(168).default(12),
  // Vigencia del token de un cliente invitado (vive en su teléfono).
  GUEST_TOKEN_DAYS: z.coerce.number().int().min(1).max(730).default(365),
  TERMS_VERSION: z.string().min(1).default("2026-11-17"),
  TRIAL_DAYS: z.coerce.number().int().min(1).max(90).default(14),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Variables de entorno inválidas:");
  for (const issue of parsed.error.issues) console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
