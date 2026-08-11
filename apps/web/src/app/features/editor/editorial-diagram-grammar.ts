import type { EditorialDiagramKind, EditorialDiagramProfile } from "./editor.models";

export type EditorialNodeRole =
  | "condition"
  | "decision"
  | "execution"
  | "evidence"
  | "feedback"
  | "stage"
  | "milestone"
  | "layer"
  | "before"
  | "after"
  | "recurring";

export type ConnectorCharacter = "precise" | "editorial" | "sketch";
export type ConnectorRoute = "spline" | "soft-step" | "arc";

export type EditorialDiagramGrammar = {
  topology: "sequence" | "chronology" | "contrast" | "containment" | "recurrence" | "causal-system";
  readingDirection: "left-to-right" | "top-to-bottom" | "bilateral" | "circular";
  focalNodeId?: string;
  roles: Record<string, EditorialNodeRole>;
  connector: {
    character: ConnectorCharacter;
    route: ConnectorRoute;
    tension: number;
  };
  lanes: [string, string, string];
  closingNotation: string;
};

const decisionPattern = /agente|agent|harness|modelo|model|orquest|sistema|controller|controlador|motor/iu;
const conditionPattern = /context|memoria|memory|regla|rule|guardrail|l[ií]mite|riesgo|risk|usuario|user|entrada|input|prompt|pol[ií]tica|policy|constraint/iu;
const evidencePattern = /resultado|result|evidencia|evidence|output|salida|respuesta|response|m[eé]trica|metric/iu;
const feedbackPattern = /feedback|retroaliment|eval[uú]a|evaluate|corrige|correct|review|revisi[oó]n/iu;
const technicalSketchPattern = /\bapi\b|database|base de datos|dynamodb|storage|servidor|server|cloud|docker|kubernetes|lambda|gateway|bucket|cdn|mcp|webhook|queue|cola/iu;

function nodeText(node: EditorialDiagramProfile["nodes"][number]) {
  return `${node.label} ${node.detail} ${node.icon}`;
}

function topologyFor(kind: EditorialDiagramKind): EditorialDiagramGrammar["topology"] {
  if (kind === "timeline") return "chronology";
  if (kind === "comparison") return "contrast";
  if (kind === "layers") return "containment";
  if (kind === "cycle") return "recurrence";
  if (kind === "system") return "causal-system";
  return "sequence";
}

function readingDirectionFor(kind: EditorialDiagramKind): EditorialDiagramGrammar["readingDirection"] {
  if (["timeline", "layers"].includes(kind)) return "top-to-bottom";
  if (kind === "comparison") return "bilateral";
  if (kind === "cycle") return "circular";
  return "left-to-right";
}

function connectorCharacter(profile: EditorialDiagramProfile): ConnectorCharacter {
  const source = `${profile.title} ${profile.caption} ${profile.nodes.map(nodeText).join(" ")}`;
  if (technicalSketchPattern.test(source) && profile.nodes.length >= 4) return "sketch";
  if (["flow", "cycle", "system"].includes(profile.kind)) return "editorial";
  return "precise";
}

function connectorRoute(kind: EditorialDiagramKind): ConnectorRoute {
  if (["timeline", "layers"].includes(kind)) return "soft-step";
  if (kind === "cycle") return "arc";
  return "spline";
}

function rolesFor(profile: EditorialDiagramProfile, focalNodeId?: string) {
  const roles: Record<string, EditorialNodeRole> = {};
  if (profile.kind === "system") {
    profile.nodes.forEach((node) => {
      const source = nodeText(node);
      roles[node.id] = node.id === focalNodeId
        ? "decision"
        : node.group === "left" || conditionPattern.test(source)
          ? "condition"
          : feedbackPattern.test(source)
            ? "feedback"
            : evidencePattern.test(source)
              ? "evidence"
              : "execution";
    });
    return roles;
  }
  if (profile.kind === "comparison") {
    const splitAt = Math.ceil(profile.nodes.length / 2);
    profile.nodes.forEach((node, index) => {
      roles[node.id] = node.group === "left" || (node.group !== "right" && index < splitAt) ? "before" : "after";
    });
    return roles;
  }
  const role: EditorialNodeRole = profile.kind === "timeline"
    ? "milestone"
    : profile.kind === "layers"
      ? "layer"
      : profile.kind === "cycle"
        ? "recurring"
        : "stage";
  profile.nodes.forEach((node) => { roles[node.id] = role; });
  return roles;
}

export function deriveEditorialDiagramGrammar(profile: EditorialDiagramProfile): EditorialDiagramGrammar {
  const focalNode = profile.kind === "system"
    ? profile.nodes.find((node) => node.group === "center")
      ?? profile.nodes.find((node) => decisionPattern.test(nodeText(node)))
      ?? profile.nodes[0]
    : profile.kind === "flow"
      ? profile.nodes.at(-1)
      : undefined;
  const character = connectorCharacter(profile);
  return {
    topology: topologyFor(profile.kind),
    readingDirection: readingDirectionFor(profile.kind),
    focalNodeId: focalNode?.id,
    roles: rolesFor(profile, focalNode?.id),
    connector: {
      character,
      route: connectorRoute(profile.kind),
      tension: character === "sketch" ? .54 : character === "editorial" ? .44 : .34,
    },
    lanes: profile.kind === "system"
      ? ["CONDICIONES", "DECISIÓN", "EJECUCIÓN"]
      : ["ENTRADA", "RELACIÓN", "SALIDA"],
    closingNotation: profile.kind === "system"
      ? "CONDICIÓN → DECISIÓN → EJECUCIÓN · RESULTADO ↩ CRITERIO"
      : profile.kind === "cycle"
        ? "LA ÚLTIMA ACCIÓN CAMBIA LA SIGUIENTE"
        : "LEE LA RELACIÓN, NO SOLO LAS CAJAS",
  };
}

export function nodesWithRole(profile: EditorialDiagramProfile, grammar: EditorialDiagramGrammar, role: EditorialNodeRole) {
  return profile.nodes.filter((node) => grammar.roles[node.id] === role);
}
