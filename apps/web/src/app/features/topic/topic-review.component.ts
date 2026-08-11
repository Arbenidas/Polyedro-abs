import { CommonModule } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { LOCAL_BRAND } from "../../editorial-presets";
import { LocalLibraryService } from "../editor/local-library.service";
import { GenerationService } from "../generation/generation.service";
import { AppHeaderComponent } from "../../shared/app-header.component";
import type { TopicDraft, TopicSource } from "./topic.models";

/** Pantalla de revisión del post largo (Fase 2 del flujo). Muestra el draft
 *  editable + fuentes + takeaways. "Aprobar y generar propuestas" lanza el
 *  plan editorial con el body aprobado como sourceText. */
@Component({
  selector: "poly-topic-review",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AppHeaderComponent],
  templateUrl: "./topic-review.component.html",
  styleUrl: "./topic-review.component.css",
})
export class TopicReviewComponent implements OnInit {
  readonly brand = LOCAL_BRAND;
  readonly draft = signal<TopicDraft | null>(null);
  readonly loading = signal(true);
  readonly missing = signal(false);
  readonly building = signal(false);
  readonly error = signal<string | null>(null);
  readonly savedNotice = signal<string | null>(null);
  readonly title = signal("");
  readonly body = signal("");
  readonly takeaways = signal<string[]>([]);
  readonly brandId = this.route.snapshot.paramMap.get("brandId") ?? LOCAL_BRAND.id;
  readonly draftId = this.route.snapshot.paramMap.get("draftId")!;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly library: LocalLibraryService,
    private readonly generation: GenerationService,
  ) {}

  async ngOnInit() {
    await this.library.initialize();
    const draft = await this.library.topicDraft(this.draftId);
    if (!draft) {
      this.missing.set(true);
      this.loading.set(false);
      return;
    }
    this.draft.set(draft);
    this.title.set(draft.title);
    this.body.set(draft.body);
    this.takeaways.set(draft.keyTakeaways);
    this.loading.set(false);
  }

  get sources(): TopicSource[] {
    return this.draft()?.sources ?? [];
  }

  get wordCount(): number {
    return this.body().split(/\s+/).filter(Boolean).length;
  }

  async saveChanges() {
    const draft = this.draft();
    if (!draft) return;
    const next: TopicDraft = {
      ...draft,
      title: this.title().trim() || draft.title,
      body: this.body(),
      keyTakeaways: this.takeaways().map((item) => item.trim()).filter(Boolean),
    };
    await this.library.saveTopicDraft(next);
    this.draft.set(next);
    this.savedNotice.set("Cambios guardados localmente.");
    window.setTimeout(() => this.savedNotice.set(null), 2500);
  }

  updateTakeaway(index: number, value: string) {
    this.takeaways.update((items) => items.map((item, i) => (i === index ? value : item)));
  }

  addTakeaway() {
    this.takeaways.update((items) => [...items, ""]);
  }

  removeTakeaway(index: number) {
    this.takeaways.update((items) => items.filter((_, i) => i !== index));
  }

  async approveAndBuild() {
    const draft = this.draft();
    if (!draft || this.building()) return;
    this.building.set(true);
    this.error.set(null);
    try {
      const sourceText = this.body().trim();
      if (sourceText.length < 40) throw new Error("El post está muy corto. Escribí al menos un párrafo antes de aprobar.");
      const next: TopicDraft = {
        ...draft,
        title: this.title().trim() || draft.title,
        body: sourceText,
        keyTakeaways: this.takeaways().map((item) => item.trim()).filter(Boolean),
      };
      await this.library.saveTopicDraft(next);
      await this.router.navigate(["/brands", this.brandId, "content", "new"], {
        queryParams: { draftId: next.id },
      });
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : "No se pudo aprobar el tema.");
      this.building.set(false);
    }
  }
}
