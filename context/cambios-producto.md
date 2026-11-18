# Kairos: cambios de producto por entregable

Contexto para agentes y para el equipo. Resume el giro de producto y qué cambia en cada uno de los tres entregables. Los detalles técnicos viven en las specs de `docs/specs/`.

Fecha: 2026-11-17.

## 1. El giro

Kairos deja de venderse como "máquina Arcade con puntos" y pasa a venderse como **plataforma de retención con prueba de ROI**: el negocio paga porque el panel le demuestra si sus clientes vuelven y si el programa le sale rentable. La fidelidad (puntos, premios, QR firmado) sigue siendo el núcleo; la analítica y las campañas son lo que justifica el cobro mensual.

Contexto académico: taller de sistemas propietarios. El producto se plantea como software cerrado y licenciado (licencia por sucursal y por máquina, activación y revocación con llaves, funciones por plan, aceptación de términos). El objetivo real es que sea vendible.

Specs relacionadas:
- `docs/specs/wallet-login.md`: cuenta opcional en la Wallet. **Implementada.**
- `docs/specs/retencion-roi.md`: retención, ROI, campañas y resumen semanal. **Borrador, pendiente de aprobación.**

## 2. Los tres entregables

| Entregable | Dónde vive | Rol en el producto |
|---|---|---|
| Panel y API | `apps/api`, `apps/admin` | Lo que se vende: gestión, analítica, campañas, planes |
| Wallet | `apps/wallet` (Flutter) | Lo que usa el cliente final: puntos, premios, cuenta |
| Arcade | repo aparte `Kairos-Godot` | Lo que atrae al cliente en el local: juego y QR |

### 2.1 Panel y API (el producto que se vende)

**Ya hecho**
- Multi-tenant con aislamiento doble, roles, planes y límites, prueba gratis que vence.
- Acreditación de QR firmado, canje de premios, cupones con desbloqueo diferido.
- Rutas de cuenta del cliente: `POST /wallet/register` y `POST /wallet/login`, con fusión de invitado en `account.service.ts` (migración `20261117120000_consumer_password`).

**Hecho (spec `retencion-roi.md`, 2026-11-17)**: todo lo de esta lista está implementado y con tests; falta probarlo en el navegador.

**Alcance de la spec**
- Esquema: `Tenant.avgTicket`, `Reward.unitCost`, y tablas `Campaign`, `TermsAcceptance` y `WeeklyReport`.
- Analítica: `GET /tenant/analytics/retention`, `/roi` y `/weekly`, con SQL agregado y control por plan.
- Campañas: CRUD en `/tenant/campaigns` y aplicación dentro de `qr-claim.service.ts`, en la misma transacción. Tipos: `MULTIPLIER`, `FIRST_VISIT_BONUS`, `COMEBACK_UNLOCK`.
- Resumen semanal programado junto a `expireCoupons()`. Reglas fijas, sin IA.
- Aceptación de términos al registrar un negocio (`acceptTerms`, `TERMS_VERSION`).
- Panel Admin: páginas **Resultados** y **Campañas**; el formulario de economía del negocio añade ticket promedio y costo por premio; tarjeta de mejora de plan cuando la función no está incluida.
- `seed:demo-analytics` con datos creíbles para presentar.

**Reglas que se mantienen**
- Rutas de tenant siempre con `req.db`; todo modelo con `tenant_id` va en `TENANT_MODELS`.
- Textos en español en `apps/admin/src/strings.ts`; colores solo por tokens; panel admin siempre con marca Kairos.
- Gate antes de commitear: `pnpm typecheck` y `pnpm test`.

### 2.2 Wallet (Flutter)

**Ya hecho**
- Sesión de invitado automática al escanear el primer QR.
- Inicio con progreso hacia el siguiente premio, premios, cupones y escáner.
- Cuenta opcional con correo y contraseña: banner «Guarda tus puntos» en Inicio y pantalla de cuenta con «Crear cuenta», «Entrar» y «Seguir sin cuenta» (`screens/account.dart`, `Api.register/login/logout`).

**Por hacer**
- **Hecho:** campaña activa visible en Inicio (`activeCampaigns` en `GET /wallet/balances`, filtradas con `isRunning`).
- **Hecho:** el desbloqueo por campaña `COMEBACK_UNLOCK` se ve en el cupón, porque el servidor fija `validFrom` y la Wallet lo muestra.
- Pendientes de cuenta: verificación de correo y recuperación de contraseña, que requieren proveedor de correo. OTP por teléfono, Google y Apple siguen fuera de alcance.

**Por qué importa para el producto:** una cuenta persistente hace que la retención se mida sobre personas reales y no sobre teléfonos que borran sus datos. Los invitados siguen contando, pero se pierden si cambian de dispositivo.

### 2.3 Arcade (Godot, repo `Kairos-Godot`)

**Sin cambios obligatorios.** Las campañas se aplican en el servidor al acreditar el QR, así que la terminal no necesita saber nada y su QR firmado no cambia. Esto es deliberado: tocar la terminal obligaría a actualizar máquinas ya instaladas.

**Opcional**
- Mostrar en la pantalla de inicio de la terminal la campaña vigente como gancho. Requeriría una ruta pública parecida a `GET /public/stores/:id/rewards` y un cambio pequeño en Godot.
- Para demos: `seed:arcade` ya deja negocio, premios, cajero y la configuración de la máquina. Para que el teléfono abra el QR hay que generarlo con `WALLET_URL=http://<IP-LAN>:5174`.

## 3. Cómo se relacionan

1. El cliente juega en la **Arcade**; la terminal firma un QR con la llave de su máquina.
2. La **Wallet** lo escanea (o lo abre desde la cámara) y la **API** acredita puntos o un premio, aplicando campañas activas.
3. Cada acreditación alimenta las métricas que el **Panel** convierte en retención, ROI y recomendaciones.
4. El plan del negocio decide qué funciones ve; la licencia por máquina decide si puede acreditar.

## 4. Orden de trabajo sugerido

1. Aprobar `retencion-roi.md` (planes, zona horaria, EULA).
2. API: migración, analítica y rutas con control por plan.
3. API: campañas y su aplicación en la acreditación.
4. Panel: Resultados y Campañas.
5. Resumen semanal y `seed:demo-analytics`.
6. Wallet: campaña activa visible.
7. Opcional: aviso de campaña en la terminal.

## 5. Riesgos y deudas conocidas

- El ROI usa un ingreso **estimado** (visitas recurrentes × ticket promedio). Debe etiquetarse como estimación y no afirmarse como dato contable.
- Zona horaria fija en `America/Mexico_City` hasta que el esquema guarde la del negocio.
- `TERMINOS.md` será un borrador sin valor legal; un abogado debe revisarlo antes de vender.
- Correo de cliente sin verificar y sin recuperación de contraseña.
- La meta de QR (`qr_goal`) no se aplica en la API: una máquina comprometida podría emitir QR sin meta. Mitigado por topes por partida y por día, y por revocación.
- La Wallet no tiene tests.
