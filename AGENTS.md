# Kairos — instrucciones para agentes

Monorepo pnpm del SaaS Kairos (fidelización B2B2C: máquina Arcade → Wallet PWA → panel multi-tenant).

**Estado:** parcial 1 implementado (API + panel Admin con Super Admin y panel Tenant).
`apps/wallet` está vacío (solo `.gitkeep`); la Wallet PWA (parcial 2) y la terminal Unity
(repo aparte) no existen todavía.

Antes de tocar el modelo de datos, la seguridad o la UI, lee:
`docs/ARQUITECTURA.md` (decisiones), `docs/ESQUEMA.md` (esquema y operaciones críticas),
`docs/DISENO.md` (tokens y theming), `context/planeacion.md` (fases).

## Comandos

`pnpm` no está en el PATH por defecto en esta máquina (instalado global por npm):
`export PATH="$HOME/.npm-global/bin:$PATH"`.

| Tarea | Comando |
|---|---|
| Tipos (gate real de calidad) | `pnpm typecheck` — corre api, admin y design |
| Tests | `pnpm test` — Vitest en `apps/api` (71) y `packages/design` (14). `apps/admin` no tiene tests |
| Un solo archivo de test | `pnpm --filter @kairos/api exec vitest run test/isolation.test.ts` |
| Base de datos | `pnpm db:up` / `pnpm db:down` — Postgres 17 en **localhost:5433** (no 5432) |
| API (dev) | `pnpm --filter @kairos/api dev` — tsx watch, puerto 3000 |
| Admin (dev) | `pnpm --filter @kairos/admin dev` — Vite, puerto 5173 con `strictPort` |
| Build | `pnpm --filter @kairos/admin build` · `pnpm --filter @kairos/api build` |
| Prisma | `pnpm --filter @kairos/api prisma:migrate` · `prisma:generate` · `prisma:validate` |
| CSS de tokens | `pnpm --filter @kairos/design build:css` |

Scripts de apoyo: `seed:admin` (`ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD`),
`seed:coupon` (`TENANT_SLUG`, se niega a correr en producción),
`gen:machine-key <nombre>` (ES256; escribe el par en `apps/api/secrets/`).

### Scripts raíz que NO funcionan (verificado, no es bug tuyo)

- `pnpm lint` → `ERR_PNPM_RECURSIVE_RUN_NO_SCRIPT`. **No hay linter** (ni ESLint ni Prettier) ni CI
  en el repo. No añadas un paso de lint a tu flujo.
- `pnpm api` → *"requires a subcommand"*. Usa `pnpm --filter @kairos/api <script>`.

## Setup

- `.env` de Postgres (compose) en la raíz; `.env` de la API en `apps/api/.env`. Ambos gitignored,
  con `.example` versionados.
- `src/config/env.ts` valida con Zod al arrancar y hace `process.exit(1)`.
  `JWT_ACCESS_SECRET` exige **≥ 32 caracteres**.
- **Las pruebas nunca tocan `kairos`**: `test/global-setup.ts` reescribe el path de `DATABASE_URL`
  a `/kairos_test` y corre `prisma migrate deploy`. Esa base la crea el contenedor, no el repo:
  `docker exec kairos-db psql -U kairos -d postgres -c 'CREATE DATABASE kairos_test'`.
- `apps/api/.env` es obligatorio para los tests (`dotenv/config` lo carga y sin él global-setup lanza).

## Tests

- `apps/api/vitest.config.ts` fija `fileParallelism: false` y `testTimeout: 15s`. Corren en serie y
  `resetDb()` hace `TRUNCATE ... CASCADE` sobre la base `kairos_test` real. Son tests de integración
  con supertest contra Postgres, no mocks.
- `pnpm --filter @kairos/api test -- <archivo>` **no filtra** (corre la suite entera). Usa `exec vitest run`.
- Helpers en `apps/api/test/helpers.ts`: `app` (con `rateLimit: false`), `makeTenant`, `makeStaff`,
  `makeCoupon`, `keyPair`, `PNG_1PX`, `loginTenant`.

## Arquitectura — lo que no se ve en los nombres

- **Aislamiento multi-tenant es doble y obligatorio**: extensión Prisma `forTenant()`
  (`src/db/tenant-scope.ts`) que inyecta `tenantId` en `where`/`data` y **lanza `TenantScopeError`
  en operaciones no soportadas**, más FKs compuestas / CHECK / triggers en la migración.
  En rutas de tenant usa siempre `req.db` (ya acotado), nunca el `prisma` global.
  Si añades un modelo con `tenant_id`, **agrega su nombre a `TENANT_MODELS`** o quedará sin filtrar.
- **Prisma no expresa CHECK, índices únicos parciales ni triggers.** La migración
  `prisma/migrations/20260928215554_init/migration.sql` trae SQL manual al final (CHECKs de color,
  balance y stock; índice parcial `coupons_tenant_code_pending_key`; trigger
  `point_transactions_immutable`). Edita a mano lo que Prisma no expresa; no esperes que
  `prisma migrate dev` lo genere.
- **Roles**: `super_admin | tenant_admin | tenant_staff` (`src/lib/tokens.ts`). El refresh token va en
  cookie `HttpOnly` `kairos_rt`; el access token vive **en memoria** en
  `apps/admin/src/api/client.ts` y se refresca con una única petición compartida.
- En dev el Admin usa el **proxy de Vite** para `/auth`, `/admin`, `/tenant` → mismo origen, sin CORS.
  `VITE_API_URL` solo se usa en producción.
- **Errores**: lanza `HttpError` con los helpers de `src/lib/errors.ts`
  (`unauthorized`/`forbidden`/`notFound`/`conflict`); `middleware/error.ts` los serializa como
  `{ error: { code, message, issues } }`, que es la forma que el Admin espera.
- **Resoluciones de import**: la API usa `NodeNext`, así que los imports relativos llevan `.js`
  (`./config/env.js`). El Admin usa `Bundler` y va sin extensión. `noUncheckedIndexedAccess` está
  activo en `packages/config/tsconfig.base.json`.
- **Imágenes**: `src/lib/storage.ts` las guarda en disco local (`UPLOADS_DIR`) detectando el tipo por
  bytes, no por el MIME declarado. `uploads/` y `secrets/` no se versionan.

## Frontend

- **Todos los textos en español y centralizados en `apps/admin/src/strings.ts`** (`t.*`). Nada de
  literales dentro del JSX.
- **Nunca escribas un hex en un componente.** Tailwind v4 consume los tokens de
  `packages/design/tokens.json` → `theme-kairos.css` (GENERADO por `build-css.mjs`, no editar a mano)
  y `src/theme-tenant.ts` para el tema del tenant.
- Según `docs/DISENO.md`: los paneles admin usan **siempre** la marca Kairos (`kairos-*`), nunca el
  color del tenant. Ese color solo manda en Wallet y Arcade. Ningún estado se comunica solo con color.

## Git

- Ramas: `develop` para el trabajo diario, `main` para releases. Remoto en GitHub.
- Mensajes de commit en español (ver `git log`).
- Sin CI: antes de commitear, el gate es `pnpm typecheck` y `pnpm test`.
- Ojo: hay bastante trabajo sin commitear (`apps/admin/src`, `apps/api/src/modules`,
  `packages/design/src` aparecen sin trackear en `git status`).
