# Cómo levantar Kairos (parcial 1)

Alcance: API + panel Admin (Super Admin y Tenant). `apps/wallet` y la terminal Unity aún no existen.

## Requisitos

- Node + pnpm (instalado global por npm). En esta máquina:
  `export PATH="$HOME/.npm-global/bin:$PATH"` (fish: `fish_add_path ~/.npm-global/bin`)
- Docker (Postgres 17)

## Primera vez

```bash
pnpm install
cp .env.example .env                       # Postgres (compose)
cp apps/api/.env.example apps/api/.env     # API; JWT_ACCESS_SECRET >= 32 caracteres
                                           # generar: openssl rand -base64 48
pnpm db:up                                 # Postgres en localhost:5433
pnpm --filter @kairos/api exec prisma migrate deploy
```

Crear Super Admin:

```bash
ADMIN_EMAIL=dev@kairos.local ADMIN_NAME="Dev Admin" ADMIN_PASSWORD='Kairos-Dev-2026!' \
  pnpm --filter @kairos/api seed:admin
```

(fish: `env ADMIN_EMAIL=... ADMIN_NAME=... ADMIN_PASSWORD=... pnpm ...`)

## Cada día (dos terminales)

```bash
pnpm db:up
pnpm --filter @kairos/api dev      # API  -> http://localhost:3000  (GET /health)
pnpm --filter @kairos/admin dev    # Admin -> http://localhost:5173
```

El Admin usa el proxy de Vite para `/auth`, `/admin`, `/tenant`: no hace falta CORS en dev.
Puerto 5173 es `strictPort`: si está ocupado, Vite falla en vez de cambiar.

## Entrar

- Super Admin: `http://localhost:5173` con el email/contraseña del seed.
- Panel Tenant: crea un tenant desde el panel Super Admin y entra con las credenciales del tenant.
- Cupón de prueba: `TENANT_SLUG=<slug> pnpm --filter @kairos/api seed:coupon` (no corre en producción).
- Llave de máquina arcade: `pnpm --filter @kairos/api gen:machine-key <nombre>` (par ES256 en `apps/api/secrets/`).

## Verificación

```bash
docker exec kairos-db psql -U kairos -d postgres -c 'CREATE DATABASE kairos_test'   # una sola vez
pnpm typecheck
pnpm test        # 71 api + 14 design; usan la base kairos_test, nunca kairos
```

## Problemas comunes

- `pnpm: command not found` → falta el PATH de arriba.
- La API sale al arrancar → revisa `apps/api/.env` (validación Zod, `process.exit(1)`).
- Puerto 5433 ocupado → cambia `POSTGRES_PORT` en `.env` y `DATABASE_URL` en `apps/api/.env`.
- `Unique constraint failed on (email)` en `seed:admin` → ese email ya existe; usa otro.

---

# Instalar una skill de Claude Code

Una skill es una carpeta con `SKILL.md`. Tres vías:

1. **Plugin / marketplace**
   ```
   /plugin marketplace add <owner>/<repo>
   /plugin install <nombre>@<marketplace>
   ```
2. **Copiar la carpeta**
   - Personal (todos los proyectos): `~/.claude/skills/<nombre>/SKILL.md`
   - Solo este proyecto: `.claude/skills/<nombre>/SKILL.md`
3. **Crearla** con `/skill-creator` o a mano.

Tras instalar, abre `/skills` para confirmar que aparece; se invoca con `/<nombre>`.

## berserk-design

No existe en tu máquina ni se encontró en búsqueda pública, así que no sé de dónde instalarla.
Necesito uno de estos datos:

- URL del repo/marketplace → `/plugin marketplace add ...` + `/plugin install berserk-design@...`
- Carpeta local o `.zip` con `SKILL.md` → copiar a `~/.claude/skills/berserk-design/`
- Si es otra cosa (p. ej. un sistema de diseño que quieres que yo cree), dímelo.

Nota: el diseño del proyecto ya está definido en `docs/DISENO.md` y `packages/design/tokens.json`.
Una skill nueva no debe contradecirlos (nada de hex en componentes; paneles admin siempre con marca `kairos-*`).
