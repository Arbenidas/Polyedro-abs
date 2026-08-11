import { describe, expect, it } from "vitest";
import type { EditorialTemplate } from "./editor.models";
import { bestTemplateForContext, inferContentTypesFromText, scoreTemplateForContext } from "./template-matcher";
import { templateByRecipe } from "./template-catalog";

function personalTemplate(): EditorialTemplate {
  const base = templateByRecipe("instagram_portrait", "typographic-poster");
  return {
    ...base,
    id: "personal-1",
    recipeId: "user-personal-1",
    name: "Portada para arquitectura",
    source: "user",
    selection: {
      intent: "Portada tipográfica para explicar decisiones de arquitectura",
      roles: ["cover"],
      contentTypes: ["tutorial"],
      keywords: ["arquitectura", "sistema", "frontend"],
      avoidWhen: ["comparación extensa"],
    },
  };
}

describe("template matcher", () => {
  it("prioriza una plantilla personal cuando coincide rol, tipo e intención", () => {
    const personal = personalTemplate();
    const builtin = templateByRecipe("instagram_portrait", "cover");
    const context = {
      channel: "instagram_portrait" as const,
      role: "cover" as const,
      contentType: "tutorial",
      headline: "La arquitectura del sistema importa más que el prompt",
      body: "Decisiones para frontend y backend.",
    };
    expect(scoreTemplateForContext(personal, context)).toBeGreaterThan(scoreTemplateForContext(builtin, context));
    expect(bestTemplateForContext([builtin, personal], context)?.template.recipeId).toBe(personal.recipeId);
  });

  it("no recomienda una portada personal para una comparación incompatible", () => {
    const personal = personalTemplate();
    const score = scoreTemplateForContext(personal, {
      channel: "instagram_portrait",
      role: "comparison",
      contentType: "comparison",
      headline: "Comparación extensa entre seis opciones",
    });
    expect(score).toBeLessThan(20);
  });

  it("infiere señales editoriales desde copy real", () => {
    expect(inferContentTypesFromText("5 recursos que todo desarrollador debería guardar")).toEqual(expect.arrayContaining(["list", "resource"]));
    expect(inferContentTypesFromText("GitHub release: cómo migrar esta versión")).toEqual(expect.arrayContaining(["repo", "release"]));
    expect(inferContentTypesFromText("El sistema antes que el prompt")).not.toContain("comparison");
  });
});
