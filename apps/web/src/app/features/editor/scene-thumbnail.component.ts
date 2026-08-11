import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, Input } from "@angular/core";
import type { SceneDocument, SceneElement } from "./editor.models";

@Component({
  selector: "poly-scene-thumbnail",
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="scene" *ngIf="scene" [style.background]="scene.background" [style.aspect-ratio]="scene.width + ' / ' + scene.height">
      <ng-container *ngFor="let item of scene.elements">
        <div *ngIf="item.visible && item.type === 'text'" class="element text" [ngStyle]="elementStyle(item)">{{ item.content }}</div>
        <div *ngIf="item.visible && ['rect','circle','ellipse','line','arrow'].includes(item.type)" class="element shape" [class.arrow]="item.type === 'arrow'" [ngStyle]="elementStyle(item)"><span *ngIf="item.type === 'arrow'">→</span></div>
        <img *ngIf="item.visible && item.type === 'image' && item.src" class="element media" [ngStyle]="elementStyle(item)" [src]="item.src" [alt]="item.name">
        <div *ngIf="item.visible && item.type === 'svg' && item.svg" class="element media svg" [ngStyle]="elementStyle(item)" [innerHTML]="item.svg"></div>
      </ng-container>
    </div>
  `,
  styles: [`
    :host { display:block; min-width:0; }
    .scene { position:relative; width:100%; overflow:hidden; container-type:inline-size; }
    .element { position:absolute; box-sizing:border-box; transform-origin:top left; overflow:hidden; }
    .text { white-space:pre-line; overflow-wrap:anywhere; }
    .shape.arrow { display:flex; overflow:visible; align-items:center; justify-content:center; border:0 !important; background:transparent !important; }
    .shape.arrow span { width:100%; font-size:11cqw; line-height:1; text-align:center; }
    .media { object-fit:cover; }
    .svg ::ng-deep svg { display:block; width:100%; height:100%; }
  `],
})
export class SceneThumbnailComponent {
  @Input({ required: true }) scene!: SceneDocument;

  elementStyle(item: SceneElement) {
    const scene = this.scene;
    const width = item.width * item.scaleX;
    const height = item.height * item.scaleY;
    const radius = item.type === "circle" ? "50%" : item.type === "ellipse" ? "50%" : `${(item.radius ?? 0) / scene.width * 100}cqw`;
    const modeFilter = item.imageFilterMode === "bitmap" || item.imageFilterMode === "cross-stitch" ? " grayscale(1) contrast(1.35)" : item.imageFilterMode === "sepia" ? " sepia(1)" : item.imageFilterMode === "invert" ? " invert(1)" : "";
    return {
      left: `${item.x / scene.width * 100}%`, top: `${item.y / scene.height * 100}%`,
      width: `${width / scene.width * 100}%`, height: `${Math.max(height, item.strokeWidth ?? 0) / scene.height * 100}%`,
      transform: `rotate(${item.rotation}deg)`, opacity: item.opacity,
      color: item.fill, background: item.type === "rect" || item.type === "circle" || item.type === "ellipse" ? item.fill : "transparent",
      border: item.strokeWidth ? `${Math.max(1, item.strokeWidth / scene.width * 100)}cqw solid ${item.stroke}` : "0",
      borderRadius: radius,
      borderTop: item.type === "line" ? `${Math.max(1, (item.strokeWidth ?? 2) / scene.width * 100)}cqw solid ${item.stroke}` : undefined,
      fontFamily: item.fontFamily, fontWeight: item.fontWeight,
      fontSize: item.fontSize ? `${item.fontSize / scene.width * 100}cqw` : undefined,
      lineHeight: item.lineHeight, letterSpacing: item.charSpacing ? `${item.charSpacing / 1000}em` : undefined,
      textAlign: item.textAlign, zIndex: item.zIndex,
      boxShadow: item.shadowColor ? `${(item.shadowOffsetX ?? 0) / scene.width * 100}cqw ${(item.shadowOffsetY ?? 0) / scene.width * 100}cqw ${(item.shadowBlur ?? 0) / scene.width * 100}cqw ${item.shadowColor}` : undefined,
      filter: item.type === "image" ? `blur(${(item.imageBlur ?? 0) * 18}px) brightness(${1 + (item.imageBrightness ?? 0)}) contrast(${1 + (item.imageContrast ?? 0)}) saturate(${1 + (item.imageSaturation ?? 0)})${modeFilter}` : undefined,
      imageRendering: item.type === "image" && item.imageFilterMode === "mosaic" ? "pixelated" : undefined,
    };
  }
}
