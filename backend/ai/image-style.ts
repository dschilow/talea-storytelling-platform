/** The shared illustration medium used by Bruno and Die Monster-Müllabfuhr.
 * Scene, mood, composition and character identity belong to the caller.
 */
export const TALEA_IMAGE_STYLE = "Warm hand-drawn children's book illustration, soft ink outlines, gouache textures, rounded friendly shapes, expressive faces, gentle saturated colors, cozy lighting, a wordless picture where every surface stays plain and unmarked";

// Existing pool exports contain these old style suffixes alongside the identity.
// Match the suffix, preserving the figure's name, clothing, palette and action.
const LEGACY_STYLE_HINTS = [
  /\bAxel Scheffler(?:[- ]inspired)?(?: watercolou?r)?(?: storybook)?(?: illustration)?(?: style)?\b/gi,
  /\b(?:Disney|Pixar|DreamWorks|Studio Ghibli)(?:[- ]inspired)?(?: animation)? style\b/gi,
  /\b(?:traditional )?watercolou?r (?:illustration|storybook style|style)\b/gi,
];

/** Retain complete scene-first captions; restore a style lost to a legacy prompt budget. */
export function withTaleaImageStyle(prompt: string): string {
  if (!prompt.trim()) return prompt;
  let cleaned = prompt;
  for (const pattern of LEGACY_STYLE_HINTS) cleaned = cleaned.replace(pattern, "");
  if (cleaned.includes(TALEA_IMAGE_STYLE)) return cleaned;
  return `${TALEA_IMAGE_STYLE}. ${cleaned}`;
}
