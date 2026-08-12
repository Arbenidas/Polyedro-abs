import { CommonModule } from "@angular/common";
import { Component, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { AppHeaderComponent } from "../../shared/app-header.component";
import { GenerationService } from "../generation/generation.service";
import type { ShortVideoPlatform, ShortVideoScript, ShortVideoSourceMode, TrendCandidate } from "./short-video.models";

@Component({
  selector: "poly-short-video-studio",
  standalone: true,
  imports: [CommonModule, FormsModule, AppHeaderComponent],
  templateUrl: "./short-video-studio.component.html",
  styleUrl: "./short-video-studio.component.css",
})
export class ShortVideoStudioComponent {
  readonly brandId = this.route.snapshot.paramMap.get("brandId") ?? "local-brand";
  readonly trends = signal<TrendCandidate[]>([]);
  readonly script = signal<ShortVideoScript | null>(null);
  readonly selectedTrend = signal<TrendCandidate | null>(null);
  readonly phase = signal<"idle" | "trends" | "script">("idle");
  readonly error = signal<string | null>(null);
  readonly copied = signal(false);

  sourceMode: ShortVideoSourceMode = "topic";
  topic = "";
  focus = "tecnología, producto y diseño";
  platform: ShortVideoPlatform = "both";
  durationSeconds: 15 | 30 | 45 | 60 = 30;
  audience = "personas que construyen productos digitales";
  tone: "direct" | "curious" | "contrarian" | "story" = "direct";

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly generation: GenerationService,
  ) {
    const seededTopic = this.route.snapshot.queryParamMap.get("topic")?.trim();
    const seededAngle = this.route.snapshot.queryParamMap.get("angle")?.trim();
    if (seededTopic) this.topic = seededAngle ? `${seededTopic}. Enfoque: ${seededAngle}` : seededTopic;
  }

  async setSourceMode(mode: ShortVideoSourceMode) {
    this.sourceMode = mode;
    this.script.set(null);
    this.error.set(null);
    this.selectedTrend.set(null);
    if (mode !== "topic" && !this.trends().length) await this.loadTrends();
  }

  async loadTrends() {
    if (this.sourceMode === "topic" || this.phase() !== "idle") return;
    this.phase.set("trends"); this.error.set(null); this.trends.set([]);
    try {
      const response = await this.generation.discoverShortVideoTrends(this.sourceMode, this.focus.trim() || undefined);
      this.trends.set(response.trends);
    } catch (error) {
      this.error.set(this.describeError(error, "No pudimos consultar tendencias reales."));
    } finally {
      this.phase.set("idle");
    }
  }

  chooseTrend(trend: TrendCandidate) {
    this.selectedTrend.set(trend);
    this.topic = trend.title;
    this.script.set(null);
    this.error.set(null);
  }

  async generate() {
    const topic = this.topic.trim();
    if (topic.length < 3 || this.phase() !== "idle") return;
    this.phase.set("script"); this.error.set(null); this.script.set(null);
    const trend = this.selectedTrend();
    try {
      const response = await this.generation.generateShortVideoScript({
        sourceMode: this.sourceMode === "topic" ? "topic" : "trend",
        topic,
        platform: this.platform,
        durationSeconds: this.durationSeconds,
        audience: this.audience.trim() || undefined,
        tone: this.tone,
        goal: "teach",
        sources: trend ? [{ title: trend.title, url: trend.sourceUrl, snippet: trend.summary }] : undefined,
      });
      this.script.set(response.script);
    } catch (error) {
      this.error.set(this.describeError(error, "No pudimos construir el guion."));
    } finally {
      this.phase.set("idle");
    }
  }

  async copyScript() {
    const script = this.script();
    if (!script) return;
    await navigator.clipboard.writeText(this.asPlainText(script));
    this.copied.set(true);
    window.setTimeout(() => this.copied.set(false), 1800);
  }

  async convertToPublication() {
    const script = this.script();
    if (!script) return;
    localStorage.setItem("polyedro-pending-content-seed", this.asEditorialSeed(script));
    await this.router.navigate(["/brands", this.brandId, "content", "new"], { queryParams: { from: "short-video" } });
  }

  beatLabel(purpose: ShortVideoScript["beats"][number]["purpose"]) {
    return ({ hook: "Hook", context: "Contexto", proof: "Evidencia", payoff: "Conclusión", cta: "Cierre" } as const)[purpose];
  }

  private asPlainText(script: ShortVideoScript) {
    const timeline = script.beats.map((beat) => `${beat.startSecond}–${beat.endSecond}s · ${this.beatLabel(beat.purpose)}\nVOZ: ${beat.voiceover}\nPANTALLA: ${beat.onScreenText}\nVISUAL: ${beat.visualDirection}\nEDICIÓN: ${beat.editCue}`).join("\n\n");
    return `${script.hook}\n\nPROMESA\n${script.promise}\n\n${timeline}\n\nCAPTION\n${script.caption}\n\nCTA\n${script.cta}\n\n${script.hashtags.join(" ")}`;
  }

  private asEditorialSeed(script: ShortVideoScript) {
    const points = script.beats.map((beat) => `- ${this.beatLabel(beat.purpose)}: ${beat.voiceover}`).join("\n");
    const sources = script.sources.map((source) => `- ${source.title}: ${source.url}`).join("\n");
    return `${script.topic}\n\nHook: ${script.hook}\nPromesa: ${script.promise}\n\nPuntos del guion:\n${points}\n\nConclusión: ${script.cta}${sources ? `\n\nFuentes:\n${sources}` : ""}`;
  }

  private describeError(error: unknown, fallback: string) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("TAVILY_API_KEY_MISSING")) return `${fallback} Falta configurar TAVILY_API_KEY en el servidor; no mostraremos tendencias inventadas.`;
    return `${fallback} ${message}`;
  }
}
