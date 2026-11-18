-- Ubicación opcional de la sucursal para la búsqueda «Cerca de ti».
ALTER TABLE "stores" ADD COLUMN "latitude" DOUBLE PRECISION,
ADD COLUMN "longitude" DOUBLE PRECISION,
ADD COLUMN "listed_nearby" BOOLEAN NOT NULL DEFAULT true;

-- Prisma no expresa CHECK: rango válido y par completo (o ambos nulos).
ALTER TABLE "stores" ADD CONSTRAINT "stores_latitude_range" CHECK ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90);
ALTER TABLE "stores" ADD CONSTRAINT "stores_longitude_range" CHECK ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180);
ALTER TABLE "stores" ADD CONSTRAINT "stores_location_pair" CHECK (("latitude" IS NULL) = ("longitude" IS NULL));

CREATE INDEX "stores_nearby_idx" ON "stores" ("latitude", "longitude") WHERE "latitude" IS NOT NULL AND "is_active" AND "listed_nearby";
