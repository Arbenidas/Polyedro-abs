import { describe, expect, it } from "vitest";
import { createContextualVectorLayout, detectContextualVectorTopic } from "./contextual-vector-layouts";

const palette = { ink: "#10251E", accent: "#2F5DE5", primary: "#B8F34A", paper: "#F3F7F2" };

describe("contextual vector layouts", () => {
  it("recognizes interface copy instead of falling back to a generic concept", () => {
    expect(detectContextualVectorTopic("El 95% de usuarios no lee instrucciones: tu interfaz debe explicarse sola")).toBe("interface");
  });

  it("rotates through structurally different compositions", () => {
    const first = createContextualVectorLayout("usuarios e interfaz clara", palette, []);
    const second = createContextualVectorLayout("usuarios e interfaz clara", palette, [first.key]);
    const third = createContextualVectorLayout("usuarios e interfaz clara", palette, [first.key, second.key]);

    expect([first.key, second.key, third.key]).toEqual(["window", "user-signal", "compare"]);
    expect(new Set([first.svg, second.svg, third.svg]).size).toBe(3);
  });

  it("changes a layout again when its family is reused", () => {
    const used = ["window", "user-signal", "compare", "target", "cards"];
    const repeated = createContextualVectorLayout("interfaz para usuarios", palette, used);
    expect(repeated.key).toBe("window");
    expect(repeated.previousUses).toBe(1);
    expect(repeated.svg).toContain('data-layout-cycle="1"');
    expect(repeated.svg).toContain('scale(-1 1)');
  });
});
