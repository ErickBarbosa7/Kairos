# Kairos — Arquitectura y Stack

Versión 0.1 · Estado: propuesta para aprobación

Este documento define el stack, la estructura de repositorios y el orden de desarrollo. Complementa `context/contexto.md`, `context/planeacion.md` y `docs/DISENO.md`.

## 1. Stack

| Capa | Tecnología | Notas |
|---|---|---|
| Frontend (Admin y Wallet) | React + Vite + TypeScript | SPA. No se necesita SSR, así que Next.js se descarta |
| Estilos | Tailwind CSS | Consume los tokens de `DISENO.md` mediante variables CSS |
| PWA | `vite-plugin-pwa` | Solo para la Wallet: manifest, service worker, instalable |
| Backend | Node.js + Express + TypeScript | API REST |
| Validación | Zod | Un mismo esquema valida la entrada y genera los tipos compartidos |
| Base de datos | PostgreSQL + Prisma | Migraciones versionadas |
| Autenticación | JWT propio (access + refresh) | Ver sección 4 |
| Arcade | Unity 2D + C# | Consume la API con `UnityWebRequest` |
| Diseño | Figma | Los tokens viven en `tokens.json`, no solo en Figma |
| Pruebas | Vitest (web y API), Playwright (E2E), Unity Test Framework | |
| Calidad | ESLint, Prettier, TypeScript estricto | Configuración compartida |
| CI/CD | GitHub Actions | Lint, tipos y pruebas en cada push |
| Despliegue | Vercel (frontends), Render o Railway (API), Neon o Supabase (PostgreSQL) | |

Observaciones sobre lo propuesto:

- **Autenticación:** se elige JWT propio y no Firebase/Supabase Auth. Reduce dependencias, y el aislamiento por `tenant_id` queda dentro de tu propio código. Si el tiempo aprieta, la Wallet puede usar login por teléfono o Google más adelante sin cambiar el modelo.
- **Render (plan gratuito):** el servidor se duerme por inactividad y el primer request tarda decenas de segundos. Para demos de la materia hay que "despertarlo" antes, o usar Railway.
- **`express`:** correcto para el alcance. Añadir `helmet`, `cors` con lista blanca y `express-rate-limit` desde el inicio.

## 2. Repositorios

Recomendación: **un monorepo para todo lo web y un repositorio aparte para Unity.**

```
kairos/                      # monorepo (pnpm workspaces)
  apps/
    api/                     # Express + Prisma
    admin/                   # Super Admin y Panel Tenant (React)
    wallet/                  # Wallet PWA (React)
  packages/
    shared/                  # tipos, esquemas Zod, constantes del contrato de la API
    design/                  # tokens.json, theme-kairos.css, theme-tenant.ts
    config/                  # tsconfig, eslint y prettier base
  docs/
  context/

Kairos-Unity/                # repositorio aparte (Unity)
```

Por qué:

- **Monorepo web:** Admin, Wallet y API comparten tipos y la función de tema. Un cambio en el contrato se ve y se prueba en un solo commit. Con un solo desarrollador, evita publicar paquetes o sincronizar versiones a mano.
- **Unity aparte:** el proyecto pesa (assets, binarios), necesita Git LFS y una `.gitignore` propia, y no comparte código con TypeScript. Mezclarlo ralentiza clones y CI.
- **Contrato entre ambos:** la API publica una especificación OpenAPI generada desde los esquemas Zod. Unity se programa contra ese documento.
- **Herramientas:** pnpm workspaces es suficiente. Turborepo se añade solo si los builds se vuelven lentos.
- **Un frontend o dos:** Admin y Wallet son apps separadas. Tienen públicos, temas y ciclos de instalación distintos, y solo la Wallet es PWA. Comparten `packages/design` y `packages/shared`.

## 3. Orden de desarrollo por parcial

Recomendado:

| Parcial | Entrega | Por qué en este lugar |
|---|---|---|
| 1 | Monorepo + API + base de datos + Panel Super Admin y Tenant | Todo lo demás depende del modelo de datos, del login y de la marca del tenant. Fija tokens y contrato de la API |
| 2 | Wallet PWA | Misma tecnología que el parcial 1, así que se avanza rápido. Se prueba con QR de mentira generados por un script de desarrollo, sin esperar a Unity |
| 3 | Terminal Arcade (Unity) | Es la pieza con tecnología distinta y más riesgo. Va al final, cuando el contrato de la API ya está estable. Al integrarla se cierra el flujo completo |

Mitigación de riesgo: durante el parcial 1 hacer una prueba de humo de una tarde en Unity (pedir `GET /stores/:id/brand` y mostrar el color). Confirma que la conexión funciona antes de llegar al parcial 3.

Alternativa: poner Unity en el parcial 2 si prefieres el resultado más visual antes. Se sacrifica poder probar la Wallet con datos reales hasta el parcial 3.

## 4. Decisiones técnicas que conviene fijar desde ya

### 4.1 Aislamiento multi-tenant

- Toda tabla de negocio lleva `tenant_id`.
- Ninguna consulta se escribe sin filtro de tenant. Se centraliza en una capa de acceso (extensión de Prisma o middleware) para no depender de la memoria del desarrollador.
- Opcional y recomendable: Row-Level Security de PostgreSQL como segunda barrera.
- Prueba obligatoria del hito 1: el tenant A no puede leer ni modificar datos del tenant B.

### 4.2 QR firmado por la máquina

Riesgo: si el Arcade firma con una llave secreta compartida, cualquiera que extraiga esa llave del ejecutable de Unity puede fabricar puntos ilimitados.

Propuesta:

- Firma **asimétrica** (ES256 o EdDSA). Cada máquina tiene su propio par de llaves.
- La API guarda solo la llave **pública** de cada máquina, registrada al darla de alta desde el panel del tenant.
- La llave privada se guarda fuera del código (archivo de configuración de la máquina, permisos restringidos).
- El JWT del QR incluye `store_id`, `machine_id`, `score`, `iat`, `exp` corto (60 s o menos) y `jti` único.
- La API guarda cada `jti` usado y rechaza repetidos. Además limita el puntaje máximo por partida y la frecuencia por usuario.
- Si una máquina se ve comprometida, se revoca su llave pública sin afectar a las demás.

Esto reemplaza la "llave secreta" de `planeacion.md` (paso 3.3). Ese documento debería actualizarse cuando lo apruebes.

### 4.3 Canje con OTP

- El OTP se genera en el servidor, no en el teléfono.
- Vinculado a usuario, premio y tenant, con expiración corta y un solo uso.
- Descontar puntos y crear el cupón ocurre en una **sola transacción** de base de datos.
- El empleado valida el código en su panel; la API marca el cupón como canjeado de forma atómica para evitar doble uso.

### 4.4 Sesiones

- Access token corto (15 min) y refresh token con rotación, en cookie `HttpOnly` para los paneles.
- Roles: `super_admin`, `tenant_admin`, `tenant_staff`, `consumer`. Los permisos se comprueban en la API, nunca solo en el frontend.

### 4.5 Entorno y secretos

- Variables de entorno con validación al arrancar (Zod). `.env.example` versionado, `.env` nunca.
- Migraciones de Prisma revisadas antes de aplicarse en producción.

## 5. Pendientes
