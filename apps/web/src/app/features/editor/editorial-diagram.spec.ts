import { describe, expect, it } from "vitest";
import type { EditorialDiagramKind, EditorialDiagramProfile } from "./editor.models";
import { createEditorialDiagramElements, normalizeEditorialDiagram } from "./editorial-diagram";

const palette = ["#D94E1E", "#008F99", "#18181B", "#F4F4F5"];

function profile(kind: EditorialDiagramKind): EditorialDiagramProfile {
  return {
    kind,
    title: "El harness coordina el trabajo",
    caption: "La relación cambia según el tipo de explicación.",
    nodes: [
      { id: "user", label: "Usuario", detail: "Define el objetivo", icon: "person", group: "left" },
      { id: "agent", label: "Agente", detail: "Decide la acción", icon: "smart_toy", group: "right" },
      { id: "tool", label: "Herramienta", detail: "Ejecuta la tarea", icon: "build", group: "right" },
    ],
    edges: [{ from: "user", to: "agent" }, { from: "agent", to: "tool", label: "usa" }],
    compareLabels: ["Manual", "Agéntico"],
  };
}

describe("editorial microdiagrams", () => {
  it("normaliza nodos, relaciones y etiquetas de comparación", () => {
    const diagram = normalizeEditorialDiagram({
      kind: "comparison",
      title: "Dos formas de operar",
      nodes: [
        { id: "a", label: "Flujo manual", detail: "Cada paso se solicita", icon: "touch_app", group: "left" },
        { id: "b", label: "Flujo agente", detail: "El objetivo guía acciones", icon: "smart_toy", group: "right" },
      ],
      edges: [{ from: "a", to: "b", label: "evoluciona" }, { from: "fantasma", to: "b" }],
      compareLabels: ["Antes", "Después"],
    });

    expect(diagram?.kind).toBe("comparison");
    expect(diagram?.nodes).toHaveLength(2);
    expect(diagram?.edges).toEqual([{ from: "a", to: "b", label: "evoluciona" }]);
    expect(diagram?.compareLabels).toEqual(["Antes", "Después"]);
  });

  it.each(["flow", "timeline", "comparison", "layers", "cycle", "system"] as EditorialDiagramKind[])(
    "renderiza %s como capas editables con iconos Material",
    (kind) => {
      const elements = createEditorialDiagramElements(profile(kind), palette, { width: 1080, height: 1350 });

      expect(elements.filter((element) => element.name.startsWith("Nodo"))).toHaveLength(3);
      expect(elements.filter((element) => element.name.startsWith("Google Material ·"))).toHaveLength(kind === "system" ? 2 : 3);
      expect(elements.some((element) => element.name.startsWith("Google Material ·"))).toBe(true);
      expect(elements.some((element) => element.visualRole === "connector")).toBe(true);
      if (!["timeline", "comparison"].includes(kind)) {
        expect(elements.some((element) => element.visualRole === "connector" && element.type === "svg" && element.svg?.includes("marker-end"))).toBe(true);
      }
      expect(elements.every((element) => element.generatedVisualId === `diagram-${kind}`)).toBe(true);
    },
  );

  it("convierte system en un carril causal y reserva el bucle para feedback", () => {
    const system = profile("system");
    system.nodes = [
      { id: "context", label: "Contexto", detail: "Conserva reglas", icon: "memory", group: "left" },
      { id: "agent", label: "Agente", detail: "Decide la acción", icon: "smart_toy", group: "center" },
      { id: "tool", label: "Herramienta", detail: "Ejecuta", icon: "build", group: "right" },
      { id: "result", label: "Resultado", detail: "Devuelve evidencia", icon: "task_alt", group: "right" },
    ];
    system.edges = [
      { from: "context", to: "agent" },
      { from: "agent", to: "tool" },
      { from: "tool", to: "result" },
      { from: "result", to: "agent", label: "ajusta" },
    ];

    const elements = createEditorialDiagramElements(system, palette, { width: 1080, height: 1350 });
    const names = elements.map((element) => element.name);

    expect(names).toContain("Campo de ejecución");
    expect(names).toContain("Marca de decisión");
    expect(names.some((name) => name.startsWith("Bucle de feedback"))).toBe(true);
    expect(names.some((name) => name.startsWith("Regla de condición"))).toBe(true);
    expect(names.some((name) => name.startsWith("Nodo") && name.includes("ejecución"))).toBe(true);
    const feedback = elements.find((element) => element.name.startsWith("Bucle de feedback"));
    expect(feedback?.type).toBe("svg");
    expect(feedback?.svg).toContain("C");
    expect(feedback?.svg).not.toContain("<line");
    const causalRail = elements.find((element) => element.name.startsWith("Carril causal"));
    expect(causalRail?.type).toBe("svg");
    expect(causalRail?.height).toBeGreaterThan(80);
  });

  it("infiere relaciones causales cuando system llega sin edges", () => {
    const diagram = normalizeEditorialDiagram({
      kind: "system",
      title: "Control de ejecución",
      nodes: [
        { id: "context", label: "Contexto", detail: "Aporta memoria", group: "left" },
        { id: "agent", label: "Agente", detail: "Decide", group: "center" },
        { id: "tool", label: "Herramienta", detail: "Ejecuta", group: "right" },
        { id: "result", label: "Resultado", detail: "Entrega evidencia", group: "right" },
      ],
      edges: [],
    });

    expect(diagram?.edges).toEqual([
      { from: "context", to: "agent" },
      { from: "agent", to: "tool" },
      { from: "tool", to: "result" },
    ]);
  });

  it("dibuja únicamente las relaciones declaradas por el brief", () => {
    const brief = profile("flow");
    brief.edges = [{ from: "user", to: "tool", label: "delega" }];
    const elements = createEditorialDiagramElements(brief, palette, { width: 1080, height: 1350 });
    const connectorNames = elements.filter((element) => element.visualRole === "connector").map((element) => element.name);

    expect(connectorNames.some((name) => name.includes("user → tool"))).toBe(true);
    expect(connectorNames.some((name) => name.includes("user → agent"))).toBe(false);
    expect(connectorNames.some((name) => name.includes("agent → tool"))).toBe(false);
  });
});
