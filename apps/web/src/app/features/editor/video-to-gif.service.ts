import { Injectable } from "@angular/core";
import { GIFEncoder, applyPalette, quantize } from "gifenc";

/** Convierte un archivo de video (mp4/webm/mov) en un GIF animado extrayendo
 *  frames del <video> a un canvas y codificándolos con gifenc. Pensado para
 *  demos cortas (repositorios, features) que se insertan en una lámina.
 *
 *  Límites: máx 10s, máx 15fps, ancho máx 600px. El GIF se devuelve como Blob
 *  listo para guardar en la biblioteca o insertar en el canvas. */
@Injectable({ providedIn: "root" })
export class VideoToGifService {
  private readonly maxDuration = 10;
  private readonly fps = 12;
  private readonly maxWidth = 600;

  async convert(file: File, onProgress?: (pct: number) => void): Promise<{ blob: Blob; width: number; height: number; duration: number; frames: number }> {
    const url = URL.createObjectURL(file);
    try {
      const video = await this.loadVideo(url);
      const duration = Math.min(video.duration || this.maxDuration, this.maxDuration);
      const frameCount = Math.min(Math.floor(duration * this.fps), this.maxDuration * this.fps);
      const { width, height } = this.fitSize(video.videoWidth, video.videoHeight);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

      const gif = GIFEncoder();
      const delay = Math.round(1000 / this.fps);

      for (let i = 0; i < frameCount; i++) {
        const t = (i / this.fps);
        await this.seek(video, t);
        ctx.drawImage(video, 0, 0, width, height);
        const { data } = ctx.getImageData(0, 0, width, height);
        const palette = quantize(data, 256);
        const indexed = applyPalette(data, palette);
        gif.writeFrame(indexed, width, height, { palette, delay });
        onProgress?.(Math.round((i / frameCount) * 100));
      }

      gif.finish();
      const bytes = gif.bytes();
      return { blob: new Blob([bytes as BlobPart], { type: "image/gif" }), width, height, duration, frames: frameCount };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  private fitSize(vw: number, vh: number) {
    const scale = Math.min(1, this.maxWidth / Math.max(1, vw));
    return { width: Math.round(vw * scale), height: Math.round(vh * scale) };
  }

  private loadVideo(url: string): Promise<HTMLVideoElement> {
    return new Promise((resolve, reject) => {
      const v = document.createElement("video");
      v.muted = true;
      v.playsInline = true;
      v.preload = "auto";
      v.crossOrigin = "anonymous";
      v.onloadeddata = () => resolve(v);
      v.onerror = () => reject(new Error("No se pudo cargar el video. ¿Formato compatible?"));
      v.src = url;
    });
  }

  private seek(video: HTMLVideoElement, time: number): Promise<void> {
    return new Promise((resolve) => {
      const handler = () => { video.removeEventListener("seeked", handler); resolve(); };
      video.addEventListener("seeked", handler);
      video.currentTime = Math.min(time, (video.duration || this.maxDuration) - 0.05);
    });
  }
}
