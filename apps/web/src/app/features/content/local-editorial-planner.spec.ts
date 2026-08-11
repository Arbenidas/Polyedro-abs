import { describe, expect, it } from "vitest";
import { buildLocalEditorialPlan } from "./local-editorial-planner";
import { CANONICAL_RECIPE_IDS } from "../editor/recipe-catalog";
import { expandSequence, isNarrativeArc, resolveBlueprint } from "../editor/narrative-blueprints";

describe("local editorial planner", () => {
  const preferences = { channel:"instagram_portrait",format:"auto",slideCount:"auto",visualDirection:"auto" } as const;
  it("condensa la fuente, crea tres hooks y no usa copy enlatado", () => {
    const source = "Migramos un proyecto de Angular a componentes standalone. El principal problema era una dependencia circular entre módulos. Primero aislamos las rutas y después movimos el estado al feature correspondiente. El build bajó su complejidad y ahora cada pantalla puede probarse de forma independiente.";
    const plan = buildLocalEditorialPlan(source, preferences);
    expect(plan.hookCandidates.map((item)=>item.angle)).toEqual(["resultado","contraste","curiosidad"]);
    expect(plan.slides.length).toBeGreaterThanOrEqual(4);
    expect(plan.entities).toContain("Angular");
    expect(plan.slides.some((item)=>item.body.includes("dependencia circular"))).toBe(true);
    expect(plan.slides.every((item,index)=>index===0 || item.recipeId!==plan.slides[index-1].recipeId)).toBe(true);
    expect(plan.slides.slice(0,-1).every((item)=>Boolean(item.transitionCue))).toBe(true);
  });

  it("solo emite recipeIds canónicos (unificados con el catálogo)", () => {
    const plan = buildLocalEditorialPlan("Una guía de Flutter con pasos: primero configura el entorno, después crea el widget, finalmente prueba en dispositivo.", {
      channel: "instagram_portrait", format: "carousel", slideCount: 6, visualDirection: "auto",
    });
    expect(plan.slides.every((item) => (CANONICAL_RECIPE_IDS as readonly string[]).includes(item.recipeId))).toBe(true);
  });

  it("emite narrativeArc coherente con el contentType y respeta la secuencia del arco", () => {
    const plan = buildLocalEditorialPlan("Tutorial: cómo configurar Flutter en macOS paso a paso", {
      channel: "instagram_portrait", format: "carousel", slideCount: 5, visualDirection: "auto",
    });
    expect(plan.narrativeArc).toBe("how-to");
    expect(isNarrativeArc(plan.narrativeArc!)).toBe(true);
    const blueprint = resolveBlueprint(plan.contentType);
    const expectedRoles = expandSequence(blueprint, 5);
    expect(plan.slides.map((s) => s.role)).toEqual(expectedRoles);
  });

  it("el closing CTA se modula por goal y arco (release-log + act)", () => {
    const plan = buildLocalEditorialPlan("Release v2 de mi librería: nuevos endpoints y migración", {
      channel: "instagram_portrait", format: "carousel", slideCount: 4, visualDirection: "auto", goal: "act",
    });
    expect(plan.narrativeArc).toBe("release-log");
    expect(plan.cta.toLowerCase()).toContain("actualiza");
  });

  it("respeta la cantidad exacta solicitada para un carrusel", () => {
    const plan = buildLocalEditorialPlan("Primera idea con suficiente contexto. Segunda idea con un ejemplo útil. Tercera idea con una conclusión clara.", {
      channel: "instagram_portrait", format: "carousel", slideCount: 8, visualDirection: "auto",
    });
    expect(plan.slides).toHaveLength(8);
    expect(plan.slides[0].role).toBe("cover");
    expect(plan.slides.at(-1)?.role).toBe("cta");
  });

  it("construye hooks específicos sin fórmulas de clickbait", () => {
    const plan = buildLocalEditorialPlan("Ley de Hick y Ley de Fitts aplicadas a interfaces móviles", {
      channel: "instagram_portrait", format: "carousel", slideCount: 5, visualDirection: "technical", goal: "save", audience: "diseñadores de producto junior",
    });
    const hooks = plan.hookCandidates.map((item) => item.text.toLowerCase()).join(" ");
    expect(hooks).not.toMatch(/casi nadie|nadie te cuenta|guía definitiva|secreto/);
    expect(plan.hookCandidates.every((item) => item.text.length <= 92)).toBe(true);
    expect(plan.cta).toContain("checklist");
    expect(plan.slides[0].headline).toBe(plan.hookCandidates.find((item) => item.id === plan.selectedHookId)?.text);
  });

  it("elige hasta dos microdiagramas por semántica y los alterna con otras recetas", () => {
    const plan = buildLocalEditorialPlan(
      "Arquitectura por capas: Interfaz, Agente, MCP y Datos tienen responsabilidades distintas. El usuario define el objetivo. El agente decide qué herramienta usar. MCP conecta el sistema con los datos. El resultado vuelve al usuario.",
      { channel: "instagram_portrait", format: "carousel", slideCount: 7, visualDirection: "technical", goal: "teach" },
    );
    const diagrams = plan.slides.filter((item) => item.diagram);

    expect(diagrams.length).toBeGreaterThan(0);
    expect(diagrams.length).toBeLessThanOrEqual(2);
    expect(diagrams.every((item) => item.recipeId === "micro-diagram")).toBe(true);
    expect(diagrams.every((item) => (item.diagram?.nodes.length ?? 0) >= 2 && (item.diagram?.nodes.length ?? 0) <= 6)).toBe(true);
    expect(plan.slides.every((item, index) => index === 0 || item.recipeId !== "micro-diagram" || plan.slides[index - 1]?.recipeId !== "micro-diagram")).toBe(true);
  });
});
