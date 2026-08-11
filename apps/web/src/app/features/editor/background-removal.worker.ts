/// <reference lib="webworker" />

const MODEL_ID = "onnx-community/ormbg-ONNX";
const MODEL_REVISION = "33d7cc32d4a8c7a9f9e7654bfc775cf015ae61de";
const TRANSFORMERS_MODULE_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm";

type TransformersModule = typeof import("@huggingface/transformers");

async function loadTransformers(): Promise<TransformersModule> {
  // Keeping the URL in a runtime variable prevents the 47 MB inference runtime
  // from entering the application bundle. The pinned ESM module and model are
  // fetched only when Cutout Lab is used, then cached by the browser.
  return import(/* @vite-ignore */ TRANSFORMERS_MODULE_URL) as Promise<TransformersModule>;
}

addEventListener("message", async ({ data }: MessageEvent<{ blob: Blob }>) => {
  try {
    const hasWebGpu = Boolean((navigator as WorkerNavigator & { gpu?: unknown }).gpu);
    postMessage({ type: "state", label: hasWebGpu ? "Preparando WebGPU…" : "Preparando modo compatible…" });
    const { pipeline } = await loadTransformers();
    const remover = await pipeline("background-removal", MODEL_ID, {
      revision: MODEL_REVISION,
      device: hasWebGpu ? "webgpu" : "wasm",
      dtype: hasWebGpu ? "q4f16" : "q4",
      progress_callback: (progress: Record<string, unknown>) => {
        postMessage({
          type: "progress",
          progress: typeof progress["progress"] === "number" ? progress["progress"] : undefined,
          file: typeof progress["file"] === "string" ? progress["file"] : undefined,
          status: typeof progress["status"] === "string" ? progress["status"] : undefined,
        });
      },
    });
    postMessage({ type: "state", label: "Separando la figura…" });
    const [output] = await remover(data.blob);
    if (!output) throw new Error("El modelo no devolvió una imagen.");
    const rgba = output.rgba();
    const pixels = new Uint8ClampedArray(rgba.data);
    postMessage({ type: "result", width: rgba.width, height: rgba.height, pixels: pixels.buffer }, [pixels.buffer]);
    await remover.dispose();
  } catch (error) {
    postMessage({ type: "error", message: error instanceof Error ? error.message : "No se pudo ejecutar el recorte automático." });
  }
});
