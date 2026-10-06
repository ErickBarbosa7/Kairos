import { describe, expect, it } from "vitest";
import { contrastRatio, deriveTenantTheme, isHex, pickOnColor } from "./theme-tenant";

describe("contraste", () => {
  it("negro sobre blanco es 21:1", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
  });
  it("elige blanco sobre fondos oscuros y oscuro sobre claros", () => {
    expect(pickOnColor("#7C3AED")).toBe("#FFFFFF");
    expect(pickOnColor("#FBBF24")).toBe("#14132B");
  });
  it("valida hex", () => {
    expect(isHex("#7c3aed")).toBe(true);
    expect(isHex("red")).toBe(false);
  });
});

describe("deriveTenantTheme", () => {
  it("deja intacto un color que ya cumple", () => {
    const t = deriveTenantTheme("#7C3AED", "light");
    expect(t.primary).toBe("#7C3AED");
    expect(t.adjusted).toBe(false);
  });

  it.each(["#FFFF00", "#FBBF24", "#22D3EE", "#111111", "#7C3AED", "#FF0000", "#00FF7F", "#888888"])(
    "%s cumple contraste en ambos temas tras derivar",
    (hex) => {
      for (const mode of ["light", "dark"] as const) {
        const t = deriveTenantTheme(hex, mode);
        expect(t.onPrimaryContrast).toBeGreaterThanOrEqual(4.5);
        expect(t.onBackgroundContrast).toBeGreaterThanOrEqual(3);
      }
    },
  );

  it("amarillo se oscurece en tema claro y avisa", () => {
    const t = deriveTenantTheme("#FFFF00", "light");
    expect(t.adjusted).toBe(true);
    expect(t.warnings.length).toBeGreaterThan(0);
  });

  it("advierte de colores casi grises", () => {
    expect(deriveTenantTheme("#888888", "light").warnings.join()).toMatch(/gris/);
  });
});
