import { describe, expect, it } from "vitest";
import { TEMPLATE_CATALOG_VERSION, templateByRecipe, templateCatalog, VISUAL_RECIPES } from "./template-catalog";
import { CANONICAL_RECIPE_IDS, isCanonicalRecipeId } from "./recipe-catalog";

describe("template catalog v12", () => {
  const SYS = ["Cover", "Typographic Poster", "Photo", "Card", "Split", "Micro Diagram", "Quote", "Number", "CTA", "Body", "Editorial Hero", "Editorial Step", "Editorial Quote", "Editorial List", "Bold Headline", "Bold Stat", "Bold Contrast", "Demo Frame", "Code Block", "Minimal Text", "Checklist"];

  it("21 sistemas curados", () => {
    const t = templateCatalog("instagram_portrait");
    expect(VISUAL_RECIPES).toHaveLength(21);
    expect(t).toHaveLength(21);
    expect(t.map((x) => x.family)).toEqual(SYS);
    expect(new Set(t.map((x) => x.recipeId)).size).toBe(21);
    expect(t.every((x) => x.catalogVersion === TEMPLATE_CATALOG_VERSION && x.source === "builtin")).toBe(true);
    expect(t.every((x) => x.selection?.roles.length && x.selection.contentTypes.length)).toBe(true);
  });

  it("cubre todos los roles", () => {
    const t = templateCatalog("instagram_portrait");
    expect(["cover", "intro", "step", "comparison", "summary", "cta"].every((r) => t.some((x) => x.slideRole === r))).toBe(true);
  });

  it("ids de VISUAL_RECIPES iguales a CANONICAL_RECIPE_IDS", () => {
    expect(VISUAL_RECIPES.map((r) => r.id).sort()).toEqual([...CANONICAL_RECIPE_IDS].sort());
    expect(VISUAL_RECIPES.map((r) => r.id).every(isCanonicalRecipeId)).toBe(true);
  });

  it("templateByRecipe resuelve legacy → nuevo", () => {
    expect(templateByRecipe("instagram_portrait", "type-hero", "cover").recipeId).toBe("cover");
    expect(templateByRecipe("instagram_portrait", "sticker-board", "summary").recipeId).toBe("body");
    expect(templateByRecipe("instagram_portrait", "clean-statement", "cta").recipeId).toBe("quote");
    expect(templateByRecipe("instagram_portrait", "cover", "cover").recipeId).toBe("cover");
  });
});
