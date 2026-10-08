# Acreditación de QR

Cómo la API convierte el QR que muestra una máquina Arcade en **una recompensa** (QR de premio, el que genera hoy la terminal) o en **puntos de Wallet** (QR de puntos). Implementa la operación 5.1 de `ESQUEMA.md`.

La terminal solo muestra un QR a quien llega a la meta de su juego y gira la ruleta: la recompensa que sale viaja firmada en el QR (`reward_id`).

Código: `apps/api/src/modules/wallet/` (`qr-claim.service.ts`, `wallet.routes.ts`). Pruebas: `apps/api/test/qr-claim.test.ts`.

## Rutas

Las dos exigen un **token de cliente** (`Authorization: Bearer ...`), distinto al del panel: la audiencia es `kairos-wallet`, así que un token de panel no sirve aquí ni al revés.

| Ruta | Qué hace |
|---|---|
| `POST /wallet/claims` | Cuerpo `{ "qr": "<JWT del QR>" }`. Verifica y acredita. Responde 201 con `claimId`, `pointsAwarded`, `score`, `balance`, `lifetimeEarned`, `tenant` y `store`; si el QR es de premio, además `reward` y `coupon` (con el `code` para caja) |
| `GET /wallet/balances` | Saldo del cliente en cada negocio activo donde tiene billetera |
| `GET /public/stores/:id/rewards` | **Pública.** Recompensas que puede ganar la ruleta de esa sucursal: activas, no borradas y con existencias. La usa la terminal |

## Qué se comprueba, en orden

1. El QR es un JWT con `machine_id`. Con él se busca la máquina y su **llave pública** (ES256 o EdDSA). El negocio sale de la máquina, nunca de lo que mande el cliente.
2. La firma y el vencimiento (`exp`, con 5 s de margen de reloj). Un QR vencido responde `qr_expired`; cualquier otro defecto, `qr_invalid`, sin detalles.
3. Los datos del QR: `store_id` y `machine_id` coinciden con la máquina, `score` es un entero entre 0 y 100 000 000, `jti` es un identificador válido, la vigencia (`exp - iat`) no pasa de **60 s** y `iat` no está en el futuro (más de 30 s).
4. Máquina `ACTIVE`, negocio `ACTIVE` y sucursal activa; si no, 403 `machine_inactive`.
5. Si el `jti` ya se usó, 409.
6. Según el QR:
   - **QR de premio** (trae `reward_id`): la recompensa debe ser **de este negocio** (si no existe, está borrada o es de otro negocio, `qr_invalid`) y estar activa (`reward_unavailable` si no). En **una transacción**: se crea la billetera y se **bloquea**, se comprueba el tope diario, se inserta el `qr_claims` (con `reward_id` y 0 puntos; el `UNIQUE (jti)` es la defensa real), se **descuenta el stock** si la recompensa lo limita (`reward_sold_out` si ya no queda, y todo se deshace) y se crea un **cupón `PENDING`** (`points_cost` 0, enlazado al QR por `qr_claim_id`, vigente 7 días) que se canjea en caja con su código. No toca el libro de puntos.
   - **QR de puntos** (sin `reward_id`): `puntos = min(floor(score / score_per_point), max_points_per_game)`; si da 0, 422 `score_too_low` y no se consume. En **una transacción**: billetera bloqueada, tope diario, `qr_claims` y suma al saldo y al libro (`point_transactions`, tipo `EARN`).

## Errores

| Código HTTP | `error.code` | Cuándo |
|---|---|---|
| 400 | `qr_invalid` | Firma, formato o datos incorrectos |
| 400 | `qr_expired` | Pasaron los 60 s de vida del QR |
| 401 | `unauthorized` | Sin token, token inválido, o cliente borrado |
| 403 | `machine_inactive` | Máquina revocada, negocio suspendido o sucursal inactiva |
| 403 | `subscription_expired` | La prueba o el plan del negocio ya venció |
| 409 | `conflict` | QR ya usado |
| 409 | `reward_sold_out` | La recompensa se agotó (no consume el QR) |
| 409 | `reward_unavailable` | La recompensa fue desactivada |
| 422 | `score_too_low` | El puntaje no alcanza para 1 punto |
| 429 | `daily_limit` | Se llegó a `max_games_per_day` en este negocio |

## Decisiones que conviene conocer

- **El QR es un portador:** quien lo acredite primero se lleva los puntos. No hay forma de saber quién jugó, y el `jti` único evita que se acredite dos veces.
- **Tope diario:** cuenta las acreditaciones de las **últimas 24 horas** (ventana móvil), por cliente y por negocio. No usa el día calendario porque el esquema no guarda zona horaria del negocio.
- **Peticiones simultáneas:** el bloqueo de la billetera serializa las acreditaciones de un mismo cliente en un mismo negocio, así que ni el saldo ni el tope diario tienen carreras (hay pruebas con peticiones paralelas).
- **Cupones de premio:** `points_cost` es 0 y no hay movimiento en el libro. La futura tarea que vence cupones y devuelve puntos (`ESQUEMA.md` 5.4) debe **omitir** los cupones con `qr_claim_id` (no hay puntos que devolver) y, si quiere, devolver el stock.
- **Probabilidades de la ruleta:** la terminal sortea con la misma probabilidad cada casilla. Ponderar por costo requeriría un campo nuevo en las recompensas.
- **La meta de QR no se aplica aquí.** La terminal solo muestra QR a quien llega a la meta de su juego (`qr_goal`), pero la API acredita cualquier QR válido. Una máquina comprometida podría emitir QR sin meta; por eso existen el tope por partida, el tope diario y revocar la máquina.
- **Relojes:** la máquina debe tener la hora correcta; el margen es de 5 s para el vencimiento y 30 s para `iat`.

## Inicio de sesión del cliente (pendiente)

El cliente (`consumers`) todavía no tiene cómo iniciar sesión: el esquema prevé verificación por teléfono o correo (OTP), que es parte de la Wallet. Mientras tanto, los tokens salen de:

```sh
pnpm --filter @kairos/api seed:consumer     # solo desarrollo; crea demo@kairos.local e imprime su token
```

Ejemplo para acreditar un QR leído de la pantalla de una terminal:

```sh
curl -s -X POST localhost:3000/wallet/claims \
  -H "Authorization: Bearer $CONSUMER_TOKEN" -H 'content-type: application/json' \
  -d "{\"qr\":\"$QR_TOKEN\"}"
```

El QR vive 60 s: hay que acreditarlo dentro de ese tiempo.
