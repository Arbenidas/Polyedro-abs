import { describe, expect, it } from "vitest";
import type { EditorialDiagramProfile } from "./editor.models";
import { deriveEditorialDiagramGrammar } from "./editorial-diagram-grammar";

const system: EditorialDiagramProfile = {
  kind: "system",
  title: "El harness gobierna la ejecución",
  caption: "Contexto y guardrails condicionan al agente.",
  nodes: [
    { id: "context", label: "Contexto", detail: "Conserva memoria", icon: "memory", group: "left" },
    { id: "agent", label: "Agente", detail: "Decide la acción", icon: "smart_toy", group: "center" },
    { id: "tool", label: "Herramienta", detail: "Ejecuta", icon: "build", group: "right" },
    { id: "result", label: "Resultado", detail: "Entrega evidencia", icon: "task_alt", group: "right" },
    { id: "feedback", label: "Feedback", detail: "Evalúa y corrige", icon: "sync", group: "right" },
  ],
  edges: [],
};

describe("editorial diagram grammar", () => {
  it("traduce un sistema a roles editoriales, no a satélites equivalentes", () => {
    const grammar = deriveEditorialDiagramGrammar(system);

    expect(grammar.topology).toBe("causal-system");
    expect(grammar.focalNodeId).toBe("agent");
    expect(grammar.roles).toMatchObject({
      context: "condition",
      agent: "decision",
      tool: "execution",
      result: "evidence",
      feedback: "feedback",
    });
    expect(grammar.lanes).toEqual(["CONDICIONES", "DECISIÓN", "EJECUCIÓN"]);
  });

  it("elige un trazo dibujado para arquitecturas técnicas densas", () => {
    const technical: EditorialDiagramProfile = {
      ...structuredClone(system),
      title: "API de archivos",
      nodes: [
        { id: "client", label: "Cliente", detail: "Envía archivo", icon: "person", group: "left" },
        { id: "api", label: "API Gateway", detail: "Valida", icon: "api", group: "center" },
        { id: "lambda", label: "Lambda", detail: "Procesa", icon: "bolt", group: "right" },
        { id: "storage", label: "Storage", detail: "Guarda", icon: "database", group: "right" },
      ],
    };

    expect(deriveEditorialDiagramGrammar(technical).connector.character).toBe("sketch");
  });

  it("mantiene una secuencia común en lectura izquierda a derecha", () => {
    const grammar = deriveEditorialDiagramGrammar({ ...structuredClone(system), kind: "flow" });

    expect(grammar.topology).toBe("sequence");
    expect(grammar.readingDirection).toBe("left-to-right");
    expect(Object.values(grammar.roles).every((role) => role === "stage")).toBe(true);
  });
});
