import type { RequestHandler } from "express";
import { forbidden, unauthorized } from "../lib/errors.js";
import { type AccessClaims, type Role, verifyAccessToken } from "../lib/tokens.js";

declare global {
  namespace Express {
    interface Request {
      auth?: AccessClaims;
    }
  }
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw unauthorized();
  try {
    req.auth = await verifyAccessToken(header.slice(7));
  } catch {
    throw unauthorized("Token inválido o expirado");
  }
  next();
};

export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth || !roles.includes(req.auth.role)) throw forbidden();
    next();
  };
