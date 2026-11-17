# Spec: Panel de retención y ROI

Estado: **implementada** en API y Admin (2026-11-17). Pendiente: probarla en el navegador y la revisión legal de `docs/TERMINOS.md`.

## 1. Problema

El panel Tenant administra (sucursales, máquinas, premios) pero no responde la pregunta que justifica pagar: **¿este programa me hace volver clientes y me sale rentable?** Sin esa respuesta, Kairos es un juego; con ella, es un producto que se renueva cada mes.

## 2. Objetivo

Dar a cada negocio, en su panel, cuatro cosas:
1. **Retención**: cuántos clientes vuelven.
2. **ROI**: cuánto cuesta el programa frente a lo que genera.
3. **Campañas**: reglas que empujan a volver en horas bajas o tras la primera visita.
4. **Resumen semanal**: lectura automática con una recomendación.

## 3. Ángulo de producto propietario (taller de sistemas propietarios)

Kairos se vende como software cerrado, licenciado y con control del fabricante. La spec lo hace explícito:

| Elemento | Cómo se materializa |
|---|---|
| Licencia por sucursal y por máquina | Ya existe: `plans.ts` limita sucursales y máquinas activas (403 `plan_limit`). |
| Activación y revocación | Ya existe: llave pública por máquina y vinculación de tableta; revocar la máquina deja de acreditar. |
| Funciones por plan | **Nuevo**: la analítica y las campañas se reparten por plan (tabla en §7). |
| Prueba gratis que vence | Ya existe: `TRIAL` y 402 al vencer. |
| Términos de uso (EULA) | **Nuevo**: aceptación versionada al registrar el negocio (§8). |
| Código y llaves cerrados | Repositorio privado; el QR firmado impide fabricar acreditaciones sin la llave de la máquina. |

## 4. Fuera de alcance

Pasarela de pago real, IA generativa, segmentación por demografía, correo o SMS de campañas, y cualquier cambio a la terminal Arcade.

## 5. Métricas (definiciones exactas)

Fuente: `qr_claims` (cada fila = una visita con partida), `wallets`, `coupons`, `point_transactions`. Todo acotado por `tenantId` con `req.db`.

- **Visita**: una fila de `qr_claims`. Varias en el mismo día natural del negocio cuentan como **una** visita-día.
- **Cliente nuevo** en un periodo: su primera visita histórica cae en el periodo.
- **Cliente recurrente**: tiene 2 o más visitas-día en el periodo.
- **Retorno 7 / 30 días**: de los clientes con primera visita hace entre 7 y 14 (o 30 y 60) días, el porcentaje que tuvo otra visita-día en los 7 (o 30) días siguientes a la primera.
- **Costo del programa**: suma de `Reward.unitCost` de los cupones `REDEEMED` cuyo `redeemed_at` cae en el periodo. `unitCost` es un campo nuevo y opcional, en pesos enteros; si algún premio canjeado no lo tiene, el ROI no se calcula y la respuesta lo indica.
- **Ingreso atribuible**: visitas-día de clientes recurrentes × `Tenant.avgTicket` (campo nuevo, pesos enteros, el negocio lo escribe). Es una **estimación**, y el panel la etiqueta así.
- **ROI** = (ingreso atribuible − costo del programa) / costo del programa. Sin costo, se muestra «sin datos».

## 6. Contrato de API (rutas de tenant, solo `tenant_admin`)

| Ruta | Respuesta |
|---|---|
| `GET /tenant/analytics/retention?from&to` | `{ newCustomers, returningCustomers, return7, return30, visitsByDay[], visitsByHour[] }` |
| `GET /tenant/analytics/roi?from&to` | `{ programCost, attributedRevenue, roi, missing: ["avgTicket" \| "unitCost"] }` |
| `GET/POST/PATCH/DELETE /tenant/campaigns` | CRUD de campañas (§7) |
| `GET /tenant/analytics/weekly` | Último resumen semanal: `{ weekStart, headline, recommendation, metrics }` |

Reglas: `from`/`to` máximo 365 días; zona horaria del negocio fija en `America/Mexico_City` hasta que el esquema guarde la propia (documentado como deuda). Consultas agregadas en SQL, con índice `(tenant_id, created_at)` existente.

## 7. Campañas y planes

Una **campaña** modifica la acreditación mientras está activa:

| Tipo | Efecto |
|---|---|
| `MULTIPLIER` | Multiplica los puntos de la partida (×1.5, ×2) en un horario semanal y un rango de fechas |
| `FIRST_VISIT_BONUS` | Puntos extra en la primera visita del cliente en ese negocio |
| `COMEBACK_UNLOCK` | Define `PRIZE_UNLOCK_HOURS` por campaña en vez de global |

Se aplican dentro de `qr-claim.service.ts`, en la misma transacción, y el movimiento `EARN` lleva `note` con el nombre de la campaña. El tope `max_points_per_game` se respeta **después** del multiplicador.

| Función | TRIAL | BASIC | PRO |
|---|---|---|---|
| Retención (últimos 30 días) | sí | sí | sí |
| Retención con rango mayor a 30 días y exportar CSV (el CSV queda para después) | no | no | sí |
| ROI | no | sí | sí |
| Campañas activas a la vez | 0 | 1 | 5 |
| Resumen semanal | no | no | sí |

Si la función no está en el plan: 403 `plan_limit`, igual que sucursales y máquinas. Los nombres de plan salen de `plans.ts`.

## 8. Resumen semanal

Trabajo programado (junto a `expireCoupons()` en `src/index.ts`) que corre los lunes y guarda un registro por negocio. Reglas, no IA:
- Retorno 7 días < 20 % → «Muchos no vuelven: baja el costo del primer premio o activa `COMEBACK_UNLOCK`».
- Hora con más visitas ≥ 3× la media de la hora más baja → «Activa un multiplicador entre X y Y».
- Costo del programa > ingreso atribuible → «Sube el costo en puntos de los premios más canjeados».
- Si ninguna aplica → «Programa estable».

## 9. Aceptación de términos (EULA)

`TermsAcceptance { tenantId, userId, version, acceptedAt, ip }`. `POST /auth/register` exige `acceptTerms: true` y guarda la versión vigente (`TERMS_VERSION` en la API). El texto vive en `docs/TERMINOS.md` (borrador, **no es asesoría legal**; un abogado debe revisarlo antes de vender).

## 10. Panel Admin (React)

- Nueva página **Resultados** con tarjetas (nuevos, recurrentes, retorno 7/30, ROI), gráfica de visitas por día y por hora, y el último resumen.
- Nueva página **Campañas** con lista y formulario.
- Formulario de **Economía del negocio**: añade ticket promedio y costo por premio.
- Textos en `strings.ts`, colores por tokens, sin estados solo por color (según `docs/DISENO.md`).
- Si la función no está en el plan: tarjeta de mejora de plan en lugar de datos.

## 11. Datos de demostración

`seed:analytics` (solo desarrollo): crea 200 clientes y unas 300 visitas de los últimos 45 días con patrón realista (más tráfico en horas pico, abandono tras la 2.ª visita) para que el panel muestre números creíbles en una presentación.

## 12. Criterios de aceptación

1. Con datos de prueba conocidos, `retention` devuelve exactamente los conteos y porcentajes esperados (tests con casos de 1 visita, 2 el mismo día, y regreso a los 6 y 8 días).
2. Un negocio nunca ve datos de otro (test de aislamiento).
3. Un plan sin la función recibe 403 `plan_limit`.
4. Una campaña `MULTIPLIER` fuera de horario no cambia los puntos; dentro, sí, y respeta el tope.
5. Sin `avgTicket` o sin `unitCost`, el ROI dice qué falta en vez de inventar un número.
6. Registrar un negocio sin aceptar términos falla con 400.
7. `pnpm typecheck` y `pnpm test` pasan.

## 13. Plan de tareas

1. Migración fase A: `Tenant.avgTicket`, `Reward.unitCost`. (`Campaign`, `TermsAcceptance` y `WeeklyReport` llegan con sus tareas.)
2. Servicio de analítica (SQL agregado) + tests con casos fijos.
3. Rutas de analítica con control por plan.
4. Campañas: CRUD y aplicación en la acreditación + tests.
5. Resumen semanal programado + tests de las reglas.
6. EULA en el registro.
7. Páginas Resultados y Campañas en el Admin.
8. `seed:analytics`.
9. Documentación: `ARQUITECTURA.md`, `ESQUEMA.md`, `SUSCRIPCIONES.md`.
