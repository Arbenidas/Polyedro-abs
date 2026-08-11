import { CommonModule } from "@angular/common";
import { Component, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import type { ContentChannel, EditorialSlide } from "../../editorial.models";
import { LOCAL_BRAND } from "../../editorial-presets";
import { compileScene } from "../editor/scene.factory";
import { LocalLibraryService } from "../editor/local-library.service";
import { templateByRecipe, templateCatalog } from "../editor/template-catalog";
import { GenerationService } from "../generation/generation.service";
import type { ContentFormat, ContentGoal, ContentPreferences, ContentProject, EditorialPlan, EditorialSlidePlan, VisualDirection } from "./content.models";
import { buildLocalEditorialPlan } from "./local-editorial-planner";
import { AppHeaderComponent } from "../../shared/app-header.component";
import { resolveRecipeId } from "../editor/recipe-catalog";
import { expandSequence, pickRecipeForArc, resolveArcSafely, slideIntention } from "../editor/narrative-blueprints";
import { bestTemplateForContext } from "../editor/template-matcher";
import type { EditorialTemplate } from "../editor/editor.models";
import type { TopicCategory, TopicDraft } from "../topic/topic.models";
import { applyCarouselContinuity } from "../editor/editorial-quality";

type Phase = "idle" | "analyzing" | "narrative" | "assets" | "scenes" | "error" | "researching";

/** Umbral de caracteres para auto-detectar "texto pegado" vs "idea corta". */
const TEXT_MODE_THRESHOLD = 220;

@Component({ selector:"poly-content-composer",standalone:true,imports:[CommonModule,FormsModule,AppHeaderComponent],templateUrl:"./content-composer.component.html",styleUrl:"./content-composer.component.css" })
export class ContentComposerComponent {
  readonly brand = LOCAL_BRAND;
  readonly phase = signal<Phase>("idle");
  readonly error = signal<string | null>(null);
  readonly aiWarning = signal<string | null>(null);
  readonly brandId = this.route.snapshot.paramMap.get("brandId") ?? LOCAL_BRAND.id;
  sourceText = "";
  sourceMode: "idea" | "text" = "idea";
  keepAsIs = true;
  category: TopicCategory | "" = "";
  channel: ContentChannel = (localStorage.getItem("polyedro-last-channel") as ContentChannel | null) ?? "instagram_portrait";
  format: ContentFormat = "auto";
  slideCount: "auto" | number = "auto";
  visualDirection: VisualDirection = "auto";
  goal: ContentGoal = "teach";
  audience = "";
  readonly channels: Array<{id:ContentChannel;label:string}> = [{id:"instagram_portrait",label:"Instagram 4:5"},{id:"instagram_square",label:"Instagram 1:1"},{id:"linkedin_portrait",label:"LinkedIn 4:5"},{id:"tiktok_vertical",label:"TikTok vertical"}];
  readonly categories: Array<{id:TopicCategory;label:string}> = [
    {id:"news",label:"Noticias"},
    {id:"problem-solved",label:"Problema resuelto"},
    {id:"ranking",label:"Ranking / Top"},
    {id:"field-notes",label:"Notas de campo"},
  ];

  private draft: TopicDraft | null = null;
  private availableTemplates: EditorialTemplate[] = [];

  constructor(private readonly route: ActivatedRoute,private readonly router:Router,private readonly library:LocalLibraryService,private readonly generation:GenerationService) {
    const pendingSeed = localStorage.getItem("polyedro-pending-content-seed");
    if (pendingSeed) {
      this.sourceText = pendingSeed;
      this.sourceMode = "text";
      this.keepAsIs = true;
      localStorage.removeItem("polyedro-pending-content-seed");
    }
    // Si venimos de aprobar un TopicDraft en /review, cargamos el sourceText
    // desde el draft y arrancamos el flujo de propuestas directo.
    const draftId = this.route.snapshot.queryParamMap.get("draftId");
    if (draftId) void this.resumeFromDraft(draftId);
  }

  private async resumeFromDraft(draftId: string) {
    await this.library.initialize();
    const draft = await this.library.topicDraft(draftId);
    if (!draft) return;
    this.draft = draft;
    this.sourceText = draft.body;
    if (draft.category) this.category = draft.category;
    // IA real (no fallback local): el plan debe extraer ideas del texto aprobado.
    await this.createProposal();
  }

  setFormat(value: ContentFormat) {
    this.format = value;
    if (value === "single") this.slideCount = 1;
    if (value === "carousel" && this.slideCount === 1) this.slideCount = 5;
  }

  setSlideCount(value: "auto" | number) {
    this.slideCount = value === "auto" ? "auto" : Math.max(1, Math.min(10, value));
    if (typeof this.slideCount === "number") this.format = this.slideCount === 1 ? "single" : "carousel";
  }

  changeSlideCount(delta: number) {
    const current = this.slideCount === "auto" ? 5 : this.slideCount;
    this.setSlideCount(current + delta);
  }

  onSourceChange(value: string) {
    this.sourceText = value;
    // Auto-detección: texto largo pegado → modo "text" (editar el material).
    if (this.sourceMode === "idea" && value.trim().length > TEXT_MODE_THRESHOLD) this.sourceMode = "text";
    if (this.sourceMode === "text" && value.trim().length <= TEXT_MODE_THRESHOLD && !value.includes("\n")) this.sourceMode = "idea";
  }

  /** Fase 0: con idea o texto, investiga/redacta el post largo y navega a
   *  /review para la revisión humana. El plan editorial corre DESPUÉS de
   *  aprobar, no acá. */
  async startTopicFlow() {
    if (this.sourceText.trim().length < 12 || (this.phase() !== "idle" && this.phase() !== "error")) return;
    this.error.set(null); this.aiWarning.set(null);
    localStorage.setItem("polyedro-last-channel",this.channel);
    this.phase.set("researching");
    try {
      await this.library.initialize();
      let draft: TopicDraft;
      const input = {
        mode: this.sourceMode === "idea" ? ("research" as const) : ("rewrite" as const),
        topic: this.sourceText,
        category: this.category || undefined,
        goal: this.goal,
        audience: this.audience.trim().slice(0,120) || undefined,
      };
      if (this.sourceMode === "idea") {
        const result = await this.generation.researchTopic(input);
        draft = result.draft;
      } else if (this.keepAsIs) {
        // Texto pegado "tal cual": no llamamos a la IA, el draft es el texto.
        draft = {
          id: crypto.randomUUID(),
          title: this.sourceText.split("\n")[0]?.trim().slice(0,120) || "Tema",
          category: this.category || "news",
          body: this.sourceText.trim(),
          sources: [],
          keyTakeaways: this.sourceText.split(/\n+/).map((item) => item.trim()).filter((item) => item.length > 24).slice(0,5),
          createdAt: new Date().toISOString(),
        };
      } else {
        const result = await this.generation.rewriteTopic(input);
        draft = result.draft;
      }
      await this.library.saveTopicDraft(draft);
      await this.router.navigate(["/brands",this.brandId,"topic",draft.id,"review"]);
    } catch (error) {
      this.phase.set("error");
      this.error.set(error instanceof Error ? error.message : "No se pudo desarrollar el tema.");
    }
  }

  async createProposal(useLocalFallback = false) {
    if (this.sourceText.trim().length < 12 || this.phase() !== "idle" && this.phase() !== "error") return;
    this.error.set(null); this.aiWarning.set(null); localStorage.setItem("polyedro-last-channel",this.channel);
    const preferences: ContentPreferences = { channel:this.channel,format:this.format,slideCount:this.slideCount,visualDirection:this.visualDirection,goal:this.goal,audience:this.audience.trim().slice(0,120) };
    try {
      await this.library.initialize(); this.phase.set("analyzing");
      const savedTemplates = await this.library.templates();
      this.availableTemplates = [
        ...templateCatalog(this.channel),
        ...savedTemplates.filter((template) => template.source === "user" && template.channel === this.channel),
      ];
      const assets = await this.library.assets();
      let plan: EditorialPlan;
      let mode: ContentProject["generationMode"] = "local-fallback";
      if (useLocalFallback) {
        plan = buildLocalEditorialPlan(this.sourceText,preferences);
      } else {
        this.phase.set("narrative");
        try {
          plan = await this.generation.generatePlan({
            brand:this.brand,
            sourceText:this.sourceText,
            preferences,
            availableAssets:assets.slice(0,80).map((item)=>({id:item.id,name:item.name,technology:item.technology,tags:item.tags})),
            availableTemplates:this.availableTemplates.filter((template)=>template.source==="user").slice(0,40).map((template)=>({
              id:template.recipeId,name:template.name,role:template.slideRole,style:template.style,density:template.density,
              contentTypes:template.selection?.contentTypes ?? template.compatibleContentTypes,
              intent:template.selection?.intent,keywords:template.selection?.keywords,avoidWhen:template.selection?.avoidWhen,
              assetRequirement:template.assetRequirement,
            })),
            // El draft aprobado da contexto editorial: title, takeaways y fuentes
            // ayudan a la IA a extraer ideas específicas en vez de headers genéricos.
            draft: this.draft ? {
              title: this.draft.title,
              category: this.draft.category,
              keyTakeaways: this.draft.keyTakeaways,
              sources: this.draft.sources.map((item)=>item.title),
            } : undefined,
          });
          mode = "ai";
        } catch (err) {
          const detail = err instanceof Error ? err.message : String(err);
          console.warn("[Polyedro] Editorial IA no disponible, usando planner local:", detail);
          this.aiWarning.set(detail);
          plan = buildLocalEditorialPlan(this.sourceText,preferences);
        }
      }
      this.phase.set("assets");
      plan = this.normalizePlan(plan);
      const iconConcepts = plan.slides.map((s) => s.iconConcept).filter(Boolean);
      let koboyoIcons: Record<string, string> = {};
      if (iconConcepts.length) {
        try {
          const found = await this.generation.findKoboyoIcons(iconConcepts, 1);
          const slugByConcept: Record<string, string> = {};
          for (const [concept, icons] of Object.entries(found.icons)) {
            if (icons[0]) slugByConcept[concept] = icons[0].slug;
          }
          const allSlugs = [...new Set(Object.values(slugByConcept))];
          if (allSlugs.length) {
            const svgResult = await this.generation.getKoboyoIconsSvg(allSlugs);
            const svgBySlug = Object.fromEntries(svgResult.icons.map((s) => [s.slug, s.svg]));
            for (const [concept, slug] of Object.entries(slugByConcept)) {
              if (svgBySlug[slug]) koboyoIcons[concept] = svgBySlug[slug];
            }
          }
        } catch { /* Koboyo es opcional: si falla, se usa el diseño base */ }
      }
      await this.persistProposal(plan,preferences,mode,koboyoIcons);
    } catch (error) {
      this.phase.set("error");
      this.error.set(error instanceof Error ? error.message : "No se pudo crear la propuesta.");
    }
  }

  private normalizePlan(plan: EditorialPlan): EditorialPlan {
    const available = this.availableTemplates.length ? this.availableTemplates : templateCatalog(this.channel);
    const requestedCount = this.format === "single" ? 1 : this.slideCount === "auto" ? Math.min(10, Math.max(this.format === "carousel" ? 2 : 1, plan.slides.length)) : this.slideCount;
    const sourceSentences = this.sourceText.split(/\n+|[.!?]\s+/).map((item)=>item.replace(/\s+/g," ").trim()).filter((item)=>item.length>24);
    const blueprint = resolveArcSafely(plan.narrativeArc, plan.contentType);
    const sequence = expandSequence(blueprint, requestedCount);
    const proposalSlides = [...plan.slides];
    while (proposalSlides.length < requestedCount) {
      const index = proposalSlides.length;
      const body = sourceSentences[Math.max(0,index-1) % Math.max(1,sourceSentences.length)] ?? this.sourceText.trim();
      const role = sequence[index] ?? "step";
      const intention = slideIntention(blueprint, index, requestedCount);
      const idea = this.stripLead(body);
      const headline = role === "intro"
        ? this.compact(`Por qué importa: ${idea}`, 64)
        : role === "summary"
          ? this.compact(`La conclusión: ${idea}`, 64)
          : role === "cta"
            ? this.compact(blueprint.closingRule(this.goal).cta, 64)
            : this.compact(idea, 64);
      proposalSlides.push({id:crypto.randomUUID(),role,headline,body:this.compact(`${intention} ${idea}`,230),keyPoint:this.compact(idea,120),recipeId:pickRecipeForArc(blueprint,role,plan.contentType),assetQueries:plan.entities,iconConcept:""});
    }
    let previous = "";
    const slides = proposalSlides.slice(0,requestedCount).map((slide,index)=>{
      const role: EditorialSlidePlan["role"] = sequence[index] ?? (requestedCount===1 ? "summary" : index===0 ? "cover" : index===requestedCount-1 ? "cta" : "step");
      const direct = available.find((item)=>item.recipeId===slide.recipeId || item.id===slide.recipeId);
      const resolvedRecipeId = direct?.recipeId ?? resolveRecipeId(slide.recipeId, role);
      let candidate = available.find((item)=>item.recipeId===resolvedRecipeId);
      const context = {
        channel:this.channel,role,contentType:plan.contentType,headline:slide.headline,body:slide.body,keyPoint:slide.keyPoint,
        visualStyle:plan.visualStyle,hasAssets:Boolean(slide.assetQueries.length || slide.iconConcept || slide.diagram),excludeRecipeId:previous,
      };
      const personalMatch = bestTemplateForContext(available.filter((item)=>item.source==="user"),context);
      if (slide.diagram) candidate = available.find((item)=>item.recipeId==="micro-diagram") ?? candidate;
      else if (direct?.source === "user" && direct.recipeId !== previous) candidate = direct;
      else if (personalMatch && personalMatch.score >= 70) candidate = personalMatch.template;
      else if (!candidate || candidate.recipeId === previous) candidate = bestTemplateForContext(available,context)?.template;
      const recipeId = candidate?.recipeId ?? available.find((item)=>item.recipeId!==previous)?.recipeId ?? "cover";
      previous = recipeId;
      return {...slide,role,id:slide.id || crypto.randomUUID(),recipeId,headline:index===0 ? (plan.hookCandidates.find((item)=>item.id===plan.selectedHookId)?.text ?? slide.headline) : slide.headline};
    });
    return {...plan,recommendedSlideCount:slides.length,recommendedFormat:slides.length===1?"single":"carousel",slides};
  }

  private compact(value:string,max:number){const clean=value.replace(/\s+/g," ").trim();return clean.length<=max?clean:`${clean.slice(0,max).replace(/\s+\S*$/,"")}…`}

  /** Quita leads genéricos del source ("en este post", "primero", "por eso")
   *  para que el fallback de slide no arranque con relleno. */
  private stripLead(value:string){return this.compact(value,230).replace(/^(en este (artículo|post|carousel)|hoy|vamos a|primero|despu[eé]s|por eso|ahora|resultado:?)\s+/i,"").replace(/[.]$/,"")}

  private async persistProposal(plan: EditorialPlan, preferences: ContentPreferences, generationMode: ContentProject["generationMode"], koboyoIcons: Record<string, string> = {}) {
    this.phase.set("scenes");
    const projectId = crypto.randomUUID();
    for (const [index,item] of plan.slides.entries()) {
      const slide: EditorialSlide = {id:item.id,post_id:projectId,slide_order:index+1,headline:item.headline,body:item.body,composition:item.recipeId,image_url:null};
      const template = this.availableTemplates.find((candidate)=>candidate.recipeId===item.recipeId || candidate.id===item.recipeId)
        ?? templateByRecipe(preferences.channel,item.recipeId,item.role);
      if (!template) throw new Error(`No existe la receta ${item.recipeId}`);
      const iconSvg = item.iconConcept ? koboyoIcons[item.iconConcept] : undefined;
      const scene = compileScene(slide,this.brand,preferences.channel,template,iconSvg,item.diagram);
      await this.library.saveScene(applyCarouselContinuity(scene,index,plan.slides.length));
    }
    const timestamp = new Date().toISOString();
    const project: ContentProject = {id:projectId,brandId:this.brandId,sourceText:this.sourceText,preferences,plan,slideOrder:plan.slides.map((item)=>item.id),selectedSlideId:plan.slides[0].id,status:"draft",generationMode,koboyoIcons,topicDraftId:this.draft?.id,topicDraft:this.draft ?? undefined,createdAt:timestamp,updatedAt:timestamp};
    await this.library.saveProject(project);
    await this.router.navigate(["/brands",this.brandId,"content",projectId,"edit"]);
  }
}
