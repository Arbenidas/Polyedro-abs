import { describe, expect, it } from "vitest";
import {
  buildLocalVisualIntent, compileBlueprintSvg, createVisualBlueprint, normalizeVisualIntent, recolorVisualBlueprint,
} from "./contextual-visual-planner";

const palette = ["#B8F34A", "#2F5DE5", "#F3F7F2", "#10251E"];

describe("contextual visual planner", () => {
  it("routes Hick and Fitts to an editable exact diagram", () => {
    const source = "Ley de Hick: menos opciones = menos carga mental. Ley de Fitts: botones mínimos 48×48dp.";
    const intent = buildLocalVisualIntent({ selectedText: source, slideContext: "Diseño de interfaces", palette });
    const blueprint = createVisualBlueprint(intent, palette, source);

    expect(intent.output).toBe("diagram");
    expect(intent.composition).toBe("hick-fitts");
    expect(intent.exactLabels).toContain("48×48dp");
    expect(blueprint.elements.some((item) => item.content === "48×48dp" && item.visualRole === "measurement")).toBe(true);
    expect([...new Set(blueprint.elements.map((item) => item.type))]).toEqual(expect.arrayContaining(["text", "rect", "line", "arrow"]));
  });

  it("routes a photographic scene to GPT Image", () => {
    const intent = buildLocalVisualIntent({ selectedText: "persona programando de noche frente a su laptop", slideContext: "", palette });
    expect(intent.output).toBe("image");
    expect(intent.composition).toBe("scene");
    expect(intent.prompt).toContain("Do not draw words, letters, numbers");
  });

  it("creates a compact transparent SVG asset for a directional arrow prompt", () => {
    const source = "flecha de color apuntando a la derecha";
    const intent = buildLocalVisualIntent({ selectedText: source, slideContext: "", palette, assetOnly: true });
    const blueprint = createVisualBlueprint(intent, palette, source);
    const svg = compileBlueprintSvg(blueprint);

    expect(intent.output).toBe("diagram");
    expect(intent.composition).toBe("icon");
    expect(blueprint.width).toBe(520);
    expect(blueprint.elements.filter((item) => item.type === "arrow")).toHaveLength(2);
    expect(svg).not.toContain('<rect width="100%" height="100%"');
  });

  it("turns a GitHub merge prompt into an editable branch graph", () => {
    const source = "ramas de GitHub haciendo un merge entre 2 commits";
    const intent = buildLocalVisualIntent({ selectedText: source, slideContext: "", palette, assetOnly: true });
    const blueprint = createVisualBlueprint(intent, palette, source);

    expect(intent.output).toBe("diagram");
    expect(intent.composition).toBe("git-merge");
    expect(intent.exactLabels).toContain("2");
    expect(blueprint.elements.filter((item) => item.type === "circle").length).toBeGreaterThanOrEqual(5);
    expect(blueprint.elements.some((item) => item.name === "Retorno al merge")).toBe(true);
    expect(blueprint.elements.some((item) => item.content === "2 COMMITS")).toBe(true);
  });

  it("keeps API flows and architecture as vector layers", () => {
    expect(buildLocalVisualIntent({ selectedText: "flujo API: cliente, servicio y base de datos", slideContext: "", palette }).output).toBe("diagram");
    expect(buildLocalVisualIntent({ selectedText: "arquitectura frontend, backend y datos", slideContext: "", palette }).composition).toBe("architecture");
  });

  it("keeps bare numbers as exact editable data", () => {
    const intent = buildLocalVisualIntent({ selectedText: "30 recursos que todo desarrollador debería conocer", slideContext: "", palette });
    expect(intent.output).toBe("diagram");
    expect(intent.exactLabels).toContain("30");
  });

  it("overrides an invalid remote image choice when exact data is present", () => {
    const source = "El botón debe medir 48×48dp";
    const intent = normalizeVisualIntent({ output: "image", composition: "scene", concept: "botón" }, { selectedText: source, slideContext: "", palette, requestedMode: "auto" });
    expect(intent.output).toBe("diagram");
    expect(intent.exactLabels).toContain("48×48dp");
  });

  it("honors an explicit Image IA choice while keeping exact labels out of the bitmap prompt", () => {
    const source = "5 paquetes de Flutter que muchos desarrolladores pasan por alto";
    const local = buildLocalVisualIntent({ selectedText: source, slideContext: "", palette, requestedMode: "image" });
    const normalized = normalizeVisualIntent(
      { output: "diagram", composition: "measurement", concept: "paquetes de Flutter" },
      { selectedText: source, slideContext: "", palette, requestedMode: "image" },
    );

    expect(local.output).toBe("image");
    expect(normalized.output).toBe("image");
    expect(normalized.exactLabels).toContain("5");
    expect(local.prompt).toContain("Do not draw words, letters, numbers");
  });

  it("creates distinct signatures and compiles a clean reusable SVG", () => {
    const source = "Compara antes y después";
    const first = buildLocalVisualIntent({ selectedText: source, slideContext: "", palette, variantSeed: "one" });
    const second = buildLocalVisualIntent({ selectedText: source, slideContext: "", palette, variantSeed: "two" });
    const svg = compileBlueprintSvg(createVisualBlueprint(first, palette, source));
    expect(first.signature).not.toBe(second.signature);
    expect(svg).toContain(`data-visual-signature="${first.signature}"`);
    expect(svg).not.toContain("data-contextual-variation");
  });

  it("rotates the structure on consecutive explicit variants", () => {
    const intent = buildLocalVisualIntent({ selectedText: "objetivo mínimo 48×48dp", slideContext: "", palette });
    const first = createVisualBlueprint({ ...intent, signature: "measurement:0:first" }, palette, "objetivo mínimo 48×48dp");
    const second = createVisualBlueprint({ ...intent, signature: "measurement:1:second" }, palette, "objetivo mínimo 48×48dp");
    expect(second.elements.map((item) => item.x)).not.toEqual(first.elements.map((item) => item.x));
  });

  it("recolors every vector token without changing exact labels", () => {
    const intent = buildLocalVisualIntent({ selectedText: "objetivo mínimo 48×48dp", slideContext: "", palette });
    const blueprint = createVisualBlueprint(intent, palette, "objetivo mínimo 48×48dp");
    const next = recolorVisualBlueprint(blueprint, ["#FFD23F", "#3155E7", "#FFF8EA", "#151515"]);
    expect(next.elements.some((item) => item.fill === "#FFD23F")).toBe(true);
    expect(next.elements.some((item) => item.content === "48×48dp")).toBe(true);
  });

  it("reconstructs a portrait typographic reference with style DNA", () => {
    const source = "El sistema antes que el prompt. La plantilla conserva jerarquía y composición.";
    const intent = normalizeVisualIntent({
      output: "diagram", composition: "typographic-poster", concept: "El sistema antes que el prompt", aspectRatio: .8,
      referenceStyle: {
        family: "typographic-poster", alignment: "center", focalPoint: { x: .5, y: .5, width: .78 }, headlineScale: "massive",
        displayFont: "grotesk", supportingFont: "grotesk", headlineWeight: 900, lineHeight: .84, tracking: -28,
        textCase: "mixed", accentMode: "word", negativeSpace: "expansive", texture: "paper", motifPlacement: "corners",
      },
    }, { selectedText: source, slideContext: source, palette });
    const blueprint = createVisualBlueprint(intent, palette, source);
    const headline = blueprint.elements.filter((item) => item.name.startsWith("Titular"));

    expect(intent.composition).toBe("typographic-poster");
    expect(intent.output).toBe("diagram");
    expect(blueprint.width / blueprint.height).toBeCloseTo(.8, 1);
    expect(headline.length).toBeGreaterThanOrEqual(2);
    expect(new Set(headline.map((item) => item.fill)).size).toBeGreaterThan(1);
    expect(blueprint.elements.some((item) => item.name === "Kicker")).toBe(true);
  });

  it("turns a symbol-led editorial reference into a full expressive poster", () => {
    const headline = "El sistema antes que el prompt";
    const body = "La estructura decide qué tan lejos puede llegar la idea.";
    const intent = normalizeVisualIntent({
      output: "diagram", composition: "object", concept: headline, aspectRatio: .8,
      referenceStyle: {
        family: "editorial-layout", layoutArchetype: "symbol-led", alignment: "center",
        focalPoint: { x: .5, y: .55, width: .82 }, headlineScale: "large",
        displayFont: "grotesk", supportingFont: "grotesk", headlineWeight: 800,
        lineHeight: .92, tracking: -18, textCase: "mixed", accentMode: "none",
        negativeSpace: "expansive", texture: "paper", motifPlacement: "around-focal",
        dominantMotif: { kind: "punctuation", value: "?", treatment: "solid", x: .5, y: .62, width: .44, rotation: 0 },
      },
    }, { selectedText: headline, slideContext: `${headline}. ${body}`, palette });
    const blueprint = createVisualBlueprint({ ...intent, signature: "symbolic-poster:0:test" }, palette, `${headline}. ${body}`);
    const headlineText = blueprint.elements.filter((item) => item.name.startsWith("Titular")).map((item) => item.content).join(" ");

    expect(intent.composition).toBe("symbolic-poster");
    expect(intent.output).toBe("diagram");
    expect(headlineText).toBe(headline);
    expect(blueprint.elements.some((item) => item.name === "Motivo dominante" && item.content === "?" && item.visualRole === "illustration")).toBe(true);
    expect(blueprint.elements.find((item) => item.name === "Cuerpo")?.content).toBe(body);
    expect(blueprint.elements.some((item) => item.name === "Área medida")).toBe(false);
  });

  it("creates authored layout variations for symbolic posters", () => {
    const remote = {
      output: "diagram", composition: "symbolic-poster", concept: "Una pregunta cambia el sistema", aspectRatio: .8,
      referenceStyle: {
        family: "editorial-layout", layoutArchetype: "symbol-led",
        dominantMotif: { kind: "punctuation", value: "?", treatment: "repeated", x: .5, y: .62, width: .48, rotation: -4 },
      },
    };
    const intent = normalizeVisualIntent(remote, { selectedText: remote.concept, slideContext: remote.concept, palette });
    const centered = createVisualBlueprint({ ...intent, signature: "symbolic-poster:0:first" }, palette, remote.concept);
    const offset = createVisualBlueprint({ ...intent, signature: "symbolic-poster:1:second" }, palette, remote.concept);
    const centerMark = centered.elements.find((item) => item.name === "Motivo dominante");
    const offsetMark = offset.elements.find((item) => item.name === "Motivo dominante");

    expect(centerMark?.x).not.toBe(offsetMark?.x);
    expect(centered.elements.filter((item) => item.name.startsWith("Eco del motivo"))).toHaveLength(2);
  });

  it("reconstructs an editorial 3x2 grid with embedded Google Material icons", () => {
    const headline = "Cómo estructurar un caso de producto";
    const body = "Seis decisiones para convertir el proceso en una historia clara.";
    const closingInsight = "La estructura demuestra tu criterio antes de que el reclutador revise cada pantalla.";
    const elements = [
      "Contexto | Define el escenario, la audiencia y el objetivo.",
      "Problema | Formula la tensión que debía resolverse.",
      "Proceso | Ordena investigación, hipótesis y pruebas.",
      "Solución | Explica la decisión final de diseño.",
      "Contribución | Aclara tu criterio y responsabilidad.",
      "Resultado | Muestra impacto, métricas y aprendizajes.",
    ];
    const intent = normalizeVisualIntent({
      output: "diagram", composition: "object", concept: "Estructura editorial del caso", elements, aspectRatio: .8,
      editorialCopy: { kicker: "PLAYBOOK / 06", headline, deck: body, closingInsight },
      referenceStyle: {
        family: "editorial-layout", layoutArchetype: "grid", alignment: "center",
        gridProfile: { columns: 3, rows: 2, numbered: true, iconStyle: "outlined", cardTreatment: "outlined", footerBand: true },
      },
    }, { selectedText: headline, slideContext: `${headline}. ${body}`, palette });
    const blueprint = createVisualBlueprint({ ...intent, signature: "editorial-grid:0:test" }, palette, `${headline}. ${body}`);
    const svg = compileBlueprintSvg(blueprint);

    expect(intent.composition).toBe("editorial-grid");
    expect(intent.concept).toBe(headline);
    expect(intent.editorialCopy).toEqual({ kicker: "PLAYBOOK / 06", headline, deck: body, closingInsight });
    expect(blueprint.elements.find((item) => item.name === "Firma editorial")?.content).toBe("PLAYBOOK / 06");
    expect(blueprint.elements.find((item) => item.name === "Cuerpo")?.content).toBe(body);
    expect(blueprint.elements.find((item) => item.name === "Conclusión")?.content?.replace(/\n/g, " ")).toBe(closingInsight);
    expect(blueprint.elements.filter((item) => item.type === "svg")).toHaveLength(6);
    expect(blueprint.elements.some((item) => item.name === "Google Material · search")).toBe(true);
    expect(blueprint.elements.some((item) => item.name === "Google Material · trending_up")).toBe(true);
    expect(svg).toContain('viewBox="0 0 24 24"');
    expect(svg).toContain("M15.5 14h-.79");

    const recolored = recolorVisualBlueprint(blueprint, ["#FFD23F", "#3155E7", "#FFF8EA", "#151515"]);
    expect(recolored.elements.find((item) => item.name === "Google Material · search")?.svg).toContain("#3155E7");
  });

  it("turns a remote editorial diagram brief into a compact editable system map", () => {
    const source = "Usuario, agente y herramienta forman un sistema de ejecución.";
    const intent = normalizeVisualIntent({
      output: "diagram",
      composition: "editorial-diagram",
      concept: "El sistema de ejecución",
      editorialCopy: { kicker: "SISTEMA / 03", headline: "Del objetivo a la acción", deck: "Tres responsabilidades conectadas." },
      diagramProfile: {
        kind: "system",
        title: "El sistema de ejecución",
        caption: "El agente ocupa el centro.",
        nodes: [
          { id: "agent", label: "Agente", detail: "Decide la acción", icon: "smart_toy" },
          { id: "user", label: "Usuario", detail: "Define el objetivo", icon: "person" },
          { id: "tool", label: "Herramienta", detail: "Ejecuta la tarea", icon: "build" },
        ],
        edges: [{ from: "agent", to: "tool" }, { from: "user", to: "agent" }],
      },
    }, { selectedText: source, slideContext: source, palette });
    const blueprint = createVisualBlueprint(intent, palette, source);

    expect(intent.composition).toBe("editorial-diagram");
    expect(intent.diagramProfile?.kind).toBe("system");
    expect(blueprint.width).toBe(720);
    expect(blueprint.height).toBe(560);
    expect(blueprint.elements.filter((element) => element.name.startsWith("Google Material ·"))).toHaveLength(2);
    expect(blueprint.elements.some((element) => element.name.includes("decisión"))).toBe(true);
    expect(blueprint.elements.some((element) => element.name === "Campo de ejecución")).toBe(true);
  });
});
