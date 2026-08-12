import type { VisualIntent } from "./editor.models";

/** Fixture editorial para QA visual y fallback demostrativo. No contiene
 * afirmaciones medibles: muestra la gramática de comparación sin copiar la
 * referencia ni depender del copy provisional del lienzo. */
export const EDITORIAL_COMPARISON_DEMO: VisualIntent = {
  version: 1,
  output: "diagram",
  concept: "Diseñar interfaces ya no termina en la pantalla",
  elements: ["Pantallas", "Sistemas", "Flujos", "Prototipos", "Entrega", "Iteración"],
  relations: [],
  exactLabels: [],
  composition: "editorial-comparison",
  aspectRatio: .8,
  prompt: "Editable editorial comparison with two parallel columns and semantic icons.",
  rationale: "Conserva la lógica de evolución lado a lado y la convierte en un sistema editorial reutilizable.",
  signature: "editorial-comparison:0:demo",
  editorialCopy: {
    kicker: "OFICIO / EVOLUCIÓN",
    headline: "Diseñar interfaces ya no termina en la pantalla",
    deck: "El criterio permanece; las herramientas amplían lo que puedes ejecutar.",
    closingInsight: "El oficio no cambió. Cambió la capacidad para llevarlo a producción.",
  },
  comparisonProfile: {
    leftLabel: "ANTES",
    rightLabel: "AHORA",
    leftItems: [
      { title: "Pantallas", detail: "Diseña estados aislados para entregar", icon: "desktop_windows" },
      { title: "Flujos", detail: "Documenta el recorrido para desarrollo", icon: "route" },
      { title: "Entrega", detail: "Cierra el archivo y espera implementación", icon: "send" },
    ],
    rightItems: [
      { title: "Sistemas", detail: "Diseña reglas que sostienen cada estado", icon: "account_tree" },
      { title: "Prototipos", detail: "Construye el recorrido y valida decisiones", icon: "deployed_code" },
      { title: "Iteración", detail: "Publica, observa y corrige el producto", icon: "rocket_launch" },
    ],
    footer: "El oficio permanece; cambia la capacidad de ejecución.",
  },
  referenceStyle: {
    family: "editorial-layout", layoutArchetype: "split", alignment: "left",
    focalPoint: { x: .5, y: .5, width: .86 }, headlineScale: "large",
    displayFont: "grotesk", supportingFont: "grotesk", headlineWeight: 900,
    lineHeight: .9, tracking: -24, textCase: "mixed", accentMode: "word",
    negativeSpace: "balanced", texture: "clean", motifPlacement: "edges",
    dominantMotif: { kind: "frame", value: "", treatment: "outline", x: .5, y: .55, width: .86, rotation: 0 },
    gridProfile: { columns: 2, rows: 3, numbered: false, iconStyle: "outlined", cardTreatment: "outlined", footerBand: true },
    colorRoles: { paper: "#F7F7F4", ink: "#171719", accent: "#F4511E", secondary: "#2F80ED" },
    summary: "Comparación editorial clara con dos columnas, iconos y cierre accionable.",
  },
  templateUsage: {
    intent: "Comparar una evolución profesional, técnica o de producto",
    roles: ["comparison"], contentTypes: ["comparison", "opinion"],
    keywords: ["antes y después", "evolución", "cambio"],
    avoidWhen: ["El contenido no presenta dos estados comparables"],
  },
};
