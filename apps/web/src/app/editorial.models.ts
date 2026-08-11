export type ContentChannel = "instagram_portrait" | "instagram_square" | "linkedin_portrait" | "tiktok_vertical";

/** Pilares editoriales de arbe.blog. Cada pieza nace de uno de estos cuatro
 *  ángulos — el pilar guía el arco narrativo, el tono y el CTA. */
export type BrandPillar = "news" | "problem-solved" | "ranking" | "field-notes";

/** Dirección de voz de la marca. Define cómo suena cada pieza, no qué dice. */
export type BrandVoice = {
  /** Descripción corta del tono dominante. Ej: "Técnico con humor seco". */
  tone: string;
  /** Registro lingüístico: formal, casual o mixto. */
  register: "formal" | "casual" | "mixto";
  /** Cómo entra el humor (si entra). Nunca "chiste plano". */
  humorStyle: string;
  /** Nota sobre bilingüismo / anglicismos. */
  bilingualNote?: string;
};

export type EditorialBrand = {
  id: string;
  user_id: string;
  name: string;
  description: string;
  palette: string[];
  status: "draft" | "review" | "approved";
  created_at: string;
  /** Voz de marca enriquecida. Opcional para no romper brands persistidos. */
  voice?: BrandVoice;
  /** Pilares editoriales activos. Define qué tipo de contenido publicás. */
  pillars?: BrandPillar[];
  /** Lo que la marca NUNCA hace. Alimenta el system prompt como lista negra. */
  antiPatterns?: string[];
  /** Referencias estilo/creadores que inspiran la dirección editorial. */
  references?: string[];
};

export type EditorialAsset = {
  id: string;
  brand_id: string;
  name: string;
  kind: string;
  image_url: string;
  tags: string[];
  use_count: number;
};

export type EditorialPost = {
  id: string;
  brand_id: string;
  topic: string;
  channel: ContentChannel;
  status: "draft" | "review" | "approved";
  hook: string;
  caption: string;
  created_at: string;
};

export type EditorialSlide = {
  id: string;
  post_id: string;
  slide_order: number;
  headline: string;
  body: string;
  composition: string;
  image_url: string | null;
};
