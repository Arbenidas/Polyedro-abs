import { describe, expect, it } from "vitest";
import { createFluidConnectorAsset } from "./fluid-connector";

describe("fluid editorial connectors", () => {
  it("compila cuerpo y punta como una sola ruta SVG continua", () => {
    const connector = createFluidConnectorAsset({ x: 20, y: 40 }, { x: 260, y: 120 }, {
      color: "#009AA6",
      character: "editorial",
      route: "spline",
      label: "Contexto informa al agente",
    });

    expect(connector.pathData).toContain("C");
    expect(connector.svg).toMatch(/marker-end="url\(#fluid-arrow-[a-z0-9]+\)"/);
    expect(connector.svg).not.toContain("<line");
    expect(connector.width).toBeGreaterThan(240);
    expect(connector.height).toBeGreaterThan(80);
  });

  it("convierte un retorno con esquinas en una curva sin segmentos cortados", () => {
    const connector = createFluidConnectorAsset({ x: 380, y: 120 }, { x: 160, y: 40 }, {
      color: "#D94E1E",
      character: "sketch",
      route: "spline",
      waypoints: [{ x: 420, y: 120 }, { x: 420, y: 260 }, { x: 160, y: 260 }],
    });

    expect(connector.pathData.match(/C/g)?.length).toBe(4);
    expect(connector.svg.match(/<path/g)?.length).toBeGreaterThanOrEqual(4);
    expect(connector.x).toBeLessThan(160);
    expect(connector.y).toBeLessThan(40);
  });

  it("ofrece codos redondeados para diagramas verticales", () => {
    const connector = createFluidConnectorAsset({ x: 80, y: 20 }, { x: 190, y: 240 }, {
      color: "#18181B",
      character: "precise",
      route: "soft-step",
    });

    expect(connector.pathData).toContain("Q");
    expect(connector.svg).toContain('stroke-linejoin="round"');
  });

  it("asigna puntas únicas cuando varias flechas conviven en el mismo SVG", () => {
    const first = createFluidConnectorAsset({ x: 10, y: 10 }, { x: 90, y: 40 }, {
      color: "#009AA6",
      label: "condición a decisión",
    });
    const second = createFluidConnectorAsset({ x: 10, y: 10 }, { x: 90, y: 40 }, {
      color: "#009AA6",
      label: "decisión a ejecución",
    });

    const firstMarker = first.svg.match(/id="(fluid-arrow-[a-z0-9]+)"/)?.[1];
    const secondMarker = second.svg.match(/id="(fluid-arrow-[a-z0-9]+)"/)?.[1];
    expect(firstMarker).toBeTruthy();
    expect(secondMarker).toBeTruthy();
    expect(firstMarker).not.toBe(secondMarker);
  });
});
