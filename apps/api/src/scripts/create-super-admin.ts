import "../config/env.js";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { hashPassword } from "../lib/password.js";

// Uso: ADMIN_EMAIL=a@b.com ADMIN_NAME="Nombre" ADMIN_PASSWORD=... pnpm seed:admin
const input = z
  .object({
    ADMIN_EMAIL: z.email(),
    ADMIN_NAME: z.string().min(2),
    ADMIN_PASSWORD: z.string().min(10),
  })
  .parse(process.env);

const admin = await prisma.superAdmin.create({
  data: {
    email: input.ADMIN_EMAIL.toLowerCase(),
    name: input.ADMIN_NAME,
    passwordHash: await hashPassword(input.ADMIN_PASSWORD),
  },
});
console.log(`Super admin creado: ${admin.email}`);
await prisma.$disconnect();
