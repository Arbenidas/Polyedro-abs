export const GUIDE_TOUR_START_EVENT = "polyedro:guide-tour-start";

export function requestGuideTourStart(): void {
  window.dispatchEvent(new CustomEvent(GUIDE_TOUR_START_EVENT));
}
