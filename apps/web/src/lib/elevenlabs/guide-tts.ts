/** Client playback for scripted guide tour narration (exact TTS, no LLM improvisation). */

/** 0.1s of silence — playing it inside the user gesture unlocks the element for later use. */
const SILENT_MP3_DATA_URI =
  "data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7v/////////////////////////////////////////////AAAAAExhdmM1OC4xMwAAAAAAAAAAAAAAACQCgAAAAAAAAAGGDpiVpwAAAAAAAAAAAAAAAAAAAP/7EGQAD/AAAGkAAAAIAAANIAAAAQAAAaQAAAAgAAA0gAAABExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sQZB6P8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=";

let guideAudio: HTMLAudioElement | null = null;
let activeObjectUrl: string | null = null;
let activeAbortController: AbortController | null = null;

/**
 * Must be called synchronously inside a user gesture (click). Plays silence on a
 * persistent element so later programmatic playback isn't blocked by autoplay policy.
 */
export function unlockGuideNarrationAudio(): void {
  if (typeof window === "undefined") {
    return;
  }

  if (!guideAudio) {
    guideAudio = new Audio();
    guideAudio.preload = "auto";
  }

  try {
    guideAudio.muted = false;
    guideAudio.src = SILENT_MP3_DATA_URI;
    void guideAudio.play().catch(() => {
      /* Autoplay policies vary — real playback may still work after the gesture. */
    });
  } catch {
    /* Non-fatal: playback is attempted again per narration. */
  }
}

function releaseObjectUrl(): void {
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = null;
  }
}

/** Stops any in-flight fetch or audio playback for the current narration. */
export function abortGuideNarration(): void {
  activeAbortController?.abort();
  activeAbortController = null;

  if (guideAudio) {
    guideAudio.pause();
    guideAudio.onended = null;
    guideAudio.onerror = null;
  }

  releaseObjectUrl();
}

export type GuideNarrationPlaybackResult = "finished" | "aborted" | "failed";

/** Speaks `text` verbatim via server-side ElevenLabs TTS. */
export async function playGuideNarration(text: string): Promise<GuideNarrationPlaybackResult> {
  abortGuideNarration();

  const controller = new AbortController();
  activeAbortController = controller;

  try {
    const response = await fetch("/api/elevenlabs/guide-tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (controller.signal.aborted) {
      return "aborted";
    }

    if (!response.ok) {
      return "failed";
    }

    const blob = await response.blob();
    if (controller.signal.aborted) {
      return "aborted";
    }

    const objectUrl = URL.createObjectURL(blob);
    activeObjectUrl = objectUrl;

    if (!guideAudio) {
      guideAudio = new Audio();
      guideAudio.preload = "auto";
    }

    const audio = guideAudio;

    return await new Promise<GuideNarrationPlaybackResult>((resolve) => {
      let settled = false;

      const finish = (result: GuideNarrationPlaybackResult) => {
        if (settled) {
          return;
        }
        settled = true;

        audio.onended = null;
        audio.onerror = null;
        releaseObjectUrl();

        if (activeAbortController === controller) {
          activeAbortController = null;
        }

        resolve(result);
      };

      controller.signal.addEventListener("abort", () => finish("aborted"), { once: true });

      audio.onended = () => finish("finished");
      audio.onerror = () => finish("failed");
      audio.src = objectUrl;

      void audio.play().catch((error) => {
        console.warn("[Guide Agent] Narration play() rejected", error);
        finish("failed");
      });
    });
  } catch (error) {
    if (controller.signal.aborted) {
      return "aborted";
    }

    console.warn("[Guide Agent] TTS narration failed", error);
    return "failed";
  }
}
