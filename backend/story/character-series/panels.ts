import sharp from 'sharp';

/**
 * FLUX copied the identity sheet's layout instead of painting a scene twice on 2026-11-02 (stories fa24532b and 571a9c54):
 * two separate panels with a light gutter, one figure in each. The picture reader passed both. A light, even band that
 * runs through almost the whole picture between its outer fifths is a panel gutter, not scenery: a pale wall or sky is
 * interrupted by floor, figures or horizon somewhere along that line.
 */
export async function hasPanelGutter(image: Buffer): Promise<boolean> {
  const { data, info } = await sharp(image, { limitInputPixels: 40_000_000 }).rotate().greyscale().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const at = (x: number, y: number) => data[(y * width + x) * channels];
  const even = (values: number[]) => {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const spread = Math.sqrt(values.reduce((sum, v) => sum + (v - mean) * (v - mean), 0) / values.length);
    return mean >= 225 && spread <= 12;
  };
  // At least three neighbouring lines, so a single pale pole or rope never counts.
  const band = (length: number, from: number, to: number, line: (i: number) => number[]) => {
    let run = 0;
    for (let i = Math.round(length * from); i <= Math.round(length * to); i++) {
      run = even(line(i)) ? run + 1 : 0;
      if (run >= 3) return true;
    }
    return false;
  };
  const rows = (x: number) => Array.from({ length: Math.round(height * 0.92) }, (_, k) => at(x, Math.round(height * 0.04) + k));
  const columns = (y: number) => Array.from({ length: Math.round(width * 0.92) }, (_, k) => at(Math.round(width * 0.04) + k, y));
  return band(width, 0.2, 0.8, rows) || band(height, 0.2, 0.8, columns);
}

/** Production check for a freshly drawn picture; an unreadable picture is left to the vision reader. */
export async function pictureHasPanels(url: string): Promise<boolean> {
  try {
    const inline = url.match(/^data:image\/[a-z]+;base64,(.+)$/i);
    if (inline) return await hasPanelGutter(Buffer.from(inline[1], 'base64'));
    if (!/^https?:\/\//i.test(url)) return false;
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    return response.ok ? await hasPanelGutter(Buffer.from(await response.arrayBuffer())) : false;
  } catch {
    return false;
  }
}
