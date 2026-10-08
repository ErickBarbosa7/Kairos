# Kairos — design.md (rediseño "Berserker")

Estado: propuesta para implementar · Reemplaza paleta y forma de `docs/DISENO.md` v0.3 en los paneles Admin.

## 0. Fuente y supuesto

La skill `berserker-design` **no existe** en esta máquina ni en el registro (`npx skills find berserker-design` sin resultado).
Estos parámetros son una interpretación propia: estética Berserk (negro profundo, rojo sangre, contraste brutal, ángulos duros, tipografía pesada), con los principios de `frontend-design` (identidad inconfundible, nada genérico).
Si aparece la guía real, se reemplazan los valores de las secciones 2–5; la estructura y el mapeo (sección 9) se mantienen.

## 1. Concepto: "forja oscura"

- **Contraste brutal.** Fondo casi negro, texto hueso, un solo color de impacto (rojo sangre).
- **Ángulos duros.** Radios 0–4 px, bordes de 2 px, sombras duras desplazadas (sin blur).
- **Tipografía pesada.** Títulos condensados en mayúsculas; cuerpo legible.
- **Densidad.** Menos aire decorativo, más jerarquía por peso y tamaño.
- **Sin suavidad gratuita.** Sin gradientes, sin glassmorphism, sin sombras difusas.

Reglas que NO cambian (AGENTS.md / DISENO.md): paneles admin siempre con marca Kairos, nunca color del tenant; cero hex en componentes; estado nunca solo con color; WCAG 2.2 AA; textos en `strings.ts`; tema claro y oscuro.

## 2. Paleta

### 2.1 Marca (`brand` en `tokens.json`)

| Token | Hex | Uso |
|---|---|---|
| `primary` | `#B91C1C` | Acción principal, marca (sangre) |
| `primary-hover` | `#991B1B` | Hover / pressed |
| `accent` | `#F97316` | Foco en oscuro, énfasis secundario (brasa) |
| `reward` | `#FBBF24` | Puntos, monedas, premios (oro) |
| `night` | `#0A0708` | Fondo oscuro |
| `night-raised` | `#161012` | Superficie oscura |
| `night-line` | `#3A2A2C` | Bordes oscuro |
| `paper` | `#F2EDE6` | Fondo claro (hueso) |
| `paper-raised` | `#FBF8F4` | Superficie clara |
| `paper-line` | `#D6CCC2` | Bordes claro |

Se conservan los **nombres** de token (`kairos-primary`, `kairos-night`, …) para no romper `index.css` ni componentes; solo cambian valores.

### 2.2 Tema

| Token | Claro | Oscuro |
|---|---|---|
| `bg` | `#F2EDE6` | `#0A0708` |
| `surface` | `#FBF8F4` | `#161012` |
| `line` | `#D6CCC2` | `#3A2A2C` |
| `text` | `#140D0E` | `#F2EBE4` |
| `text-secondary` | `#4A3E3C` | `#C2B5AE` |
| `text-disabled` | `#8A7D78` | `#7A6C68` |
| `focus` | `#991B1B` | `#F97316` |
| `link` | `#991B1B` | `#FCA5A5` |
| `success` / `success-text` | `#16A34A` / `#15803D` | `#16A34A` / `#4ADE80` |
| `warning` / `warning-text` | `#D97706` / `#B45309` | `#D97706` / `#FBBF24` |
| `danger` / `danger-text` | `#DC2626` / `#B91C1C` | `#DC2626` / `#F87171` |
| `info` / `info-text` | `#0284C7` / `#0369A1` | `#0284C7` / `#38BDF8` |

Riesgo: `primary` y `danger` son ambos rojos. Mitigación obligatoria: `danger` siempre con icono + texto, y las acciones destructivas usan botón contorneado con icono, no el botón sólido primario. Texto sobre `primary` es `#FFFFFF` (≥ 6:1).
Verificar con contraste real (AA 4.5:1 texto, 3:1 UI) antes de cerrar; ajustar el hex, no la regla.

## 3. Tipografía

| Rol | Fuente | Notas |
|---|---|---|
| `display` | Big Shoulders Display (variable, 700–900) | Títulos, mayúsculas, `letter-spacing: 0.02em` |
| `text` | Figtree Variable | Se conserva |
| `accent` | Instrument Serif 400 italic | Se conserva; `em.k`, una palabra por título |
| `mono` | JetBrains Mono 500 | Se conserva; códigos y cifras |

Escala: 12 / 14 / 16 / 20 / 28 / 40 px. Títulos `display` en uppercase; cuerpo mínimo 14 px.
Cambio de paquete: añadir `@fontsource-variable/big-shoulders-display`; retirar `@fontsource-variable/bricolage-grotesque`.

## 4. Forma

| Token | Valor |
|---|---|
| `radius.sm` | `0px` |
| `radius.md` | `2px` |
| `radius.lg` | `4px` |
| Borde estándar | `2px solid var(--line)` |
| Sombra dura | `4px 4px 0 0 var(--line)` (hover: `6px 6px 0 0`; sin blur) |

## 5. Componentes

- **Botón primario:** fondo `primary`, texto blanco, borde 2 px `primary-hover`, uppercase `display`, sombra dura. Hover: `primary-hover` + desplazamiento (-1,-1). Active: sin sombra, desplazamiento (+2,+2).
- **Botón secundario:** transparente, borde 2 px `text`, texto `text`. Hover: invierte (fondo `text`, texto `bg`).
- **Botón destructivo:** contorneado con borde `danger-text` + icono + texto.
- **Input:** fondo `surface`, borde 2 px `line`, radio 2 px. Foco: borde `focus` + outline 2 px `focus` offset 2.
- **Card:** `surface`, borde 2 px `line`, sombra dura. Título `display` uppercase.
- **Tabla:** cabecera `display` uppercase 12 px, borde inferior 2 px `text`; filas con borde 1 px `line`; hover fila: fondo `bg`.
- **Badge de estado:** borde 2 px del color de estado + icono + texto (nunca solo color).
- **Modal / ConfirmDialog:** igual que card; backdrop `night` al 80 %.
- **Toast:** borde izquierdo 4 px del estado + icono + texto.
- **Navegación:** item activo con barra 4 px `primary` y texto `display` uppercase.

### Login y adaptación a dispositivos

- **Login:** Kairos en Instrument Serif cursiva, con tamaño fluido de 72–160 px. Marca y mensaje a la izquierda del formulario desde 1024 px; composición apilada en móvil y tablet. Mantener ambos tipos de acceso y selector de tema.
- **Premios:** ojo de 44×44 px para alternar `isActive`, solo para el administrador del negocio. Estado siempre con icono y texto; ocultar conserva el premio en el panel, su stock y los cupones emitidos.
- **Panel:** navegación en cuadrícula bajo 1024 px; barra lateral contraíble en escritorio. Negocios como tarjetas bajo 768 px y tabla desde ese tamaño. Formularios con vista previa en dos columnas desde 1280 px.
- **Diálogos:** altura limitada al viewport dinámico, scroll interno y acciones apiladas en pantallas pequeñas. Campos y acciones deben poder usarse desde 320 px, con teclado y en ambos temas.

## 6. Movimiento

Transiciones de 80–120 ms, `steps` o `ease-out`; sin rebotes. Respetar `prefers-reduced-motion` (ya está en `index.css`).

## 7. Accesibilidad

AA mínimo. Foco visible siempre (outline 2 px). Objetivos táctiles ≥ 44 px. Estado = color + icono + texto. Sombras duras decorativas, nunca portan información.

## 8. Fuera de alcance

- `theme-tenant.ts` y theming del tenant (Wallet/Arcade): sin cambios.
- Wallet PWA y terminal Unity: aún no existen; heredarán estos tokens como marca "powered by".

## 9. Mapeo de implementación

| Archivo | Cambio |
|---|---|
| `packages/design/tokens.json` | Valores de 2.1, 2.2, `font.display`, `radius`; añadir `shadow.hard` si se tokeniza |
| `packages/design/theme-kairos.css` | Regenerar: `pnpm --filter @kairos/design build:css` (no editar a mano) |
| `apps/admin/package.json`, `src/main.tsx` | Fuente display nueva |
| `apps/admin/src/index.css` | `--color-on-primary` y backdrop vía token (hoy hex literal); utilidades de sombra dura |
| `apps/admin/src/components/ui.tsx` | Botón, input, card, tabla, badge según sección 5 |
| `Layout.tsx`, `Modal.tsx`, `ConfirmDialog.tsx`, `Toast.tsx`, `BrandPreview.tsx` | Aplicar forma y estados |
| `docs/DISENO.md` | Actualizar versión, paleta y forma para no divergir |

Nota: `index.css` hoy tiene hex (`#ffffff`, `rgb(11 11 26 / 0.6)`); pasarlos a tokens.

## 10. Aceptación

- [ ] `pnpm typecheck` y `pnpm test` en verde (incluye los 14 tests de `packages/design`).
- [ ] `pnpm --filter @kairos/admin build` sin errores.
- [ ] Ningún hex en `apps/admin/src/**/*.tsx` ni `index.css`.
- [ ] Contraste AA verificado en claro y oscuro.
- [ ] Estados con icono + texto; destructivo distinguible de primario sin color.
- [ ] Revisión visual: login, tenants, caja, recompensas, staff, marca.
