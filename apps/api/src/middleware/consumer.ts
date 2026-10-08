import type { RequestHandler } from "express";
import { prisma } from "../db/prisma.js";
import { unauthorized } from "../lib/errors.js";
import { verifyConsumerToken } from "../lib/consumer-tokens.js";

declare global {
  namespace Express {
    interface Request {
      consumerId?: string;
    }
  }
}

/** Exige un token de cliente (audiencia Wallet) de un cliente que siga existiendo. */
export const requireConsumer: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw unauthorized();
  let consumerId: string;
  try {
    ({ consumerId } = await verifyConsumerToken(header.slice(7)));
  } catch {
    throw unauthorized("Token inválido o expirado");
  }
  const consumer = await prisma.consumer.findFirst({ where: { id: consumerId, deletedAt: null }, select: { id: true } });
  if (!consumer) throw unauthorized();
  req.consumerId = consumer.id;
  next();
};
