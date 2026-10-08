# Prueba gratis y planes

Cómo un negocio entra con una prueba gratis y cómo se le pide después que elija un plan.

## Flujo

1. **Registro** (`POST /auth/register`, público): nombre del negocio, nombre del administrador, correo y contraseña (mínimo 10 caracteres). Crea el negocio en plan `TRIAL` con vencimiento a `TRIAL_DAYS` días (14 por defecto, variable de entorno), crea a su administrador y abre sesión. El **identificador** para entrar se genera del nombre (`Café Aurora` → `cafe-aurora`; si ya existe, se le añade un sufijo de 4 caracteres) y se muestra al registrarse.
2. **Durante la prueba** el panel funciona completo y muestra "Prueba gratis: te quedan N días", con un enlace a los planes.
3. **Al vencer** (`subscription_ends_at` ya pasó):
   - El panel responde `402 subscription_required` en todo menos en `/tenant/subscription*`. En la web, solo se puede ver la página **Plan**. El personal de caja también queda bloqueado.
   - Las máquinas dejan de entregar recompensas y puntos: `POST /wallet/claims` responde `403 subscription_expired`.
   - Los datos se conservan.
4. **Elegir plan**: el administrador pulsa "Quiero este plan" (Básico o Pro) → `POST /tenant/subscription/request`. Queda como `requested_plan` con fecha.
5. **Activación**: el Super Admin ve "Pidió Básico/Pro" en la lista de negocios y fija el plan y la fecha de vencimiento (`PATCH /admin/tenants/:id`). Al fijar un plan se borra la solicitud pendiente. El negocio recupera el acceso en cuanto el Super Admin lo activa; no necesita volver a iniciar sesión (la página Plan vuelve a leer el estado al abrirse).

## Planes: precios y límites

Están en un solo archivo, `apps/api/src/lib/plans.ts`. La API aplica los límites y la landing y el panel leen los mismos valores de `GET /public/plans`, así que lo que se muestra es lo que se cumple. Para cambiar un precio o un tope, se edita ahí.

| Plan | Precio (MXN al mes) | Sucursales | Máquinas Arcade |
|---|---|---|---|
| Prueba | Gratis, `TRIAL_DAYS` días | 1 | 1 |
| Básico | $149 | 2 | 2 |
| Pro | $499 | 10 | 10 |

Todos incluyen la máquina con la marca del negocio, la ruleta de recompensas, la caja y el panel.

- **Cómo se aplican:** al crear una sucursal (o reactivar una desactivada) o al registrar una máquina, si el negocio ya tiene el tope de **activas**, la API responde `403 plan_limit` con un mensaje claro ("Tu plan permite hasta 1 sucursal. Sube de plan en la sección Plan…"). Las sucursales desactivadas y las máquinas revocadas no cuentan. La app de la terminal muestra ese mensaje al vincular.
- **Negocios que ya pasan el tope** (por ejemplo, tras bajar de plan) conservan lo que tienen; solo se les impide crear más.
- **Orden de las respuestas:** primero se valida el dato (400) y después se revisa el tope (403).
- **Carrera:** dos peticiones simultáneas que crean el último lugar podrían pasar las dos, porque no hay un candado entre contar y crear. Es raro (hace falta enviarlas a la vez), pero el tope no es estrictamente garantizado.
- `GET /tenant/subscription` devuelve `limits` y `usage` (lo que lleva usado); la página Plan lo muestra en el plan actual.

## Rutas

| Ruta | Quién | Qué hace |
|---|---|---|
| `POST /auth/register` | Público, 5 por hora y por IP | Alta con prueba gratis |
| `GET /public/plans` | Público | Precios, límites y días de prueba |
| `GET /tenant/subscription` | Administrador y caja | Estado (`plan`, `endsAt`, `daysLeft`, `expired`, `onTrial`, `requestedPlan`), `limits` y `usage` |
| `POST /tenant/subscription/request` | Solo administrador | Pide `BASIC` o `PRO` |
| `GET /auth/me` | Cualquier usuario del negocio | Incluye `subscription` |

## Lo que todavía no existe

- **Cobro en línea:** pedir un plan solo deja una solicitud; el Super Admin lo activa a mano.
- **Verificación del correo:** cualquiera puede registrar un negocio con cualquier correo. El límite de 5 registros por hora y por IP frena el abuso, pero no lo impide.
- **Aviso por correo** de que la prueba está por terminar o de que se activó el plan.
- **Suspensión automática:** vencer bloquea el panel y las máquinas, pero el `status` del negocio no cambia solo.
- **Límites de personal de caja y de recompensas:** solo se limitan sucursales y máquinas; el personal y las recompensas no tienen tope por plan.

## Negocios sin fecha de vencimiento

Un negocio con `subscription_ends_at` vacío no vence nunca (así los crea el Super Admin si no pone fecha).
