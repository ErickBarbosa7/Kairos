# Spec: negocios cercanos en la Wallet

Estado: **idea, sin implementar.** Se evaluó el 2026-11-17. Va después del rediseño de la Wallet, porque comparten pantallas.

## Idea

El cliente abre la Wallet (app o web) y ve los negocios suscritos a Kairos que están cerca, para que sepa dónde puede jugar por recompensas. Sirve también como argumento de venta de la suscripción: «apareces en la app».

## Qué existe hoy

- `Store` tiene `name` y `address`, sin coordenadas.
- El negocio tiene logo y colores.
- La Wallet Flutter corre en Android, iOS y web, así que el cliente puede entrar sin descargar nada.

## Qué hay que construir

1. **Coordenadas por sucursal.** Columnas `latitude` y `longitude` en `Store`, con CHECK de rango (−90 a 90 y −180 a 180). El administrador pone la ubicación en el panel con un pin en el mapa o con un buscador de dirección.
2. **Visibilidad opcional.** Campo para que un negocio decida si aparece en «Cerca de ti» (`listedNearby`, por defecto activo).
3. **Ruta pública** `GET /public/stores/nearby?lat=&lng=&radius=`. Solo sucursales activas, con coordenadas y listadas, de negocios con suscripción activa. Devuelve nombre del negocio y de la sucursal, logo, color, distancia y hasta 3 premios destacados. Orden por distancia, tope de 20 resultados y radio máximo (por ejemplo 25 km).
4. **Pantalla «Cerca de ti»** en la Wallet. Pide permiso de ubicación con una explicación breve. Primero lista ordenada por distancia; el mapa es opcional.
5. **Panel.** Campo de ubicación en Sucursales y casilla para aparecer o no en la búsqueda. Texto de ayuda con `HelpHint`.

La distancia se calcula con la fórmula de Haversine en SQL. PostGIS solo hace falta con miles de sucursales.

## Decisiones abiertas

| Tema | Opciones | Nota |
|---|---|---|
| Mapa | Lista sola, o mapa con OpenStreetMap (`flutter_map`) | La lista es gratis y basta para empezar |
| Geocodificar direcciones | Pin manual del dueño, Nominatim, Google | Google tiene costo; el pin manual no |
| Filtro por tipo de negocio | Sin filtro, o categoría en `Tenant` (spa, barbería, café…) | La categoría también ayuda a la landing |
| Quién aparece | Todos los suscritos, o solo los que lo activen | Recomendado: activo por defecto y desactivable |

## Privacidad y abuso

- La ubicación del cliente se envía solo para la consulta y no se guarda ni se registra.
- Redondear las coordenadas que se aceptan (unos 3 decimales) y no devolver direcciones exactas de negocios que no quieran aparecer.
- Limitar consultas por IP con el mismo `rate-limit` que las rutas públicas, y tope de resultados, para que nadie raspe todos los negocios.
- Respetar el permiso del sistema: si el cliente lo niega, se ofrece buscar por ciudad o colonia, sin bloquear la Wallet.

## Riesgo de producto

- **Densidad:** con pocos negocios por ciudad la lista da poco valor. Mostrar la pantalla solo si hay resultados en el radio, y mientras tanto dejar el inicio actual.
- **Dos usos distintos:** hoy el cliente llega escaneando el QR de un local; con descubrimiento llega buscando. La pantalla de inicio debe servir a ambos.
- **Promesa al negocio:** aparecer en la búsqueda no garantiza clientes. No venderlo como captación segura.

## Esfuerzo estimado

- Lista de cercanos (migración, ruta, campo en el panel, pantalla): 1 a 2 días.
- Mapa con pines y filtro por tipo de negocio: 2 a 3 días más.
- Tests: la ruta se prueba con supertest (orden por distancia, exclusión de suspendidos, vencidos y no listados, tope de resultados, aislamiento).
