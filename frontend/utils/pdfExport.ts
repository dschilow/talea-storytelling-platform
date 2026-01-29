/**
 * PDF Export Utility for Talea Stories
 *
 * Exports complete story with cover, chapters, and images as PDF
 * Uses jsPDF library for PDF generation
 */

import { jsPDF } from 'jspdf';
import type { Story } from '../types/story';

// Type definitions for image loading
interface ImageLoadResult {
  success: boolean;
  dataUrl?: string;
  width?: number;
  height?: number;
  error?: string;
}

/**
 * Load an image from URL and convert to data URL for embedding.
 * Uses multiple strategies to handle CORS restrictions:
 * 1. Backend proxy (for bucket/signed URLs with CORS issues)
 * 2. fetch + blob → object URL → canvas (avoids CORS canvas taint)
 * 3. fetch + FileReader → base64 directly (no canvas needed)
 * 4. Image element with crossOrigin → canvas (classic approach)
 */
async function loadImageAsDataUrl(url: string): Promise<ImageLoadResult> {
  // Strategy 0: Backend proxy for bucket images (bypasses CORS entirely)
  if (url.includes('storage.railway.app') || url.includes('X-Amz-Signature')) {
    try {
      const result = await loadImageViaBackendProxy(url);
      if (result.success) return result;
    } catch (error) {
      console.warn('[PDF] Backend proxy strategy failed for:', url, error);
    }
  }

  // Strategy 1: fetch as blob → object URL → canvas (most reliable for cross-origin)
  try {
    const result = await loadImageViaFetch(url);
    if (result.success) return result;
  } catch {
    console.warn('[PDF] Fetch+canvas strategy failed for:', url);
  }

  // Strategy 2: fetch → FileReader → base64 (no canvas at all)
  try {
    const result = await loadImageViaFileReader(url);
    if (result.success) return result;
  } catch {
    console.warn('[PDF] FileReader strategy failed for:', url);
  }

  // Strategy 3: classic Image element with crossOrigin → canvas
  try {
    const result = await loadImageViaCanvasClassic(url);
    if (result.success) return result;
  } catch {
    console.warn('[PDF] Classic canvas strategy failed for:', url);
  }

  console.error('[PDF] All image loading strategies failed for:', url);
  return { success: false, error: 'All image loading strategies failed' };
}

/**
 * Load image via backend proxy endpoint.
 * This bypasses all CORS restrictions by fetching server-side.
 */
async function loadImageViaBackendProxy(url: string): Promise<ImageLoadResult> {
  // Get backend URL from environment
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://backend-2-production-3de1.up.railway.app';

  // Get auth token from Clerk
  let authToken: string | null = null;
  try {
    // Try to get auth token from window.__clerk if available
    const clerk = (window as any).__clerk;
    if (clerk?.session) {
      authToken = await clerk.session.getToken();
    }
  } catch {
    console.warn('[PDF] Could not get auth token for proxy request');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${backendUrl}/story/proxy-image`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ imageUrl: url }),
  });

  if (!response.ok) {
    return { success: false, error: `Proxy request failed: ${response.status}` };
  }

  const data = await response.json();

  if (!data.success || !data.imageData) {
    return { success: false, error: data.error || 'Proxy returned no image data' };
  }

  // Get dimensions from the data URL
  const objectUrl = data.imageData;
  const dimensions = await new Promise<{ width: number; height: number }>((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = () => {
      resolve({ width: 1024, height: 1024 });
    };
    img.src = objectUrl;
  });

  return {
    success: true,
    dataUrl: data.imageData,
    width: dimensions.width,
    height: dimensions.height,
  };
}

/**
 * Fetch image as blob, create object URL, draw to canvas, export as data URL.
 * This avoids CORS canvas taint because the blob data is local.
 */
async function loadImageViaFetch(url: string): Promise<ImageLoadResult> {
  const response = await fetch(url);
  if (!response.ok) {
    return { success: false, error: `Fetch failed: ${response.status}` };
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          resolve({ success: false, error: 'Failed to get canvas context' });
          return;
        }

        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        URL.revokeObjectURL(objectUrl);

        resolve({
          success: true,
          dataUrl,
          width: img.width,
          height: img.height,
        });
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        resolve({ success: false, error: String(error) });
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ success: false, error: 'Failed to load blob image' });
    };

    img.src = objectUrl;
  });
}

/**
 * Fetch image and convert directly to base64 via FileReader (no canvas needed).
 * Gets dimensions by loading as object URL image.
 */
async function loadImageViaFileReader(url: string): Promise<ImageLoadResult> {
  const response = await fetch(url);
  if (!response.ok) {
    return { success: false, error: `Fetch failed: ${response.status}` };
  }

  const blob = await response.blob();

  // Convert blob to base64 data URL via FileReader
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('FileReader did not return string'));
      }
    };
    reader.onerror = () => reject(new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });

  // Get dimensions by loading as object URL
  const objectUrl = URL.createObjectURL(blob);
  const dimensions = await new Promise<{ width: number; height: number }>((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
      URL.revokeObjectURL(objectUrl);
    };
    img.onerror = () => {
      resolve({ width: 1024, height: 1024 });
      URL.revokeObjectURL(objectUrl);
    };
    img.src = objectUrl;
  });

  return {
    success: true,
    dataUrl,
    width: dimensions.width,
    height: dimensions.height,
  };
}

/**
 * Classic approach: Image element with crossOrigin → canvas → dataURL.
 * May fail with CORS restrictions on some image servers.
 */
async function loadImageViaCanvasClassic(url: string): Promise<ImageLoadResult> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ success: false, error: 'Failed to get canvas context' });
          return;
        }

        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

        resolve({
          success: true,
          dataUrl,
          width: img.width,
          height: img.height,
        });
      } catch (error) {
        resolve({ success: false, error: String(error) });
      }
    };

    img.onerror = () => {
      resolve({ success: false, error: 'Failed to load image with CORS' });
    };

    img.src = url;
  });
}

/**
 * Add text with automatic word wrapping
 */
function addWrappedText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const lines = doc.splitTextToSize(text, maxWidth);
  let currentY = y;

  lines.forEach((line: string) => {
    // Check if we need a new page
    if (currentY > 280) {
      doc.addPage();
      currentY = 20;
    }

    doc.text(line, x, currentY);
    currentY += lineHeight;
  });

  return currentY;
}

/**
 * Export story as PDF
 *
 * @param story - Story object with chapters and images
 * @param onProgress - Optional callback for progress updates (0-100)
 */
export async function exportStoryAsPDF(
  story: Story,
  onProgress?: (progress: number) => void
): Promise<void> {
  try {
    // Create PDF document (A4 format)
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);

    // Support both 'chapters' and 'pages' field names
    const chapters = story.chapters || story.pages || [];

    console.log('[PDF Export] Story data:', {
      hasChapters: !!story.chapters,
      hasPages: !!story.pages,
      chaptersLength: chapters.length,
      storyTitle: story.title,
      storyKeys: Object.keys(story),
      firstChapter: chapters.length > 0 ? {
        title: chapters[0].title,
        contentLength: chapters[0].content.length,
        hasImage: !!chapters[0].imageUrl
      } : null
    });

    // Early validation
    if (!chapters || chapters.length === 0) {
      console.error('[PDF Export] ERROR: No chapters found!', {
        storyId: story.id,
        status: story.status,
        fullStoryObject: story
      });
      throw new Error('Geschichte hat keine Kapitel. Bitte stelle sicher, dass die Geschichte vollständig geladen ist.');
    }

    // Calculate total steps for progress
    const totalSteps = 1 + chapters.length * 2; // Cover + (chapter text + image) * chapters
    let currentStep = 0;

    const updateProgress = () => {
      currentStep++;
      if (onProgress) {
        onProgress(Math.round((currentStep / totalSteps) * 100));
      }
    };

    // ============================================================================
    // PAGE 1: COVER PAGE
    // ============================================================================

    // Add cover image if available
    if (story.coverImageUrl) {
      const coverResult = await loadImageAsDataUrl(story.coverImageUrl);

      if (coverResult.success && coverResult.dataUrl) {
        // Calculate dimensions to fit cover (max width, maintain aspect ratio)
        const maxCoverWidth = contentWidth;
        const maxCoverHeight = pageHeight * 0.5;

        let coverWidth = maxCoverWidth;
        let coverHeight = maxCoverHeight;

        if (coverResult.width && coverResult.height) {
          const aspectRatio = coverResult.width / coverResult.height;

          if (aspectRatio > 1) {
            // Landscape
            coverWidth = maxCoverWidth;
            coverHeight = coverWidth / aspectRatio;
          } else {
            // Portrait
            coverHeight = maxCoverHeight;
            coverWidth = coverHeight * aspectRatio;
          }
        }

        // Center the cover image
        const coverX = (pageWidth - coverWidth) / 2;
        const coverY = 30;

        doc.addImage(coverResult.dataUrl, 'JPEG', coverX, coverY, coverWidth, coverHeight);
      }
    }

    // Add title
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    let yPos = story.coverImageUrl ? pageHeight * 0.65 : 60;
    const titleLines = doc.splitTextToSize(story.title, contentWidth);
    titleLines.forEach((line: string) => {
      const textWidth = doc.getTextWidth(line);
      doc.text(line, (pageWidth - textWidth) / 2, yPos);
      yPos += 10;
    });

    // Add description/summary
    if (story.description) {
      yPos += 10;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      yPos = addWrappedText(doc, story.description, margin, yPos, contentWidth, 7);
    }

    // Add metadata
    yPos += 15;
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Genre: ${story.config.genre || 'Story'}`, margin, yPos);
    yPos += 6;
    doc.text(`Alter: ${story.config.ageGroup || '6-8'}`, margin, yPos);
    yPos += 6;
    doc.text(`Kapitel: ${chapters.length || 0}`, margin, yPos);
    yPos += 6;
    const dateStr = new Date(story.createdAt).toLocaleDateString('de-DE');
    doc.text(`Erstellt: ${dateStr}`, margin, yPos);

    doc.setTextColor(0);
    updateProgress();

    // ============================================================================
    // CHAPTERS
    // ============================================================================

    if (chapters && chapters.length > 0) {
      for (const chapter of chapters) {
        // Start new page for each chapter
        doc.addPage();
        yPos = margin;

        // Chapter title
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        const chapterTitleLines = doc.splitTextToSize(chapter.title || `Kapitel ${chapter.order}`, contentWidth);
        chapterTitleLines.forEach((line: string) => {
          doc.text(line, margin, yPos);
          yPos += 10;
        });

        yPos += 5;

        // Chapter image if available
        if (chapter.imageUrl) {
          const imageResult = await loadImageAsDataUrl(chapter.imageUrl);

          if (imageResult.success && imageResult.dataUrl) {
            // Calculate dimensions (max width, maintain aspect ratio)
            const maxImageWidth = contentWidth;
            const maxImageHeight = 100; // Max height for chapter images

            let imageWidth = maxImageWidth;
            let imageHeight = maxImageHeight;

            if (imageResult.width && imageResult.height) {
              const aspectRatio = imageResult.width / imageResult.height;

              if (aspectRatio > maxImageWidth / maxImageHeight) {
                // Wide image
                imageWidth = maxImageWidth;
                imageHeight = imageWidth / aspectRatio;
              } else {
                // Tall image
                imageHeight = maxImageHeight;
                imageWidth = imageHeight * aspectRatio;
              }
            }

            // Center the image
            const imageX = (pageWidth - imageWidth) / 2;

            doc.addImage(imageResult.dataUrl, 'JPEG', imageX, yPos, imageWidth, imageHeight);
            yPos += imageHeight + 10;
          }
        }

        updateProgress();

        // Chapter content
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');

        // Split content by paragraphs
        const paragraphs = chapter.content.split('\n').filter(p => p.trim().length > 0);

        for (const paragraph of paragraphs) {
          // Check if we need a new page
          if (yPos > pageHeight - 30) {
            doc.addPage();
            yPos = margin;
          }

          yPos = addWrappedText(doc, paragraph, margin, yPos, contentWidth, 7);
          yPos += 5; // Space between paragraphs
        }

        updateProgress();
      }
    }

    // ============================================================================
    // FOOTER ON EACH PAGE
    // ============================================================================

    const totalPages = doc.getNumberOfPages();

    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(150);

      // Page number
      const pageText = `Seite ${i} von ${totalPages}`;
      const pageTextWidth = doc.getTextWidth(pageText);
      doc.text(pageText, pageWidth - margin - pageTextWidth, pageHeight - 10);

      // Talea branding
      doc.text('Erstellt mit Talea', margin, pageHeight - 10);
    }

    doc.setTextColor(0);

    // ============================================================================
    // SAVE PDF
    // ============================================================================

    const filename = `${story.title.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.pdf`;
    doc.save(filename);

    if (onProgress) {
      onProgress(100);
    }

  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error(`PDF-Export fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Check if PDF export is supported in current browser
 */
export function isPDFExportSupported(): boolean {
  try {
    // Check if required APIs are available
    return !!(
      typeof document !== 'undefined' &&
      document.createElement &&
      HTMLCanvasElement.prototype.toDataURL
    );
  } catch {
    return false;
  }
}
