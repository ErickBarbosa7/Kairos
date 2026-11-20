import { env } from "../../config/env.js";
import { prisma } from "../../db/prisma.js";
import { consumeEmailToken, issueEmailToken } from "../../lib/email-tokens.js";
import { HttpError } from "../../lib/errors.js";
import { sendMail } from "../../lib/mailer.js";
import { hashPassword } from "../../lib/password.js";

const invalid = () => new HttpError(400, "El enlace o código no es válido o ya venció", "invalid_token");

/** Cierra todas las sesiones del usuario: tras cambiar la clave, nadie sigue dentro con la anterior. */
const revokeSessions = (subjectType: "TENANT_USER", subjectId: string) =>
  prisma.refreshToken.updateMany({ where: { subjectType, subjectId, revokedAt: null }, data: { revokedAt: new Date() } });

// ── Panel del negocio ──────────────────────────────────────────────────────────

/** Siempre responde igual exista o no la cuenta, para no revelar qué correos están registrados. */
export async function requestTenantReset(tenantSlug: string, email: string) {
  const user = await prisma.tenantUser.findFirst({
    where: { email: email.toLowerCase(), isActive: true, tenant: { slug: tenantSlug, deletedAt: null } },
  });
  if (!user) return;
  const token = await issueEmailToken("TENANT_RESET", user.id);
  await sendMail({
    to: user.email,
    subject: "Restablece tu contraseña de Kairos",
    text: `Hola ${user.name},\n\nPara elegir una contraseña nueva abre este enlace (vale 1 hora):\n${env.ADMIN_URL}/restablecer?token=${token}\n\nSi no lo pediste, ignora este correo: tu contraseña no cambia.`,
  });
}

export async function resetTenantPassword(token: string, password: string) {
  const userId = await consumeEmailToken("TENANT_RESET", token);
  if (!userId) throw invalid();
  await prisma.tenantUser.update({ where: { id: userId }, data: { passwordHash: await hashPassword(password) } });
  await revokeSessions("TENANT_USER", userId);
}

export async function sendTenantVerification(userId: string) {
  const user = await prisma.tenantUser.findUniqueOrThrow({ where: { id: userId } });
  if (user.emailVerifiedAt) return;
  const token = await issueEmailToken("TENANT_VERIFY", user.id);
  await sendMail({
    to: user.email,
    subject: "Confirma tu correo en Kairos",
    text: `Hola ${user.name},\n\nConfirma tu correo con este enlace (vale 48 horas):\n${env.ADMIN_URL}/verificar?token=${token}`,
  });
}

export async function verifyTenantEmail(token: string) {
  const userId = await consumeEmailToken("TENANT_VERIFY", token);
  if (!userId) throw invalid();
  await prisma.tenantUser.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
}

// ── Wallet ─────────────────────────────────────────────────────────────────────

/** El cliente teclea el código en la app (no hay enlace profundo hacia la Wallet). */
export async function requestConsumerReset(email: string) {
  const consumer = await prisma.consumer.findFirst({ where: { email: email.toLowerCase(), deletedAt: null, isGuest: false } });
  if (!consumer?.email) return;
  const code = await issueEmailToken("CONSUMER_RESET", consumer.id, "code");
  await sendMail({
    to: consumer.email,
    subject: "Tu código para recuperar tu cuenta de Kairos",
    text: `Tu código es: ${code}\n\nEscríbelo en la app para elegir una contraseña nueva. Vale 30 minutos.\nSi no lo pediste, ignora este correo.`,
  });
}

export async function resetConsumerPassword(email: string, code: string, password: string) {
  const consumer = await prisma.consumer.findFirst({ where: { email: email.toLowerCase(), deletedAt: null, isGuest: false } });
  // El código se consume solo si pertenece a esa cuenta; así un código ajeno no se gasta ni sirve.
  const owner = consumer ? await consumeEmailToken("CONSUMER_RESET", code) : null;
  if (!consumer || owner !== consumer.id) throw invalid();
  await prisma.consumer.update({ where: { id: consumer.id }, data: { passwordHash: await hashPassword(password) } });
}
