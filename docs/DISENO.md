# Kairos — Guía de Diseño y Color

Versión 0.3 · Estado: paleta y tipografía aprobadas

Este documento define la identidad visual de Kairos y el sistema de theming multi-tenant. Es la fuente única de verdad para Admin, Wallet PWA y Terminal Arcade.

## 1. Principios

1. **Arcade con criterio.** El tono es lúdico y energético, pero las pantallas de gestión (dashboards) son sobrias y legibles.
2. **La marca del negocio manda donde el cliente mira.** En Wallet y Arcade domina el color del tenant. Kairos queda como marca secundaria ("powered by").
3. **Tokens, no valores sueltos.** Ningún componente usa hex directo. Todo sale de tokens semánticos.
4. **Accesibilidad por defecto.** WCAG 2.2 AA como mínimo, sin importar qué color elija el tenant.
5. **Mobile first.** La Wallet se usa de pie, con una mano, en un local con luz variable.

## 2. Superficies y qué marca usan

| Superficie | Usuario | Marca dominante | Tema base |
|---|---|---|---|
| Panel Super Admin | Propietario SaaS | Kairos | Claro y oscuro |
| Panel Tenant | Dueño / empleado | Kairos + logo del tenant | Claro y oscuro |
| Wallet PWA | Consumidor final | Tenant (Kairos en footer) | Claro u oscuro, definido por el tenant; el consumidor puede cambiarlo |
| Terminal Arcade (Unity) | Consumidor final | Tenant | Oscuro (ambiente de arcade) |

Decisión: los paneles administrativos usan Kairos y no el color del tenant. Así se evita que un color mal elegido rompa la usabilidad de herramientas de trabajo. El tenant solo aporta logo y acento puntual.

## 3. Paleta de marca Kairos

Concepto: noche de arcade. Fondo profundo, violeta eléctrico como color principal, cian como acento de interacción y ámbar como color de puntos y monedas.

### 3.1 Colores base

| Token | Hex | Uso |
|---|---|---|
| `kairos-primary` | `#7C3AED` | Acciones principales, marca |
| `kairos-primary-hover` | `#6D28D9` | Hover / pressed |
| `kairos-accent` | `#22D3EE` | Foco, enlaces, elementos interactivos secundarios |
| `kairos-reward` | `#FBBF24` | Puntos, monedas, premios |
| `kairos-night` | `#0B0B1A` | Fondo oscuro principal |
| `kairos-night-raised` | `#151530` | Tarjetas y superficies elevadas (oscuro) |
| `kairos-night-line` | `#2A2A4A` | Bordes y divisores (oscuro) |
| `kairos-paper` | `#F8F7FC` | Fondo claro principal |
| `kairos-paper-raised` | `#FFFFFF` | Tarjetas (claro) |
| `kairos-paper-line` | `#E4E2F0` | Bordes y divisores (claro) |

### 3.2 Texto

| Token | Claro | Oscuro |
|---|---|---|
| `text-primary` | `#14132B` | `#F4F3FF` |
| `text-secondary` | `#4B4A6B` | `#B8B6D6` |
| `text-disabled` | `#8A88A8` | `#6B6990` |

### 3.3 Semánticos de estado

| Estado | Hex | Uso en Kairos |
|---|---|---|
| `success` | `#16A34A` | Cupón canjeado, tenant activo |
| `warning` | `#D97706` | Suscripción por vencer, QR por expirar |
| `danger` | `#DC2626` | Tenant suspendido, error, QR inválido |
| `info` | `#0284C7` | Avisos neutros |

Regla: el estado nunca se comunica solo con color. Siempre va acompañado de icono y texto.

### 3.4 Escalas

Cada color de marca y de estado tiene una escala 50–950 generada desde el valor base (base = 500 o 600). Se genera una sola vez, se versiona en `tokens` y no se edita a mano por componente.

## 4. Sistema de theming multi-tenant (el "Camaleón")

### 4.1 Qué controla el tenant

Solo cuatro entradas, para mantener control de calidad:

- `logo` (imagen)
- `primary_color` (hex)
- `secondary_color` (hex, opcional)
- `theme_mode` (`light` | `dark` | `auto`): tema por defecto de su Wallet. `auto` sigue el sistema del teléfono. El consumidor final siempre puede cambiarlo con un interruptor.

Cada tenant se valida en ambos temas, porque el usuario puede alternar. El contraste del punto 4.3 se comprueba en claro y en oscuro.

Todo lo demás se **deriva** automáticamente.

### 4.2 Qué se deriva

A partir de `primary_color` el sistema calcula:

| Token derivado | Cómo se obtiene |
|---|---|
| `--tenant-primary` | Valor ingresado, ajustado si falla contraste (ver 4.3) |
| `--tenant-on-primary` | Blanco o casi negro, el que dé mayor contraste sobre el primario |
| `--tenant-primary-hover` | Primario con 8% más oscuro (tema oscuro: 8% más claro) |
| `--tenant-primary-subtle` | Primario al 12% de opacidad sobre la superficie |
| `--tenant-focus-ring` | Primario o accent de Kairos, el que contraste ≥ 3:1 con el fondo |

Si el tenant no define secundario, se usa `kairos-reward` para puntos y se omite el secundario.

### 4.3 Guardarraíles de accesibilidad

Se validan en el panel del tenant al guardar y de nuevo al servir el tema:

1. **Texto sobre primario:** contraste ≥ 4.5:1. El sistema elige `on-primary` automáticamente. Si ninguna opción llega a 4.5:1, se ajusta la luminosidad del primario hasta cumplirlo y se avisa al tenant con una vista previa.
2. **Primario sobre el fondo de la Wallet:** contraste ≥ 3:1 para bordes, iconos y botones. Si falla, se usa una variante ajustada solo para ese fondo.
3. **Vista previa obligatoria** en el formulario de marca (Wallet y Arcade simulados, claro y oscuro) antes de publicar.
4. **Colores rechazados:** grises casi neutros sin saturación pueden aprobarse, pero se advierte de baja distinción respecto al fondo.

### 4.4 Implementación

Variables CSS en la raíz, sobrescritas por tenant en tiempo de ejecución:

```css
:root {
  --color-bg: #0b0b1a;
  --color-surface: #151530;
  --color-text: #f4f3ff;
  --tenant-primary: #7c3aed;      /* fallback: Kairos */
  --tenant-on-primary: #ffffff;
}

[data-tenant] {
  /* valores inyectados desde la API al cargar el tenant */
}
```

Tailwind consume los tokens, no hex:

```js
// tailwind.config.js
theme: {
  extend: {
    colors: {
      brand: 'var(--tenant-primary)',
      'on-brand': 'var(--tenant-on-primary)',
      surface: 'var(--color-surface)',
      reward: 'var(--color-reward)',
    },
  },
}
```

Reglas de uso:

- Un componente de Wallet usa `brand` / `on-brand`. Nunca `violet-600`.
- Un componente de admin usa siempre `kairos-*`.
- Si la API falla o el tenant no tiene tema, se cae al tema Kairos.
- Evitar parpadeo: el `store_id` del último tenant se guarda en cache local y el tema se aplica antes del primer render.

### 4.5 Terminal Arcade (Unity)

- Recibe de la API los mismos tres valores (`logo`, `primary`, `secondary`) y calcula `on-primary` con la misma fórmula de luminancia relativa, para que el resultado coincida con la web.
- Fondo del juego siempre oscuro (`kairos-night` o derivado), para que el color del tenant destaque.
- Puntos y monedas usan `kairos-reward` para dar consistencia entre Arcade y Wallet.
- Fallback embebido en el build por si no hay red: tema Kairos.
- El QR se dibuja siempre en negro sobre blanco con margen mínimo (quiet zone) de 4 módulos, sin tematizar. Prioridad: que escanee.

## 5. Tipografía

Idea: Kairos significa "el momento oportuno". La tipografía mezcla dos mundos: la energía de una pantalla arcade (grotesca gruesa, con carácter) y la elegancia de una cursiva serif que marca el instante importante.

| Rol | Fuente | Fallback | Uso |
|---|---|---|---|
| Display | Bricolage Grotesque (600–800, eje de ancho variable) | system-ui | Títulos, saldo de puntos, cifras grandes |
| Acento | Instrument Serif, cursiva | Georgia, serif | Palabra clave dentro de un título, logotipo "Kairos", mensajes de celebración |
| Texto | Figtree (400–600) | system-ui | UI, formularios, tablas |
| Mono | JetBrains Mono (500) | ui-monospace | Códigos OTP, IDs |

Cómo se combinan:

- **Regla de la cursiva:** una sola palabra por título en cursiva serif, la que lleva la emoción. Ejemplo: "Tu próximo *premio* está cerca". Nunca frases completas en cursiva.
- **Logotipo:** "Kairos" en Instrument Serif cursiva, con la K alta. Sirve como marca secundaria ("powered by") sin competir con el logo del tenant.
- **Puntos:** el saldo va en Bricolage Grotesque 800 con `tabular-nums`. Es el elemento más grande de la Wallet.
- **Tenant:** la tipografía no cambia por tenant. Solo cambia el color y el logo. Así se mantiene coherencia y bajo peso de carga.
- Los códigos OTP van en mono, tamaño grande, agrupados en bloques de 3 caracteres.
- Las fuentes se autoalojan con `font-display: swap`. Se cargan solo los pesos usados.
- Escala base: 12 / 14 / 16 / 20 / 24 / 32 / 48 / 72. Texto de cuerpo mínimo 16px en móvil.
- Los paneles admin usan Figtree y reservan la cursiva para el logotipo y los títulos de sección.
- Unity: se incluyen los archivos de Bricolage Grotesque e Instrument Serif como fuentes TextMeshPro.

Vista previa: https://claude.ai/artifact/CAW6V2i1LoUxZeypxqwCRJ (página de muestra, privada).

## 6. Espaciado, forma y elevación

- **Espaciado:** rejilla de 4px (4, 8, 12, 16, 24, 32, 48, 64).
- **Radios:** `sm` 6px (inputs), `md` 12px (botones, tarjetas), `lg` 20px (paneles grandes), `full` (avatares, chips).
- **Elevación en oscuro:** se usa superficie más clara y borde, no sombra pesada.
- **Elevación en claro:** sombra suave de una sola capa.
- **Objetivo táctil:** mínimo 44×44px en Wallet.

## 7. Componentes clave (lineamientos)

- **Botón primario:** fondo `brand`, texto `on-brand`. Un solo primario por vista.
- **Saldo de puntos:** número grande en Display con icono de moneda en `reward`. Es el elemento más prominente de la Wallet.
- **Tarjeta de premio:** imagen, título, costo en puntos. Estado bloqueado (puntos insuficientes) con texto "Te faltan N pts" además del tono atenuado.
- **Cupón OTP:** pantalla completa, alto contraste, fondo claro sin importar el tema para máxima legibilidad ante el empleado, con contador de expiración.
- **Estados de cupón:** pendiente (`warning`), canjeado (`success`), expirado (`danger`), siempre con icono y texto.
- **Tablas admin:** filas de 48px, encabezado fijo, acciones destructivas (suspender tenant) con confirmación.

## 8. Movimiento

- Duraciones: 120 ms (microinteracción), 200 ms (transición), 400 ms (celebración).
- Celebración al sumar puntos: animación breve de monedas en `reward` sobre la Wallet.
- Respetar `prefers-reduced-motion`: sin animación de celebración, solo cambio de valor.

## 9. Accesibilidad (checklist)

- [ ] Contraste de texto ≥ 4.5:1, texto grande e iconos ≥ 3:1.
- [ ] Foco visible en todo elemento interactivo.
- [ ] Ningún estado depende solo del color.
- [ ] Soporte de tema claro y oscuro (`prefers-color-scheme`) con opción manual.
- [ ] Etiquetas y `aria` en el lector de QR, con alternativa manual (ingresar código).
- [ ] Probado con zoom al 200% y sin animaciones.

## 10. Estructura de tokens propuesta

```
/design
  tokens.json        # fuente única (color, tipografía, espacio, radios)
  theme-kairos.css   # variables base Kairos, claro y oscuro
  theme-tenant.ts    # función: (primary, secondary) => variables derivadas
```

`theme-tenant` es una función pura con pruebas unitarias para contraste. Se comparte entre Wallet, Panel Tenant y (como referencia de fórmula) Unity.

## 11. Alcance por etapas

Los tres proyectos se desarrollan por separado y luego se integran. El orden y la estructura de repositorios están en `docs/ARQUITECTURA.md`, secciones 2 y 3. Resumen del diseño que se entrega en cada parcial:

| Parcial | Proyecto | Diseño que se entrega |
|---|---|---|
| 1 | API + Panel Super Admin / Tenant | Tokens, tema Kairos claro y oscuro, tipografía, componentes de admin, formulario de marca con vista previa |
| 2 | Wallet PWA | Tema multi-tenant completo, saldo, premios, cupón OTP, escáner QR |
| 3 | Terminal Arcade (Unity) | Tema dinámico por tenant, fuentes TMP, pantalla de Game Over y QR |

Los tokens (`tokens.json` y `theme-tenant.ts`) se crean en el parcial 1 dentro de `packages/design` y los reutilizan los demás.

## 12. Decisiones

Resueltas:

- Paleta violeta, cian y ámbar: aprobada.
- Tipografía con cursiva serif como acento: aprobada.
- Tema claro y oscuro configurable por tenant: sí.
- Nombre: Kairos. Logotipo: pendiente de diseñar (propuesta en sección 5).
- Idioma: solo español por ahora. Los textos van en un archivo de cadenas para poder traducir después.

Abiertas:

1. Orden de parciales (recomendación en `ARQUITECTURA.md`).
2. Diseño del logotipo: hacerlo en Figma o dejarlo como wordmark tipográfico por ahora.
