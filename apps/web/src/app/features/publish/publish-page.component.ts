import { CommonModule } from "@angular/common";
import { Component, OnInit, signal, computed } from "@angular/core";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { LOCAL_BRAND } from "../../editorial-presets";
import type { ContentProject, EditorialSlidePlan } from "../content/content.models";
import type { SceneDocument } from "../editor/editor.models";
import { LocalLibraryService } from "../editor/local-library.service";
import { ExportService } from "../editor/export.service";
import { GenerationService } from "../generation/generation.service";
import { SceneThumbnailComponent } from "../editor/scene-thumbnail.component";
import { AppHeaderComponent } from "../../shared/app-header.component";

/** Pantalla de finalización: resume el proyecto (idea + storyboard + copys) y
 *  permite descargar el carrusel y copiar el caption para publicar en redes. */
@Component({
  selector: "poly-publish-page",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SceneThumbnailComponent, AppHeaderComponent],
  templateUrl: "./publish-page.component.html",
  styleUrl: "./publish-page.component.css",
})
export class PublishPageComponent implements OnInit {
  readonly brand = LOCAL_BRAND;
  readonly project = signal<ContentProject | null>(null);
  readonly scenes = signal<Record<string, SceneDocument>>({});
  readonly loading = signal(true);
  readonly missing = signal(false);
  readonly exporting = signal(false);
  readonly notice = signal<string | null>(null);
  readonly captionCopied = signal(false);
  readonly slideCopied = signal<number | null>(null);
  readonly brandId = this.route.snapshot.paramMap.get("brandId") ?? LOCAL_BRAND.id;
  readonly postId = this.route.snapshot.paramMap.get("postId")!;
  readonly copyMode = signal<"short" | "long">("short");
  readonly copyText = signal("");
  readonly copyGenerating = signal(false);
  readonly copyError = signal<string | null>(null);

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly library: LocalLibraryService,
    private readonly exporter: ExportService,
    private readonly generation: GenerationService,
  ) {}

  async ngOnInit() {
    await this.library.initialize();
    const project = await this.library.project(this.postId);
    if (!project) {
      this.missing.set(true);
      this.loading.set(false);
      return;
    }
    this.project.set(project);
    const scenes: Record<string, SceneDocument> = {};
    for (const slideId of project.slideOrder) {
      const scene = await this.library.scene(`scene-${slideId}`);
      if (scene) scenes[slideId] = scene;
    }
    this.scenes.set(scenes);
    this.loading.set(false);
  }

  readonly slides = computed(() => {
    const project = this.project();
    if (!project) return [];
    return project.slideOrder.map((id, i) => {
      const plan = project.plan.slides.find((s) => s.id === id);
      const scene = this.scenes()[id];
      return { id, index: i + 1, plan, scene };
    });
  });

  readonly activeHook = computed(() => {
    const plan = this.project()?.plan;
    return plan?.hookCandidates.find((h) => h.id === plan.selectedHookId) ?? plan?.hookCandidates[0];
  });

  /** Borrador del artículo (TopicDraft aprobado) que originó este proyecto. */
  readonly article = computed(() => this.project()?.topicDraft ?? null);
  readonly articleCopied = signal(false);

  get articleText(): string {
    const draft = this.article();
    if (!draft) return "";
    const sources = draft.sources.length
      ? `\n\nFuentes:\n${draft.sources.map((s) => `- ${s.title}: ${s.url}`).join("\n")}`
      : "";
    return `# ${draft.title}\n\n${draft.body}${sources}`;
  }

  get captionText(): string {
    const project = this.project();
    if (!project) return "";
    const plan = project.plan;
    const hashtags = this.extractHashtags(plan.topic);
    return `${plan.caption}\n\n${hashtags}`;
  }

  async copyArticle() {
    try {
      await navigator.clipboard.writeText(this.articleText);
      this.articleCopied.set(true);
      setTimeout(() => this.articleCopied.set(false), 2500);
    } catch {
      this.notice.set("No se pudo copiar el artículo.");
    }
  }

  slideCopy(slide: EditorialSlidePlan, index: number): string {
    const project = this.project()!;
    const isCover = index === 0;
    const hook = this.activeHook();
    const headline = isCover && hook ? hook.text : slide.headline;
    return `${headline}\n\n${slide.body}`;
  }

  private extractHashtags(topic: string): string {
    const words = topic.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean).slice(0, 5);
    const defaults = ["dev", "tech", "programacion"];
    const tags = [...new Set([...words, ...defaults])].slice(0, 8);
    return tags.map((t) => `#${t}`).join(" ");
  }

  async copyCaption() {
    try {
      await navigator.clipboard.writeText(this.captionText);
      this.captionCopied.set(true);
      setTimeout(() => this.captionCopied.set(false), 2500);
    } catch {
      this.notice.set("No se pudo copiar. Seleccioná el texto manualmente.");
    }
  }

  async copySlideCopy(index: number, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      this.slideCopied.set(index);
      setTimeout(() => this.slideCopied.set(null), 2500);
    } catch { /* noop */ }
  }

  /** Genera el copy para redes con IA: caption corto o post largo, según
   *  copyMode. Anclado al contexto real del proyecto (topic, hook, slides). */
  async generateCopyForNetworks() {
    const project = this.project();
    if (!project || this.copyGenerating()) return;
    this.copyGenerating.set(true);
    this.copyError.set(null);
    try {
      const plan = project.plan;
      const result = await this.generation.generateCopy({
        mode: this.copyMode(),
        topic: plan.topic,
        contentType: plan.contentType,
        goal: project.preferences.goal,
        audience: project.preferences.audience,
        caption: plan.caption,
        hook: this.activeHook()?.text,
        channel: project.preferences.channel,
        slides: plan.slides.map((s) => ({ role: s.role, headline: s.headline, body: s.body })),
        brand: { name: this.brand.name, description: this.brand.description },
      });
      this.copyText.set(result.copy.copy);
    } catch (error) {
      this.copyError.set(error instanceof Error ? error.message : "No se pudo generar el copy.");
    } finally {
      this.copyGenerating.set(false);
    }
  }

  copyForMode(): string {
    if (this.copyMode() === "long") return this.copyText();
    return this.copyText() || this.captionText;
  }

  async copyNetworkCopy() {
    try {
      await navigator.clipboard.writeText(this.copyForMode());
      this.captionCopied.set(true);
      setTimeout(() => this.captionCopied.set(false), 2500);
    } catch {
      this.notice.set("No se pudo copiar el copy.");
    }
  }

  async downloadZip() {
    const project = this.project();
    if (!project || this.exporting()) return;
    const scenes = project.slideOrder.map((id) => this.scenes()[id]).filter((s): s is SceneDocument => Boolean(s));
    if (!scenes.length) return;
    this.exporting.set(true);
    this.notice.set("Preparando ZIP de PNGs…");
    try {
      const slug = project.plan.topic.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "carrusel";
      await this.exporter.exportCarouselZip(scenes, `${slug}-instagram.zip`);
      this.notice.set("ZIP descargado con los PNGs en orden.");
    } catch (error) {
      this.notice.set(error instanceof Error ? error.message : "No se pudo exportar.");
    } finally {
      this.exporting.set(false);
    }
  }
}
