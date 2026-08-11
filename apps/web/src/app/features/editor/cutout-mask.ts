export function morphMask(
  input: Uint8ClampedArray<ArrayBuffer>,
  width: number,
  height: number,
  dilate: boolean,
): Uint8ClampedArray<ArrayBuffer> {
  const output = new Uint8ClampedArray(input.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let value = dilate ? 0 : 255;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const px = Math.max(0, Math.min(width - 1, x + ox));
          const py = Math.max(0, Math.min(height - 1, y + oy));
          value = dilate ? Math.max(value, input[py * width + px]) : Math.min(value, input[py * width + px]);
        }
      }
      output[y * width + x] = value;
    }
  }
  return output;
}
export function blurMask(
  input: Uint8ClampedArray<ArrayBuffer>,
  width: number,
  height: number,
  radius: number,
): Uint8ClampedArray<ArrayBuffer> {
  if (!radius) return input.slice();
  const horizontal = new Uint8ClampedArray(input.length);
  const output = new Uint8ClampedArray(input.length);
  for (let y = 0; y < height; y++) {
    let sum = 0;
    for (let x = -radius; x <= radius; x++) sum += input[y * width + Math.max(0, Math.min(width - 1, x))];
    for (let x = 0; x < width; x++) {
      horizontal[y * width + x] = sum / (radius * 2 + 1);
      sum -= input[y * width + Math.max(0, x - radius)];
      sum += input[y * width + Math.min(width - 1, x + radius + 1)];
    }
  }
  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let y = -radius; y <= radius; y++) sum += horizontal[Math.max(0, Math.min(height - 1, y)) * width + x];
    for (let y = 0; y < height; y++) {
      output[y * width + x] = sum / (radius * 2 + 1);
      sum -= horizontal[Math.max(0, y - radius) * width + x];
      sum += horizontal[Math.min(height - 1, y + radius + 1) * width + x];
    }
  }
  return output;
}

export function processMask(
  input: Uint8ClampedArray<ArrayBuffer>,
  width: number,
  height: number,
  edge: number,
  feather: number,
): Uint8ClampedArray<ArrayBuffer> {
  let output = input.slice();
  const iterations = Math.min(8, Math.abs(Math.round(edge)));
  for (let pass = 0; pass < iterations; pass++) output = morphMask(output, width, height, edge > 0);
  return feather > 0 ? blurMask(output, width, height, Math.min(12, Math.round(feather))) : output;
}

export class MaskHistory {
  private states: Uint8ClampedArray<ArrayBuffer>[] = [];
  private index = -1;

  constructor(private readonly limit = 20) {}

  reset(mask: Uint8ClampedArray<ArrayBuffer>) {
    this.states = [mask.slice()];
    this.index = 0;
  }

  push(mask: Uint8ClampedArray<ArrayBuffer>) {
    this.states = this.states.slice(0, this.index + 1);
    this.states.push(mask.slice());
    if (this.states.length > this.limit) this.states.shift();
    this.index = this.states.length - 1;
  }

  undo() {
    if (!this.canUndo) return undefined;
    return this.states[--this.index].slice();
  }

  redo() {
    if (!this.canRedo) return undefined;
    return this.states[++this.index].slice();
  }

  get canUndo() { return this.index > 0; }
  get canRedo() { return this.index >= 0 && this.index < this.states.length - 1; }
  get size() { return this.states.length; }
}
