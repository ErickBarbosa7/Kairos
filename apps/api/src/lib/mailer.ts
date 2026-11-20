import { env, isProd } from "../config/env.js";

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

/** Correos enviados en pruebas, para poder leerlos sin red. */
export const outbox: Mail[] = [];

/**
 * Envía un correo con Resend. Sin `RESEND_API_KEY` no sale nada: en desarrollo se imprime en consola
 * y en pruebas se guarda en `outbox`. Un fallo de envío se registra pero no tumba la petición.
 */
export async function sendMail(mail: Mail): Promise<void> {
  if (env.NODE_ENV === "test") {
    outbox.push(mail);
    return;
  }
  if (!env.RESEND_API_KEY) {
    if (!isProd) console.log(`\n✉  Para ${mail.to} · ${mail.subject}\n${mail.text}\n`);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: env.MAIL_FROM, to: mail.to, subject: mail.subject, text: mail.text }),
    });
    if (!res.ok) console.error(`Correo no enviado (${res.status})`);
  } catch (e) {
    console.error("Correo no enviado", e);
  }
}
