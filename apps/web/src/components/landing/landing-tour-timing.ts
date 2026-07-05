/** Pacing for guide tour — brisk narration with a short beat between sections. */

const SCROLL_SETTLE_MS = 260;
const DEFAULT_SECTION_POST_READ_GAP_MS: number | null = null;
const DEFAULT_SECTION_DWELL_MS = 300;
const DEFAULT_HIGHLIGHT_DWELL_MS = 750;
const DEFAULT_SMOOTH_SCROLL_MS = 1150;
const MIN_SCROLL_MS = 550;
const MAX_SCROLL_MS = 2200;
const SCROLL_DISTANCE_BASE_PX = 700;
const DEFAULT_TTS_SPEED = 1.08;
const SPEAKING_POLL_MS = 100;
const SPEAKING_START_GRACE_MS = 250;
const SPEAKING_WAIT_MAX_MS = 22_000;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseSpeed(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(1.2, Math.max(0.7, parsed));
}

export function getTourSectionDwellMs(): number {
  return parsePositiveInt(process.env.NEXT_PUBLIC_ELEVENLABS_GUIDE_SECTION_DWELL_MS, DEFAULT_SECTION_DWELL_MS);
}

/** Gap after section narration (0 = continuous flow). */
export function getTourSectionPostReadGapMs(): number | null {
  const raw = process.env.NEXT_PUBLIC_ELEVENLABS_GUIDE_SECTION_GAP_MS;
  if (!raw) {
    return DEFAULT_SECTION_POST_READ_GAP_MS;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_SECTION_POST_READ_GAP_MS;
}

export function getTourHighlightDwellMs(): number {
  return parsePositiveInt(process.env.NEXT_PUBLIC_ELEVENLABS_GUIDE_HIGHLIGHT_DWELL_MS, DEFAULT_HIGHLIGHT_DWELL_MS);
}

export function getTourSmoothScrollMs(): number {
  return parsePositiveInt(process.env.NEXT_PUBLIC_ELEVENLABS_GUIDE_SCROLL_MS, DEFAULT_SMOOTH_SCROLL_MS);
}

export function getGuideTtsSpeed(): number {
  return parseSpeed(process.env.NEXT_PUBLIC_ELEVENLABS_GUIDE_TTS_SPEED, DEFAULT_TTS_SPEED);
}

export function getScrollSettleMs(): number {
  return SCROLL_SETTLE_MS;
}

/** Longer jumps get proportionally more time while keeping the tour moving. */
export function resolveScrollDurationMs(distancePx: number): number {
  const baseMs = getTourSmoothScrollMs();
  const scaled = (Math.abs(distancePx) / SCROLL_DISTANCE_BASE_PX) * baseMs;
  return Math.round(Math.min(MAX_SCROLL_MS, Math.max(MIN_SCROLL_MS, scaled)));
}

export function getMaxScrollDurationMs(): number {
  return MAX_SCROLL_MS;
}

function easeInOutQuint(progress: number): number {
  return progress < 0.5
    ? 16 * progress ** 5
    : 1 - (-2 * progress + 2) ** 5 / 2;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/** Eased scroll — duration scales with distance for a clear but brisk transition. */
export async function smoothScrollToElement(
  element: HTMLElement,
  durationMs?: number,
): Promise<void> {
  const headerOffset = 72;
  const startY = window.scrollY;
  const targetY = element.getBoundingClientRect().top + window.scrollY - headerOffset;
  const distance = targetY - startY;

  if (Math.abs(distance) < 8) {
    return;
  }

  const scrollMs = durationMs ?? resolveScrollDurationMs(distance);
  const startedAt = performance.now();

  await new Promise<void>((resolve) => {
    const step = (now: number) => {
      const elapsed = now - startedAt;
      const progress = Math.min(elapsed / scrollMs, 1);
      const eased = easeInOutQuint(progress);

      window.scrollTo({ top: startY + distance * eased, left: 0 });

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        resolve();
      }
    };

    requestAnimationFrame(step);
  });

  await sleep(SCROLL_SETTLE_MS);
}

/** Waits until the agent finishes the current narration beat. */
export async function waitForAgentSpeechToFinish(isSpeaking?: () => boolean): Promise<void> {
  if (!isSpeaking) {
    return;
  }

  const startedAt = Date.now();
  const speakStartDeadline = Date.now() + SPEAKING_START_GRACE_MS;

  while (!isSpeaking() && Date.now() < speakStartDeadline) {
    await sleep(SPEAKING_POLL_MS);
  }

  if (!isSpeaking()) {
    return;
  }

  while (isSpeaking() && Date.now() - startedAt < SPEAKING_WAIT_MAX_MS) {
    await sleep(SPEAKING_POLL_MS);
  }
}

/** Short gap after narration ends, before scrolling to the next section. */
export async function waitBeforeSectionScroll(isSpeaking?: () => boolean): Promise<void> {
  await waitForAgentSpeechToFinish(isSpeaking);

  const gapMs = getTourSectionPostReadGapMs() ?? getTourSectionDwellMs();
  if (gapMs > 0) {
    await sleep(gapMs);
  }
}
