import type { EditorialBrand } from "./editorial.models";

export const LOCAL_BRAND: EditorialBrand = {
  id: "local-brand",
  user_id: "local",
  name: "arbe.blog",
  description: "Bitácora de tecnología en vivo. Lo que pasó esta semana, el problema que acabo de resolver y el ranking que te ahorra probar cinco cosas. Técnico con punchline — aprendé algo útil y salí con una sonrisa seca.",
  voice: {
    tone: "Técnico con humor seco. Serio con la evidencia, irónico con el hype.",
    register: "casual",
    humorStyle: "Ironía y observación, no chiste plano. El punchline llega al cerrar, después de entregar valor.",
    bilingualNote: "Español nativo. Anglicismos técnicos sin traducir (deployment, release, refactor).",
  },
  pillars: ["news", "problem-solved", "ranking", "field-notes"],
  antiPatterns: [
    "growth-hacking slop (desbloquea, potencia, revoluciona)",
    "clickbait y 'el secreto que nadie te cuenta'",
    "guías definitivas y 'todo lo que necesitas saber'",
    "vender humo o prometer resultados sin evidencia",
    "motivación genérica sin sustancia técnica",
  ],
  references: ["Lenny Rachitsky", "The Pragmatic Engineer", "Big Technology", "Latent.Space"],
  palette: ["#D94E1E", "#008F99", "#18181B", "#F4F4F5"],
  status: "approved",
  created_at: "2026-07-14T00:00:00.000Z",
};
