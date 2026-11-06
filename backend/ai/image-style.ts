/** The shared illustration medium used by Bruno and Die Monster-Müllabfuhr.
 * Scene, mood, composition and character identity belong to the caller.
 */
export const TALEA_IMAGE_STYLE = "Warm hand-drawn children's book illustration, soft ink outlines, gouache textures, rounded friendly shapes, expressive faces, gentle saturated colors, cozy lighting, a wordless picture where every surface stays plain and unmarked";

/** A story stores only a trusted catalogue ID, never a client-supplied prompt or URL. */
export type StoryImageStyleId = "talea-originals" | "colored-pencil" | "painterly-adventure";

export interface StoryImageStyleProfile {
  id: Exclude<StoryImageStyleId, "talea-originals">;
  artDirection: string;
  /**
   * The painter's style reference: an abstract swatch of the medium, no figure, object or place. Until 2026-11-06 this
   * was the wizard preview (a curly red-haired girl, round glasses in the painted one, a purple monster, mushrooms), and
   * FLUX.2 klein painted that girl, her glasses and the forest into the stories' scenes. The wizard keeps its preview
   * (frontend/lib/story-image-styles.ts); scripts/image-bench/style-reference-probe.ts measures the swatches.
   */
  referenceUrl: string;
}

const STORY_IMAGE_STYLE_PROFILES: Record<Exclude<StoryImageStyleId, "talea-originals">, StoryImageStyleProfile> = {
  "colored-pencil": {
    id: "colored-pencil",
    // "tangled curls" described the preview girl's hair (wizard prompt of 2026-11-03), not the medium: every child came out curly.
    artDirection: "Hand-drawn COLORED PENCIL on rough ivory paper. Build every colored area from clearly visible individual pencil strokes: loose parallel hatching, curved scribbles following form and crosshatching in shadows. Broken waxy pigment catches on the paper grain; ivory paper remains visible between strokes, including on faces, hair and clothes. Light warm-brown sketch contours, rosy cheeks, gentle flat shapes and supple informal gestures. Fresh leaf-green, warm ochre, terracotta and sky-blue pencils. Every figure and surface must look drawn with colored pencils, without watercolor washes, smooth paint fills or airbrushed gradients. The story scene determines place, light and emotion.",
    referenceUrl: "https://www.talea.website/library/image-styles/colored-pencil-swatch.webp",
  },
  "painterly-adventure": {
    id: "painterly-adventure",
    artDirection: "Lush expressive BRUSH-PAINTED GOUACHE adventure illustration. Playfully exaggerated character proportions, large lively eyes, bouncy organic silhouettes and funny physical gestures. Opaque layered paint masses sculpt faces, hair, fabric and fur into rounded volumes with broad light and shadow, visible bristle marks and chipped dry-brush edges. Saturated emerald, cool ultramarine depth and luminous warm highlights. Dense overlapping painterly forms reaching every edge. Keep the rough painted surface and bold shapes throughout; fine brown ink contours and pencil hatching do not define this medium. The story scene determines place, light and emotion.",
    referenceUrl: "https://www.talea.website/library/image-styles/painterly-adventure-swatch.webp",
  },
};

export function storyImageStyleProfile(id?: StoryImageStyleId): StoryImageStyleProfile | undefined {
  return id === "colored-pencil" || id === "painterly-adventure" ? STORY_IMAGE_STYLE_PROFILES[id] : undefined;
}

// Existing pool exports contain these old style suffixes alongside the identity.
// Match the suffix, preserving the figure's name, clothing, palette and action.
const LEGACY_STYLE_HINTS = [
  /\bAxel Scheffler(?:[- ]inspired)?(?: watercolou?r)?(?: storybook)?(?: illustration)?(?: style)?\b/gi,
  /\b(?:Disney|Pixar|DreamWorks|Studio Ghibli)(?:[- ]inspired)?(?: animation)? style\b/gi,
  /\b(?:traditional )?watercolou?r (?:illustration|storybook style|style)\b/gi,
];

/** Retain complete scene-first captions; restore a style lost to a legacy prompt budget. */
export function withTaleaImageStyle(prompt: string, styleId?: StoryImageStyleId): string {
  if (!prompt.trim()) return prompt;
  let cleaned = prompt;
  for (const pattern of LEGACY_STYLE_HINTS) cleaned = cleaned.replace(pattern, "");
  const profile = storyImageStyleProfile(styleId);
  if (profile) cleaned = cleaned.split(TALEA_IMAGE_STYLE).join("").trim();
  const medium = profile?.artDirection || TALEA_IMAGE_STYLE;
  if (cleaned.includes(medium)) return cleaned;
  return `${medium}. ${cleaned}`;
}
