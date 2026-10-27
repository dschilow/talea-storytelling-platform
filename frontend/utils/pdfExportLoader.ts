// The PDF exporter bundles jsPDF (~370 KB) and is left out of the offline
// precache (vite.config.ts). A screen that imports it statically fails as a
// whole whenever that chunk is unreachable — offline, or in a tab still running
// the previous build after a deploy. Screens import from here instead, and the
// exporter loads on the click.
import type * as PdfExport from './pdfExport';

/**
 * Check if PDF export is supported in current browser
 */
export function isPDFExportSupported(): boolean {
  try {
    // Check if required APIs are available
    return typeof document !== 'undefined' && typeof HTMLCanvasElement.prototype.toDataURL === 'function';
  } catch {
    return false;
  }
}

export async function exportStoryAsPDF(...args: Parameters<typeof PdfExport.exportStoryAsPDF>) {
  const { exportStoryAsPDF } = await import('./pdfExport');
  return exportStoryAsPDF(...args);
}

export async function exportDokuAsPDF(...args: Parameters<typeof PdfExport.exportDokuAsPDF>) {
  const { exportDokuAsPDF } = await import('./pdfExport');
  return exportDokuAsPDF(...args);
}
