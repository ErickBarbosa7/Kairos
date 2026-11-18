# Guía: probar el flujo completo de Kairos

Recorre los tres entregables en orden: **Panel** (Super Admin y negocio) → **Arcade** (terminal) → **Wallet** (cliente) → de vuelta al **Panel** (caja y resultados).

Tiempo estimado: 30 a 40 minutos la primera vez.

## 0. Requisitos y arranque

Terminales (en la raíz de `Kairos`):

```bash
export PATH="$HOME/.npm-global/bin:$PATH:$HOME/flutter/bin"
pnpm db:up                                    # Postgres en :5433
pnpm --filter @kairos/api dev                 # API    http://localhost:3000
pnpm --filter @kairos/admin dev               # Panel  http://localhost:5173
cd apps/wallet && flutter run -d web-server --web-port 5174 --web-hostname 0.0.0.0   # Wallet http://localhost:5174
```

Primera vez (si la base está vacía):

```bash
pnpm --filter @kairos/api exec prisma migrate deploy
ADMIN_EMAIL=dev@kairos.local ADMIN_NAME="Dev Admin" ADMIN_PASSWORD='Kairos-Dev-2026!' pnpm --filter @kairos/api seed:admin
```

Comprueba: `curl localhost:3000/health` responde `{"status":"ok"}`.

**Para probar con el teléfono real** el QR debe apuntar a una IP de la red, no a `localhost`. Averigua tu IP de LAN (`ip -4 addr`) y úsala como `<IP-LAN>` en los pasos 6 y 7. Teléfono y computadora deben estar en la misma red.

## 1. Super Admin: crear un negocio

1. Abre http://localhost:5173, pestaña **Super Admin**.
2. Entra con `dev@kairos.local` / `Kairos-Dev-2026!`.
3. **Negocios → Nuevo negocio**. Llena:
   - Nombre comercial (ej. `Tacos Prueba`).
   - Identificador (slug), por ejemplo `tacos-prueba`. No se puede cambiar después.
   - Plan: elige **PRO** para ver todo el panel (Resultados completos y hasta 5 campañas).
   - Marca: color principal, tema de la Wallet.
   - Economía: puntos de juego por 1 punto, máximo por partida (ej. 50), máximo de partidas por día.
   - Activa **Crear el administrador ahora** y escribe nombre, correo y contraseña (mínimo 10 caracteres).
4. Guarda. Debe aparecer el aviso «… fue creado».

Verifica: el negocio sale en la lista con estado **ACTIVE**.

Atajo: ya existe el negocio `demo-arcade` (plan PRO) con datos de demo. Si prefieres no crear uno, salta al paso 2 con `admin@demo-arcade.local` / `Kairos-Test-2026!`.

## 2. Administrador del negocio: configurar

1. Cierra sesión. En el login elige la pestaña **Tenant** (negocio), escribe el slug, el correo y la contraseña del administrador.
2. **Sucursales** → crea una sucursal (ej. `Centro`).
3. **Premios** → crea 2 o 3 premios:
   - Título, costo en puntos, imagen opcional.
   - Stock vacío = sin límite.
   - Costo del premio (para el ROI), opcional.
4. **Economía** → revisa puntos por partida y llena **Ticket promedio** (ej. 120). Sin él el ROI no se calcula.
5. **Marca** → logo y colores (se ven en Wallet y Arcade, no en el panel).
6. **Personal** → crea un empleado de caja (correo y contraseña de 10 o más caracteres).
7. **Campañas** → crea una, por ejemplo «Doble puntos» tipo multiplicador 200 %, sin horario (siempre vigente). También puedes probar bono de primera visita.

Verifica: la campaña aparece como vigente.

## 3. Vincular la terminal Arcade

Hay dos caminos. Usa el **A** para la prueba más fiel y el **B** si solo quieres arrancar rápido.

### A. Con código temporal (flujo real, tableta o PWA)

1. Abre la terminal sin configuración: pide un **código temporal** de 8 caracteres y lo muestra en pantalla. Detalle en `Kairos-Godot/docs/PWA_TABLETA.md`.
2. En el panel: **Sucursales y máquinas → Vincular terminal**. Escribe el código, ponle nombre a la terminal y elige la sucursal.
3. La terminal arranca con la marca del negocio.

Variante de escritorio: `godot --path ../Kairos-Godot/kairos-arcade -- --link` abre la pantalla «Vincula esta máquina», donde el administrador escribe slug, correo y contraseña del negocio.

### B. Con el seed de demo (solo negocio `demo-arcade`)

```bash
WALLET_URL=http://<IP-LAN>:5174 pnpm --filter @kairos/api seed:arcade
```

Imprime la línea de lanzamiento, parecida a:

```bash
godot --path ../Kairos-Godot/kairos-arcade -- --config=<ruta>/apps/api/secrets/demo-arcade.machine.config.json
```

Ejecútala. Esta máquina ya queda vinculada a `demo-arcade`.

Verifica: en el panel, **Sucursales y máquinas** muestra la máquina como activa.

## 4. Arcade: jugar y generar el QR

1. El menú debe mostrar bajo el título «🔥 Hoy: Doble puntos» si hay campaña vigente.
2. Elige un juego con las flechas y `Espacio`.
3. Para ver la ruleta y el QR rápido, alcanza la **meta de puntaje** del juego (`qr_goal` en `resources/games/*.tres`; puedes bajarla con `qr_goals` en `machine.config.json` mientras pruebas).
4. Al llegar a la meta: pon tus iniciales si entras al marcador, la ruleta gira una vez y sale **¡GANASTE!** con un **QR firmado**, válido 60 segundos.

Si no llegas a la meta, la pantalla dice cuánto faltó y no hay QR.

## 5. Wallet: escanear y acreditar

1. Abre la Wallet en el teléfono: `http://<IP-LAN>:5174`. En la computadora sirve `http://localhost:5174`.
2. Escanea el QR de la pantalla del Arcade (escáner de la Wallet o cámara del teléfono, si el QR es un enlace a la Wallet).
3. La primera vez se crea una **sesión de invitado** sola. Debe aparecer la pantalla de acreditación.
4. En **Inicio**: tarjeta del negocio con tu saldo, barra de progreso hacia el siguiente premio y, si hay campaña activa, una línea «🔥 Doble puntos».
5. Premio de la ruleta: queda como **cupón** en **Premios**, con un código. Si hay espera de desbloqueo, aparece «Próximamente» con la fecha.
6. Opcional: banner **Guarda tus puntos** → **Crear cuenta** con correo y contraseña. Tus puntos de invitado se fusionan.
7. Canje con puntos: **Ver premios** → elige uno que te alcance → se descuentan los puntos y se crea un cupón.

Verifica: el saldo sube según la economía del negocio y la campaña (con «Doble puntos» salen el doble de puntos, con tope por partida).

Los puntos de un QR solo se acreditan una vez: escanear el mismo QR otra vez debe fallar. Un QR vencido (más de 60 s) también falla.

## 6. Caja: canjear el cupón

1. En el panel entra como administrador o como el empleado de caja del paso 2.
2. **Caja** → escribe el código del cupón de la Wallet.
3. Muestra el premio y el cliente; confirma el canje.
4. Vuelve a escribir el mismo código: debe rechazarlo (ya canjeado).

Verifica: en la Wallet, el cupón pasa a **canjeado**.

## 7. Clientes y resultados (administrador)

1. **Clientes** → busca al cliente por nombre o correo. Debe verse tu invitado o tu cuenta.
2. Abre su detalle: saldo, cupones por estado, historial (ganó puntos, canjeó premio).
3. **Ajustar puntos**: escribe `+20` y un motivo (ej. «Cortesía»). El saldo sube y aparece un movimiento «Ajuste manual». Prueba `-9999`: debe rechazarlo porque el saldo no puede quedar negativo.
4. **Resultados**: retención, visitas recurrentes, ROI estimado (necesita ticket promedio) y resumen semanal.
5. Para ver Resultados con volumen sin jugar cientos de partidas:

   ```bash
   TENANT_SLUG=demo-arcade pnpm --filter @kairos/api seed:analytics   # solo desarrollo; corre después de seed:arcade (demo-arcade por defecto)
   ```

Verifica: en Resultados hay cifras de retención y la tarjeta de ROI, marcada como **estimación**.

## 8. Comprobaciones de seguridad y planes

- Entra como empleado de caja: solo debe ver **Caja** y **Premios**.
- En Super Admin, cambia el plan del negocio a **TRIAL**: Resultados y Campañas piden subir de plan.
- En Super Admin, **suspende** el negocio: el login del negocio y la acreditación fallan.
- Pon una fecha de vencimiento pasada a la suscripción: el panel responde 402 (salvo **Plan**) y la máquina no acredita.
- Revoca la máquina en el panel: la terminal deja de generar QR válidos.

## Cuentas de referencia

| Rol | Pestaña | Slug | Correo | Contraseña |
|---|---|---|---|---|
| Super Admin | Super Admin | — | `dev@kairos.local` | `Kairos-Dev-2026!` |
| Administrador | Tenant | `demo-arcade` | `admin@demo-arcade.local` | `Kairos-Test-2026!` |
| Caja | Tenant | `demo-arcade` | `cajero@demo-arcade.local` | `Kairos-Test-2026!` |

## Problemas comunes

| Síntoma | Causa y arreglo |
|---|---|
| `pnpm: command not found` | Falta el `PATH` del paso 0. |
| El panel no carga datos | La API no corre o falló al arrancar: revisa `apps/api/.env`. |
| Login de negocio rechazado | Falta el slug, o el negocio está suspendido o vencido. |
| El teléfono no abre la Wallet | Usa la IP de LAN, no `localhost`, y misma red. |
| El QR no lleva a la Wallet | Genera la config con `WALLET_URL=http://<IP-LAN>:5174`. |
| «subscription_expired» al acreditar | La suscripción venció: corrígela en Super Admin. |
| Resultados vacíos | No hay visitas suficientes: corre `seed:analytics` (paso 7). |
| Campañas piden subir de plan | El plan es TRIAL o BASIC y llegó a su límite: usa PRO. |
| La terminal no muestra «🔥 Hoy» | Sin campaña vigente, sin red o máquina sin vincular. |

## Verificación automática (opcional)

```bash
pnpm typecheck
pnpm test                    # API (203) y design (14)
godot --headless --path ../Kairos-Godot/kairos-arcade --script res://tests/run_tests.gd
```
