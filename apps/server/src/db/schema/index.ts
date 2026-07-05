import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** Estado genérico reutilizado por brand, brand_kit, campaign, campaign_strategy,
 *  ad_copy, creative_asset y video_script. */
export const assetStatusEnum = pgEnum("asset_status", [
  "draft",
  "generating",
  "review",
  "approved",
  "ready_to_publish",
  "rejected",
]);

/** Idioma de un asset bilingüe (copies, guiones, voiceovers). */
export const languageEnum = pgEnum("language", ["es", "en"]);

/** Variante A/B de un asset generado (copies, creativos). */
export const variantEnum = pgEnum("variant", ["a", "b"]);

/** Estado del export/publish hacia Meta Ads vía n8n. */
export const exportStatusEnum = pgEnum("export_status", [
  "pending",
  "processing",
  "sent",
  "failed",
]);

/** Estado de un post publicado (o programado) directamente vía Graph API. */
export const socialPostStatusEnum = pgEnum("social_post_status", [
  "draft",
  "scheduled",
  "publishing",
  "published",
  "failed",
]);

// ---------------------------------------------------------------------------
// Helpers y shapes de jsonb
// ---------------------------------------------------------------------------

const timestamps = {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
};

/** Contenido bilingüe simple: { es: "...", en: "..." }. */
type Bilingual<T = string> = { es: T; en: T };

type ColorPalette = {
  primary: string;
  secondary: string;
  accent: string;
  neutrals?: string[];
};

type BuyerPersona = {
  name: string;
  age?: string;
  occupation?: string;
  goals?: string[];
  painPoints?: string[];
  notes?: string;
};

type VisualStyle = {
  mood?: string;
  imageryStyle?: string;
  typography?: string;
  references?: string[];
};

type AudienceProfile = {
  description: string;
  ageRange?: string;
  locations?: string[];
  interests?: string[];
};

type MetaAdsSegmentation = {
  ageMin?: number;
  ageMax?: number;
  genders?: string[];
  locations?: string[];
  interests?: string[];
  placements?: string[];
};

type VideoScene = {
  sceneNumber: number;
  description: string;
  dialogue?: string;
  durationSeconds?: number;
};

// ---------------------------------------------------------------------------
// Tabla: users
// ---------------------------------------------------------------------------

// RLS habilitado (sin policies) en todas las tablas: el acceso a datos pasa
// exclusivamente por apps/server (conexión directa Postgres, no afectada por
// RLS); la Data API pública de Supabase queda bloqueada para anon/authenticated.

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  ...timestamps,
}).enableRLS();

// ---------------------------------------------------------------------------
// Tabla: brands
// ---------------------------------------------------------------------------

export const brands = pgTable(
  "brands",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    industry: text("industry"),
    status: assetStatusEnum("status").notNull().default("draft"),
    ...timestamps,
  },
  (table) => [index("brands_user_id_idx").on(table.userId)],
).enableRLS();

// ---------------------------------------------------------------------------
// Tabla: brand_kits (1:1 con brand) — Brand Agent
// ---------------------------------------------------------------------------

export const brandKits = pgTable("brand_kits", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id")
    .notNull()
    .unique()
    .references(() => brands.id, { onDelete: "cascade" }),
  status: assetStatusEnum("status").notNull().default("draft"),
  logoUrl: text("logo_url"),
  logoPrompt: text("logo_prompt"),
  colorPalette: jsonb("color_palette").$type<ColorPalette>(),
  toneOfVoice: jsonb("tone_of_voice").$type<Bilingual>(),
  buyerPersona: jsonb("buyer_persona").$type<BuyerPersona>(),
  valueProposition: jsonb("value_proposition").$type<Bilingual>(),
  keyMessages: jsonb("key_messages").$type<Bilingual<string[]>>(),
  visualStyle: jsonb("visual_style").$type<VisualStyle>(),
  ...timestamps,
}).enableRLS();

// ---------------------------------------------------------------------------
// Tabla: campaigns
// ---------------------------------------------------------------------------

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    objective: text("objective").notNull(),
    status: assetStatusEnum("status").notNull().default("draft"),
    ...timestamps,
  },
  (table) => [index("campaigns_brand_id_idx").on(table.brandId)],
).enableRLS();

// ---------------------------------------------------------------------------
// Tabla: campaign_briefs — input capturado antes de crear/generar campaña
// ---------------------------------------------------------------------------

export const campaignBriefs = pgTable(
  "campaign_briefs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id").references(() => campaigns.id, {
      onDelete: "set null",
    }),
    language: languageEnum("language").notNull().default("es"),
    source: text("source").notNull().default("microphone"),
    provider: text("provider").notNull().default("openai"),
    model: text("model").notNull(),
    text: text("text").notNull(),
    audioMimeType: text("audio_mime_type"),
    audioSizeBytes: integer("audio_size_bytes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    index("campaign_briefs_brand_id_idx").on(table.brandId),
    index("campaign_briefs_campaign_id_idx").on(table.campaignId),
  ],
);

// ---------------------------------------------------------------------------
// Tabla: campaign_strategies (1:1 con campaign) — Strategy Agent
// ---------------------------------------------------------------------------

export const campaignStrategies = pgTable("campaign_strategies", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id")
    .notNull()
    .unique()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  status: assetStatusEnum("status").notNull().default("draft"),
  audience: jsonb("audience").$type<AudienceProfile>(),
  segmentation: jsonb("segmentation").$type<MetaAdsSegmentation>(),
  commercialAngle: text("commercial_angle"),
  notes: text("notes"),
  ...timestamps,
}).enableRLS();

// ---------------------------------------------------------------------------
// Tabla: ad_copies — Meta Ads Agent (es/en, variante A/B)
// ---------------------------------------------------------------------------

export const adCopies = pgTable(
  "ad_copies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    language: languageEnum("language").notNull(),
    variant: variantEnum("variant").notNull().default("a"),
    status: assetStatusEnum("status").notNull().default("draft"),
    headline: text("headline"),
    primaryText: text("primary_text"),
    description: text("description"),
    callToAction: text("call_to_action"),
    ...timestamps,
  },
  (table) => [index("ad_copies_campaign_id_idx").on(table.campaignId)],
).enableRLS();

// ---------------------------------------------------------------------------
// Tabla: creative_assets — Creative Agent (imágenes IA, variante A/B)
// ---------------------------------------------------------------------------

export const creativeAssets = pgTable(
  "creative_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    variant: variantEnum("variant").notNull().default("a"),
    status: assetStatusEnum("status").notNull().default("draft"),
    imageUrl: text("image_url"),
    prompt: text("prompt"),
    altText: text("alt_text"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [index("creative_assets_campaign_id_idx").on(table.campaignId)],
).enableRLS();

// ---------------------------------------------------------------------------
// Tabla: video_scripts — Video Agent
// ---------------------------------------------------------------------------

export const videoScripts = pgTable(
  "video_scripts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    status: assetStatusEnum("status").notNull().default("draft"),
    language: languageEnum("language").notNull().default("es"),
    title: text("title"),
    scenes: jsonb("scenes").$type<VideoScene[]>(),
    durationSeconds: integer("duration_seconds"),
    ...timestamps,
  },
  (table) => [index("video_scripts_campaign_id_idx").on(table.campaignId)],
).enableRLS();

// ---------------------------------------------------------------------------
// Tabla: voiceovers — Voice Agent (ElevenLabs), ligada a un video_script
// ---------------------------------------------------------------------------

export const voiceovers = pgTable(
  "voiceovers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    videoScriptId: uuid("video_script_id")
      .notNull()
      .references(() => videoScripts.id, { onDelete: "cascade" }),
    status: assetStatusEnum("status").notNull().default("draft"),
    language: languageEnum("language").notNull(),
    voiceId: text("voice_id").notNull(),
    audioUrl: text("audio_url"),
    durationSeconds: integer("duration_seconds"),
    settings: jsonb("settings").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    index("voiceovers_video_script_id_idx").on(table.videoScriptId),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// Tabla: automation_exports — Automation Agent (n8n -> Meta Ads)
// ---------------------------------------------------------------------------

export const automationExports = pgTable(
  "automation_exports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    exportStatus: exportStatusEnum("export_status")
      .notNull()
      .default("pending"),
    n8nWorkflowId: text("n8n_workflow_id"),
    n8nExecutionId: text("n8n_execution_id"),
    metaAdsPayload: jsonb("meta_ads_payload").$type<Record<string, unknown>>(),
    metaCampaignId: text("meta_campaign_id"),
    errorMessage: text("error_message"),
    requestedAt: timestamp("requested_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
    ...timestamps,
  },
  (table) => [
    index("automation_exports_campaign_id_idx").on(table.campaignId),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// Tabla: social_posts — publish directo a Meta Graph API (sin pasar por n8n)
// ---------------------------------------------------------------------------

export const socialPosts = pgTable(
  "social_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    creativeAssetId: uuid("creative_asset_id")
      .notNull()
      .references(() => creativeAssets.id, { onDelete: "restrict" }),
    caption: text("caption").notNull(),
    status: socialPostStatusEnum("status").notNull().default("draft"),
    scheduledAt: timestamp("scheduled_at"),
    publishedAt: timestamp("published_at"),
    externalPostId: text("external_post_id"),
    errorMessage: text("error_message"),
    ...timestamps,
  },
  (table) => [index("social_posts_campaign_id_idx").on(table.campaignId)],
).enableRLS();

// ---------------------------------------------------------------------------
// Relations (para el query API relacional: db.query.brands.findMany({ with: {...} }))
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ many }) => ({
  brands: many(brands),
}));

export const brandsRelations = relations(brands, ({ one, many }) => ({
  user: one(users, { fields: [brands.userId], references: [users.id] }),
  brandKit: one(brandKits, {
    fields: [brands.id],
    references: [brandKits.brandId],
  }),
  campaigns: many(campaigns),
  campaignBriefs: many(campaignBriefs),
}));

export const brandKitsRelations = relations(brandKits, ({ one }) => ({
  brand: one(brands, { fields: [brandKits.brandId], references: [brands.id] }),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  brand: one(brands, { fields: [campaigns.brandId], references: [brands.id] }),
  campaignBriefs: many(campaignBriefs),
  strategy: one(campaignStrategies, {
    fields: [campaigns.id],
    references: [campaignStrategies.campaignId],
  }),
  adCopies: many(adCopies),
  creativeAssets: many(creativeAssets),
  videoScripts: many(videoScripts),
  automationExports: many(automationExports),
  socialPosts: many(socialPosts),
}));

export const campaignBriefsRelations = relations(campaignBriefs, ({ one }) => ({
  brand: one(brands, {
    fields: [campaignBriefs.brandId],
    references: [brands.id],
  }),
  campaign: one(campaigns, {
    fields: [campaignBriefs.campaignId],
    references: [campaigns.id],
  }),
}));

export const campaignStrategiesRelations = relations(
  campaignStrategies,
  ({ one }) => ({
    campaign: one(campaigns, {
      fields: [campaignStrategies.campaignId],
      references: [campaigns.id],
    }),
  }),
);

export const adCopiesRelations = relations(adCopies, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [adCopies.campaignId],
    references: [campaigns.id],
  }),
}));

export const creativeAssetsRelations = relations(
  creativeAssets,
  ({ one, many }) => ({
    campaign: one(campaigns, {
      fields: [creativeAssets.campaignId],
      references: [campaigns.id],
    }),
    socialPosts: many(socialPosts),
  }),
);

export const videoScriptsRelations = relations(
  videoScripts,
  ({ one, many }) => ({
    campaign: one(campaigns, {
      fields: [videoScripts.campaignId],
      references: [campaigns.id],
    }),
    voiceovers: many(voiceovers),
  }),
);

export const voiceoversRelations = relations(voiceovers, ({ one }) => ({
  videoScript: one(videoScripts, {
    fields: [voiceovers.videoScriptId],
    references: [videoScripts.id],
  }),
}));

export const automationExportsRelations = relations(
  automationExports,
  ({ one }) => ({
    campaign: one(campaigns, {
      fields: [automationExports.campaignId],
      references: [campaigns.id],
    }),
  }),
);

export const socialPostsRelations = relations(socialPosts, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [socialPosts.campaignId],
    references: [campaigns.id],
  }),
  creativeAsset: one(creativeAssets, {
    fields: [socialPosts.creativeAssetId],
    references: [creativeAssets.id],
  }),
}));
