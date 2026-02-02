import sharp from "sharp";
import { uploadBufferToBucket } from "../../helpers/bucket-storage";

export const FRAME_COLORS: Array<{ name: string; hex: string }> = [
  { name: "purple", hex: "#8B5CF6" },
  { name: "green", hex: "#22C55E" },
  { name: "blue", hex: "#3B82F6" },
  { name: "orange", hex: "#F97316" },
  { name: "red", hex: "#EF4444" },
];

const CELL_SIZE = 512;
const BORDER_WIDTH = 10;
const INNER_SIZE = CELL_SIZE - BORDER_WIDTH * 2;

export interface CollageSlot {
  imageUrl: string;
  displayName: string;
}

export interface CollagePosition {
  index: number;
  displayName: string;
  color: { name: string; hex: string };
}

export interface CollageResult {
  collageUrl: string;
  positions: CollagePosition[];
}

/**
 * Creates a horizontal sprite collage from character reference images.
 * Each image is framed with a colored border, arranged left-to-right.
 * Returns null if fewer than 2 images (no collage needed).
 */
export async function buildSpriteCollage(slots: CollageSlot[]): Promise<CollageResult | null> {
  if (slots.length < 2) return null;

  const slotCount = slots.length;
  const totalWidth = CELL_SIZE * slotCount;
  const totalHeight = CELL_SIZE;

  try {
    const cellBuffers = await Promise.all(
      slots.map(async (slot, index) => {
        const color = FRAME_COLORS[index % FRAME_COLORS.length];
        try {
          const imageBuffer = await downloadAndResize(slot.imageUrl);
          return createFramedCell(imageBuffer, color.hex);
        } catch (err) {
          console.warn(`[sprite-collage] Failed to process image for ${slot.displayName}:`, err);
          return null;
        }
      })
    );

    // Filter out failed downloads
    const validEntries: Array<{ buffer: Buffer; slot: CollageSlot; originalIndex: number }> = [];
    for (let i = 0; i < cellBuffers.length; i++) {
      if (cellBuffers[i]) {
        validEntries.push({ buffer: cellBuffers[i]!, slot: slots[i], originalIndex: i });
      }
    }

    if (validEntries.length < 2) {
      console.warn(`[sprite-collage] Only ${validEntries.length} valid images, skipping collage`);
      return null;
    }

    const validWidth = CELL_SIZE * validEntries.length;
    const compositeInputs = validEntries.map((entry, idx) => ({
      input: entry.buffer,
      left: idx * CELL_SIZE,
      top: 0,
    }));

    const collageBuffer = await sharp({
      create: {
        width: validWidth,
        height: totalHeight,
        channels: 4 as const,
        background: { r: 255, g: 255, b: 255, alpha: 255 },
      },
    })
      .composite(compositeInputs)
      .png()
      .toBuffer();

    const uploadResult = await uploadBufferToBucket(collageBuffer, "image/png", {
      prefix: "images/collages",
      filenameHint: `sprite-collage-${validEntries.length}`,
    });

    if (!uploadResult) {
      console.error("[sprite-collage] Failed to upload collage to bucket");
      return null;
    }

    const positions: CollagePosition[] = validEntries.map((entry, idx) => ({
      index: idx,
      displayName: entry.slot.displayName,
      color: FRAME_COLORS[idx % FRAME_COLORS.length],
    }));

    console.log(`[sprite-collage] Created collage with ${validEntries.length} characters (${validWidth}x${totalHeight}px)`);
    return { collageUrl: uploadResult.url, positions };
  } catch (err) {
    console.error("[sprite-collage] Collage creation failed:", err);
    return null;
  }
}

async function downloadAndResize(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  return sharp(Buffer.from(arrayBuffer))
    .resize(INNER_SIZE, INNER_SIZE, { fit: "cover" })
    .png()
    .toBuffer();
}

async function createFramedCell(imageBuffer: Buffer, borderColorHex: string): Promise<Buffer> {
  const { r, g, b } = hexToRgb(borderColorHex);
  return sharp({
    create: {
      width: CELL_SIZE,
      height: CELL_SIZE,
      channels: 4 as const,
      background: { r, g, b, alpha: 255 },
    },
  })
    .composite([{ input: imageBuffer, left: BORDER_WIDTH, top: BORDER_WIDTH }])
    .png()
    .toBuffer();
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 128, g: 128, b: 128 };
}
