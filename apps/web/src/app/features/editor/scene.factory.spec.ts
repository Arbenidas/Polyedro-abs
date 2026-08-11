import { describe, expect, it } from "vitest";
import type { EditorialBrand, EditorialSlide } from "../../editorial.models";
import { compileScene } from "./scene.factory";
import { templateByRecipe } from "./template-catalog";

const brand: EditorialBrand = {
  id: "b1", user_id: "local", name: "arbe.blog",
  description: "Bitácora de tecnología en vivo",
  palette: ["#D94E1E", "#008F99", "#18181B", "#F4F4F5"],
  status: "approved", created_at: "2026-07-14",
};

const slide: EditorialSlide = {
  id: "s1", post_id: "p1", slide_order: 1,
  headline: "Documenta lo que resuelves",
  body: "Una idea práctica para tu próximo proyecto.",
  composition: "cover", image_url: null,
};

describe("arbes scenes v3", () => {
  it("cover produce título grande con firma", () => {
    const s = compileScene(slide, brand, "instagram_portrait", templateByRecipe("instagram_portrait", "cover")!);
    expect(s.width).toBe(1080);
    expect(s.height).toBe(1350);
    expect(s.elements.find((e) => e.name === "Titular")?.fontSize).toBeGreaterThan(60);
    expect(s.elements.find((e) => e.name === "F")?.content).toContain("@arbe.blog");
  });

  it("card tiene borde redondeado", () => {
    const s = compileScene(slide, brand, "instagram_portrait", templateByRecipe("instagram_portrait", "card")!);
    const r = s.elements.find((e) => e.type === "rect" && e.radius === 18);
    expect(r).toBeDefined();
  });

  it("quote produce headline centrado", () => {
    const s = compileScene(slide, brand, "instagram_portrait", templateByRecipe("instagram_portrait", "quote")!);
    expect(s.elements.find((e) => e.name === "Titular")?.textAlign).toBe("center");
  });

  it("typographic poster construye jerarquía multinivel y micro-motivos", () => {
    const s = compileScene({ ...slide, headline: "El sistema antes que el prompt" }, brand, "instagram_portrait", templateByRecipe("instagram_portrait", "typographic-poster")!);
    const headlines = s.elements.filter((element) => element.name.startsWith("Titular"));
    expect(headlines.length).toBeGreaterThanOrEqual(2);
    expect(new Set(headlines.map((element) => element.fill)).size).toBeGreaterThan(1);
    expect(s.elements.some((element) => element.name === "Eyebrow")).toBe(true);
    expect(s.elements.some((element) => element.name === "CTA")).toBe(true);
  });

  it("micro-diagram compila un mapa editorial completo y editable", () => {
    const s = compileScene(
      { ...slide, headline: "Del objetivo a la acción", body: "El agente coordina herramientas y resultado." },
      brand,
      "instagram_portrait",
      templateByRecipe("instagram_portrait", "micro-diagram")!,
      undefined,
      {
        kind: "flow",
        title: "Flujo de ejecución",
        caption: "Cada nodo tiene una responsabilidad.",
        nodes: [
          { id: "goal", label: "Objetivo", detail: "Define el resultado", icon: "flag" },
          { id: "agent", label: "Agente", detail: "Elige la acción", icon: "smart_toy" },
          { id: "tool", label: "Herramienta", detail: "Ejecuta el trabajo", icon: "build" },
        ],
        edges: [{ from: "goal", to: "agent" }, { from: "agent", to: "tool" }],
      },
    );

    expect(s.width).toBe(1080);
    expect(s.height).toBe(1350);
    expect(s.elements.filter((element) => element.name.startsWith("Nodo"))).toHaveLength(3);
    expect(s.elements.filter((element) => element.name.startsWith("Google Material ·"))).toHaveLength(3);
    expect(s.elements.some((element) => element.visualRole === "connector" && element.type === "svg")).toBe(true);
    expect(s.elements.some((element) => element.visualRole === "connector")).toBe(true);
  });
});
