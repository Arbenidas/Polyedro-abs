import type { ConnectorCharacter, ConnectorRoute } from "./editorial-diagram-grammar";

export type ConnectorPoint = { x: number; y: number };
export type ConnectorDirection = "left" | "right" | "up" | "down";

export type FluidConnectorOptions = {
  color: string;
  strokeWidth?: number;
  character?: ConnectorCharacter;
  route?: ConnectorRoute;
  tension?: number;
  startDirection?: ConnectorDirection;
  endDirection?: ConnectorDirection;
  waypoints?: ConnectorPoint[];
  dashed?: boolean;
  label?: string;
};

export type FluidConnectorAsset = {
  x: number;
  y: number;
  width: number;
  height: number;
  svg: string;
  pathData: string;
};

const escapeXml = (value: string) => value.replace(/[<>&"']/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[character] ?? character);
const round = (value: number) => Math.round(value * 100) / 100;
const stableId = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

function vector(direction: ConnectorDirection) {
  if (direction === "left") return { x: -1, y: 0 };
  if (direction === "up") return { x: 0, y: -1 };
  if (direction === "down") return { x: 0, y: 1 };
  return { x: 1, y: 0 };
}

function defaultDirection(start: ConnectorPoint, end: ConnectorPoint): ConnectorDirection {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right" : "left";
  return dy >= 0 ? "down" : "up";
}

function cubicPath(
  start: ConnectorPoint,
  end: ConnectorPoint,
  startDirection: ConnectorDirection,
  endDirection: ConnectorDirection,
  tension: number,
) {
  const distance = Math.max(1, Math.hypot(end.x - start.x, end.y - start.y));
  const reach = Math.max(18, Math.min(distance * tension, 180));
  const from = vector(startDirection);
  const into = vector(endDirection);
  const c1 = { x: start.x + from.x * reach, y: start.y + from.y * reach };
  const c2 = { x: end.x - into.x * reach, y: end.y - into.y * reach };
  return {
    path: `M${round(start.x)} ${round(start.y)}C${round(c1.x)} ${round(c1.y)} ${round(c2.x)} ${round(c2.y)} ${round(end.x)} ${round(end.y)}`,
    support: [start, c1, c2, end],
  };
}

function catmullRomPath(points: ConnectorPoint[], tension: number) {
  if (points.length < 2) return { path: "", support: points };
  const commands = [`M${round(points[0]!.x)} ${round(points[0]!.y)}`];
  const support = [...points];
  for (let index = 0; index < points.length - 1; index++) {
    const p0 = points[index - 1] ?? points[index]!;
    const p1 = points[index]!;
    const p2 = points[index + 1]!;
    const p3 = points[index + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) * tension / 6, y: p1.y + (p2.y - p0.y) * tension / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) * tension / 6, y: p2.y - (p3.y - p1.y) * tension / 6 };
    support.push(c1, c2);
    commands.push(`C${round(c1.x)} ${round(c1.y)} ${round(c2.x)} ${round(c2.y)} ${round(p2.x)} ${round(p2.y)}`);
  }
  return { path: commands.join(""), support };
}

function roundedStepPath(points: ConnectorPoint[], radius: number) {
  if (points.length < 2) return { path: "", support: points };
  const commands = [`M${round(points[0]!.x)} ${round(points[0]!.y)}`];
  for (let index = 1; index < points.length - 1; index++) {
    const previous = points[index - 1]!;
    const current = points[index]!;
    const next = points[index + 1]!;
    const beforeDistance = Math.max(1, Math.hypot(previous.x - current.x, previous.y - current.y));
    const afterDistance = Math.max(1, Math.hypot(next.x - current.x, next.y - current.y));
    const beforeRadius = Math.min(radius, beforeDistance / 2);
    const afterRadius = Math.min(radius, afterDistance / 2);
    const before = {
      x: current.x + (previous.x - current.x) / beforeDistance * beforeRadius,
      y: current.y + (previous.y - current.y) / beforeDistance * beforeRadius,
    };
    const after = {
      x: current.x + (next.x - current.x) / afterDistance * afterRadius,
      y: current.y + (next.y - current.y) / afterDistance * afterRadius,
    };
    commands.push(`L${round(before.x)} ${round(before.y)}Q${round(current.x)} ${round(current.y)} ${round(after.x)} ${round(after.y)}`);
  }
  const end = points.at(-1)!;
  commands.push(`L${round(end.x)} ${round(end.y)}`);
  return { path: commands.join(""), support: points };
}

function routePoints(start: ConnectorPoint, end: ConnectorPoint, route: ConnectorRoute) {
  if (route !== "soft-step") return [start, end];
  if (Math.abs(end.x - start.x) >= Math.abs(end.y - start.y)) {
    const middleX = (start.x + end.x) / 2;
    return [start, { x: middleX, y: start.y }, { x: middleX, y: end.y }, end];
  }
  const middleY = (start.y + end.y) / 2;
  return [start, { x: start.x, y: middleY }, { x: end.x, y: middleY }, end];
}

function pathFor(start: ConnectorPoint, end: ConnectorPoint, options: FluidConnectorOptions) {
  const route = options.route ?? "spline";
  const tension = options.tension ?? .44;
  const waypoints = options.waypoints ?? [];
  const points = [start, ...waypoints, end];
  if (points.length > 2) return route === "soft-step" ? roundedStepPath(points, 18) : catmullRomPath(points, tension);
  if (route === "soft-step") return roundedStepPath(routePoints(start, end, route), 18);
  if (route === "arc") {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const normal = { x: -dy / distance, y: dx / distance };
    const bow = Math.min(90, distance * .18);
    const c1 = { x: start.x + dx * .28 + normal.x * bow, y: start.y + dy * .28 + normal.y * bow };
    const c2 = { x: start.x + dx * .72 + normal.x * bow, y: start.y + dy * .72 + normal.y * bow };
    return {
      path: `M${round(start.x)} ${round(start.y)}C${round(c1.x)} ${round(c1.y)} ${round(c2.x)} ${round(c2.y)} ${round(end.x)} ${round(end.y)}`,
      support: [start, c1, c2, end],
    };
  }
  const direction = defaultDirection(start, end);
  return cubicPath(start, end, options.startDirection ?? direction, options.endDirection ?? direction, tension);
}

export function createFluidConnectorAsset(start: ConnectorPoint, end: ConnectorPoint, options: FluidConnectorOptions): FluidConnectorAsset {
  const character = options.character ?? "editorial";
  const strokeWidth = options.strokeWidth ?? 3;
  const absolute = pathFor(start, end, options);
  const padding = Math.max(18, strokeWidth * 5);
  const minX = Math.min(...absolute.support.map((point) => point.x)) - padding;
  const minY = Math.min(...absolute.support.map((point) => point.y)) - padding;
  const maxX = Math.max(...absolute.support.map((point) => point.x)) + padding;
  const maxY = Math.max(...absolute.support.map((point) => point.y)) + padding;
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const localStart = { x: start.x - minX, y: start.y - minY };
  const localEnd = { x: end.x - minX, y: end.y - minY };
  const localWaypoints = options.waypoints?.map((point) => ({ x: point.x - minX, y: point.y - minY }));
  const local = pathFor(localStart, localEnd, { ...options, waypoints: localWaypoints });
  const color = escapeXml(options.color);
  const label = escapeXml(options.label ?? "Relación editorial");
  // Each connector is later embedded inside a larger SVG. A unique marker id
  // prevents one arrow from resolving the head that belongs to another layer.
  const markerId = `fluid-arrow-${stableId(`${options.label ?? "connector"}:${local.path}:${color}`)}`;
  const dash = options.dashed ? ` stroke-dasharray="${round(strokeWidth * 2.6)} ${round(strokeWidth * 2.2)}"` : "";
  const ghostPasses = character === "sketch"
    ? `<path d="${local.path}" fill="none" stroke="${color}" stroke-width="${round(strokeWidth * .52)}" stroke-linecap="round" stroke-linejoin="round" opacity=".2" transform="translate(1.1 -.75)"/><path d="${local.path}" fill="none" stroke="${color}" stroke-width="${round(strokeWidth * .42)}" stroke-linecap="round" stroke-linejoin="round" opacity=".12" transform="translate(-.7 .8)"/>`
    : character === "editorial"
      ? `<path d="${local.path}" fill="none" stroke="${color}" stroke-width="${round(strokeWidth * .46)}" stroke-linecap="round" stroke-linejoin="round" opacity=".14" transform="translate(.6 -.45)"/>`
      : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${round(width)} ${round(height)}" role="img" aria-label="${label}" overflow="visible"><defs><marker id="${markerId}" viewBox="0 0 12 12" refX="10.2" refY="6" markerWidth="8" markerHeight="8" orient="auto" markerUnits="userSpaceOnUse" overflow="visible"><path d="M1 1L10.2 6L1 11" fill="none" stroke="${color}" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>${ghostPasses}<path d="${local.path}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#${markerId})"${dash}/></svg>`;
  return { x: minX, y: minY, width, height, svg, pathData: local.path };
}
