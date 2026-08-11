import { describe, expect, it } from "vitest";
import { MaskHistory, blurMask, morphMask, processMask } from "./cutout-mask";

describe("cutout mask operations", () => {
  it("expands and contracts alpha without touching the source array", () => {
    const source = new Uint8ClampedArray(25);
    source[12] = 255;
    const expanded = morphMask(source, 5, 5, true);
    const contracted = morphMask(expanded, 5, 5, false);
    expect(source.filter(Boolean)).toHaveLength(1);
    expect(expanded.filter(Boolean)).toHaveLength(9);
    expect(contracted[12]).toBe(255);
  });

  it("feathers a hard edge into partial alpha values", () => {
    const source = new Uint8ClampedArray([0, 0, 255, 255, 255]);
    const softened = blurMask(source, 5, 1, 1);
    expect([...softened].some((value) => value > 0 && value < 255)).toBe(true);
    expect(processMask(source, 5, 1, 0, 1)).toEqual(softened);
  });

  it("keeps a bounded undo and redo history", () => {
    const history = new MaskHistory(3);
    history.reset(new Uint8ClampedArray([0]));
    history.push(new Uint8ClampedArray([80]));
    history.push(new Uint8ClampedArray([160]));
    history.push(new Uint8ClampedArray([255]));
    expect(history.size).toBe(3);
    expect(history.undo()?.[0]).toBe(160);
    expect(history.undo()?.[0]).toBe(80);
    expect(history.redo()?.[0]).toBe(160);
  });
});
