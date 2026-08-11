import { describe, expect, it } from "vitest";
import {
  CANONICAL_RECIPE_IDS, EDITORIAL_RECIPES, LEGACY_RECIPE_ALIASES,
  isCanonicalRecipeId, pickRecipeForRole, recipesByRole,
  recipesForContentType, resolveRecipeId,
} from "./recipe-catalog";

describe("recipe-catalog v4", () => {
  it("21 recetas canónicas con ids únicos", () => {
    expect(EDITORIAL_RECIPES).toHaveLength(21);
    expect(new Set(CANONICAL_RECIPE_IDS).size).toBe(21);
    for (const r of EDITORIAL_RECIPES) {
      expect(r.roles[0]).toBe(r.role);
      expect(r.intent.length).toBeGreaterThan(20);
      expect(r.contentTypes.length).toBeGreaterThan(0);
    }
  });

  it("todo rol editorial tiene al menos una receta", () => {
    for (const role of ["cover", "intro", "step", "comparison", "summary", "cta"] as const) {
      expect(recipesByRole(role).length).toBeGreaterThan(0);
    }
  });

  it("resolveRecipeId acepta canónicos y mapea legacy", () => {
    expect(resolveRecipeId("cover")).toBe("cover");
    expect(resolveRecipeId("type-hero")).toBe("cover");
    expect(resolveRecipeId("sticker-board")).toBe("body");
    expect(resolveRecipeId("signature-cta", "cta")).toBe("cta");
  });

  it("ids desconocidos caen al default del rol", () => {
    expect(resolveRecipeId("no-existe", "cover")).toBe("cover");
    expect(resolveRecipeId("no-existe", "cta")).toBe("cta");
    expect(isCanonicalRecipeId(resolveRecipeId("no-existe", "step"))).toBe(true);
  });

  it("legacy aliases cubren migración", () => {
    for (const id of Object.keys(LEGACY_RECIPE_ALIASES)) {
      expect(isCanonicalRecipeId(resolveRecipeId(id))).toBe(true);
    }
  });

  it("pickRecipeForRole evita repetir", () => {
    const a = pickRecipeForRole("step", "tutorial");
    const b = pickRecipeForRole("step", "tutorial", a);
    expect(b).not.toBe(a);
  });
});
