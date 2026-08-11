import type { ContextAnalysis, LibraryAsset } from "./editor.models";

export type EnrichmentProfile = "learning-curve" | "git-flow" | "technology" | "editorial-emphasis";

export function isReusableAsset(asset: LibraryAsset) {
  return asset.scope !== "render" && asset.style !== "safe-polish" && !asset.tags.includes("polished-render");
}

const ENTITY_MAP: Record<string, { label: string; motifs: string[] }> = {
  angular: { label: "Angular", motifs: ["component tree", "browser window", "dependency injection"] },
  flutter: { label: "Flutter", motifs: ["widget tree", "mobile device", "cross-platform layers"] },
  java: { label: "Java", motifs: ["code window", "JVM layers", "coffee motif"] },
  quarkus: { label: "Quarkus", motifs: ["cloud native service", "fast startup", "container"] },
  spring: { label: "Spring", motifs: ["service graph", "API layers", "application context"] },
  google: { label: "Google", motifs: ["search field", "browser card", "cloud nodes"] },
  https: { label: "HTTPS", motifs: ["browser lock", "certificate chain", "request flow"] },
  github: { label: "GitHub", motifs: ["repository window", "branch graph", "commit timeline"] },
  git: { label: "Git", motifs: ["branch graph", "commit nodes", "terminal command"] },
  docker: { label: "Docker", motifs: ["container stack", "image layers", "deployment flow"] },
  typescript: { label: "TypeScript", motifs: ["typed code", "interface card", "compiler flow"] },
};

const CONCEPTS = ["arquitectura", "seguridad", "frontend", "backend", "rendimiento", "tutorial", "repositorio", "testing", "api", "diseño", "base de datos"];

const CONCEPT_SIGNALS = [
  { pattern: /interfaz|\bui\b|\bux\b|usabilidad|experiencia de usuario/, concept: "usabilidad", motifs: ["self-explanatory interface", "visual hierarchy", "cursor action"] },
  { pattern: /usuarios?|instrucciones?|explicarse|autoexplic|claridad|comprensi[oó]n/, concept: "claridad", motifs: ["user signal", "clear action", "before and after"] },
  { pattern: /opciones|decisi[oó]n|elecci[oó]n|carga mental|hick|fitts|botones|objetivos/, concept: "decisión", motifs: ["choice funnel", "large target", "reduced options"] },
];

export function analyzeContext(text: string): ContextAnalysis {
  const normalized = text.toLocaleLowerCase();
  const matches = Object.entries(ENTITY_MAP).filter(([key]) => key === "git" ? /\bgit\b/.test(normalized) : normalized.includes(key));
  const signals = CONCEPT_SIGNALS.filter(({ pattern }) => pattern.test(normalized));
  const entities = matches.map(([, value]) => value.label);
  const concepts = [...new Set([...CONCEPTS.filter((concept) => normalized.includes(concept)), ...signals.map(({ concept }) => concept)])];
  const visualMotifs = [...new Set([...matches.flatMap(([, value]) => value.motifs), ...signals.flatMap(({ motifs }) => motifs)])];
  if (!visualMotifs.length) visualMotifs.push("editorial note", "diagram cards", "directional arrows");
  return { entities, concepts, visualMotifs };
}

export function detectEnrichmentProfile(text: string, analysis: ContextAnalysis, composition = ""): EnrichmentProfile {
  const source = text.toLocaleLowerCase();
  if (/\b(curva de aprendizaje|aprendizaje|semanas?|meses?|d[ií]as?|productiv[oa]|nivel inicial|nivel avanzado)\b/.test(source)) return "learning-curve";
  if (analysis.entities.includes("Git") || /\b(origin|remote|stash|commit|branch|rama|repositorio)\b/.test(source)) return "git-flow";
  if (analysis.entities.length || ["tool-grid", "technical-diagram", "infographic", "technical-flow", "code-window", "metric-board"].includes(composition)) return "technology";
  return "editorial-emphasis";
}

export function rankAssets(analysis: ContextAnalysis, assets: LibraryAsset[], slot?: "icon" | "screenshot" | "hero-image") {
  return assets
    .filter(isReusableAsset)
    .map((asset) => {
      let score = 0;
      if (asset.technology && analysis.entities.some((entity) => entity.toLowerCase() === asset.technology?.toLowerCase())) score += 100;
      score += asset.themes.filter((theme) => analysis.concepts.includes(theme)).length * 20;
      score += asset.tags.filter((tag) => analysis.visualMotifs.some((motif) => motif.includes(tag))).length * 8;
      if (slot === "icon" && ["logo", "icon"].includes(asset.kind)) score += 15;
      if (slot === "screenshot" && asset.kind === "screenshot") score += 15;
      if (slot === "hero-image" && ["illustration", "screenshot", "mockup"].includes(asset.kind)) score += 15;
      score += Math.min(asset.useCount, 10);
      return { asset, score };
    })
    .sort((a, b) => b.score - a.score);
}
