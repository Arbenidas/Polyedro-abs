import { ApiError } from "@/api/shared";
import { deepSeekJson, isDeepSeekConfigured } from "@/api/services/deepseek";
import type { EditorialBrandInput } from "@/api/services/editorial";

/** Genera el copy para PUBLICAR en redes sociales (Instagram/LinkedIn/TikTok).
 *  Dos modos:
 *  - "short": caption corto (2-4 líneas + CTA + hashtags) para el carrusel.
 *  - "long": post completo tipo LinkedIn/Instagram (hook + secciones numeradas
 *    + regla de oro + pregunta de engagement + hashtags).
 *
 *  Usa el contexto real del proyecto (topic, caption del plan, slides) para
 *  que el copy sea específico, no genérico. */

export type CopyLength = "short" | "long";

export type CopyGenerateInput = {
  mode: CopyLength;
  topic: string;
  contentType?: string;
  goal?: string;
  audience?: string;
  /** Caption base que la IA puede mejorar/expandir. */
  caption?: string;
  /** CTAs/hooks ya seleccionados (hooks del plan). */
  hook?: string;
  /** Copy de las láminas (headline + body) para anclar el post largo. */
  slides?: Array<{ role?: string; headline: string; body?: string }>;
  brand?: EditorialBrandInput;
  channel?: string;
};

export type CopyGenerateResult = {
  copy: string;
  hashtags: string[];
  mode: CopyLength;
};

const exampleShort = {
  copy: "La mayoría de los ORMs funcionan en demo, pero fallan en producción. Probé 7: solo 2 aguantan. \n\nEl criterio no es si funciona, es si aguanta: migración, debugging y equipo. \n\nGuarda esta comparativa para tu próxima decisión de stack. \n\n#ORM #typescript #backend #dev",
  hashtags: ["ORM", "typescript", "backend", "dev"],
};

const exampleLong = {
  copy: `Elegir entre Docker y Kubernetes suele ser un dolor de cabeza si no tienes claros los criterios de costo, control y complejidad. Aquí te dejo un resumen rápido para que dejes de adivinar. 🚀☁️

1️⃣ Docker (Simplicidad pura)
Ideal si solo quieres empaquetar tu app y olvidarte del entorno.
Uso ideal: Contenedores locales, desarrollo y despliegues simples.
Ventajas: El runtime y la portabilidad los maneja la herramienta.
Costo: Gratis en tu máquina; pagas por el hosting del contenedor.

2️⃣ Kubernetes (Control total)
La opción preferida para orquestar clusters y servicios a escala.
Uso ideal: Microservicios, autoescalado y alta disponibilidad.
Ventajas: Escalado por réplica, cualquier carga de trabajo, multi-nube.
Costo: Pagas por los nodos activos (más eficiente a alto volumen).

💡 Regla de oro:
Empieza con Docker si estás en MVP o un solo servicio. Migra a Kubernetes cuando necesites autoescalado real o tráfico alto.

📌 ¿Cuál estás usando actualmente? Cuéntame en los comentarios si has tenido que migrar. 👇`,
  hashtags: ["docker", "kubernetes", "devops", "backend", "cloud"],
};

function buildShortPrompt(input: CopyGenerateInput, brandVoice: string): string {
  return `Eres el community manager de una cuenta de tecnología con humor seco. Genera un caption CORTO para publicar el carrusel de redes sociales (Instagram/LinkedIn). Escribe copy NUEVO, no copies el caption base.

CONTEXTO DEL PROYECTO
- Tema: ${input.topic}
- Tipo: ${input.contentType ?? "n/d"} · Intención: ${input.goal ?? "teach"} · Canal: ${input.channel ?? "instagram"}
- Audiencia: ${input.audience ?? "devs y curiosos técnicos"}
- Hook seleccionado: ${input.hook ?? "n/d"}
- Caption base (puedes mejorarlo o reescribirlo): ${input.caption?.slice(0, 600) ?? "n/d"}
${brandVoice}

REGLAS DEL CAPTION CORTO
- 2-4 líneas como máximo. Primera línea = hook con postura (puede usar emoji con moderación).
- Incluye 1 dato o idea específica del tema (no genérico).
- Cierre con CTA según intención: teach → "Guarda esto"; save → "Guárdalo para cuando lo necesites"; discuss → pregunta; act → "Haz el paso 1 hoy".
- Máx 3 hashtags relevantes al final (sin emojis en hashtags).
- Sin clickbait, sin "nadie te cuenta", sin guías definitivas.

El json debe seguir exactamente esta forma: ${JSON.stringify(exampleShort)}`;
}

function buildLongPrompt(input: CopyGenerateInput, brandVoice: string): string {
  const slides = input.slides?.length
    ? `\nLÁMINAS DEL CARRUSEL (para anclar ideas concretas):\n${input.slides.map((s, i) => `${i + 1}. [${s.role ?? "slide"}] ${s.headline}${s.body ? ` — ${s.body.slice(0, 140)}` : ""}`).join("\n")}`
    : "";
  return `Eres el community manager de una cuenta de tecnología con humor seco. Escribe un POST LARGO para publicar en redes sociales (LinkedIn/Instagram) que acompañe al carrusel. Este es el texto que la gente lee debajo del carrusel: debe ser escaneable, con estructura clara, y con gancho.

CONTEXTO DEL PROYECTO
- Tema: ${input.topic}
- Tipo: ${input.contentType ?? "n/d"} · Intención: ${input.goal ?? "teach"} · Canal: ${input.channel ?? "instagram"}
- Audiencia: ${input.audience ?? "devs y curiosos técnicos"}
- Hook seleccionado: ${input.hook ?? "n/d"}
- Caption base: ${input.caption?.slice(0, 600) ?? "n/d"}${slides}
${brandVoice}

ESTRUCTURA OBLIGATORIA DEL POST LARGO (en este orden):
1. Hook de apertura: 1-2 líneas con postura clara. Puede usar emoji con moderación (🚀☁️💡📌 son bienvenidos, no los abuses).
2. Problema/contexto: 1 párrafo corto que enmarca por qué importa.
3. Secciones numeradas con emoji (1️⃣, 2️⃣…): cada una con Uso ideal / Ventajas / Costo (o equivalente según el tema). Máx 4 secciones.
4. 💡 Regla de oro: 1-2 líneas que resumen la decisión práctica.
5. 📌 Pregunta de engagement al cierre: invitá a comentar con una pregunta específica sobre el tema (no "¿qué opinas?").
6. Hashtags: 6-8 relevantes al final (sin emojis).

REGLAS
- Copia NUEVA y específica del tema: usa los datos, nombres y ejemplos reales del contexto (nunca genéricos).
- CRÍTICO: usa los NOMBRES REALES de las opciones del contexto (ej. "Cloud Functions", "Cloud Run", "Prisma", "Drizzle"). Prohibido reemplazarlos por "Opción A" u "Opción B".
- Las secciones 1️⃣/2️⃣ deben reflejar las láminas del carrusel: cada sección = una idea real de las láminas, no un relleno.
- Tono: técnico con humor seco. Serio con la evidencia, irónico con el hype.
- Prohibido: clickbait, "nadie te cuenta", "guía definitiva", "todo lo que necesitas saber", vender humo.
- Cada sección debe tener un dato concreto. Si el contexto no lo da, formula como criterio o recomendación.

El json debe seguir exactamente esta forma: ${JSON.stringify(exampleLong)}`;
}

export const generateCopy = async (input: CopyGenerateInput): Promise<CopyGenerateResult> => {
  if (!isDeepSeekConfigured()) throw new ApiError(500, "DEEPSEEK_API_KEY_MISSING");

  const brandVoice = input.brand?.description
    ? `Voz de marca: "${input.brand.name}" — ${input.brand.description}`
    : "Voz de marca: técnica con humor seco.";

  const prompt = input.mode === "long" ? buildLongPrompt(input, brandVoice) : buildShortPrompt(input, brandVoice);

  const result = await deepSeekJson<unknown>(
    [
      { role: "system", content: prompt },
      { role: "user", content: `Genera el copy de redes en modo "${input.mode}" para el tema: ${input.topic}.` },
    ],
    input.mode === "long" ? 4_000 : 2_000,
  );

  const data = result.data as Record<string, unknown>;
  const copy = typeof data?.copy === "string" && data.copy.trim() ? data.copy.trim() : "";
  if (!copy) throw new ApiError(502, "COPY_GENERATION_EMPTY");
  const hashtags = Array.isArray(data?.hashtags)
    ? [...new Set(data.hashtags.filter((h): h is string => typeof h === "string").map((h) => h.replace(/^#/, "").trim()).filter(Boolean))].slice(0, 10)
    : [];

  return { copy, hashtags, mode: input.mode };
};
