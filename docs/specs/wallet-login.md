# Spec: Inicio de sesión opcional en la Wallet

Estado: **aprobada e implementada** (API + Wallet). Prueba manual en la Wallet web pendiente.

## 1. Problema

La Wallet solo tiene cuentas de invitado (`POST /wallet/guest`). El token vive en el dispositivo: si el cliente borra los datos del navegador o cambia de teléfono, pierde sus puntos y cupones. Un login obligatorio rompería la fricción cero, que es el valor del producto.

## 2. Objetivo

- El cliente **puede usar la Wallet sin cuenta** (invitado), como hoy.
- El cliente **puede crear una cuenta o iniciar sesión** cuando quiera, para conservar y recuperar sus puntos.
- Crear cuenta **no pierde** lo ya acumulado como invitado.

## 3. Fuera de alcance

- OTP por SMS o correo, recuperación de contraseña, Google/Apple. Requieren proveedor externo; quedan para una etapa posterior (el esquema ya admite `phone`, `email` y `*_verified_at`).
- Cambiar el panel Admin o la terminal Arcade.

## 4. Decisiones

| # | Decisión | Motivo |
|---|---|---|
| D1 | Identificador: **correo + contraseña**. | No necesita proveedor de correo/SMS; se puede probar ya en desarrollo. |
| D2 | El correo queda **sin verificar** (`email_verified_at = null`). | Sin proveedor no se puede verificar. Se documenta como deuda. |
| D3 | **Registrar** = convertir al invitado actual en cuenta (mismo `consumer.id`). | Conserva billeteras, cupones y movimientos sin migrar datos. |
| D4 | **Iniciar sesión** en un dispositivo con invitado que ya tiene datos = **fusionar** el invitado en la cuenta existente. | Evita perder puntos ganados antes de entrar. |
| D5 | Contraseña con Argon2 (`src/lib/password.ts`), mínimo 8 caracteres. | Reutiliza lo que ya usa el panel. |
| D6 | Token de cuenta con la misma audiencia `kairos-wallet`; vigencia `GUEST_TOKEN_DAYS`. | Sin cambios en `requireConsumer`. |
| D7 | Cerrar sesión borra el token local; la Wallet vuelve a crear un invitado al necesitarlo. | Sin fricción. |

## 5. Contrato de API

Todas bajo `/wallet`, con límite de peticiones por IP (10/hora en registro y login).

### 5.1 `POST /wallet/register` (token de invitado requerido)
Cuerpo: `{ email, password, displayName? }`.
- 200: `{ token, me }`. El consumer pasa a `isGuest=false` con `email` normalizado (minúsculas, recortado) y `passwordHash`.
- 409 `email_taken` si el correo ya existe. La Wallet ofrece entonces iniciar sesión.
- 409 `already_registered` si el consumer ya no es invitado.
- 400 por correo o contraseña inválidos.

### 5.2 `POST /wallet/login` (token de invitado opcional)
Cuerpo: `{ email, password }`.
- 200: `{ token, me }` de la cuenta.
- 401 `invalid_credentials` (mismo mensaje exista o no el correo; comparar hash también si no existe, para no filtrar por tiempo).
- Si llega token de invitado **distinto** a la cuenta: en **una transacción** se fusiona (ver 5.3) y el invitado se marca `deletedAt`.

### 5.3 Fusión de invitado → cuenta
En una transacción, con las billeteras bloqueadas:
1. Por cada `wallet` del invitado: si la cuenta no tiene billetera en ese negocio, se reasigna `consumerId` (el historial viaja con la billetera); si la tiene, se suman `balance` y `lifetimeEarned`, se inserta un `EARN` nuevo y se reasignan `coupons` y `qr_claims`.
2. El libro de movimientos es inmutable (trigger): nunca se edita ni se mueve una fila, solo se insertan nuevas.
3. Se conserva `UNIQUE (jti)` en `qr_claims`: nada se acredita dos veces.
4. El invitado queda con `deletedAt` y sin datos.

### 5.4 `GET /wallet/me`
Añade `email` (puede ser `null`).

### 5.5 Esquema
`Consumer` añade `passwordHash String? @map("password_hash")`. Migración nueva; el `CHECK` de identificador existente no cambia.

## 6. Wallet (Flutter)

- **Home**: si `isGuest`, banner discreto «Guarda tus puntos» → pantalla de cuenta. Nunca bloquea el uso.
- **Pantalla de cuenta** (`screens/account.dart`): pestañas «Crear cuenta» e «Iniciar sesión»; enlace «Seguir sin cuenta» que cierra la pantalla.
- **Con sesión**: muestra correo y botón «Cerrar sesión».
- Errores en español, textos en `strings.dart`, colores solo desde `theme.dart`.
- `api.dart`: `register`, `login`, `logout`; tras login/registro se guarda el token nuevo.

## 7. Seguridad

- Límite de peticiones en `/register` y `/login`.
- Respuestas de login sin distinguir correo inexistente de contraseña errónea.
- El hash nunca sale en ninguna respuesta.
- `login` con token de invitado de otro cliente solo fusiona si ese token es válido y es invitado.

## 8. Criterios de aceptación

1. Un invitado con puntos se registra y mantiene saldo, cupones y movimientos (mismo `consumer.id`).
2. Un invitado con puntos inicia sesión en una cuenta existente: los saldos se suman por negocio y no se pierde ningún cupón.
3. Un correo repetido devuelve 409 `email_taken`.
4. Credenciales incorrectas devuelven 401 igual con correo existente o no.
5. Sin cuenta, el flujo de escanear QR y canjear premios funciona igual que hoy.
6. Cerrar sesión y volver a entrar recupera los puntos en otro navegador.
7. Tests de API: registro, login, fusión (con y sin billetera en común), correo repetido, límite. `pnpm typecheck` y `pnpm test` pasan.

## 9. Plan de tareas

1. Migración + modelo `passwordHash`.
2. Servicio de fusión + tests de integración.
3. Rutas `register` y `login` + tests.
4. `api.dart`, `strings.dart`, pantalla de cuenta, banner en home.
5. Actualizar `docs/ACREDITACION.md` y `docs/ESQUEMA.md`.
6. Prueba manual en la Wallet web.
