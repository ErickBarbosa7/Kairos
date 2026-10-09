# Kairos

## Despliegue de la API en Render

El repositorio incluye [`render.yaml`](render.yaml) para crear la API como un
Web Service. En Render, selecciona **New > Blueprint**, conecta este repositorio
y completa las variables que aparecen como requeridas. El Blueprint también crea
una instancia gratuita de PostgreSQL y conecta `DATABASE_URL` automáticamente.
Solo hay que proporcionar:

- `CORS_ORIGINS`: URLs públicas del panel, separadas por comas. No añadas una
  barra final; por ejemplo `https://admin.kairos.com`.
- `PUBLIC_API_URL`: URL pública definitiva de esta API, por ejemplo
  `https://kairos-api.onrender.com`.

`JWT_ACCESS_SECRET` se genera en Render y no se guarda en Git. La primera vez,
guarda la URL de la API y configura `PUBLIC_API_URL`; después vuelve a desplegar.
El servicio aplica `prisma migrate deploy` antes de iniciar. Para usar una base
externa, reemplaza `DATABASE_URL` en el panel de Render por su cadena de
conexión.

Render no conserva el disco local de un Web Service. Antes de usar la carga de
logos en producción, configura un disco persistente de pago o sustituye el
almacenamiento local de `apps/api/src/lib/storage.ts` por S3 o Cloudinary.
