import { filters, type T2DPipelineState, type TWebGLUniformLocationMap } from "fabric/es";

export type EditorialRasterStyle = "bitmap" | "halftone" | "cross-stitch";

type EditorialRasterProps = {
  style: EditorialRasterStyle;
  size: number;
  ink: string;
  paper: string;
};

const fragmentSource = `
  precision highp float;
  varying vec2 vTexCoord;
  uniform sampler2D uTexture;
  uniform float uSize;
  uniform float uStyle;
  uniform vec4 uInk;
  uniform vec4 uPaper;
  uniform float uStepW;
  uniform float uStepH;

  void main() {
    vec4 source = texture2D(uTexture, vTexCoord);
    float luminance = dot(source.rgb, vec3(0.2126, 0.7152, 0.0722));
    vec2 pixel = vTexCoord / vec2(uStepW, uStepH);
    vec2 local = mod(pixel, uSize) - uSize * 0.5;
    float mark = 0.0;
    if (uStyle > 1.5) {
      float diagonal = min(abs(local.x - local.y), abs(local.x + local.y));
      float stitch = 1.0 - smoothstep(0.55, 1.35, diagonal);
      float reach = step(length(local), (1.0 - luminance) * uSize * 0.78 + 1.0);
      mark = stitch * reach;
    } else {
      float radius = max(0.45, (1.0 - luminance) * uSize * 0.68);
      mark = 1.0 - smoothstep(radius - 0.7, radius + 0.7, length(local));
    }
    vec3 ink = uStyle > 0.5 && uStyle < 1.5 ? source.rgb : uInk.rgb;
    gl_FragColor = vec4(mix(uPaper.rgb, ink, mark), source.a);
  }
`;

function rgb(value: string) {
  const normalized = /^#[0-9a-f]{6}$/i.test(value) ? value : "#000000";
  return [Number.parseInt(normalized.slice(1, 3), 16) / 255, Number.parseInt(normalized.slice(3, 5), 16) / 255, Number.parseInt(normalized.slice(5, 7), 16) / 255, 1] as [number, number, number, number];
}

export function rasterStyleIndex(style: EditorialRasterStyle) {
  return style === "bitmap" ? 0 : style === "halftone" ? 1 : 2;
}

export class EditorialRasterFilter extends filters.BaseFilter<"EditorialRaster", EditorialRasterProps> {
  declare style: EditorialRasterStyle;
  declare size: number;
  declare ink: string;
  declare paper: string;

  static override type = "EditorialRaster";
  static override defaults: EditorialRasterProps = { style: "bitmap", size: 7, ink: "#10251E", paper: "#F3F7F2" };
  static override uniformLocations = ["uSize", "uStyle", "uInk", "uPaper"];

  override getFragmentSource() { return fragmentSource; }
  override getCacheKey() { return this.type; }

  override sendUniformData(gl: WebGLRenderingContext, locations: TWebGLUniformLocationMap) {
    gl.uniform1f(locations["uSize"], Math.max(3, this.size));
    gl.uniform1f(locations["uStyle"], rasterStyleIndex(this.style));
    gl.uniform4fv(locations["uInk"], rgb(this.ink));
    gl.uniform4fv(locations["uPaper"], rgb(this.paper));
  }

  override applyTo2d(options: T2DPipelineState) {
    const { data, width, height } = options.imageData;
    const source = new Uint8ClampedArray(data);
    const size = Math.max(3, Math.round(this.size));
    const ink = rgb(this.ink).map((value) => value * 255);
    const paper = rgb(this.paper).map((value) => value * 255);
    const style = this.style;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * 4;
        const centerX = Math.min(width - 1, Math.floor(x / size) * size + Math.floor(size / 2));
        const centerY = Math.min(height - 1, Math.floor(y / size) * size + Math.floor(size / 2));
        const centerOffset = (centerY * width + centerX) * 4;
        const red = source[centerOffset];
        const green = source[centerOffset + 1];
        const blue = source[centerOffset + 2];
        const luminance = (red * .2126 + green * .7152 + blue * .0722) / 255;
        const localX = x % size - size / 2;
        const localY = y % size - size / 2;
        let marked: boolean;
        if (style === "cross-stitch") {
          const diagonal = Math.min(Math.abs(localX - localY), Math.abs(localX + localY));
          marked = diagonal < 1.25 && Math.hypot(localX, localY) < (1 - luminance) * size * .78 + 1;
        } else {
          const radius = Math.max(.5, (1 - luminance) * size * .68);
          marked = Math.hypot(localX, localY) <= radius;
        }
        const color = marked ? style === "halftone" ? [red, green, blue, 255] : ink : paper;
        data[offset] = color[0];
        data[offset + 1] = color[1];
        data[offset + 2] = color[2];
        data[offset + 3] = source[offset + 3];
      }
    }
  }
}
