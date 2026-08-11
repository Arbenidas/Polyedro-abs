import { describe, expect, it } from "vitest";
import type { EditorialBrand, EditorialSlide } from "../../editorial.models";
import { compileScene } from "./scene.factory";
import { createTemplateSceneSnapshot, templateCharacteristics, templateSlotsFromScene } from "./template-snapshot";
import { templateByRecipe } from "./template-catalog";

const brand: EditorialBrand = {
  id: "brand", user_id: "local", name: "polyedro", description: "",
  palette: ["#E8572A", "#2E6670", "#FFF8F0", "#17212B"], status: "approved", created_at: "2026-08-11",
};
const slide: EditorialSlide = {
  id: "slide", post_id: "post", slide_order: 1, headline: "El sistema antes que el prompt",
  body: "Una estructura visual con intención.", composition: "typographic-poster", image_url: null,
};

describe("template snapshot", () => {
  it("guarda la composición real y reemplaza el copy al reutilizarla", () => {
    const baseTemplate = templateByRecipe("instagram_portrait", "typographic-poster");
    const original = compileScene(slide, brand, "instagram_portrait", baseTemplate);
    const snapshot = createTemplateSceneSnapshot(original);
    const saved = { ...baseTemplate, id: "saved", recipeId: "user-saved", source: "user" as const, sceneSnapshot: snapshot };
    const reused = compileScene({ ...slide, headline: "Una referencia no es una paleta" }, brand, "instagram_portrait", saved);

    expect(snapshot.elements).toHaveLength(original.elements.length);
    expect(reused.elements.map((element) => element.x)).toEqual(original.elements.map((element) => element.x));
    expect(reused.elements.filter((element) => element.name.startsWith("Titular")).map((element) => element.content).join(" ")).toContain("Una referencia no es una paleta");
    expect(templateSlotsFromScene(original).some((slot) => slot.role === "headline" && slot.frame)).toBe(true);
    expect(templateCharacteristics(original).style).toBe("bold");
  });
});
