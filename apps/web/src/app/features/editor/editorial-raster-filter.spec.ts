import { describe, expect, it } from "vitest";
import { rasterStyleIndex } from "./editorial-raster-filter";

describe("editorial raster filter", () => {
  it("mantiene modos distintos para trama monocroma, color y punto de cruz", () => {
    expect(rasterStyleIndex("bitmap")).toBe(0);
    expect(rasterStyleIndex("halftone")).toBe(1);
    expect(rasterStyleIndex("cross-stitch")).toBe(2);
  });
});
