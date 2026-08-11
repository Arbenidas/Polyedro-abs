import { describe, expect, it } from "vitest";
import type { ContentGoal } from "../content/content.models";
import {
  NARRATIVE_BLUEPRINTS,
  blueprintById,
  expandSequence,
  isNarrativeArc,
  pickRecipeForArc,
  resolveArcSafely,
  resolveBlueprint,
  slideIntention,
} from "./narrative-blueprints";

describe("narrative-blueprints (arcos narrativos)", () => {
  it("define 6 arcos y cada contentType tiene uno asignado", () => {
    expect(NARRATIVE_BLUEPRINTS).toHaveLength(6);
    const types = ["tutorial", "list", "comparison", "opinion", "repo", "case-study", "release", "resource"] as const;
    for (const type of types) {
      const bp = resolveBlueprint(type);
      expect(bp).toBeDefined();
      expect(isNarrativeArc(bp.id)).toBe(true);
    }
  });

  it("expandSequence preserva cover al inicio y cta al final", () => {
    const bp = blueprintById("how-to")!;
    expect(expandSequence(bp, 1)).toEqual(["summary"]);
    expect(expandSequence(bp, 2)).toEqual(["cover", "cta"]);
    const five = expandSequence(bp, 5);
    expect(five[0]).toBe("cover");
    expect(five.at(-1)).toBe("cta");
    expect(five).toHaveLength(5);
  });

  it("expandSequence reparte los roles intermedios según el arco", () => {
    const myth = blueprintById("myth-bust")!;
    const seq = expandSequence(myth, 6);
    // Secuencia base: cover, comparison, step, step, summary, cta
    expect(seq).toEqual(["cover", "comparison", "step", "step", "summary", "cta"]);
  });

  it("pickRecipeForArc respeta recipeOverrides del arco y el exclude", () => {
    const howTo = blueprintById("how-to")!;
    const first = pickRecipeForArc(howTo, "step", "tutorial");
    expect(first).toBe("editorial-step");
    const second = pickRecipeForArc(howTo, "step", "tutorial", first);
    expect(second).not.toBe(first);
  });

  it("closingRule modula por goal y por arco", () => {
    const release = blueprintById("release-log")!;
    const closing = release.closingRule("act" as ContentGoal);
    expect(closing.cta.toLowerCase()).toContain("actualiza");
  });

  it("resolveArcSafely acepta un arco válido y cae al del contentType si no", () => {
    expect(resolveArcSafely("myth-bust", "tutorial").id).toBe("myth-bust");
    expect(resolveArcSafely("no-existe", "tutorial").id).toBe("how-to");
    expect(resolveArcSafely(undefined, "release").id).toBe("release-log");
  });

  it("slideIntention devuelve una guía útil para cada slide", () => {
    const bp = blueprintById("how-to")!;
    const intention = slideIntention(bp, 0, 5);
    expect(intention.length).toBeGreaterThan(20);
    expect(intention.toLowerCase()).toContain("hook");
  });
});
