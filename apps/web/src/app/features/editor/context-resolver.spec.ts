import { describe, expect, it } from "vitest";
import { analyzeContext, detectEnrichmentProfile, rankAssets } from "./context-resolver";
import type { LibraryAsset } from "./editor.models";

const asset = (technology: string, useCount = 0): LibraryAsset => ({ id: technology, name: technology, kind: "logo", format: "svg", source: "catalog", technology, themes: ["frontend"], tags: [technology.toLowerCase()], style: "official", colors: [], aspectRatio: 1, compatibleBackgrounds: ["light"], hash: technology, useCount, createdAt: "2026-01-01", version: 1, svg: "<svg/>" });

describe("context resolver", () => {
  it("detecta tecnologías y motivos sin pedir a la IA que invente logos", () => {
    const result = analyzeContext("Arquitectura frontend con Angular, Flutter y HTTPS");
    expect(result.entities).toEqual(["Angular", "Flutter", "HTTPS"]);
    expect(result.visualMotifs).toContain("widget tree");
    expect(result.visualMotifs).toContain("browser lock");
  });

  it("prioriza coincidencia exacta y luego uso", () => {
    const result = rankAssets(analyzeContext("Guía Angular frontend"), [asset("Flutter", 20), asset("Angular")]);
    expect(result[0].asset.technology).toBe("Angular");
  });

  it("detecta Git como entidad reutilizable en contenido técnico", () => {
    const result = analyzeContext("Git stash, origin y remote sin perder cambios");
    expect(result.entities).toContain("Git");
    expect(result.visualMotifs).toContain("branch graph");
  });

  it("detecta usabilidad y claridad en copy sobre interfaces", () => {
    const result = analyzeContext("El 95% de los usuarios no lee instrucciones: tu interfaz debe explicarse sola");
    expect(result.concepts).toEqual(expect.arrayContaining(["usabilidad", "claridad"]));
    expect(result.visualMotifs).toEqual(expect.arrayContaining(["self-explanatory interface", "user signal"]));
  });

  it("elige una receta de enriquecimiento según el significado del contenido", () => {
    const learning = analyzeContext("Curva de aprendizaje de Flutter: 2-4 semanas");
    expect(detectEnrichmentProfile("Curva de aprendizaje de Flutter: 2-4 semanas", learning, "tool-grid")).toBe("learning-curve");

    const git = analyzeContext("Origin vs remote en Git");
    expect(detectEnrichmentProfile("Origin vs remote en Git", git, "image-hero")).toBe("git-flow");

    const opinion = analyzeContext("Diseñar también es decidir qué quitar");
    expect(detectEnrichmentProfile("Diseñar también es decidir qué quitar", opinion, "minimal-type")).toBe("editorial-emphasis");
  });

  it("excluye publicaciones completas del ranking de assets reutilizables", () => {
    const logo = asset("Flutter");
    const fullRender: LibraryAsset = {
      ...asset("Render final"),
      id: "render-final",
      source: "ai",
      scope: "render",
      kind: "illustration",
      tags: ["Flutter", "polished-render"],
      style: "safe-polish",
    };
    const ranked = rankAssets(analyzeContext("Guía de Flutter"), [fullRender, logo]);
    expect(ranked.map((item) => item.asset.id)).toEqual(["Flutter"]);
  });
});
