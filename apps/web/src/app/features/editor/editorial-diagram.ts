// Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V5
import type { EditorialDiagramKind, EditorialDiagramProfile, SceneElement, VisualRole } from "./editor.models";
import { deriveEditorialDiagramGrammar, nodesWithRole } from "./editorial-diagram-grammar";
import { createFluidConnectorAsset, type ConnectorDirection, type ConnectorPoint } from "./fluid-connector";
import { googleMaterialSymbolSvg, materialSymbolForConcept } from "./google-material-symbols";

type JsonObject = Record<string, unknown>;
type Dimensions = { width: number; height: number };
type DiagramOptions = {
  headline?: string;
  deck?: string;
  brand?: string;
  folio?: string;
  compact?: boolean;
};
type DrawConnectorOptions = Pick<Partial<SceneElement>, "stroke" | "strokeWidth" | "opacity"> & {
  route?: "spline" | "soft-step" | "arc";
  character?: "precise" | "editorial" | "sketch";
  tension?: number;
  startDirection?: ConnectorDirection;
  endDirection?: ConnectorDirection;
  waypoints?: ConnectorPoint[];
};

const KINDS: EditorialDiagramKind[] = ["flow", "timeline", "comparison", "layers", "cycle", "system"];

const clean = (value: unknown, max = 160) => typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
const isObject = (value: unknown): value is JsonObject => Boolean(value) && typeof value === "object" && !Array.isArray(value);

export function normalizeEditorialDiagram(value: unknown, fallbackTitle = "Mapa de la idea"): EditorialDiagramProfile | undefined {
  if (!isObject(value)) return undefined;
  const kind = KINDS.includes(value["kind"] as EditorialDiagramKind) ? value["kind"] as EditorialDiagramKind : "flow";
  const rawNodes = Array.isArray(value["nodes"]) ? value["nodes"].slice(0, 6) : [];
  const nodes = rawNodes.flatMap((item, index) => {
    if (!isObject(item)) return [];
    const label = clean(item["label"], 44);
    if (!label) return [];
    return [{
      id: clean(item["id"], 32) || `node-${index + 1}`,
      label,
      detail: clean(item["detail"], 100),
      icon: clean(item["icon"], 48) || label,
      group: ["left", "right", "center"].includes(String(item["group"])) ? item["group"] as "left" | "right" | "center" : undefined,
    }];
  });
  if (nodes.length < 2) return undefined;
  const ids = new Set(nodes.map((node) => node.id));
  const rawEdges = Array.isArray(value["edges"]) ? value["edges"].slice(0, 10) : [];
  const edges: EditorialDiagramProfile["edges"] = rawEdges.flatMap((item) => {
    if (!isObject(item)) return [];
    const from = clean(item["from"], 32);
    const to = clean(item["to"], 32);
    if (!ids.has(from) || !ids.has(to) || from === to) return [];
    return [{ from, to, label: clean(item["label"], 48) || undefined }];
  });
  if (!edges.length && !["comparison", "layers"].includes(kind)) {
    if (kind === "system") {
      const center = nodes.find((node) => node.group === "center")
        ?? nodes.find((node) => /agente|agent|harness|modelo|model|orquest|sistema/iu.test(`${node.label} ${node.detail}`))
        ?? nodes[0]!;
      const peers = nodes.filter((node) => node.id !== center.id);
      let conditions = peers.filter((node) => node.group === "left" || /context|memoria|memory|regla|rule|guardrail|l[ií]mite|riesgo|risk|usuario|user|entrada|input|prompt/iu.test(`${node.label} ${node.detail}`));
      let execution = peers.filter((node) => !conditions.includes(node));
      if (!conditions.length && peers.length > 1) {
        conditions = peers.slice(0, Math.floor(peers.length / 2));
        execution = peers.filter((node) => !conditions.includes(node));
      }
      conditions.forEach((node) => edges.push({ from: node.id, to: center.id }));
      if (execution[0]) edges.push({ from: center.id, to: execution[0].id });
      execution.slice(0, -1).forEach((node, index) => edges.push({ from: node.id, to: execution[index + 1]!.id }));
    } else {
      nodes.slice(0, -1).forEach((node, index) => edges.push({ from: node.id, to: nodes[index + 1]!.id }));
      if (kind === "cycle") edges.push({ from: nodes[nodes.length - 1]!.id, to: nodes[0]!.id });
    }
  }
  const compareLabels = Array.isArray(value["compareLabels"])
    ? [clean(value["compareLabels"][0], 32) || "ANTES", clean(value["compareLabels"][1], 32) || "DESPUÉS"] as [string, string]
    : undefined;
  return {
    kind,
    title: clean(value["title"], 100) || fallbackTitle,
    caption: clean(value["caption"], 160),
    nodes,
    edges,
    compareLabels,
  };
}

function wrap(value: string, maxChars: number, maxLines = 2) {
  const words = clean(value, 180).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && next.length > maxChars && lines.length < maxLines - 1) {
      lines.push(current);
      current = word;
    } else current = next;
  }
  if (current) lines.push(current);
  return lines.slice(0, maxLines).join("\n");
}

export function createEditorialDiagramElements(
  profile: EditorialDiagramProfile,
  colors: string[],
  dimensions: Dimensions,
  options: DiagramOptions = {},
): SceneElement[] {
  const [marker = "#D94E1E", accent = "#008F99", paper = "#F4F4F5", ink = "#18181B"] = colors;
  const { width, height } = dimensions;
  const compact = options.compact === true;
  const elements: SceneElement[] = [];
  const visualId = `diagram-${profile.kind}`;
  const grammar = deriveEditorialDiagramGrammar(profile);
  const add = (input: Partial<SceneElement> & Pick<SceneElement, "type" | "name" | "x" | "y" | "width" | "height">, role: VisualRole = "shape") => {
    elements.push({
      id: `${visualId}-${elements.length}`,
      scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, zIndex: elements.length,
      visible: true, locked: false, generatedVisualId: visualId, visualRole: role,
      ...input,
    });
  };
  const text = (name: string, content: string, x: number, y: number, boxWidth: number, size: number, opts: Partial<SceneElement> = {}) => add({
    type: "text", name, content, x, y, width: boxWidth, height: size * 2.7,
    fill: ink, fontFamily: "Space Grotesk", fontSize: size, fontWeight: 650,
    lineHeight: 1.02, charSpacing: -8, textAlign: "left", ...opts,
  }, "label");
  const line = (name: string, x: number, y: number, lineWidth: number, lineHeight: number, opts: Partial<SceneElement> = {}) => add({
    type: "line", name, x, y, width: lineWidth, height: lineHeight, stroke: ink, strokeWidth: 2.2, opacity: .34, ...opts,
  }, "connector");
  const connector = (name: string, x: number, y: number, deltaX: number, deltaY: number, opts: DrawConnectorOptions = {}) => {
    const asset = createFluidConnectorAsset({ x, y }, { x: x + deltaX, y: y + deltaY }, {
      color: opts.stroke ?? accent,
      strokeWidth: opts.strokeWidth ?? (compact ? 1.8 : 2.25),
      character: opts.character ?? grammar.connector.character,
      route: opts.route ?? grammar.connector.route,
      tension: opts.tension ?? grammar.connector.tension,
      startDirection: opts.startDirection,
      endDirection: opts.endDirection,
      waypoints: opts.waypoints,
      label: name,
    });
    add({
      type: "svg", name, x: asset.x, y: asset.y, width: asset.width, height: asset.height,
      svg: asset.svg, imageFit: "contain", opacity: opts.opacity ?? .64,
    }, "connector");
  };

  const headline = options.headline || profile.title;
  const deck = options.deck || profile.caption;
  const top = compact ? height * .045 : height * .055;
  const diagramTop = compact ? height * .25 : height * .265;
  const diagramBottom = compact ? height * .94 : height * .875;
  const diagramHeight = diagramBottom - diagramTop;
  const side = width * (compact ? .055 : .075);

  if (profile.kind === "system") {
    [side, width * .39, width * .65, width - side].forEach((x, index) => {
      line(`Guía estructural ${index + 1}`, x, 0, 0, height, { stroke: paper, strokeWidth: 1, opacity: .055 });
    });
  } else {
    for (let index = 1; index < 7; index++) {
      line(`Retícula vertical ${index}`, width * index / 7, 0, 0, height, { stroke: accent, strokeWidth: 1, opacity: .055 });
    }
    for (let index = 1; index < 9; index++) {
      line(`Retícula horizontal ${index}`, 0, height * index / 9, width, 0, { stroke: accent, strokeWidth: 1, opacity: .045 });
    }
  }

  text("Kicker del diagrama", options.folio || (profile.kind === "system" ? "SISTEMA / RELACIÓN" : `MAPA / ${profile.kind.toLocaleUpperCase()}`), side, top, width * .44, compact ? 11 : 14, {
    fontFamily: "Share Tech Mono", fontWeight: 700, charSpacing: 22, opacity: .62,
  });
  if (options.brand) text("Firma", `@${options.brand}`, width * .62, top, width * .30, compact ? 11 : 14, {
    fontFamily: "Share Tech Mono", fontWeight: 700, charSpacing: 12, textAlign: "right", opacity: .52,
  });
  text("Titular del diagrama", wrap(headline, compact ? 38 : 30, 2), side, top + height * .045, width - side * 2, compact ? 31 : 54, {
    fontWeight: 850, lineHeight: .9, charSpacing: -22,
  });
  if (deck) text("Bajada del diagrama", wrap(deck, compact ? 70 : 62, 2), side, top + height * (compact ? .145 : .155), width - side * 2, compact ? 13 : 17, {
    fontWeight: 430, lineHeight: 1.2, charSpacing: 0, opacity: .66,
  });

  const positions = new Map<string, { x: number; y: number; width: number; height: number }>();
  const card = (node: EditorialDiagramProfile["nodes"][number], index: number, x: number, y: number, cardWidth: number, cardHeight: number, emphasized = false) => {
    positions.set(node.id, { x, y, width: cardWidth, height: cardHeight });
    add({ type: "rect", name: `Nodo ${index + 1}`, x, y, width: cardWidth, height: cardHeight, fill: emphasized ? ink : paper, stroke: emphasized ? ink : accent, strokeWidth: emphasized ? 2.8 : 1.7, radius: compact ? 10 : 16, shadowColor: ink, shadowBlur: compact ? 0 : 8, shadowOffsetY: compact ? 0 : 4 }, "shape");
    add({ type: "rect", name: `Acento ${index + 1}`, x, y, width: Math.max(5, cardWidth * .018), height: cardHeight, fill: index === 0 ? marker : accent, radius: compact ? 10 : 16 }, "shape");
    const iconSize = Math.min(cardHeight * .28, cardWidth * .13, compact ? 28 : 38);
    const iconName = materialSymbolForConcept(`${node.icon} ${node.label} ${node.detail}`, index);
    add({ type: "svg", name: `Google Material · ${iconName}`, x: x + cardWidth * .07, y: y + cardHeight * .16, width: iconSize, height: iconSize, svg: googleMaterialSymbolSvg(iconName, emphasized ? paper : accent) }, "illustration");
    text(`Etiqueta ${index + 1}`, wrap(node.label, compact ? 14 : 16, 2), x + cardWidth * .07, y + cardHeight * .52, cardWidth * .86, compact ? 12 : 16, {
      fill: emphasized ? paper : ink, fontWeight: 800, lineHeight: .95, charSpacing: -8,
    });
    if (node.detail) text(`Detalle ${index + 1}`, wrap(node.detail, compact ? 22 : 28, 2), x + cardWidth * .07, y + cardHeight * .72, cardWidth * .86, compact ? 8.5 : 11.5, {
      fill: emphasized ? paper : ink, fontWeight: 430, lineHeight: 1.12, charSpacing: 0, opacity: emphasized ? .76 : .68,
    });
  };
  const connectProfileEdge = (edge: EditorialDiagramProfile["edges"][number], index: number, opacity = .55) => {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    if (!from || !to) return;
    const fromX = from.x + from.width / 2;
    const fromY = from.y + from.height / 2;
    const toX = to.x + to.width / 2;
    const toY = to.y + to.height / 2;
    const distance = Math.max(1, Math.hypot(toX - fromX, toY - fromY));
    const unitX = (toX - fromX) / distance;
    const unitY = (toY - fromY) / distance;
    const boundaryInset = (box: { width: number; height: number }) => Math.min(
      Math.abs(unitX) > .001 ? box.width / 2 / Math.abs(unitX) : Number.POSITIVE_INFINITY,
      Math.abs(unitY) > .001 ? box.height / 2 / Math.abs(unitY) : Number.POSITIVE_INFINITY,
    );
    const fromInset = boundaryInset(from) * 1.03;
    const toInset = boundaryInset(to) * 1.03;
    const startX = fromX + unitX * fromInset;
    const startY = fromY + unitY * fromInset;
    const endX = toX - unitX * toInset;
    const endY = toY - unitY * toInset;
    connector(`Relación visual ${index + 1} · ${edge.from} → ${edge.to}`, startX, startY, endX - startX, endY - startY, { opacity });
  };

  const zoneWidth = width - side * 2;
  if (profile.kind === "comparison") {
    const [leftLabel, rightLabel] = profile.compareLabels ?? ["ANTES", "DESPUÉS"];
    const gap = width * .055;
    const columnWidth = (zoneWidth - gap) / 2;
    const splitAt = Math.ceil(profile.nodes.length / 2);
    const leftNodes = profile.nodes.filter((node, index) => node.group === "left" || (node.group !== "right" && index < splitAt)).slice(0, 3);
    const rightNodes = profile.nodes.filter((node, index) => node.group === "right" || (node.group !== "left" && index >= splitAt)).slice(0, 3);
    add({ type: "rect", name: "Campo izquierdo", x: side, y: diagramTop, width: columnWidth, height: diagramHeight, fill: paper, stroke: ink, strokeWidth: 1.5, radius: 18, opacity: .88 }, "shape");
    add({ type: "rect", name: "Campo derecho", x: side + columnWidth + gap, y: diagramTop, width: columnWidth, height: diagramHeight, fill: accent, stroke: accent, strokeWidth: 1.5, radius: 18, opacity: .10 }, "shape");
    text("Comparación A", leftLabel.toLocaleUpperCase(), side + 18, diagramTop + 15, columnWidth - 36, compact ? 12 : 15, { fontFamily: "Share Tech Mono", charSpacing: 16, opacity: .6 });
    text("Comparación B", rightLabel.toLocaleUpperCase(), side + columnWidth + gap + 18, diagramTop + 15, columnWidth - 36, compact ? 12 : 15, { fill: accent, fontFamily: "Share Tech Mono", charSpacing: 16, opacity: .9 });
    const renderColumn = (nodes: typeof leftNodes, startX: number, emphasis: boolean) => {
      const gapY = 12;
      const available = diagramHeight - 70;
      const cardHeight = Math.min((available - Math.max(0, nodes.length - 1) * gapY) / Math.max(1, nodes.length), compact ? 118 : 210);
      const stackHeight = nodes.length * cardHeight + Math.max(0, nodes.length - 1) * gapY;
      const startY = diagramTop + 50 + Math.max(0, (available - stackHeight) / 2);
      nodes.forEach((node, index) => card(node, profile.nodes.indexOf(node), startX + 18, startY + index * (cardHeight + gapY), columnWidth - 36, cardHeight, emphasis && index === nodes.length - 1));
    };
    renderColumn(leftNodes, side, false);
    renderColumn(rightNodes, side + columnWidth + gap, false);
    text("Versus", "VS", side + columnWidth + gap * .18, diagramTop + diagramHeight * .46, gap * .64, compact ? 13 : 17, { fill: marker, fontFamily: "Share Tech Mono", textAlign: "center", fontWeight: 900 });
  } else if (profile.kind === "layers") {
    const count = profile.nodes.length;
    const gap = compact ? 9 : 12;
    const cardHeight = Math.min(diagramHeight * .17, (diagramHeight - gap * (count - 1)) / count);
    profile.nodes.forEach((node, index) => {
      const inset = Math.min(width * .10, index * width * .018);
      card(node, index, side + inset, diagramTop + index * (cardHeight + gap), zoneWidth - inset * 2, cardHeight, index === count - 1);
      if (index < count - 1) connector(`Descenso ${index + 1}`, width * .5, diagramTop + (index + 1) * (cardHeight + gap) - gap + 1, 0, gap - 2);
    });
  } else if (profile.kind === "timeline") {
    const count = profile.nodes.length;
    const spineX = width * .5;
    line("Eje temporal", spineX, diagramTop + 12, 0, diagramHeight - 24, { stroke: ink, strokeWidth: 3, opacity: .7 });
    const rowHeight = diagramHeight / count;
    profile.nodes.forEach((node, index) => {
      const left = index % 2 === 0;
      const cardWidth = zoneWidth * .42;
      const cardHeight = Math.min(rowHeight * .78, compact ? 82 : 115);
      const x = left ? side : width - side - cardWidth;
      const y = diagramTop + index * rowHeight + (rowHeight - cardHeight) / 2;
      line(`Rama temporal ${index + 1}`, left ? x + cardWidth : spineX, y + cardHeight * .5, left ? spineX - x - cardWidth : x - spineX, 0, { stroke: accent, opacity: .55 });
      add({ type: "circle", name: `Hito ${index + 1}`, x: spineX - 8, y: y + cardHeight * .5 - 8, width: 16, height: 16, fill: index === count - 1 ? marker : paper, stroke: ink, strokeWidth: 2.5 }, "shape");
      card(node, index, x, y, cardWidth, cardHeight, index === count - 1);
    });
  } else if (profile.kind === "system") {
    const center = profile.nodes.find((node) => node.id === grammar.focalNodeId) ?? profile.nodes[0]!;
    const peers = profile.nodes.filter((node) => node.id !== center.id);
    let conditions = nodesWithRole(profile, grammar, "condition").filter((node) => node.id !== center.id);
    let execution = peers.filter((node) => !conditions.includes(node));
    if (!conditions.length && peers.length > 1) {
      conditions = peers.slice(0, Math.min(2, Math.floor(peers.length / 2)));
      execution = peers.filter((node) => !conditions.includes(node));
    }
    if (!execution.length && conditions.length > 1) {
      execution = [conditions.pop()!];
    }

    const leftX = side;
    const leftWidth = zoneWidth * .255;
    const centerWidth = zoneWidth * .25;
    const centerHeight = Math.min(diagramHeight * .31, compact ? 160 : 230);
    const centerX = width * .42;
    const centerY = diagramTop + diagramHeight * .25;
    const rightX = width * .67;
    const rightWidth = width - side - rightX;
    const fieldY = diagramTop + diagramHeight * .13;
    const fieldHeight = Math.min(diagramHeight * .59, compact ? 340 : 500);
    const nodeIcon = (node: EditorialDiagramProfile["nodes"][number], index: number, x: number, y: number, size: number, color: string) => {
      const iconName = materialSymbolForConcept(`${node.icon} ${node.label} ${node.detail}`, index);
      add({ type: "svg", name: `Google Material · ${iconName}`, x, y, width: size, height: size, svg: googleMaterialSymbolSvg(iconName, color) }, "illustration");
    };

    text("Cabecera condiciones", `01 / ${grammar.lanes[0]}`, leftX, diagramTop + 8, leftWidth, compact ? 9.5 : 12, {
      fill: accent, fontFamily: "Share Tech Mono", fontWeight: 800, charSpacing: 18,
    });
    text("Cabecera decisión", `02 / ${grammar.lanes[1]}`, centerX, diagramTop + 8, centerWidth, compact ? 9.5 : 12, {
      fill: ink, fontFamily: "Share Tech Mono", fontWeight: 800, charSpacing: 18, opacity: .68,
    });
    text("Cabecera ejecución", `03 / ${grammar.lanes[2]}`, rightX, diagramTop + 8, rightWidth, compact ? 9.5 : 12, {
      fill: ink, fontFamily: "Share Tech Mono", fontWeight: 800, charSpacing: 18, opacity: .68,
    });

    const conditionGap = compact ? 18 : 28;
    const conditionHeight = Math.min(compact ? 92 : 116, (fieldHeight - Math.max(0, conditions.length - 1) * conditionGap) / Math.max(1, conditions.length));
    conditions.forEach((node, index) => {
      const x = leftX;
      const y = fieldY + index * (conditionHeight + conditionGap);
      positions.set(node.id, { x, y, width: leftWidth, height: conditionHeight });
      line(`Regla de condición ${index + 1}`, x, y, leftWidth, 0, { stroke: accent, strokeWidth: 2.4, opacity: .9 });
      nodeIcon(node, profile.nodes.indexOf(node), x + leftWidth - (compact ? 22 : 28), y + (compact ? 14 : 18), compact ? 20 : 25, accent);
      text(`Nodo ${profile.nodes.indexOf(node) + 1} · condición`, wrap(node.label, compact ? 18 : 22, 2), x, y + (compact ? 24 : 34), leftWidth * .78, compact ? 14 : 20, {
        fontWeight: 820, lineHeight: .95, charSpacing: -9,
      });
      if (node.detail) text(`Detalle ${profile.nodes.indexOf(node) + 1}`, wrap(node.detail, compact ? 28 : 34, 2), x, y + conditionHeight * .69, leftWidth * .9, compact ? 9 : 12.5, {
        fontWeight: 430, lineHeight: 1.12, charSpacing: 0, opacity: .58,
      });
    });

    positions.set(center.id, { x: centerX, y: centerY, width: centerWidth, height: centerHeight });
    add({ type: "rect", name: `Nodo ${profile.nodes.indexOf(center) + 1} · decisión`, x: centerX, y: centerY, width: centerWidth, height: centerHeight, fill: ink, stroke: ink, strokeWidth: 2, radius: compact ? 5 : 7 }, "shape");
    add({ type: "circle", name: "Marca de decisión", x: centerX + centerWidth * .12, y: centerY + centerHeight * .84, width: compact ? 9 : 13, height: compact ? 9 : 13, fill: marker }, "shape");
    text("Folio del agente", "AGENTE / 01", centerX + centerWidth * .12, centerY + centerHeight * .12, centerWidth * .72, compact ? 8 : 11, {
      fill: paper, fontFamily: "Share Tech Mono", fontWeight: 800, charSpacing: 18, opacity: .52,
    });
    text(`Etiqueta ${profile.nodes.indexOf(center) + 1}`, wrap(center.label, compact ? 14 : 17, 2), centerX + centerWidth * .12, centerY + centerHeight * .37, centerWidth * .76, compact ? 25 : 38, {
      fill: paper, fontWeight: 880, lineHeight: .9, charSpacing: -18,
    });
    if (center.detail) text(`Detalle ${profile.nodes.indexOf(center) + 1}`, wrap(center.detail, compact ? 24 : 29, 2), centerX + centerWidth * .12, centerY + centerHeight * .66, centerWidth * .76, compact ? 10 : 13.5, {
      fill: paper, fontWeight: 450, lineHeight: 1.12, charSpacing: 0, opacity: .62,
    });

    add({ type: "rect", name: "Campo de ejecución", x: rightX, y: fieldY, width: rightWidth, height: fieldHeight, fill: "transparent", stroke: ink, strokeWidth: 1.4, radius: compact ? 4 : 6, opacity: .28 }, "shape");
    const executionRow = fieldHeight / Math.max(1, execution.length);
    execution.forEach((node, index) => {
      const x = rightX;
      const y = fieldY + index * executionRow;
      positions.set(node.id, { x, y, width: rightWidth, height: executionRow });
      if (index) line(`Divisor de ejecución ${index}`, x, y, rightWidth, 0, { stroke: ink, strokeWidth: 1, opacity: .14 });
      const highlighted = ["evidence", "feedback"].includes(grammar.roles[node.id] ?? "");
      add({ type: "circle", name: `Hito de ejecución ${index + 1}`, x: x - (compact ? 5 : 7), y: y + executionRow * .39, width: compact ? 10 : 14, height: compact ? 10 : 14, fill: highlighted ? marker : accent }, "shape");
      nodeIcon(node, profile.nodes.indexOf(node), x + rightWidth - (compact ? 30 : 38), y + executionRow * .18, compact ? 20 : 26, highlighted ? marker : accent);
      text(`Nodo ${profile.nodes.indexOf(node) + 1} · ejecución`, wrap(node.label, compact ? 18 : 20, 2), x + rightWidth * .10, y + executionRow * .29, rightWidth * .70, compact ? 14 : 19, {
        fontWeight: 820, lineHeight: .95, charSpacing: -9,
      });
      if (node.detail) text(`Detalle ${profile.nodes.indexOf(node) + 1}`, wrap(node.detail, compact ? 30 : 34, 2), x + rightWidth * .10, y + executionRow * .59, rightWidth * .78, compact ? 9 : 12, {
        fontWeight: 430, lineHeight: 1.1, charSpacing: 0, opacity: .56,
      });
    });

    const feedbackEdges = profile.edges.filter((edge) => edge.to === center.id && ["execution", "evidence", "feedback"].includes(grammar.roles[edge.from] ?? ""));
    const executionIds = new Set(execution.map((node) => node.id));
    profile.edges.forEach((edge, index) => {
      const from = positions.get(edge.from);
      const to = positions.get(edge.to);
      if (!from || !to) return;
      if (feedbackEdges.includes(edge)) {
        const loopY = Math.min(diagramBottom - (compact ? 42 : 58), Math.max(from.y + from.height, centerY + centerHeight) + (compact ? 36 : 52));
        const startX = from.x;
        const startY = from.y + from.height * .62;
        const endX = centerX + centerWidth * .5;
        const elbowX = startX - (compact ? 24 : 34);
        const endY = centerY + centerHeight + 4;
        connector(`Bucle de feedback ${index + 1} · ${edge.from} → ${edge.to}`, startX, startY, endX - startX, endY - startY, {
          stroke: marker,
          strokeWidth: compact ? 2.6 : 3.2,
          opacity: .95,
          route: "spline",
          character: grammar.connector.character,
          tension: .48,
          waypoints: [{ x: elbowX, y: startY }, { x: elbowX, y: loopY }, { x: endX, y: loopY }],
        });
        if (edge.label) text(`Etiqueta de feedback ${index + 1}`, edge.label.toLocaleUpperCase(), centerX + centerWidth * .24, loopY - (compact ? 22 : 30), centerWidth * .72, compact ? 8.5 : 11, {
          fill: ink, fontFamily: "Share Tech Mono", fontWeight: 800, charSpacing: 14, opacity: .78,
        });
        return;
      }
      if (executionIds.has(edge.from) && executionIds.has(edge.to)) {
        // Execution rows touch each other, so a boundary-to-boundary connector
        // collapses to almost zero. Give causal flow a narrow dedicated rail.
        const railX = rightX + rightWidth * (compact ? .055 : .06);
        const startY = from.y + from.height * .43;
        const endY = to.y + to.height * .35;
        connector(`Carril causal ${index + 1} · ${edge.from} → ${edge.to}`, railX, startY, 0, endY - startY, {
          opacity: .78,
          route: "spline",
          startDirection: endY >= startY ? "down" : "up",
          endDirection: endY >= startY ? "down" : "up",
        });
        return;
      }
      connectProfileEdge(edge, index, .72);
    });
  } else if (profile.kind === "cycle") {
    const center = undefined;
    const orbitNodes = profile.nodes;
    const cx = width * .5;
    const cy = diagramTop + diagramHeight * .50;
    const radiusX = zoneWidth * .35;
    const radiusY = diagramHeight * .33;
    const cardWidth = Math.min(zoneWidth * .30, compact ? 150 : 250);
    const cardHeight = Math.min(diagramHeight * .25, compact ? 92 : 150);
    const orbitPositions = orbitNodes.map((node, index) => {
      const angle = -Math.PI / 2 + index * (Math.PI * 2 / orbitNodes.length);
      return { node, x: cx + Math.cos(angle) * radiusX - cardWidth / 2, y: cy + Math.sin(angle) * radiusY - cardHeight / 2 };
    });
    orbitPositions.forEach(({ node, x, y }, index) => {
      positions.set(node.id, { x, y, width: cardWidth, height: cardHeight });
    });
    profile.edges.forEach((edge, index) => connectProfileEdge(edge, index, .55));
    orbitPositions.forEach(({ node, x, y }) => card(node, profile.nodes.indexOf(node), x, y, cardWidth, cardHeight, false));
  } else {
    const count = profile.nodes.length;
    const columns = count > 4 ? 3 : count;
    const rows = Math.ceil(count / columns);
    const gapX = width * .025;
    const gapY = height * .035;
    const cardWidth = (zoneWidth - gapX * (columns - 1)) / columns;
    const cardHeight = Math.min(compact ? 124 : 200, diagramHeight * .42, (diagramHeight - gapY * (rows - 1)) / rows);
    const flowPositions = profile.nodes.map((node, index) => {
      const row = Math.floor(index / columns);
      const logicalColumn = index % columns;
      const column = row % 2 ? columns - 1 - logicalColumn : logicalColumn;
      return { node, x: side + column * (cardWidth + gapX), y: diagramTop + row * (cardHeight + gapY) + (diagramHeight - rows * cardHeight - (rows - 1) * gapY) / 2 };
    });
    flowPositions.forEach(({ node, x, y }) => positions.set(node.id, { x, y, width: cardWidth, height: cardHeight }));
    profile.edges.forEach((edge, index) => connectProfileEdge(edge, index, .62));
    flowPositions.forEach(({ node, x, y }, index) => card(node, index, x, y, cardWidth, cardHeight, index === count - 1));
  }

  for (const edge of profile.kind === "system" ? [] : profile.edges) {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    if (!from || !to || !edge.label) continue;
    const x = (from.x + from.width / 2 + to.x + to.width / 2) / 2;
    const y = (from.y + from.height / 2 + to.y + to.height / 2) / 2;
    text(`Relación ${edge.from}-${edge.to}`, edge.label, x - width * .07, y - 10, width * .14, compact ? 8 : 10, { fill: accent, textAlign: "center", fontFamily: "Share Tech Mono", charSpacing: 3, opacity: .8 });
  }

  if (!compact) {
    line("Regla de pie", side, height * .925, width - side * 2, 0, { stroke: ink, opacity: .22 });
    text("Lectura", grammar.closingNotation, side, height * .942, width * .80, 12, { fontFamily: "Share Tech Mono", charSpacing: 12, opacity: .52 });
  }
  return elements;
}
