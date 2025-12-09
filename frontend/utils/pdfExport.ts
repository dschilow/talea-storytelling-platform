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
 * Load an image from URL and convert to data URL for embedding
 */
async function loadImageAsDataUrl(url: string): Promise<ImageLoadResult> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Enable CORS for external images

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
          height: img.height
        });
      } catch (error) {
        resolve({ success: false, error: String(error) });
      }
    };

    img.onerror = () => {
      resolve({ success: false, error: 'Failed to load image' });
    };

    // Try to load the image
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
      storyTitle: story.title
    });

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
