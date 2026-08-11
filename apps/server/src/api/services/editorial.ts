import { deepSeekJson, isDeepSeekConfigured } from "@/api/services/deepseek";

// ---------------------------------------------------------------------------
// Tipos del EditorialPlan (espejo de apps/web/.../content.models.ts)
// ---------------------------------------------------------------------------

export const CONTENT_TYPES = ["tutorial", "list", "comparison", "opinion", "repo", "case-study", "release", "resource"] as const;
export const SLIDE_ROLES = ["cover", "intro", "step", "comparison", "summary", "cta"] as const;
export const RECIPES = [
  "cover", "typographic-poster", "photo", "card", "split",
  "quote", "number", "cta", "body",
  "editorial-hero", "editorial-step", "editorial-quote", "editorial-list",
  "bold-headline", "bold-stat", "bold-contrast",
  "demo-frame", "code-block", "minimal-text", "checklist", "micro-diagram",
] as const;
const ANGLES = ["resultado", "contraste", "curiosidad"] as const;
const DIAGRAM_KINDS = ["flow", "timeline", "comparison", "layers", "cycle", "system"] as const;
const NARRATIVE_ARCS = ["how-to", "listicle", "case-study", "myth-bust", "comparison", "release-log"] as const;
type NarrativeArc = typeof NARRATIVE_ARCS[number];

const ARC_BY_CONTENT_TYPE: Record<string, NarrativeArc> = {
  tutorial: "how-to",
  list: "listicle",
  resource: "listicle",
  "case-study": "case-study",
  opinion: "myth-bust",
  comparison: "comparison",
  release: "release-log",
  repo: "release-log",
};

const VISUAL_BG_BY_CONTENT_TYPE: Record<string, "light" | "dark" | "paper"> = {
  tutorial: "light", list: "light", resource: "light", "case-study": "light",
  opinion: "paper", comparison: "light", release: "dark", repo: "light",
};
const VISUAL_TYPE_BY_CONTENT_TYPE: Record<string, "bold" | "serif" | "mono"> = {
  tutorial: "bold", list: "bold", resource: "bold", "case-study": "mono",
  opinion: "serif", comparison: "bold", release: "bold", repo: "mono",
};
const VISUAL_ORN_BY_CONTENT_TYPE: Record<string, "minimal" | "playful" | "technical"> = {
  tutorial: "playful", list: "playful", resource: "playful", "case-study": "technical",
  opinion: "minimal", comparison: "technical", release: "playful", repo: "technical",
};

export type EditorialSlidePlan = {
  id: string;
  role: (typeof SLIDE_ROLES)[number];
  headline: string;
  body: string;
  keyPoint: string;
  proof?: string;
  transitionCue?: string;
  recipeId: string;
  assetQueries: string[];
  iconConcept: string;
  diagram?: {
    kind: (typeof DIAGRAM_KINDS)[number];
    title: string;
    caption: string;
    nodes: Array<{ id: string; label: string; detail: string; icon: string; group?: "left" | "right" | "center" }>;
    edges: Array<{ from: string; to: string; label?: string }>;
    compareLabels?: [string, string];
  };
};

export type EditorialPlan = {
  topic: string;
  contentType: (typeof CONTENT_TYPES)[number];
  narrativeArc: NarrativeArc;
  visualStyle: { background: "light" | "dark" | "paper"; typeMood: "bold" | "serif" | "mono"; ornamentation: "minimal" | "playful" | "technical" };
  recommendedFormat: "single" | "carousel";
  recommendedSlideCount: number;
  hookCandidates: Array<{ id: string; text: string; angle: (typeof ANGLES)[number] }>;
  selectedHookId: string;
  caption: string;
  cta: string;
  entities: string[];
  concepts: string[];
  visualMotifs: string[];
  slides: EditorialSlidePlan[];
  provider: "deepseek" | "local";
  model?: string;
};

export type EditorialPreferences = {
  channel?: string;
  format?: "auto" | "single" | "carousel";
  slideCount?: "auto" | number;
  visualDirection?: string;
  goal?: "teach" | "save" | "discuss" | "act";
  audience?: string;
};

export type EditorialBrandInput = {
  name: string;
  description?: string;
  voice?: {
    tone: string;
    register: "formal" | "casual" | "mixto";
    humorStyle: string;
    bilingualNote?: string;
  };
  pillars?: Array<"news" | "problem-solved" | "ranking" | "field-notes">;
  antiPatterns?: string[];
  references?: string[];
};

export type AvailableTemplate = {
  id: string;
  name: string;
  role: (typeof SLIDE_ROLES)[number];
  style: string;
  density: string;
  contentTypes: string[];
  intent?: string;
  keywords?: string[];
  avoidWhen?: string[];
  assetRequirement?: string;
};

// ---------------------------------------------------------------------------
// Prompt del sistema — COPY PARA CARRUSEL (Smart Brevity)
// ---------------------------------------------------------------------------

const example = {
  topic: "Tema específico",
  contentType: "tutorial",
  narrativeArc: "how-to",
  visualStyle: { background: "light", typeMood: "bold", ornamentation: "playful" },
  recommendedFormat: "carousel",
  recommendedSlideCount: 5,
  hookCandidates: [
    { id: "hook-1", text: "Resultado concreto y verificable", angle: "resultado" },
    { id: "hook-2", text: "Contraste relevante", angle: "contraste" },
    { id: "hook-3", text: "Curiosidad útil", angle: "curiosidad" },
  ],
  selectedHookId: "hook-2",
  caption: "Caption fundamentado en la fuente",
  cta: "Guárdalo para consultarlo después.",
  entities: ["REST", "GraphQL"],
  concepts: ["arquitectura de APIs"],
  visualMotifs: ["diagrama de flujo", "icono de servidor"],
  slides: [
    {
      id: "slide-1",
      role: "cover",
      headline: "Toda app moderna habla con otras. La API es ese idioma.",
      body: "No la ves, pero está en cada login, cada pago, cada \"ver clima\".",
      keyPoint: "Las APIs son el intermediario invisible del software.",
      proof: "Cada login y cada pago envían una petición a otro servicio.",
      transitionCue: "Ahora sigue la ruta de esa petición.",
      recipeId: "cover",
      assetQueries: ["icono API", "conexión"],
      iconConcept: "server api endpoint",
    },
    {
      id: "slide-2",
      role: "step",
      headline: "La petición cruza tres responsabilidades",
      body: "Cada nodo explica una función; las flechas solo muestran dependencias comprobables.",
      keyPoint: "Una API coordina cliente, servidor y datos.",
      recipeId: "micro-diagram",
      assetQueries: [],
      iconConcept: "workflow",
      diagram: {
        kind: "flow",
        title: "Del cliente al dato",
        caption: "Una lectura de izquierda a derecha.",
        nodes: [
          { id: "client", label: "Cliente", detail: "Formula la petición", icon: "devices" },
          { id: "api", label: "API", detail: "Valida y coordina", icon: "api" },
          { id: "data", label: "Datos", detail: "Responde la consulta", icon: "database" },
        ],
        edges: [{ from: "client", to: "api" }, { from: "api", to: "data" }],
      },
    },
  ],
};

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, fallback = "") => typeof value === "string" && value.trim() ? value.trim() : fallback;
const strings = (value: unknown) => Array.isArray(value) ? [...new Set(value.map((item) => text(item)).filter(Boolean))].slice(0, 16) : [];
const oneOf = <T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]): T[number] => allowed.includes(value as T[number]) ? value as T[number] : fallback;

function normalizeDiagram(value: unknown, fallbackTitle: string): EditorialSlidePlan["diagram"] | undefined {
  if (!isObject(value)) return undefined;
  const rawNodes = Array.isArray(value.nodes) ? value.nodes : [];
  const nodes = rawNodes
    .filter(isObject)
    .slice(0, 6)
    .map((node, index) => {
      const group = ["left", "right", "center"].includes(String(node.group)) ? node.group as "left" | "right" | "center" : undefined;
      return {
        id: text(node.id, `node-${index + 1}`).slice(0, 32),
        label: text(node.label, `Nodo ${index + 1}`).slice(0, 32),
        detail: text(node.detail).slice(0, 90),
        icon: text(node.icon, "circle").slice(0, 40),
        ...(group ? { group } : {}),
      };
    });
  if (nodes.length < 2) return undefined;
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = (Array.isArray(value.edges) ? value.edges : [])
    .filter(isObject)
    .map((edge) => ({ from: text(edge.from), to: text(edge.to), label: text(edge.label).slice(0, 40) || undefined }))
    .filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to) && edge.from !== edge.to)
    .slice(0, 10);
  const rawCompareLabels = Array.isArray(value.compareLabels) ? value.compareLabels : [];
  const compareLabels = rawCompareLabels.length >= 2
    ? [text(rawCompareLabels[0], "A").slice(0, 24), text(rawCompareLabels[1], "B").slice(0, 24)] as [string, string]
    : undefined;
  return {
    kind: oneOf(value.kind, DIAGRAM_KINDS, "flow"),
    title: text(value.title, fallbackTitle).slice(0, 84),
    caption: text(value.caption).slice(0, 160),
    nodes,
    edges,
    ...(compareLabels ? { compareLabels } : {}),
  };
}

function normalizePlan(value: unknown, availableTemplates: AvailableTemplate[] = []): EditorialPlan {
  if (!isObject(value)) throw new Error("INVALID_EDITORIAL_PLAN");
  const rawHooks = Array.isArray(value.hookCandidates) ? value.hookCandidates : [];
  const hooks = ANGLES.map((angle, index) => {
    const candidate = isObject(rawHooks[index]) ? rawHooks[index] : {};
    return { id: text(candidate.id, `hook-${index + 1}`), text: text(candidate.text, `Hook ${index + 1}`), angle };
  });
  const rawSlides = Array.isArray(value.slides) ? value.slides.slice(0, 10) : [];
  if (!rawSlides.length) throw new Error("EDITORIAL_PLAN_WITHOUT_SLIDES");
  const customRecipeIds = new Set(availableTemplates.map((template) => template.id));
  let previousRecipe = "";
  const slides = rawSlides.map((item, index) => {
    const slide = isObject(item) ? item : {};
    const headline = text(slide.headline, index === 0 ? hooks[0]!.text : `Punto ${index + 1}`);
    const diagram = normalizeDiagram(slide.diagram, headline);
    const requestedRecipe = text(slide.recipeId);
    let recipeId = diagram ? "micro-diagram" : customRecipeIds.has(requestedRecipe) || (RECIPES as readonly string[]).includes(requestedRecipe)
      ? requestedRecipe
      : RECIPES[index % RECIPES.length]!;
    if (!diagram && recipeId === previousRecipe) recipeId = RECIPES[((RECIPES as readonly string[]).indexOf(recipeId) + 1) % RECIPES.length]!;
    previousRecipe = recipeId;
    return {
      id: text(slide.id, crypto.randomUUID()),
      role: oneOf(slide.role, SLIDE_ROLES, index === 0 ? "cover" : index === rawSlides.length - 1 ? "cta" : "step"),
      headline,
      body: text(slide.body),
      keyPoint: text(slide.keyPoint, text(slide.headline, `Punto ${index + 1}`)),
      proof: text(slide.proof).slice(0, 220) || undefined,
      transitionCue: text(slide.transitionCue).slice(0, 120) || undefined,
      recipeId,
      assetQueries: strings(slide.assetQueries).slice(0, 6),
      iconConcept: text(slide.iconConcept, ""),
      ...(diagram ? { diagram } : {}),
    };
  });
  const selectedHookId = hooks.some((hook) => hook.id === value.selectedHookId) ? String(value.selectedHookId) : hooks[0]!.id;
  const contentType = oneOf(value.contentType, CONTENT_TYPES, "tutorial");
  const remoteArc = typeof value.narrativeArc === "string" && (NARRATIVE_ARCS as readonly string[]).includes(value.narrativeArc) ? value.narrativeArc as NarrativeArc : ARC_BY_CONTENT_TYPE[contentType] ?? "how-to";
  const rawStyle = isObject(value.visualStyle) ? value.visualStyle : {};
  const visualStyle = {
    background: oneOf(rawStyle.background, ["light", "dark", "paper"] as const, VISUAL_BG_BY_CONTENT_TYPE[contentType] ?? "light"),
    typeMood: oneOf(rawStyle.typeMood, ["bold", "serif", "mono"] as const, VISUAL_TYPE_BY_CONTENT_TYPE[contentType] ?? "bold"),
    ornamentation: oneOf(rawStyle.ornamentation, ["minimal", "playful", "technical"] as const, VISUAL_ORN_BY_CONTENT_TYPE[contentType] ?? "playful"),
  };
  return {
    topic: text(value.topic, slides[0]!.headline),
    contentType,
    narrativeArc: remoteArc,
    visualStyle,
    recommendedFormat: slides.length === 1 ? "single" as const : "carousel" as const,
    recommendedSlideCount: slides.length,
    hookCandidates: hooks,
    selectedHookId,
    caption: text(value.caption, slides.map((slide) => slide.keyPoint).join("\n\n")),
    cta: text(value.cta, "Guárdalo para consultarlo después."),
    entities: strings(value.entities),
    concepts: strings(value.concepts),
    visualMotifs: strings(value.visualMotifs),
    slides,
    provider: "deepseek",
  };
}

/** Construye el prompt de sistema con el framework Smart Brevity para que cada
 *  headline sea copy ORIGINAL (no un extracto del source text) y el body
 *  complemente con evidencia concreta. */
function buildSystemPrompt(brand: EditorialBrandInput, availableTemplates: AvailableTemplate[] = []): string {
  const voiceLines: string[] = [];
  if (brand.description) voiceLines.push(`Descripción: "${brand.description}"`);
  if (brand.voice) {
    voiceLines.push(`Tono: ${brand.voice.tone}`);
    voiceLines.push(`Registro: ${brand.voice.register}`);
    voiceLines.push(`Humor: ${brand.voice.humorStyle}`);
    if (brand.voice.bilingualNote) voiceLines.push(`Idioma: ${brand.voice.bilingualNote}`);
  }
  if (brand.pillars?.length) {
    voiceLines.push(`Pilares editoriales (elige uno como ángulo de la pieza): ${brand.pillars.join(" · ")}`);
  }
  if (brand.references?.length) {
    voiceLines.push(`Referencias de estilo que inspiran la dirección: ${brand.references.join(", ")}`);
  }
  const brandVoice = voiceLines.length
    ? `Marca: "${brand.name}". ${voiceLines.join(" ")}`
    : `Marca: "${brand.name}". Sin descripción, escribe con voz técnica, honesta y con trazo de cuaderno.`;

  const antiPatterns = brand.antiPatterns?.length
    ? `\n\nPROHIBIDO EN LA VOZ\nNunca uses ni te aproximes a: ${brand.antiPatterns.map((item) => `"${item}"`).join(", ")}. Si una frase suena a landing page de SaaS, borrala y reescribila.`
    : "";
  const savedTemplateGuide = availableTemplates.length
    ? `\n\nSISTEMAS VISUALES GUARDADOS POR EL USUARIO\nTambién puedes emitir exactamente el id de uno de estos sistemas como recipeId. Úsalo solo cuando role, contentTypes, intent y keywords coincidan con la idea del slide; respeta avoidWhen. No lo elijas solo por ser personalizado.\n${JSON.stringify(availableTemplates.slice(0, 40))}`
    : "";

  return `Eres el director editorial de Polyedro. Conviertes un tema o una fuente en contenido que una persona quiera leer, guardar y usar. Devuelves solamente json válido; no devuelvas coordenadas ni imágenes.

VOZ DE MARCA
${brandVoice}${antiPatterns}

REGLAS EDITORIALES DE MARCA
1. Valor primero, chiste después. Si la pieza no entrega técnica útil, el humor no la salva.
2. Evidencia > opinión. Si vas a decir "es mejor", mostrá el número o el caso concreto.
3. Postura sí, imparcialidad falsa no. Decí qué elegirías vos y por qué.
4. Cero hype words. Si suena a landing page de SaaS, borrá y reescribí.
5. El humor es condimento, no plato. Una ironía al cerrar. No más.

CUANDO EL SOURCE ES UN POST LARGO APROBADO (FASE 2)
El sourceText puede ser un post largo de blog (500-900 palabras) en markdown con headers (##, ###) y bullets. Tu trabajo es DESTILAR ese post en una publicación, no resumirlo:
- NUNCA uses un header de markdown ("## Lo que encontré", "## Contexto", "### Errores comunes") como headline. Los headers son de navegación del post, no ideas.
- LEE el contenido bajo cada header, EXTRAE la idea específica, el dato concreto, la decisión o el ejemplo, y ESCRIBE copy nuevo (Smart Brevity) para esa idea.
- Cada slide debe anclarse a una idea ÚNICA del post con un detalle concreto (número, caso, tradeoff, ejemplo). Si el slide funciona con cualquier tema, es genérico: reescríbelo.
- Prioriza los datos, cifras, comparaciones y conclusiones específicas del post sobre generalidades.
- El tema del plan (topic) debe ser el TÍTULO del post o una promesa específica, nunca "Contexto 2026" ni "Lo que encontré".
- Prohibido empezar slides con "El 2026 trae una ola…", "Hoy en día…", "En el mundo de…", "Es importante…", "Cabe destacar…". Empezá con el verbo y el hecho.
- Si el draft incluye keyTakeaways, úsalos como anclas: cada takeaway puede convertirse en un slide, siempre reescrito con evidencia del post.

ARCOS NARRATIVOS
Elige uno de estos seis arcos y rellénalo con la secuencia indicada. El arco estructura el orden de las láminas —no es decorativo. Si el formato es individual (1 lámina), colapsa todo en role "summary".
- how-to (tutoriales): cover → intro → step × N → summary → cta. Promesa, contexto, pasos numerados, trampa común, aplicación.
- listicle (listas/recursos): cover → step × N → summary → cta. Cada step es un item discreto accionable.
- case-study (casos): cover → intro → step → comparison → step → summary → cta. Contexto, problema, decisión, acción, resultado medible, lección.
- myth-bust (opinión): cover → comparison → step → step → summary → cta. Hook polémico, el mito, la evidencia, el matiz, postura honesta.
- comparison (comparativas): cover → intro → comparison × N → summary → cta. Contexto, criterios, versus por criterio, veredicto matizado.
- release-log (releases/repos): cover → intro → step × N → summary → cta. Qué es, qué cambia, highlights, cómo migrar, disponibilidad.

COPY PARA CARRUSEL — FRAMEWORK SMART BREVITY
Un carrusel no es un artículo partido en trozos. Cada lámina es una unidad independiente que debe entenderse sola y hacer querer swipar a la siguiente. Escribe copy NUEVO, no extractos del texto fuente.

Estructura de cada slide:
- headline: LA idea en negrita. Máximo 12 palabras (84 caracteres). Debe poder leerse solo y tener sentido completo. Copia original: reformula, comprime y crea tensión. NUNCA copies una oración del texto fuente como headline.
- body: "¿Por qué importa?" + detalle concreto. Máximo 2 oraciones (260 caracteres). Da evidencia, ejemplo, matiz o dato del texto fuente. NUNCA vacío, NUNCA repitas el headline con otras palabras.
- keyPoint: la idea en una frase (máximo 15 palabras).
- proof: el dato, caso, ejemplo o mecanismo concreto que sostiene la idea. Si la fuente no lo aporta, déjalo vacío; nunca inventes evidencia.
- transitionCue: una frase breve que crea continuidad con la siguiente lámina sin usar clickbait. La última puede dejarlo vacío.

COPY DE ALTO IMPACTO — REGLAS NO NEGOCIABLES
1. Cada headline debe contener UN elemento concreto del texto: un dato, un número, un caso, un tradeoff, un error o una metáfora específica. Si el headline funcionaría con cualquier tema, está mal: reescribilo.
2. Variá la estructura sintáctica entre slides. Prohibido que 3+ slides arranquen igual ("El X...", "La X...", "Por qué X..."). Mezclá: afirmación directa, pregunta, imperativo, contraste, consecuente ("Si X, entonces Y").
3. Prohibido headlines con estructura "X: Y" (dospuntos) en más de un slide. Preferí una oración completa.
4. Los bodies deben citar el dato, número o ejemplo específico del texto fuente. "Carece de manejo de errores" es vago; "un error de 200KB en memoria sin logging tarda 3 días en encontrarse" es específico.
5. El humor seco de la marca puede aparecer en un slide (no en todos): una observación irónica que refuerce la idea, nunca un chiste que distraiga.
6. La tensión es obligatoria en el cover: el swipe debe motivarse con una promesa específica o una tensión real, no con una generalidad.

REGLAS SMART BREVITY
1. Sin oraciones de más de 25 palabras. Si es más larga, párte.
2. Lead con el verbo. No "Es importante considerar..." sino "Considera esto:".
3. Cada palabra gana su lugar. Si puedes borrar una palabra y la oración sigue teniendo sentido, bórrala.
4. Cero relleno motivacional. Nada de "en este post", "todo lo que necesitas saber", "guía definitiva".
5. Progresión narrativa: cada slide aporta una idea nueva. No repitas el mismo tipo de idea en slides consecutivos. Avanza la historia.
6. El cover promete un resultado concreto y verificable. Los slides intermedios alternan entre entregar valor y crear curiosidad por el siguiente.
7. El cierre (cta) es una acción específica, no genérica. "Guarda este mapa" > "Ponlo a prueba".

EJEMPLO DE CALIDAD OBJETIVO
Para "qué es una API y cuáles son sus tipos" la secuencia correcta sería:
- cover: headline "Toda app moderna habla con otras. La API es ese idioma." body "No la ves, pero está en cada login, cada pago."
- step: headline "REST: el estándar de la calle." body "GET para leer, POST para crear. Simple, predecible, el más usado en la web."
- step: headline "GraphQL: solo lo que necesitas." body "Un solo endpoint. Traes exactamente los campos que pides. Ni uno más."
- cta: headline "Elige según tu problema, no la moda." body "¿Simplicidad? REST. ¿Flexibilidad? GraphQL." cta "Guarda este mapa."
Nota: cada headline es original y distinto de los demás; cada body complementa con un dato concreto.

PRIORIDAD EDITORIAL
1. Identifica para quién es, qué problema resuelve y qué cambio concreto promete. Si preferences.audience está vacío, infiere una audiencia estrecha y plausible a partir del tema.
2. Extrae primero la información de mayor utilidad: mecanismo, decisión, ejemplo, error, comparación o pasos. Elimina introducciones obvias, definiciones de diccionario, repetición y relleno motivacional.
3. Cada slide debe poder entenderse sin leer un párrafo largo.

HOOKS
Genera exactamente tres hooks, en este orden: resultado concreto, tensión/contraste y curiosidad útil. Un buen hook combina especificidad, relevancia para la audiencia, una tensión real y una vista previa honesta del valor. Selecciona el más fuerte, no el primero por defecto. Evita clickbait y fórmulas gastadas como "nadie te cuenta", "todo lo que necesitas saber", "guía definitiva", "esto cambiará tu vida" o "el secreto de". No empieces los tres hooks igual. No uses signos de exclamación.

RIGOR
Si sourceText es una fuente extensa, no agregues afirmaciones, cifras, citas o resultados que no estén en ella. Si sourceText es solo un tema breve, puedes usar conocimiento general estable para construir una explicación práctica, pero nunca inventes estadísticas, fechas, benchmarks, citas, noticias ni resultados precisos. Si falta evidencia, formula la idea como principio o recomendación, no como hecho medido.

INTENCIÓN
preferences.goal controla el cierre: teach = comprensión aplicable; save = referencia/checklist; discuss = contraste con pregunta específica; act = siguiente paso concreto. El CTA y la caption deben modularse por goal y por arco (p.ej. release-log + act → "actualiza y prueba en staging"; case-study + discuss → "¿habrías decidido igual?"). Respeta exactamente preferences.slideCount cuando sea un número y usa entre 1 y 10 láminas cuando sea auto.

DISEÑO
Solo puedes emitir recipeId de esta lista de recetas. Elige por intención del slide, nunca repitas la misma receta consecutiva:
- cover: solo título grande en fondo de color. Nada más. Para portadas.
- typographic-poster: póster editorial con jerarquía multinivel, palabra de acento, subtítulo y micro-motivos. Para hooks donde la tipografía es la protagonista.
- photo: área de foto con borde + título debajo. Para slides que van a llevar imagen.
- card: una sola tarjeta con borde redondeado: título + texto. Para pasos individuales.
- split: dos columnas: número de acento a la izquierda, título y texto a la derecha. Para comparativas.
- quote: frase grande centrada con línea de atribución. Para takeaways y citas.
- number: número gigante + título corto. Para posts numerados y listicles.
- cta: tarjeta de cierre con pill de acción. Para el último slide.
- body: solo texto con márgenes amplios. Sin título. Para desarrollo extenso.
- editorial-hero: número gigante + subtítulo + zona de imagen. Para portadas de listas y rankings.
- editorial-step: título + cuerpo + zona de demo abajo. Para pasos de tutorial con imagen.
- editorial-quote: cita grande en serif con atribución. Para posturas y takeaways.
- editorial-list: lista numerada con bullets. Para rankings y colecciones.
- bold-headline: headline masivo en fondo sólido. Para hooks y statements.
- bold-stat: número/dato gigante + contexto. Para métricas impactantes.
- bold-contrast: SÍ vs NO, antes vs después. Para comparaciones directas.
- demo-frame: marco de screenshot/demo con dots. Para repos y features.
- code-block: bloque de código mono. Para snippets y comandos.
- minimal-text: texto minimal sobre fondo sólido. Para CTAs limpios.
- checklist: items con checks. Para cierres tipo "guarda esto".
- micro-diagram: diagrama editorial nativo con nodos, conectores e iconos. Para explicar relaciones, no para decorar.
${savedTemplateGuide}

MICRODIAGRAMAS EDITORIALES
Usa entre 1 y 3 microdiagramas por carrusel, nunca en cover ni CTA. Emite diagram solo cuando la relación espacial explica mejor la idea que una lista:
- flow: secuencia lineal o pipeline.
- timeline: evolución temporal, fases o madurez.
- comparison: dos sistemas, estados o alternativas; incluye compareLabels y asigna group left/right.
- layers: arquitectura por capas, jerarquía o stack.
- cycle: bucle con retroalimentación real.
- system: relación causal entre condiciones, decisión y ejecución. Usa exactamente un node group center para quien decide; group left para contexto, entradas o restricciones; group right para herramientas, acciones y resultados. Traza edges de izquierda a centro y de centro a derecha. Agrega un retorno hacia center solo si la fuente menciona evaluación o feedback. Evita órbitas de satélites equivalentes.
Cada diagram debe tener entre 2 y 6 nodes. label debe tener 1–3 palabras; detail, máximo 10 palabras; icon, un concepto semántico compatible con Google Material Symbols. Agrega edges solo cuando la fuente pruebe esa relación. No inventes pasos para llenar el layout. Si emites diagram, recipeId debe ser "micro-diagram". Alterna los microdiagramas con slides tipográficos, evidencia o ejemplos para mantener ritmo editorial.

ICONOS KIMOYO
Cada slide debe incluir un iconConcept: un concepto corto en inglés (1-3 palabras) que describa qué icono hand-drawn de Kimoyo acompañaría el slide. Ejemplos: "server", "database", "arrow", "code", "lightbulb", "rocket", "bookmark", "gear", "pencil", "cloud". Usa conceptos que refuercen visualmente la idea del slide. El cover y el CTA siempre deben tener iconConcept. Los steps intermedios también. Nunca dejes iconConcept vacío.

DIRECCIÓN VISUAL
Emite visualStyle con tres campos para darle a la pieza un look coherente (no genérico):
- background: "light" | "dark" | "paper". Claro editorial para guías/listas/casos; oscuro para releases y tech; papel cálido para opinión y reflexiones.
- typeMood: "bold" | "serif" | "mono". Bold para contenido accionable y tutoriales; serif para opinión y narrativa; mono para código/repos.
- ornamentation: "minimal" | "playful" | "technical". Playful cuando hay stickers/tips que destacar; technical para diagramas y arquitectura; minimal para piezas sobrias.
Elige según el contenido real, no por defecto. La dirección visual debe reforzar el arco narrativo y el goal.

El json debe seguir exactamente esta forma: ${JSON.stringify(example)}`;
}

// ---------------------------------------------------------------------------
// Generación del plan
// ---------------------------------------------------------------------------

export const generateEditorialPlan = async (input: {
  brand: EditorialBrandInput;
  sourceText: string;
  preferences?: EditorialPreferences;
  availableAssets?: Array<{ id: string; name: string; tags?: string[] }>;
  availableTemplates?: AvailableTemplate[];
  draft?: {
    title: string;
    category?: string;
    keyTakeaways?: string[];
    sources?: string[];
  };
}): Promise<EditorialPlan> => {
  if (!isDeepSeekConfigured()) {
    return {
      topic: input.sourceText.slice(0, 68),
      contentType: "tutorial",
      narrativeArc: "how-to",
      visualStyle: { background: "light", typeMood: "bold", ornamentation: "playful" },
      recommendedFormat: "carousel",
      recommendedSlideCount: 5,
      hookCandidates: [
        { id: "hook-1", text: "Resultado concreto", angle: "resultado" },
        { id: "hook-2", text: "Contraste relevante", angle: "contraste" },
        { id: "hook-3", text: "Curiosidad útil", angle: "curiosidad" },
      ],
      selectedHookId: "hook-1",
      caption: "",
      cta: "Guárdalo para consultarlo después.",
      entities: [],
      concepts: [],
      visualMotifs: [],
      slides: [],
      provider: "local",
    };
  }

  const result = await deepSeekJson<unknown>(
    [
      { role: "system", content: buildSystemPrompt(input.brand, input.availableTemplates ?? []) },
      {
        role: "user",
        content: `Produce el EditorialPlan en json para esta entrada:\n${JSON.stringify({
          brand: input.brand,
          preferences: input.preferences ?? {},
          availableAssets: input.availableAssets ?? [],
          availableTemplates: input.availableTemplates ?? [],
          draft: input.draft ?? undefined,
          sourceText: String(input.sourceText).slice(0, 32_000),
        })}`,
      },
    ],
    // deepseek-chat (V3) emite el JSON directamente sin reasoning_content;
    // 16k tokens dejan margen holgado para un plan completo de hasta 10 slides.
    16_000,
  );

  const plan = normalizePlan(result.data, input.availableTemplates ?? []);
  return { ...plan, model: result.model };
};
