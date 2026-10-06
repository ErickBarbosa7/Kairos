import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { HttpError } from "../../lib/errors.js";
import { detectImage, saveImage, uploadsUrlPrefix } from "../../lib/storage.js";
import { tenantAdminOnly } from "../../middleware/tenant.js";

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color hex #RRGGBB");

/** Solo se aceptan imágenes que subió este mismo tenant. */
export const ownedImageUrl = (tenantId: string) =>
  z
    .string()
    .max(500)
    .refine((u) => u.startsWith(uploadsUrlPrefix(tenantId)), "Imagen no válida");

const select = { name: true, slug: true, logoUrl: true, primaryColor: true, secondaryColor: true, themeMode: true } as const;

export const brandRouter = Router();

// Cualquier usuario del tenant puede leer la marca (la caja la usa para su encabezado)
brandRouter.get("/brand", async (req, res) => {
  res.json(await prisma.tenant.findUniqueOrThrow({ where: { id: req.auth!.tid! }, select }));
});

brandRouter.patch("/brand", tenantAdminOnly, async (req, res) => {
  const tid = req.auth!.tid!;
  const body = z
    .object({
      primaryColor: hex,
      secondaryColor: hex.nullable(),
      themeMode: z.enum(["LIGHT", "DARK", "AUTO"]),
      logoUrl: ownedImageUrl(tid).nullable(),
    })
    .partial()
    .strict()
    .parse(req.body);
  res.json(await prisma.tenant.update({ where: { id: tid }, data: body, select }));
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024, files: 1 } });

brandRouter.post("/uploads", tenantAdminOnly, upload.single("file"), async (req, res) => {
  if (!req.file) throw new HttpError(400, "Falta el archivo", "validation_error");
  const type = detectImage(req.file.buffer);
  if (!type) throw new HttpError(415, "Formato no permitido. Usa PNG, JPG o WebP", "unsupported_media");
  res.status(201).json({ url: await saveImage(req.auth!.tid!, req.file.buffer, type) });
});
