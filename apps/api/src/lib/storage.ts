import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";

/**
 * Almacenamiento de imágenes. Hoy en disco local; para producción se sustituye
 * `saveImage` por S3 o Cloudinary sin tocar las rutas (Render borra el disco al reiniciar).
 */
export const uploadsRoot = path.resolve(env.UPLOADS_DIR);
export const uploadsUrlPrefix = (tenantId: string) => `${env.PUBLIC_API_URL}/uploads/${tenantId}/`;

export type ImageType = { ext: "png" | "jpg" | "webp"; mime: string };

/** Detecta el tipo real por los primeros bytes; el mime que declara el cliente no cuenta. */
export function detectImage(buf: Buffer): ImageType | null {
  if (buf.length > 12 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { ext: "png", mime: "image/png" };
  }
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (buf.length > 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") {
    return { ext: "webp", mime: "image/webp" };
  }
  return null;
}

export async function saveImage(tenantId: string, buf: Buffer, type: ImageType): Promise<string> {
  const dir = path.join(uploadsRoot, tenantId);
  await mkdir(dir, { recursive: true });
  const name = `${randomBytes(16).toString("hex")}.${type.ext}`;
  await writeFile(path.join(dir, name), buf);
  return `${uploadsUrlPrefix(tenantId)}${name}`;
}
