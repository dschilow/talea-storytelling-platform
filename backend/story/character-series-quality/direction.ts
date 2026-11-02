import { directSeriesPictures } from '../character-series/pictures';

/** Reserve the third sheet cell for the central prop on the cover; all avatars still appear inside the book. */
export async function directQualitySeriesPictures(input: Parameters<typeof directSeriesPictures>[0]) {
  return directSeriesPictures({ ...input, llm: request => input.llm({ ...request,
    system: request.system + '\nSHARED DESIGNS: Keep material, scale and distinctive parts fixed; transient states such as wet, open seam, broken or repaired belong only in the current scene, not in the shared object appearance.\nQUALITY COVER OVERRIDE: The cover shows exactly TWO people/creatures: the series lead and ONE participating child avatar, both source-grounded. Reserve the third sheet cell for the central object. Pick a real moment that works with these two participants and name only them in its caption. Every other avatar still appears inside the book. This overrides any earlier request to fit all avatars onto the cover.' }) });
}
