import { Injectable } from "@angular/core";

export type BackgroundRemovalProgress = {
  label: string;
  progress?: number;
};

export type BackgroundRemovalResult = {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
};

@Injectable({ providedIn: "root" })
export class CutoutService {
  removeBackground(
    blob: Blob,
    onProgress: (progress: BackgroundRemovalProgress) => void,
    signal?: AbortSignal,
  ): Promise<BackgroundRemovalResult> {
    const worker = new Worker(new URL("./background-removal.worker", import.meta.url), { type: "module" });
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        worker.terminate();
        signal?.removeEventListener("abort", abort);
      };
      const abort = () => {
        cleanup();
        reject(new DOMException("Recorte cancelado", "AbortError"));
      };
      signal?.addEventListener("abort", abort, { once: true });
      worker.onmessage = ({ data }: MessageEvent<Record<string, unknown>>) => {
        if (data["type"] === "state") {
          onProgress({ label: String(data["label"] ?? "Preparando recorte…") });
          return;
        }
        if (data["type"] === "progress") {
          const raw = typeof data["progress"] === "number" ? data["progress"] : undefined;
          onProgress({
            label: raw === undefined ? "Descargando el modelo local…" : "Descargando el modelo local…",
            progress: raw === undefined ? undefined : raw <= 1 ? raw * 100 : raw,
          });
          return;
        }
        if (data["type"] === "error") {
          cleanup();
          reject(new Error(String(data["message"] ?? "No se pudo ejecutar el recorte automático.")));
          return;
        }
        if (data["type"] === "result") {
          cleanup();
          resolve({
            width: Number(data["width"]),
            height: Number(data["height"]),
            pixels: new Uint8ClampedArray(data["pixels"] as ArrayBuffer),
          });
        }
      };
      worker.onerror = (event) => {
        cleanup();
        reject(new Error(event.message || "El worker de recorte dejó de responder."));
      };
      worker.postMessage({ blob });
    });
  }
}
