import { generatePlaceholderImage } from "@/api/services/images";
import { openaiProvider } from "@/api/services/images/openai";

const IMAGE_WIDTH = 1080;
const IMAGE_HEIGHT = 1080;
const PREVIEW_WIDTH = 768;
const PREVIEW_HEIGHT = 768;

export type DemoCreativeInput = {
  brandName?: string;
  brief?: string;
  audience?: string;
  audienceLabel?: string;
  goal?: string;
  goalLabel?: string;
  style?: string;
  styleLabel?: string;
  audienceNotes?: string;
  socialLink?: string;
  proposalNotes?: string;
  memory?: string[];
};

export type DemoCreative = {
  imageUrl: string;
  provider: string;
  prompt: string;
  concept: string;
};

/** Concepto de pieza generada (manifiesto / oferta / prueba). Cada uno lleva su
 *  dirección visual para que el modelo lo aborde con enfoque distinto. */
const CONCEPTS: {
  id: string;
  title: string;
  channel: string;
  format: string;
  copy: string;
  direction: string;
}[] = [
  {
    id: "launch",
    title: "Manifiesto de marca",
    channel: "Facebook",
    format: "Post",
    copy: "Presenta la promesa de marca y abre conversación con la audiencia principal.",
    direction:
      "Brand manifesto piece: dramatic hero shot, confident posture, generous negative space for a bold headline, aspirational mood.",
  },
  {
    id: "leads",
    title: "Oferta para contactos",
    channel: "Facebook Ads",
    format: "Anuncio",
    copy: "Invita a pedir información con una oferta clara y una razón simple para dejar datos.",
    direction:
      "Lead capture ad: clear value proposition front and center, benefit-driven layout, visual cue pointing to a simple action (form, CTA button zone), conversion-oriented.",
  },
  {
    id: "proof",
    title: "Prueba visual",
    channel: "Facebook",
    format: "Carrusel",
    copy: "Muestra cómo se ve la solución en acción y refuerza confianza antes de vender.",
    direction:
      "Social proof / in-action showcase: the product or result shown in context, warm and authentic vibe, before-and-after or comparison layout, credibility signals, trustworthy.",
  },
];

/** Direcciones visuales por estilo. */
const STYLE_DIRECTIONS: Record<string, string> = {
  neobrutal:
    "Neo-brutalist advertising aesthetic: bold flat blocks of acid green, cyan and off-white, thick black outlines, hard offset shadows, oversized geometric shapes. Editorial Swiss typography, not cartoony.",
  editorial:
    "Refined editorial aesthetic: premium paper textures, generous negative space, elegant serif accents, muted warm palette, sophisticated and trustworthy. Magazine-quality, not templated.",
  tech:
    "Modern SaaS/tech aesthetic: clean modular grid, soft diffused gradients, data panels, electric blue and teal accents, crisp glassmorphism panels, futuristic but restrained.",
  minimal:
    "Ultra-minimalist: pure white backgrounds, microscopic sans-serif type, single focal element with surgical precision, Scandinavian restraint, abundant breathing room. Architectural, not empty.",
  premium:
    "Luxury fashion-ad aesthetic: deep blacks, gold leaf accents, marble or silk micro-textures, dramatic spotlight lighting, high-end product photography, exclusive feel. Rich and tactile.",
  grunge:
    "Deconstructed zine/collage aesthetic: photocopy grain, torn paper edges, ransom-note typography, raw black and acid yellow with unexpected red splashes, DIY punk energy. Hand-made, imperfect, urgent.",
  render3d:
    "Cinematic 3D product render: physically based materials, dramatic studio lighting, depth of field bokeh, floating in space on a dark reflective surface, premium CGI feel. Hyper-real textures.",
  ilustrado:
    "Hand-drawn illustration style: organic brush strokes, sketchbook paper texture, custom hand-lettering accents, warm ink and watercolor palette, artisanal and human feel. Not vector-clean, intentionally rough.",
  brutalist:
    "Raw concrete architecture aesthetic: declassified blueprint vibe, Swiss mono typography, exposed grid lines, industrial materials, analog degradation effects. Severe, honest, institutional but beautiful.",
  "pop-art":
    "Pop art comic panel: halftone dots, bold Ben-Day primary colors, thick black ink outlines, speech bubbles, Roy Lichtenstein energy. Graphic, punchy, loud but deliberate.",
  "art-deco":
    "Art Deco geometric elegance: symmetrical sunburst patterns, gold foil on black lacquer, stepped geometric borders, Great Gatsby 1920s sophistication. Ornate but structured, not gaudy.",
  botanico:
    "Botanical herbarium aesthetic: vintage scientific illustrations, pressed flowers, warm terracotta and sage greens, deckled-edge paper, organic textures, earthy and calm. Natural history museum meets modern brand.",
};

const STYLE_NEGATIVE_DIRECTIONS: Record<string, string> = {
  minimal:
    "Avoid neo-brutalist cues: no thick black outlines, no acid green blocks, no comic shadows, no collage, no loud poster typography. Keep it quiet, white, sparse and restrained.",
  editorial:
    "Avoid neon startup graphics, heavy outlines, comic effects, zine collage, and aggressive geometric blocks.",
  premium:
    "Avoid bright acid colors, playful poster shapes, cartoon outlines, and casual SaaS UI panels.",
  grunge:
    "Avoid clean corporate SaaS minimalism, luxury polish, perfect grids, and sterile white-space-only layouts.",
  render3d:
    "Avoid flat poster collage, illustrated line art, halftone comic effects, and paper editorial layouts.",
  ilustrado:
    "Avoid photoreal CGI, luxury product photography, flat SaaS dashboards, and neo-brutalist poster blocks.",
  brutalist:
    "Avoid playful pop colors, luxury gloss, botanical softness, and friendly rounded SaaS visuals.",
  "pop-art":
    "Avoid minimalist white editorial layouts, luxury black-and-gold product photography, and muted botanical palettes.",
  "art-deco":
    "Avoid neon brutalist colors, collage/zine textures, SaaS dashboard panels, and cartoonish comic treatment.",
  botanico:
    "Avoid acid green neo-brutalism, hard black poster shadows, tech dashboards, and luxury black-gold gloss.",
};

const GOAL_DIRECTIONS: Record<string, string> = {
  awareness: "The visual should maximize brand recall and feel highly shareable.",
  leads: "The visual should invite the viewer to leave their contact info or request information.",
  sales: "The visual should present a clear offer with product, benefit and a call to buy.",
  community: "The visual should feel warm and communal, inviting participation and conversation.",
};

const buildPrompt = (input: DemoCreativeInput, concept: string): string => {
  const conceptSpec = CONCEPTS.find((c) => c.id === concept) ?? CONCEPTS[0]!;
  const brand = input.brandName?.trim() || "la marca";
  const styleDirection =
    STYLE_DIRECTIONS[input.style ?? ""] ?? STYLE_DIRECTIONS.neobrutal;
  const styleNegativeDirection = STYLE_NEGATIVE_DIRECTIONS[input.style ?? ""];
  const goalDirection = GOAL_DIRECTIONS[input.goal ?? ""] ?? GOAL_DIRECTIONS.awareness;
  const audience = input.audienceLabel || input.audienceNotes || input.audience;
  const memory = (input.memory ?? []).filter(Boolean).slice(-4);

  const parts = [
    `Square 1:1 social media ad creative for a Facebook campaign by ${brand}.`,
    `Concept: ${conceptSpec.title} (${conceptSpec.format}). ${conceptSpec.direction}`,
    input.brief ? `Brand brief: ${input.brief}` : undefined,
    audience ? `Target audience: ${audience}.` : undefined,
    input.goalLabel ? `Campaign goal: ${input.goalLabel}.` : undefined,
    goalDirection,
    styleDirection,
    styleNegativeDirection,
    input.proposalNotes ? `Extra direction: ${input.proposalNotes}.` : undefined,
    memory.length ? `Keep in mind: ${memory.join(" ")}` : undefined,
    "Leave clean negative space for a short headline overlay. Professional, high quality, no watermarks, no real company logos, no gibberish text.",
  ];

  return parts.filter(Boolean).join(" ");
};

const generate = async (prompt: string, label: string) => {
  const request = {
    prompt,
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
    placeholder: { label },
  };

  return openaiProvider.isConfigured()
    ? openaiProvider.generate(request)
    : generatePlaceholderImage(request);
};

export const generateDemoCreative = async (
  input: DemoCreativeInput,
  concept: string,
): Promise<DemoCreative> => {
  const conceptSpec = CONCEPTS.find((c) => c.id === concept);
  const conceptLabel = conceptSpec?.title ?? concept;

  const prompt = buildPrompt(input, concept);
  const image = await generate(
    prompt,
    `${input.brandName?.trim() || "Polyedro"}\n${conceptLabel}`,
  );

  return { imageUrl: image.url, provider: image.provider, prompt, concept };
};

export const generateStylePreview = async (
  styleKey: string,
  input: Pick<DemoCreativeInput, "brandName" | "audience" | "goal"> = {},
): Promise<DemoCreative> => {
  const styleDirection = STYLE_DIRECTIONS[styleKey];
  if (!styleDirection) {
    const fallback = generatePlaceholderImage({
      prompt: `Style preview: ${styleKey}`,
      width: PREVIEW_WIDTH,
      height: PREVIEW_HEIGHT,
      placeholder: { label: styleKey },
    });
    return { imageUrl: fallback.url, provider: fallback.provider, prompt: "", concept: styleKey };
  }

  const brand = input.brandName?.trim() || "a modern brand";

  const prompt = [
    `Aesthetic moodboard thumbnail for a ${styleDirection}`,
    `The brand is: ${brand}.`,
    input.audience ? `The mood is inspired by ${input.audience}.` : undefined,
    input.goal ? `The intended campaign goal is ${input.goal}.` : undefined,
    "Composition: clean vertical portrait layout, abstract representation of the style direction as a stylized ad mockup, no faces, no real brand logos, design-focused.",
  ]
    .filter(Boolean)
    .join(" ");

  const request = {
    prompt,
    width: PREVIEW_WIDTH,
    height: PREVIEW_HEIGHT,
    placeholder: { label: styleKey },
  };

  const image = openaiProvider.isConfigured()
    ? await openaiProvider.generate(request)
    : generatePlaceholderImage(request);

  return { imageUrl: image.url, provider: image.provider, prompt, concept: styleKey };
};
