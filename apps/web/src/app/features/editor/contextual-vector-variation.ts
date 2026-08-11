export function contextualVectorSource(focus: string | undefined, headline: string, body: string) {
  return [focus?.trim(), headline.trim(), body.trim()].filter(Boolean).join(" ");
}

const LEGACY_VARIATION_ORNAMENT = /<g\s+data-contextual-variation=(['"])[^'"]+\1[^>]*>[\s\S]*?<\/g>/gi;

/**
 * Older contextual vectors received the same dot-and-arrow ornament on every
 * creation. Remove it at the SVG source so saved assets and scenes migrate
 * without asking the user to recreate them.
 */
export function stripLegacyContextualOrnament(svg: string) {
  return svg.replace(LEGACY_VARIATION_ORNAMENT, "");
}

export function addFreshVectorVariation(svg: string, signature: string, _ink: string, _accent: string) {
  const clean = stripLegacyContextualOrnament(svg)
    .replace(/\sdata-contextual-variation=(['"])[^'"]+\1/i, "");
  return clean.replace("<svg", `<svg data-contextual-variation="${signature}"`);
}
