import { Injectable } from "@angular/core";
import { SupabaseService } from "./supabase.service";
import type { ContentChannel, EditorialAsset, EditorialBrand, EditorialPost, EditorialSlide } from "./editorial.models";

const palette = ["#F4BE2A", "#201914", "#F7F1E3"];

@Injectable({ providedIn: "root" })
export class EditorialService {
  constructor(private readonly supabase: SupabaseService) {}

  async currentUser() { return (await this.supabase.client.auth.getUser()).data.user; }
  async signIn(email: string, password: string) { return this.supabase.client.auth.signInWithPassword({ email, password }); }
  async signUp(email: string, password: string) { return this.supabase.client.auth.signUp({ email, password }); }
  async signOut() { await this.supabase.client.auth.signOut(); }

  async brands(): Promise<EditorialBrand[]> {
    const { data, error } = await this.supabase.client.from("editorial_brands").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data as EditorialBrand[];
  }
  async createBrand(name: string, description: string): Promise<EditorialBrand> {
    const user = await this.currentUser(); if (!user) throw new Error("Inicia sesión para crear una marca.");
    const { data, error } = await this.supabase.client.from("editorial_brands").insert({ user_id: user.id, name, description, palette, status: "review" }).select().single();
    if (error) throw error; return data as EditorialBrand;
  }
  async approveBrand(brandId: string) { const { error } = await this.supabase.client.from("editorial_brands").update({ status: "approved" }).eq("id", brandId); if (error) throw error; }
  async posts(brandId: string): Promise<EditorialPost[]> { const { data, error } = await this.supabase.client.from("editorial_posts").select("*").eq("brand_id", brandId).order("created_at", { ascending: false }); if (error) throw error; return data as EditorialPost[]; }
  async assets(brandId: string): Promise<EditorialAsset[]> { const { data, error } = await this.supabase.client.from("editorial_assets").select("*").eq("brand_id", brandId).order("use_count", { ascending: false }); if (error) throw error; return data as EditorialAsset[]; }
  async createPost(brandId: string, topic: string, channel: ContentChannel): Promise<{ post: EditorialPost; slides: EditorialSlide[] }> {
    const hook = `${topic}: una guía para empezar hoy`;
    const { data, error } = await this.supabase.client.from("editorial_posts").insert({ brand_id: brandId, topic, channel, status: "review", hook, caption: `Guarda esta guía sobre ${topic} para revisarla después.` }).select().single();
    if (error) throw error;
    const post = data as EditorialPost;
    const copy = [
      [topic, "Una guía práctica que puedes seguir hoy.", "Titular grande, fondo oscuro y acento cálido."],
      ["Empieza por lo esencial", "Define una meta pequeña y concreta antes de buscar más recursos.", "Texto superior con fotografía tenue."],
      ["Tu plan", "• Elige un recurso\n• Practica 20 minutos\n• Anota lo aprendido", "Lista editorial con subrayado manual."],
      ["Hazlo visible", "Documentar tu proceso te ayuda a aprender y a compartir conocimiento.", "Iconos tipo sticker y espacio negativo."],
      ["Constancia > intensidad", "Una práctica pequeña cada día crea progreso real.", "Frase central con trazo dibujado."],
      ["Guárdalo para después", "¿Cuál será tu primer paso?", "CTA con bookmark y firma de marca."],
    ];
    const rows = copy.map(([headline, body, composition], index) => ({ post_id: post.id, slide_order: index + 1, headline, body, composition, image_url: null }));
    const { data: created, error: slideError } = await this.supabase.client.from("editorial_slides").insert(rows).select();
    if (slideError) throw slideError;
    return { post, slides: created as EditorialSlide[] };
  }
  async slides(postId: string): Promise<EditorialSlide[]> { const { data, error } = await this.supabase.client.from("editorial_slides").select("*").eq("post_id", postId).order("slide_order"); if (error) throw error; return data as EditorialSlide[]; }
}
