import { z } from "zod";

/**
 * Parámetros de la economía de puntos de un negocio (ESQUEMA.md 4).
 * Los comparten el panel del negocio y el Super Admin para validar igual.
 */
export const economyFields = {
  scorePerPoint: z.number().int().min(1).max(1000),
  maxPointsPerGame: z.number().int().min(1).max(100_000),
  maxGamesPerDay: z.number().int().min(1).max(1000),
} as const;
