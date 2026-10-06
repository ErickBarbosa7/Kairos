// Genera theme-kairos.css desde tokens.json (fuente única de tokens).
import { readFileSync, writeFileSync } from "node:fs";

const t = JSON.parse(readFileSync(new URL("../tokens.json", import.meta.url), "utf8"));
const vars = (obj, prefix = "") => Object.entries(obj).map(([k, v]) => `  --${prefix}${k}: ${v};`).join("\n");

const dark = vars(t.theme.dark);
const css = `/* GENERADO por scripts/build-css.mjs desde tokens.json. No editar a mano. */
:root {
${vars(t.brand, "kairos-")}
${vars(t.font, "type-")}
${vars(t.radius, "shape-")}
${vars(t.theme.light)}
  color-scheme: light;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
${dark.replace(/^/gm, "  ")}
    color-scheme: dark;
  }
}

:root[data-theme="dark"] {
${dark}
  color-scheme: dark;
}
`;
writeFileSync(new URL("../theme-kairos.css", import.meta.url), css);
console.log("theme-kairos.css generado");
