import { PDFDocument, rgb, degrees, StandardFonts, PageSizes } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import { Document, Paragraph, TextRun, HeadingLevel, Packer, AlignmentType } from 'docx';
// @ts-ignore
import { encryptPDF, AlreadyEncryptedError } from '@pdfsmaller/pdf-encrypt';
import {
  CreateDocOptions,
  PageItem,
  SplitMode,
  CompressionLevel,
  ExtractedImagePage,
  DocumentAnnotations,
  StickyNoteAnnotation,
  ShapeAnnotation,
  TextBlockAnnotation,
  ImageOverlayAnnotation,
  FormFieldAnnotation,
  WhiteoutReplaceAnnotation,
  PdfSecurityOptions,
  PdfSecurityPermissions,
  PdfSecurityStatus
} from '../types';

// Set up pdf.js worker using unpkg / cdnjs fallback to guarantee worker loads smoothly
try {
  if (typeof window !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || '4.10.38'}/build/pdf.worker.min.mjs`;
  }
} catch {
  console.warn('pdf.js worker fallback initialized');
}

/**
 * Render PDF page thumbnails to data URLs using pdfjs or canvas fallback
 */
export async function renderPdfPagesToThumbnails(
  pdfBytes: Uint8Array,
  maxPages: number = 1000,
  onProgress?: (current: number, total: number) => void
): Promise<string[]> {
  const thumbnails: string[] = [];
  try {
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice(0) });
    const pdf = await loadingTask.promise;
    const count = Math.min(pdf.numPages, maxPages);

    for (let i = 1; i <= count; i++) {
      try {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 0.5 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        if (context) {
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          // Render page to canvas
          // @ts-ignore
          await page.render({
            canvasContext: context,
            viewport: viewport,
          }).promise;

          thumbnails.push(canvas.toDataURL('image/jpeg', 0.8));
        } else {
          thumbnails.push(generateFallbackThumbnail(i));
        }
      } catch (err) {
        thumbnails.push(generateFallbackThumbnail(i));
      }

      if (onProgress) {
        onProgress(i, count);
      }
    }
  } catch (err) {
    // If pdfjs fails, count pages with pdf-lib and generate clean graphic placeholders
    try {
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const totalPages = Math.min(pdfDoc.getPageCount(), maxPages);
      for (let i = 1; i <= totalPages; i++) {
        thumbnails.push(generateFallbackThumbnail(i));
        if (onProgress) {
          onProgress(i, totalPages);
        }
      }
    } catch {
      thumbnails.push(generateFallbackThumbnail(1));
      if (onProgress) {
        onProgress(1, 1);
      }
    }
  }
  return thumbnails;
}

function generateFallbackThumbnail(pageNumber: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = 300;
  canvas.height = 400;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Border
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

  // Header band
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(20, 25, 120, 16);

  // Skeleton lines
  ctx.fillStyle = '#f1f5f9';
  for (let y = 65; y < 330; y += 22) {
    const w = 180 + Math.sin(y) * 60;
    ctx.fillRect(20, y, Math.min(260, w), 10);
  }

  // Page number badge
  ctx.fillStyle = '#3b82f6';
  ctx.beginPath();
  ctx.roundRect(110, 340, 80, 34, 17);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`Page ${pageNumber}`, 150, 362);

  return canvas.toDataURL('image/png');
}

/**
 * 1. CREATE: Build a fresh PDF document from user notes, structured sections, or templates
 */
export async function createPdfDocument(options: CreateDocOptions): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const pageSizeMap = {
    A4: PageSizes.A4,
    Letter: PageSizes.Letter,
    Legal: PageSizes.Legal,
  };

  const [pageWidth, pageHeight] = pageSizeMap[options.pageSize] || PageSizes.A4;
  const margin = options.margin || 40;
  const contentWidth = pageWidth - margin * 2;

  let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let currentY = pageHeight - margin;

  // Helper to add new page when cursor reaches bottom
  const checkNewPage = (neededSpace: number) => {
    if (currentY - neededSpace < margin + 40) {
      currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      currentY = pageHeight - margin;
      drawHeaderAndFooter(currentPage);
    }
  };

  const drawHeaderAndFooter = (page: any) => {
    if (options.headerText) {
      page.drawText(options.headerText, {
        x: margin,
        y: pageHeight - margin / 2,
        size: 9,
        font: helveticaFont,
        color: rgb(0.4, 0.4, 0.4),
      });
    }
    if (options.footerText || options.includePageNumbers) {
      const pageIndex = pdfDoc.getPageCount();
      const footerStr = options.includePageNumbers
        ? `${options.footerText ? options.footerText + '  •  ' : ''}Page ${pageIndex}`
        : options.footerText || '';
      page.drawText(footerStr, {
        x: margin,
        y: margin / 2,
        size: 9,
        font: helveticaFont,
        color: rgb(0.4, 0.4, 0.4),
      });
    }
  };

  // First page header/footer
  drawHeaderAndFooter(currentPage);

  // Title
  if (options.title) {
    currentPage.drawText(options.title, {
      x: margin,
      y: currentY - 20,
      size: 24,
      font: helveticaBold,
      color: rgb(0.08, 0.12, 0.2),
      maxWidth: contentWidth,
    });
    currentY -= 40;

    // Accent line
    currentPage.drawLine({
      start: { x: margin, y: currentY },
      end: { x: margin + contentWidth, y: currentY },
      thickness: 2,
      color: rgb(0.15, 0.4, 0.9),
    });
    currentY -= 24;
  }

  // Author & Date metadata
  if (options.author) {
    currentPage.drawText(`Author: ${options.author}  |  Generated on: ${new Date().toLocaleDateString()}`, {
      x: margin,
      y: currentY,
      size: 10,
      font: helveticaOblique,
      color: rgb(0.45, 0.45, 0.5),
    });
    currentY -= 20;
  }

  // Render each section
  for (const section of options.sections) {
    switch (section.type) {
      case 'heading': {
        checkNewPage(45);
        currentY -= 15;
        currentPage.drawText(section.content || 'Heading', {
          x: margin,
          y: currentY,
          size: 16,
          font: helveticaBold,
          color: rgb(0.1, 0.15, 0.25),
        });
        currentY -= 22;
        break;
      }

      case 'paragraph': {
        const text = section.content || '';
        const words = text.split(' ');
        let line = '';
        const lines: string[] = [];

        for (const word of words) {
          const testLine = line + (line ? ' ' : '') + word;
          const textWidth = helveticaFont.widthOfTextAtSize(testLine, 11);
          if (textWidth > contentWidth) {
            lines.push(line);
            line = word;
          } else {
            line = testLine;
          }
        }
        if (line) lines.push(line);

        for (const textLine of lines) {
          checkNewPage(16);
          currentPage.drawText(textLine, {
            x: margin,
            y: currentY,
            size: 11,
            font: helveticaFont,
            color: rgb(0.2, 0.2, 0.25),
          });
          currentY -= 16;
        }
        currentY -= 8;
        break;
      }

      case 'bullet': {
        checkNewPage(20);
        currentPage.drawCircle({
          x: margin + 6,
          y: currentY + 3,
          size: 2.5,
          color: rgb(0.2, 0.45, 0.9),
        });
        currentPage.drawText(section.content || '', {
          x: margin + 18,
          y: currentY,
          size: 11,
          font: helveticaFont,
          color: rgb(0.2, 0.2, 0.25),
          maxWidth: contentWidth - 20,
        });
        currentY -= 18;
        break;
      }

      case 'callout': {
        checkNewPage(60);
        const boxHeight = 45;
        // Background box
        currentPage.drawRectangle({
          x: margin,
          y: currentY - boxHeight + 10,
          width: contentWidth,
          height: boxHeight,
          color: rgb(0.94, 0.96, 1),
          borderColor: rgb(0.2, 0.45, 0.9),
          borderWidth: 1,
        });
        currentPage.drawText(section.content || 'Important Note', {
          x: margin + 12,
          y: currentY - 14,
          size: 11,
          font: helveticaBold,
          color: rgb(0.1, 0.25, 0.6),
          maxWidth: contentWidth - 24,
        });
        currentY -= boxHeight + 15;
        break;
      }

      case 'signature': {
        checkNewPage(90);
        currentY -= 20;
        if (section.content && section.content.startsWith('data:image')) {
          try {
            const pngImageBytes = await fetch(section.content).then(res => res.arrayBuffer());
            const pngImage = await pdfDoc.embedPng(pngImageBytes);
            const pngDims = pngImage.scale(0.35);
            currentPage.drawImage(pngImage, {
              x: margin + 10,
              y: currentY - 40,
              width: pngDims.width,
              height: pngDims.height,
            });
            currentY -= 45;
          } catch {
            // fallback
          }
        }
        currentPage.drawLine({
          start: { x: margin, y: currentY },
          end: { x: margin + 200, y: currentY },
          thickness: 1,
          color: rgb(0.4, 0.4, 0.4),
        });
        currentPage.drawText('Authorized Signature', {
          x: margin,
          y: currentY - 14,
          size: 9,
          font: helveticaOblique,
          color: rgb(0.4, 0.4, 0.4),
        });
        currentY -= 30;
        break;
      }
    }
  }

  return await pdfDoc.save();
}

/**
 * 1b. CREATE FROM IMAGES / PHOTO SCANNER
 */
export async function createPdfFromImages(
  images: { dataUrl: string; name: string }[],
  options: { pageSize?: 'A4' | 'Letter'; fit?: 'contain' | 'cover'; margin?: number } = {}
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const [pageWidth, pageHeight] = options.pageSize === 'Letter' ? PageSizes.Letter : PageSizes.A4;
  const margin = options.margin ?? 20;

  for (const imgItem of images) {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    const imageBytes = await fetch(imgItem.dataUrl).then((r) => r.arrayBuffer());
    
    let embeddedImage;
    if (imgItem.dataUrl.includes('image/png')) {
      embeddedImage = await pdfDoc.embedPng(imageBytes);
    } else {
      embeddedImage = await pdfDoc.embedJpg(imageBytes);
    }

    const imgWidth = embeddedImage.width;
    const imgHeight = embeddedImage.height;

    const availableWidth = pageWidth - margin * 2;
    const availableHeight = pageHeight - margin * 2;

    const scale = Math.min(availableWidth / imgWidth, availableHeight / imgHeight);
    const renderWidth = imgWidth * scale;
    const renderHeight = imgHeight * scale;

    const x = margin + (availableWidth - renderWidth) / 2;
    const y = margin + (availableHeight - renderHeight) / 2;

    page.drawImage(embeddedImage, {
      x,
      y,
      width: renderWidth,
      height: renderHeight,
    });
  }

  return await pdfDoc.save();
}

/**
 * 2. ORGANISE: Reorder, rotate, delete, insert pages
 */
export async function organizeAndExportPdf(
  originalPdfBytes: Uint8Array,
  pages: PageItem[]
): Promise<Uint8Array> {
  const originalDoc = await PDFDocument.load(originalPdfBytes);
  const newDoc = await PDFDocument.create();

  // Filter out deleted pages
  const activePages = pages.filter((p) => !p.isDeleted);

  for (const pageItem of activePages) {
    if (pageItem.isBlank) {
      // Add a clean blank page matching first page's dimensions
      const refPage = originalDoc.getPage(0);
      const { width, height } = refPage.getSize();
      newDoc.addPage([width, height]);
      continue;
    }

    // Copy original page
    const [copiedPage] = await newDoc.copyPages(originalDoc, [pageItem.originalIndex]);

    // Apply rotation adjustments
    const currentRot = copiedPage.getRotation().angle;
    const totalRotation = (currentRot + pageItem.rotation) % 360;
    copiedPage.setRotation(degrees(totalRotation));

    newDoc.addPage(copiedPage);
  }

  return await newDoc.save({ useObjectStreams: true });
}

/**
 * 3. COMBINE / MERGE: Combine multiple PDF files into one
 */
export async function mergeMultiplePdfs(
  files: { data: Uint8Array; name: string; pageRanges?: string }[]
): Promise<Uint8Array> {
  const mergedDoc = await PDFDocument.create();

  for (const file of files) {
    try {
      const srcDoc = await PDFDocument.load(file.data);
      const totalPages = srcDoc.getPageCount();
      let pageIndicesToCopy: number[] = [];

      if (file.pageRanges && file.pageRanges.trim().length > 0) {
        pageIndicesToCopy = parsePageRangeString(file.pageRanges, totalPages);
      } else {
        pageIndicesToCopy = Array.from({ length: totalPages }, (_, i) => i);
      }

      if (pageIndicesToCopy.length > 0) {
        const copiedPages = await mergedDoc.copyPages(srcDoc, pageIndicesToCopy);
        copiedPages.forEach((page) => mergedDoc.addPage(page));
      }
    } catch (err) {
      console.error(`Failed to merge file: ${file.name}`, err);
    }
  }

  return await mergedDoc.save({ useObjectStreams: true });
}

/**
 * 4. SPLIT: Split PDF by range, individual pages, or intervals
 */
export async function splitPdfDocument(
  pdfBytes: Uint8Array,
  mode: SplitMode,
  config: {
    ranges?: { from: number; to: number; name?: string }[];
    interval?: number;
    selectedPages?: number[];
  }
): Promise<{ filename: string; data: Uint8Array; pageCount: number }[]> {
  const srcDoc = await PDFDocument.load(pdfBytes);
  const totalPages = srcDoc.getPageCount();
  const results: { filename: string; data: Uint8Array; pageCount: number }[] = [];

  if (mode === 'all') {
    // Split into each individual page
    for (let i = 0; i < totalPages; i++) {
      const singleDoc = await PDFDocument.create();
      const [copiedPage] = await singleDoc.copyPages(srcDoc, [i]);
      singleDoc.addPage(copiedPage);
      const savedBytes = await singleDoc.save();
      results.push({
        filename: `page_${i + 1}.pdf`,
        data: savedBytes,
        pageCount: 1,
      });
    }
  } else if (mode === 'interval') {
    const step = config.interval && config.interval > 0 ? config.interval : 2;
    let part = 1;
    for (let start = 0; start < totalPages; start += step) {
      const end = Math.min(start + step, totalPages);
      const partDoc = await PDFDocument.create();
      const indices = Array.from({ length: end - start }, (_, k) => start + k);
      const copiedPages = await partDoc.copyPages(srcDoc, indices);
      copiedPages.forEach((p) => partDoc.addPage(p));
      const savedBytes = await partDoc.save();
      results.push({
        filename: `split_part_${part}_pages_${start + 1}-${end}.pdf`,
        data: savedBytes,
        pageCount: copiedPages.length,
      });
      part++;
    }
  } else if (mode === 'range') {
    const ranges = config.ranges || [];
    let idx = 1;
    for (const r of ranges) {
      const from = Math.max(1, Math.min(r.from, totalPages));
      const to = Math.max(from, Math.min(r.to, totalPages));
      const count = to - from + 1;

      const partDoc = await PDFDocument.create();
      const indices = Array.from({ length: count }, (_, k) => from - 1 + k);
      const copiedPages = await partDoc.copyPages(srcDoc, indices);
      copiedPages.forEach((p) => partDoc.addPage(p));
      const savedBytes = await partDoc.save();
      results.push({
        filename: r.name ? `${r.name}.pdf` : `range_${from}-${to}.pdf`,
        data: savedBytes,
        pageCount: copiedPages.length,
      });
      idx++;
    }
  } else if (mode === 'custom_select') {
    const selected = config.selectedPages || [];
    if (selected.length > 0) {
      const partDoc = await PDFDocument.create();
      const indices = selected.map((p) => p - 1).filter((idx) => idx >= 0 && idx < totalPages);
      const copiedPages = await partDoc.copyPages(srcDoc, indices);
      copiedPages.forEach((p) => partDoc.addPage(p));
      const savedBytes = await partDoc.save();
      results.push({
        filename: `extracted_${selected.length}_pages.pdf`,
        data: savedBytes,
        pageCount: copiedPages.length,
      });
    }
  }

  return results;
}

/**
 * 5. COMPRESS: Re-encode, remove unused metadata, compress streams
 */
export async function compressPdfDocument(
  pdfBytes: Uint8Array,
  level: CompressionLevel = 'recommended'
): Promise<{ data: Uint8Array; originalSize: number; newSize: number; ratio: number }> {
  const originalSize = pdfBytes.byteLength;
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

  // Clean metadata and compress object streams
  pdfDoc.setTitle('');
  pdfDoc.setAuthor('');
  pdfDoc.setSubject('');
  pdfDoc.setKeywords([]);
  pdfDoc.setProducer('DocHub Mobile Compressor');
  pdfDoc.setCreator('DocHub Android');

  // pdf-lib's useObjectStreams optimizes cross-reference tables and compresses raw streams
  const compressedBytes = await pdfDoc.save({
    useObjectStreams: true,
    addDefaultPage: false,
    updateFieldAppearances: false,
  });

  let newSize = compressedBytes.byteLength;
  // If the document is small or already compressed, synthesize practical compression reduction representation
  if (level === 'extreme' && newSize >= originalSize * 0.9) {
    // For extreme compression demonstration on simple PDFs
  }

  const ratio = Math.max(0, Math.round(((originalSize - newSize) / originalSize) * 100));

  return {
    data: compressedBytes,
    originalSize,
    newSize,
    ratio,
  };
}

/**
 * Helper: Parse page ranges string like "1-3, 5, 8-10"
 */
export function parsePageRangeString(rangeStr: string, totalPages: number): number[] {
  const indices = new Set<number>();
  const parts = rangeStr.split(/[,;\s]+/).filter(Boolean);

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = Math.max(1, start); i <= Math.min(totalPages, end); i++) {
          indices.add(i - 1);
        }
      }
    } else {
      const page = parseInt(part, 10);
      if (!isNaN(page) && page >= 1 && page <= totalPages) {
        indices.add(page - 1);
      }
    }
  }

  return Array.from(indices).sort((a, b) => a - b);
}

/**
 * Format bytes to readable size (KB, MB)
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Generate starter sample PDF for rapid testing
 */
export async function createSampleReport(): Promise<{ name: string; bytes: Uint8Array }> {
  const options: CreateDocOptions = {
    title: 'Quarterly Project Summary & Logistics',
    author: 'DocHub Android Suite',
    pageSize: 'A4',
    margin: 35,
    headerText: 'CONFIDENTIAL • INTERNAL REVIEW',
    footerText: 'DocHub Android Edition',
    includePageNumbers: true,
    themeColor: '#2563eb',
    sections: [
      {
        id: 'sec-1',
        type: 'heading',
        content: '1. Executive Overview',
      },
      {
        id: 'sec-2',
        type: 'paragraph',
        content: 'This multi-page demonstration document is created for testing the Android Toolkit features: Organise, Combine, Split, Merge, and Compress.',
      },
      {
        id: 'sec-3',
        type: 'callout',
        content: 'Tip: You can reorder these pages, rotate them, extract specific sections, or merge with your own files.',
      },
      {
        id: 'sec-4',
        type: 'bullet',
        content: 'High-performance offline client-side PDF manipulation engine',
      },
      {
        id: 'sec-5',
        type: 'bullet',
        content: 'Android Material Design 3 interface with tactile haptic feedback',
      },
      {
        id: 'sec-6',
        type: 'bullet',
        content: 'Lossless & high-efficiency compression algorithms',
      },
      {
        id: 'sec-7',
        type: 'heading',
        content: '2. Operational Workflows',
      },
      {
        id: 'sec-8',
        type: 'paragraph',
        content: 'All documents are processed directly in your browser memory for 100% privacy and lightning-fast speed without transmitting files to external cloud servers.',
      },
    ],
  };

  const bytes = await createPdfDocument(options);
  return {
    name: 'Sample_Report_Doc.pdf',
    bytes,
  };
}

export async function generateSamplePdfBytes(): Promise<Uint8Array> {
  const sample = await createSampleReport();
  return sample.bytes;
}

/**
 * 6. CONVERT: PDF to Images (PNG / JPG) with custom DPI & Quality
 */
export async function convertPdfToImages(
  pdfBytes: Uint8Array,
  options: {
    format?: 'png' | 'jpeg';
    dpi?: number; // 72, 150, 300
    quality?: number; // 0.1 to 1.0 for jpeg
    pageIndices?: number[];
    onProgress?: (current: number, total: number) => void;
  } = {}
): Promise<ExtractedImagePage[]> {
  const format = options.format || 'png';
  const dpi = options.dpi || 150;
  const quality = options.quality ?? 0.92;
  const scale = dpi / 72; // Standard PDF point is 72 dpi

  const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice(0) });
  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;
  const targetIndices = options.pageIndices && options.pageIndices.length > 0
    ? options.pageIndices.filter(p => p >= 1 && p <= totalPages)
    : Array.from({ length: totalPages }, (_, i) => i + 1);

  const results: ExtractedImagePage[] = [];

  for (let idx = 0; idx < targetIndices.length; idx++) {
    const pageNum = targetIndices[idx];
    if (options.onProgress) {
      options.onProgress(idx + 1, targetIndices.length);
    }

    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    // Fill white background for clean transparency handling
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // @ts-ignore
    await page.render({
      canvasContext: ctx,
      viewport,
    }).promise;

    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
    const dataUrl = canvas.toDataURL(mimeType, quality);

    // Create Blob
    const blob: Blob = await new Promise((resolve) => {
      canvas.toBlob((b) => {
        resolve(b || new Blob([], { type: mimeType }));
      }, mimeType, quality);
    });

    results.push({
      pageNumber: pageNum,
      dataUrl,
      blob,
      filename: `page_${pageNum}.${format === 'png' ? 'png' : 'jpg'}`,
      width: canvas.width,
      height: canvas.height,
      size: blob.size,
    });
  }

  return results;
}

/**
 * Helper: Package multiple images into a single ZIP file
 */
export async function createZipFromImages(
  images: ExtractedImagePage[],
  zipFilename: string = 'converted_pages.zip'
): Promise<{ blob: Blob; filename: string }> {
  const zip = new JSZip();

  images.forEach((img) => {
    zip.file(img.filename, img.blob);
  });

  const content = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return {
    blob: content,
    filename: zipFilename.endsWith('.zip') ? zipFilename : `${zipFilename}.zip`,
  };
}

/**
 * 7. CONVERT: PDF to Microsoft Word (.docx) format
 * Extracts structured text, layout, headings, and formatting directly on client
 */
export async function convertPdfToDocx(
  pdfBytes: Uint8Array,
  options: {
    title?: string;
    onProgress?: (current: number, total: number) => void;
  } = {}
): Promise<{ blob: Blob; filename: string; pageCount: number; totalParagraphs: number }> {
  const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice(0) });
  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;

  const docParagraphs: Paragraph[] = [];
  let totalParagraphCount = 0;

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    if (options.onProgress) {
      options.onProgress(pageNum, totalPages);
    }

    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items = textContent.items as any[];

    if (items.length === 0) {
      // Empty or scanned page
      docParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `[Page ${pageNum} - Image/Graphic content without embedded text layer]`,
              italics: true,
              color: '888888',
            }),
          ],
        })
      );
      continue;
    }

    // Group text items by vertical line (y-coordinate)
    // Items in PDF coordinate system have (0,0) at bottom-left
    const lineMap = new Map<number, any[]>();
    const yTolerance = 4; // px tolerance for same line

    for (const item of items) {
      if (!item.str || item.str.trim() === '') continue;
      const y = Math.round(item.transform[5]);
      
      let matchedY: number | null = null;
      for (const existingY of lineMap.keys()) {
        if (Math.abs(existingY - y) <= yTolerance) {
          matchedY = existingY;
          break;
        }
      }

      if (matchedY !== null) {
        lineMap.get(matchedY)!.push(item);
      } else {
        lineMap.set(y, [item]);
      }
    }

    // Sort lines from top to bottom (descending Y in PDF coordinates)
    const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a);

    // Calculate median font height to distinguish headings from regular body text
    const heights = items.map((i) => Math.abs(i.transform[0] || i.height || 12)).filter(Boolean);
    heights.sort((a, b) => a - b);
    const medianHeight = heights[Math.floor(heights.length / 2)] || 11;

    for (const y of sortedYs) {
      const lineItems = lineMap.get(y)!;
      // Sort line items horizontally from left to right (ascending X)
      lineItems.sort((a, b) => a.transform[4] - b.transform[4]);

      const lineText = lineItems.map((i) => i.str).join(' ').trim();
      if (!lineText) continue;

      const avgItemHeight = lineItems.reduce((acc, i) => acc + (Math.abs(i.transform[0] || i.height || 11)), 0) / lineItems.length;
      const isLargeHeading = avgItemHeight >= medianHeight * 1.45;
      const isMediumHeading = avgItemHeight >= medianHeight * 1.2 && !isLargeHeading;
      const isBullet = lineText.startsWith('•') || lineText.startsWith('-') || lineText.startsWith('*') || /^\d+\.\s/.test(lineText);

      totalParagraphCount++;

      if (isLargeHeading) {
        docParagraphs.push(
          new Paragraph({
            text: lineText,
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 240, after: 120 },
          })
        );
      } else if (isMediumHeading) {
        docParagraphs.push(
          new Paragraph({
            text: lineText,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 180, after: 80 },
          })
        );
      } else if (isBullet) {
        const cleanBulletText = lineText.replace(/^[•\-*]\s*/, '').trim();
        docParagraphs.push(
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({
                text: cleanBulletText,
                size: 22, // 11pt in half-points
              }),
            ],
            spacing: { after: 60 },
          })
        );
      } else {
        docParagraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: lineText,
                size: 22, // 11pt
              }),
            ],
            spacing: { after: 100 },
          })
        );
      }
    }

    // Add page separator between document pages
    if (pageNum < totalPages) {
      docParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: '',
              break: 1,
            }),
          ],
          pageBreakBefore: true,
        })
      );
    }
  }

  // Create docx document
  const doc = new Document({
    creator: 'DocHub Android PDF Converter',
    title: options.title || 'Converted PDF Document',
    description: 'Document converted from PDF to Word format',
    sections: [
      {
        properties: {},
        children: docParagraphs.length > 0 ? docParagraphs : [
          new Paragraph({
            children: [new TextRun({ text: 'Converted Document' })],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const baseName = (options.title || 'document').replace(/\.[^/.]+$/, '');
  
  return {
    blob,
    filename: `${baseName}.docx`,
    pageCount: totalPages,
    totalParagraphs: totalParagraphCount,
  };
}

/**
 * 8. ROTATE: Rotate individual pages or all pages of a PDF document
 */
export async function rotatePdfDocumentPages(
  pdfBytes: Uint8Array,
  rotations: { pageIndex: number; rotationAngle: number }[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const totalPages = pdfDoc.getPageCount();

  const rotationMap = new Map<number, number>();
  rotations.forEach((r) => {
    rotationMap.set(r.pageIndex, r.rotationAngle);
  });

  for (let i = 0; i < totalPages; i++) {
    const angleDelta = rotationMap.get(i) || 0;
    if (angleDelta !== 0) {
      const page = pdfDoc.getPage(i);
      const currentRot = page.getRotation().angle;
      const newRot = (currentRot + angleDelta + 360) % 360;
      page.setRotation(degrees(newRot));
    }
  }

  return await pdfDoc.save({ useObjectStreams: true });
}

/**
 * Convert Hex Color (#RRGGBB or #RGB) to normalized RGB (0..1)
 */
export function parseColorToRgb(hexOrNamed: string): { r: number; g: number; b: number } {
  if (!hexOrNamed) return { r: 0.1, g: 0.1, b: 0.1 };
  
  const cleanHex = hexOrNamed.trim().replace('#', '');
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16) / 255;
    const g = parseInt(cleanHex[1] + cleanHex[1], 16) / 255;
    const b = parseInt(cleanHex[2] + cleanHex[2], 16) / 255;
    return { r, g, b };
  } else if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
    const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
    const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
    return { r, g, b };
  }

  // Common color keywords fallback
  const named: Record<string, { r: number; g: number; b: number }> = {
    yellow: { r: 0.98, g: 0.85, b: 0.2 },
    blue: { r: 0.2, g: 0.5, b: 0.95 },
    green: { r: 0.15, g: 0.75, b: 0.35 },
    pink: { r: 0.95, g: 0.3, b: 0.6 },
    purple: { r: 0.6, g: 0.3, b: 0.9 },
    amber: { r: 0.95, g: 0.6, b: 0.1 },
    red: { r: 0.9, g: 0.2, b: 0.2 },
    black: { r: 0, g: 0, b: 0 },
    white: { r: 1, g: 1, b: 1 },
  };

  return named[hexOrNamed.toLowerCase()] || { r: 0.2, g: 0.2, b: 0.2 };
}

/**
 * 9. EDIT & ANNOTATE: Burn all comments, sticky notes, shapes, text blocks, form fields,
 * and whiteout/rewrites into the final PDF document
 */
export async function applyAnnotationsToPdf(
  pdfBytes: Uint8Array,
  annotations: DocumentAnnotations
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const totalPages = pdfDoc.getPageCount();

  let form: any = null;
  try {
    form = pdfDoc.getForm();
  } catch {
    // Form not available on this document
  }

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const page = pdfDoc.getPage(pageIdx);
    const { width: pageWidth, height: pageHeight } = page.getSize();

    // 1. Apply Whiteouts & Text Rewrites FIRST (covers existing content)
    const pageWhiteouts = annotations.whiteouts.filter((w) => w.pageIndex === pageIdx);
    for (const w of pageWhiteouts) {
      const boxW = (w.widthPercent / 100) * pageWidth;
      const boxH = (w.heightPercent / 100) * pageHeight;
      const boxX = (w.xPercent / 100) * pageWidth;
      // In PDF coordinates (0,0 is bottom-left)
      const boxY = pageHeight - ((w.yPercent / 100) * pageHeight) - boxH;

      // Draw whiteout mask
      page.drawRectangle({
        x: Math.max(0, boxX),
        y: Math.max(0, boxY),
        width: boxW,
        height: boxH,
        color: rgb(1, 1, 1),
        borderColor: rgb(1, 1, 1),
        borderWidth: 0,
      });

      // If replacement text is provided, draw it over the whiteout
      if (w.replacementText && w.replacementText.trim()) {
        const textRgb = parseColorToRgb(w.color || '#1e293b');
        const font = w.isBold ? helveticaBold : helveticaFont;
        const fontSize = Math.max(8, w.fontSize || 12);
        
        // Draw text vertically centered within the box
        page.drawText(w.replacementText, {
          x: boxX + 4,
          y: boxY + Math.max(2, (boxH - fontSize) / 2),
          size: fontSize,
          font,
          color: rgb(textRgb.r, textRgb.g, textRgb.b),
          maxWidth: boxW - 8,
        });
      }
    }

    // 2. Apply Shapes & Markups (Rectangles, Circles, Lines, Arrows, Highlights, Redactions)
    const pageShapes = annotations.shapes.filter((s) => s.pageIndex === pageIdx);
    for (const shape of pageShapes) {
      const shapeW = (shape.widthPercent / 100) * pageWidth;
      const shapeH = (shape.heightPercent / 100) * pageHeight;
      const shapeX = (shape.xPercent / 100) * pageWidth;
      const shapeY = pageHeight - ((shape.yPercent / 100) * pageHeight) - shapeH;

      const strokeRgb = parseColorToRgb(shape.strokeColor || '#4F46E5');
      const fillRgb = parseColorToRgb(shape.fillColor || '#4F46E5');

      switch (shape.type) {
        case 'rect': {
          page.drawRectangle({
            x: shapeX,
            y: shapeY,
            width: shapeW,
            height: shapeH,
            color: shape.fillColor !== 'transparent' ? rgb(fillRgb.r, fillRgb.g, fillRgb.b) : undefined,
            borderColor: rgb(strokeRgb.r, strokeRgb.g, strokeRgb.b),
            borderWidth: shape.strokeWidth || 2,
            opacity: shape.opacity ?? 1,
          });
          break;
        }

        case 'circle': {
          page.drawEllipse({
            x: shapeX + shapeW / 2,
            y: shapeY + shapeH / 2,
            xScale: shapeW / 2,
            yScale: shapeH / 2,
            color: shape.fillColor !== 'transparent' ? rgb(fillRgb.r, fillRgb.g, fillRgb.b) : undefined,
            borderColor: rgb(strokeRgb.r, strokeRgb.g, strokeRgb.b),
            borderWidth: shape.strokeWidth || 2,
            opacity: shape.opacity ?? 1,
          });
          break;
        }

        case 'highlight': {
          // Semi-transparent highlighter band
          const hlRgb = parseColorToRgb(shape.fillColor || '#facc15');
          page.drawRectangle({
            x: shapeX,
            y: shapeY,
            width: shapeW,
            height: shapeH,
            color: rgb(hlRgb.r, hlRgb.g, hlRgb.b),
            opacity: 0.38,
          });
          break;
        }

        case 'redact': {
          // Solid privacy redaction block
          page.drawRectangle({
            x: shapeX,
            y: shapeY,
            width: shapeW,
            height: shapeH,
            color: rgb(0, 0, 0),
            borderColor: rgb(0, 0, 0),
            borderWidth: 1,
          });
          // Optional small white redaction stamp
          if (shapeW > 50 && shapeH > 14) {
            page.drawText('[REDACTED]', {
              x: shapeX + (shapeW - 48) / 2,
              y: shapeY + (shapeH - 7) / 2,
              size: 7,
              font: helveticaBold,
              color: rgb(0.8, 0.8, 0.8),
            });
          }
          break;
        }

        case 'line': {
          page.drawLine({
            start: { x: shapeX, y: shapeY + shapeH },
            end: { x: shapeX + shapeW, y: shapeY },
            thickness: shape.strokeWidth || 2,
            color: rgb(strokeRgb.r, strokeRgb.g, strokeRgb.b),
            opacity: shape.opacity ?? 1,
          });
          break;
        }

        case 'arrow': {
          const startX = shapeX;
          const startY = shapeY + shapeH;
          const endX = shapeX + shapeW;
          const endY = shapeY;

          // Line shaft
          page.drawLine({
            start: { x: startX, y: startY },
            end: { x: endX, y: endY },
            thickness: shape.strokeWidth || 2,
            color: rgb(strokeRgb.r, strokeRgb.g, strokeRgb.b),
          });

          // Arrowhead tick
          const angle = Math.atan2(endY - startY, endX - startX);
          const headLen = 10;
          page.drawLine({
            start: { x: endX, y: endY },
            end: {
              x: endX - headLen * Math.cos(angle - Math.PI / 6),
              y: endY - headLen * Math.sin(angle - Math.PI / 6),
            },
            thickness: shape.strokeWidth || 2,
            color: rgb(strokeRgb.r, strokeRgb.g, strokeRgb.b),
          });
          page.drawLine({
            start: { x: endX, y: endY },
            end: {
              x: endX - headLen * Math.cos(angle + Math.PI / 6),
              y: endY - headLen * Math.sin(angle + Math.PI / 6),
            },
            thickness: shape.strokeWidth || 2,
            color: rgb(strokeRgb.r, strokeRgb.g, strokeRgb.b),
          });
          break;
        }
      }
    }

    // 3. Apply Image Overlays & Rubber Stamps
    const pageImages = annotations.imageOverlays.filter((img) => img.pageIndex === pageIdx);
    for (const imgAnn of pageImages) {
      const imgW = (imgAnn.widthPercent / 100) * pageWidth;
      const imgH = (imgAnn.heightPercent / 100) * pageHeight;
      const imgX = (imgAnn.xPercent / 100) * pageWidth;
      const imgY = pageHeight - ((imgAnn.yPercent / 100) * pageHeight) - imgH;

      if (imgAnn.stampLabel) {
        // Pre-designed rubber stamp badge
        const stampColors: Record<string, { r: number; g: number; b: number }> = {
          APPROVED: { r: 0.1, g: 0.65, b: 0.3 },
          CONFIDENTIAL: { r: 0.85, g: 0.15, b: 0.15 },
          PAID: { r: 0.15, g: 0.45, b: 0.9 },
          DRAFT: { r: 0.8, g: 0.5, b: 0.1 },
          VOID: { r: 0.7, g: 0.2, b: 0.2 },
          URGENT: { r: 0.9, g: 0.1, b: 0.3 },
          FINAL: { r: 0.2, g: 0.6, b: 0.8 },
        };
        const stRgb = stampColors[imgAnn.stampLabel] || { r: 0.8, g: 0.2, b: 0.2 };

        // Outer border
        page.drawRectangle({
          x: imgX,
          y: imgY,
          width: imgW,
          height: imgH,
          borderColor: rgb(stRgb.r, stRgb.g, stRgb.b),
          borderWidth: 2.5,
          color: rgb(stRgb.r, stRgb.g, stRgb.b),
          opacity: 0.12,
        });

        // Inner border line
        page.drawRectangle({
          x: imgX + 3,
          y: imgY + 3,
          width: imgW - 6,
          height: imgH - 6,
          borderColor: rgb(stRgb.r, stRgb.g, stRgb.b),
          borderWidth: 1,
          opacity: 0.6,
        });

        // Label text centered
        const fontSize = Math.min(18, Math.max(10, imgH * 0.45));
        const textWidth = helveticaBold.widthOfTextAtSize(imgAnn.stampLabel, fontSize);
        page.drawText(imgAnn.stampLabel, {
          x: imgX + Math.max(4, (imgW - textWidth) / 2),
          y: imgY + (imgH - fontSize) / 2 + 2,
          size: fontSize,
          font: helveticaBold,
          color: rgb(stRgb.r, stRgb.g, stRgb.b),
        });
      } else if (imgAnn.dataUrl && imgAnn.dataUrl.startsWith('data:image')) {
        try {
          const isPng = imgAnn.dataUrl.includes('image/png');
          const base64Data = imgAnn.dataUrl.replace(/^data:image\/[a-zA-Z0-9+]+;base64,/, '');
          const binaryStr = atob(base64Data);
          const bytes = new Uint8Array(binaryStr.length);
          for (let k = 0; k < binaryStr.length; k++) {
            bytes[k] = binaryStr.charCodeAt(k);
          }

          let embeddedImg;
          if (isPng) {
            embeddedImg = await pdfDoc.embedPng(bytes);
          } else {
            embeddedImg = await pdfDoc.embedJpg(bytes);
          }

          page.drawImage(embeddedImg, {
            x: imgX,
            y: imgY,
            width: imgW,
            height: imgH,
          });
        } catch (e) {
          console.warn('Failed to embed image annotation into PDF:', e);
        }
      }
    }

    // 4. Apply Text Blocks
    const pageTextBlocks = annotations.textBlocks.filter((t) => t.pageIndex === pageIdx);
    for (const t of pageTextBlocks) {
      if (!t.text) continue;
      const textW = (t.widthPercent / 100) * pageWidth;
      const textX = (t.xPercent / 100) * pageWidth;
      const fontSize = t.fontSize || 12;
      const font = t.isBold
        ? t.isItalic
          ? helveticaBold
          : helveticaBold
        : t.isItalic
        ? helveticaOblique
        : helveticaFont;

      const lines = t.text.split('\n');
      const textH = lines.length * (fontSize * 1.3) + 12;
      const textY = pageHeight - ((t.yPercent / 100) * pageHeight) - textH;

      // Background card
      if (!t.isTransparentBg) {
        const bgRgb = parseColorToRgb(t.backgroundColor || '#ffffff');
        page.drawRectangle({
          x: textX,
          y: textY,
          width: textW,
          height: textH,
          color: rgb(bgRgb.r, bgRgb.g, bgRgb.b),
          borderColor: rgb(0.85, 0.87, 0.9),
          borderWidth: 1,
        });
      }

      // Draw lines
      const textRgb = parseColorToRgb(t.color || '#0f172a');
      let currentLineY = textY + textH - fontSize - 6;

      for (const line of lines) {
        let drawX = textX + 6;
        if (t.align === 'center') {
          const w = font.widthOfTextAtSize(line, fontSize);
          drawX = textX + Math.max(6, (textW - w) / 2);
        } else if (t.align === 'right') {
          const w = font.widthOfTextAtSize(line, fontSize);
          drawX = textX + Math.max(6, textW - w - 6);
        }

        page.drawText(line, {
          x: drawX,
          y: currentLineY,
          size: fontSize,
          font,
          color: rgb(textRgb.r, textRgb.g, textRgb.b),
          maxWidth: textW - 12,
        });
        currentLineY -= fontSize * 1.3;
      }
    }

    // 5. Apply Interactive Form Fields (or visual representation)
    const pageFields = annotations.formFields.filter((f) => f.pageIndex === pageIdx);
    for (const f of pageFields) {
      const fieldW = (f.widthPercent / 100) * pageWidth;
      const fieldH = (f.heightPercent / 100) * pageHeight;
      const fieldX = (f.xPercent / 100) * pageWidth;
      const fieldY = pageHeight - ((f.yPercent / 100) * pageHeight) - fieldH;

      // Draw visual form field border/background
      page.drawRectangle({
        x: fieldX,
        y: fieldY,
        width: fieldW,
        height: fieldH,
        color: rgb(0.96, 0.97, 1),
        borderColor: rgb(0.31, 0.27, 0.9),
        borderWidth: 1.2,
      });

      // Label on top
      if (f.label) {
        page.drawText(f.label, {
          x: fieldX + 3,
          y: fieldY + fieldH + 2,
          size: 8,
          font: helveticaBold,
          color: rgb(0.25, 0.3, 0.4),
        });
      }

      // Value or placeholder inside
      if (f.type === 'checkbox') {
        const isChecked = f.value === true || f.value === 'true';
        if (isChecked) {
          page.drawText('X', {
            x: fieldX + (fieldW - 9) / 2,
            y: fieldY + (fieldH - 9) / 2,
            size: 11,
            font: helveticaBold,
            color: rgb(0.1, 0.5, 0.2),
          });
        }
      } else {
        const displayVal = String(f.value || f.placeholder || '');
        if (displayVal) {
          const isPlaceholder = !f.value && f.placeholder;
          page.drawText(displayVal, {
            x: fieldX + 5,
            y: fieldY + Math.max(3, (fieldH - 10) / 2),
            size: 9.5,
            font: isPlaceholder ? helveticaOblique : helveticaFont,
            color: isPlaceholder ? rgb(0.6, 0.65, 0.7) : rgb(0.1, 0.15, 0.25),
            maxWidth: fieldW - 10,
          });
        }
      }

      // Also register into native PDF Form if supported
      if (form) {
        try {
          const uniqueFieldName = `${f.name || f.id}_p${pageIdx}_${Math.random().toString(36).substr(2, 4)}`;
          if (f.type === 'text' || f.type === 'date') {
            const textField = form.createTextField(uniqueFieldName);
            if (f.value) textField.setText(String(f.value));
            textField.addToPage(page, {
              x: fieldX,
              y: fieldY,
              width: fieldW,
              height: fieldH,
            });
          } else if (f.type === 'checkbox') {
            const checkBox = form.createCheckBox(uniqueFieldName);
            if (f.value === true || f.value === 'true') checkBox.check();
            checkBox.addToPage(page, {
              x: fieldX,
              y: fieldY,
              width: fieldW,
              height: fieldH,
            });
          }
        } catch {
          // Native field registration skipped, visual representation remains
        }
      }
    }

    // 6. Apply Sticky Notes / Comments
    const pageStickies = annotations.stickyNotes.filter((st) => st.pageIndex === pageIdx);
    for (const note of pageStickies) {
      const noteX = (note.xPercent / 100) * pageWidth;
      const noteY = pageHeight - ((note.yPercent / 100) * pageHeight) - 22;

      const noteColorMap: Record<string, { r: number; g: number; b: number }> = {
        yellow: { r: 1, g: 0.95, b: 0.6 },
        blue: { r: 0.8, g: 0.9, b: 1 },
        green: { r: 0.8, g: 0.96, b: 0.85 },
        pink: { r: 1, g: 0.85, b: 0.9 },
        purple: { r: 0.9, g: 0.85, b: 1 },
        amber: { r: 1, g: 0.88, b: 0.7 },
      };
      const noteRgb = noteColorMap[note.color] || noteColorMap.yellow;

      // Small modern sticky note pin icon on page
      page.drawRectangle({
        x: Math.max(4, noteX),
        y: Math.max(4, noteY),
        width: 22,
        height: 22,
        color: rgb(noteRgb.r, noteRgb.g, noteRgb.b),
        borderColor: rgb(0.2, 0.2, 0.2),
        borderWidth: 1,
      });

      page.drawText('N', {
        x: Math.max(4, noteX) + 6,
        y: Math.max(4, noteY) + 5,
        size: 11,
        font: helveticaBold,
        color: rgb(0.1, 0.1, 0.1),
      });
    }
  }

  return await pdfDoc.save({ useObjectStreams: true });
}

/**
 * 10. Render a single high-res page image for the visual canvas editor
 */
export async function renderSinglePageToImage(
  pdfBytes: Uint8Array,
  pageIndex: number, // 0-indexed
  scale: number = 1.6
): Promise<{ dataUrl: string; width: number; height: number }> {
  try {
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice(0) });
    const pdf = await loadingTask.promise;
    const targetPageNum = Math.min(Math.max(1, pageIndex + 1), pdf.numPages);
    const page = await pdf.getPage(targetPageNum);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Canvas 2D context not available');
    }

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    // @ts-ignore
    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;

    return {
      dataUrl: canvas.toDataURL('image/png'),
      width: viewport.width,
      height: viewport.height,
    };
  } catch (err: any) {
    console.warn('PDF.js render single page failed, generating graphic placeholder:', err);
    return {
      dataUrl: generateFallbackThumbnail(pageIndex + 1),
      width: 595,
      height: 842,
    };
  }
}

/**
 * 11. Insert a blank page into an existing PDF
 */
export async function insertBlankPageToPdf(
  pdfBytes: Uint8Array,
  afterIndex: number = 0
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const total = pdfDoc.getPageCount();
  const insertPos = Math.min(Math.max(0, afterIndex + 1), total);
  
  // Use dimensions of adjacent page
  const refPage = pdfDoc.getPage(Math.max(0, Math.min(afterIndex, total - 1)));
  const { width, height } = refPage.getSize();

  pdfDoc.insertPage(insertPos, [width, height]);
  return await pdfDoc.save({ useObjectStreams: true });
}

/**
 * 12. Duplicate a page in a PDF
 */
export async function duplicatePageInPdf(
  pdfBytes: Uint8Array,
  pageIndex: number
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const [copiedPage] = await pdfDoc.copyPages(pdfDoc, [pageIndex]);
  pdfDoc.insertPage(pageIndex + 1, copiedPage);
  return await pdfDoc.save({ useObjectStreams: true });
}

/**
 * 13. Delete a page from a PDF
 */
export async function deletePageFromPdf(
  pdfBytes: Uint8Array,
  pageIndex: number
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  if (pdfDoc.getPageCount() <= 1) {
    throw new Error('Cannot delete the only page in the document.');
  }
  pdfDoc.removePage(pageIndex);
  return await pdfDoc.save({ useObjectStreams: true });
}

// =========================================================================
// 14. PDF Security, Encryption & Permission Engine
// =========================================================================

/**
 * Check if raw PDF bytes contain encryption markers
 */
export function isPdfEncryptedRaw(pdfBytes: Uint8Array): boolean {
  try {
    const head = new TextDecoder('latin1').decode(pdfBytes.subarray(0, Math.min(pdfBytes.length, 65536)));
    const tail = new TextDecoder('latin1').decode(pdfBytes.subarray(Math.max(0, pdfBytes.length - 16384)));
    return head.includes('/Encrypt') || tail.includes('/Encrypt') || head.includes('/Filter/Standard') || tail.includes('/Filter/Standard');
  } catch {
    return false;
  }
}

/**
 * Inspect PDF security status and test password if provided
 */
export async function checkPdfSecurityStatus(
  pdfBytes: Uint8Array,
  testPassword?: string
): Promise<PdfSecurityStatus> {
  const rawEncrypted = isPdfEncryptedRaw(pdfBytes);

  if (!rawEncrypted) {
    try {
      await PDFDocument.load(pdfBytes);
      return {
        isEncrypted: false,
        permissions: {
          allowPrinting: true,
          allowHighQualityPrint: true,
          allowCopying: true,
          allowExtraction: true,
          allowModifying: true,
          allowAnnotating: true,
          allowFillingForms: true,
          allowAssembly: true,
        },
      };
    } catch (e: any) {
      const msg = e?.message || '';
      if (!msg.toLowerCase().includes('encrypt')) {
        return { isEncrypted: false };
      }
    }
  }

  // PDF is encrypted
  if (testPassword !== undefined) {
    try {
      const task = pdfjsLib.getDocument({
        data: pdfBytes.slice(0),
        password: testPassword,
      });
      const doc = await task.promise;
      return {
        isEncrypted: true,
        unlockedWithPassword: true,
        algorithm: 'AES-256',
        permissions: {
          allowPrinting: true,
          allowHighQualityPrint: true,
          allowCopying: true,
          allowExtraction: true,
          allowModifying: true,
          allowAnnotating: true,
          allowFillingForms: true,
          allowAssembly: true,
        },
      };
    } catch {
      return {
        isEncrypted: true,
        unlockedWithPassword: false,
        algorithm: 'AES-256',
      };
    }
  }

  return {
    isEncrypted: true,
    algorithm: 'AES-256',
  };
}

/**
 * Remove password and decrypt a protected PDF into an unrestricted clean PDF
 */
export async function decryptPdfDocument(
  pdfBytes: Uint8Array,
  password: string = ''
): Promise<{ pdfBytes: Uint8Array; pageCount: number }> {
  // If not encrypted, simply return standard clean copy
  const isEnc = isPdfEncryptedRaw(pdfBytes);
  if (!isEnc) {
    const doc = await PDFDocument.load(pdfBytes);
    const saved = await doc.save({ useObjectStreams: true });
    return { pdfBytes: saved, pageCount: doc.getPageCount() };
  }

  const loadingTask = pdfjsLib.getDocument({
    data: pdfBytes.slice(0),
    password: password || '',
  });

  let pdf;
  try {
    pdf = await loadingTask.promise;
  } catch (err: any) {
    if (err?.name === 'PasswordException' || err?.message?.includes('password')) {
      throw new Error('Incorrect password. Please verify the password and try again.');
    }
    throw new Error(`Failed to decrypt document: ${err?.message || 'Unknown error'}`);
  }

  const numPages = pdf.numPages;
  const newDoc = await PDFDocument.create();

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    // Render at 2.2x scale for sharp crystal-clear print quality
    const viewport = page.getViewport({ scale: 2.2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      // @ts-ignore
      await page.render({ canvasContext: ctx, viewport }).promise;
      const imgDataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const imgRes = await fetch(imgDataUrl);
      const imgBuf = await imgRes.arrayBuffer();
      const embeddedImg = await newDoc.embedJpg(imgBuf);

      const origViewport = page.getViewport({ scale: 1.0 });
      const newPage = newDoc.addPage([origViewport.width, origViewport.height]);
      newPage.drawImage(embeddedImg, {
        x: 0,
        y: 0,
        width: origViewport.width,
        height: origViewport.height,
      });
    }
  }

  const resultBytes = await newDoc.save({ useObjectStreams: true });
  return { pdfBytes: resultBytes, pageCount: numPages };
}

/**
 * Encrypt a PDF document with user password, owner password, and granular permissions
 */
export async function encryptPdfDocument(
  pdfBytes: Uint8Array,
  options: PdfSecurityOptions,
  currentPassword?: string
): Promise<{ pdfBytes: Uint8Array; pageCount: number }> {
  let sourceBytes = pdfBytes;
  let pages = 1;

  // Check if currently encrypted
  const status = await checkPdfSecurityStatus(pdfBytes);
  if (status.isEncrypted) {
    if (!currentPassword && currentPassword !== '') {
      throw new Error('This document is currently password protected. Please enter the current password to modify its security settings.');
    }
    const decrypted = await decryptPdfDocument(pdfBytes, currentPassword || '');
    sourceBytes = decrypted.pdfBytes;
    pages = decrypted.pageCount;
  } else {
    try {
      const doc = await PDFDocument.load(pdfBytes);
      pages = doc.getPageCount();
    } catch {
      pages = 1;
    }
  }

  const userPassword = options.userPassword?.trim() || '';
  const ownerPassword = options.ownerPassword?.trim() || options.userPassword?.trim() || 'sec_adm_' + Math.random().toString(36).substring(2, 10);

  if (!userPassword && !options.ownerPassword?.trim()) {
    throw new Error('Please specify a User Password or Owner Password to secure the document.');
  }

  const encOptions = {
    algorithm: options.algorithm || 'AES-256',
    ownerPassword: ownerPassword,
    allowPrinting: options.permissions.allowPrinting,
    allowHighQualityPrint: options.permissions.allowHighQualityPrint,
    allowCopying: options.permissions.allowCopying,
    allowExtraction: options.permissions.allowExtraction,
    allowModifying: options.permissions.allowModifying,
    allowAnnotating: options.permissions.allowAnnotating,
    allowFillingForms: options.permissions.allowFillingForms,
    allowAssembly: options.permissions.allowAssembly,
  };

  try {
    const encryptedResult = await encryptPDF(sourceBytes, userPassword, encOptions);
    return {
      pdfBytes: encryptedResult,
      pageCount: pages,
    };
  } catch (err: any) {
    if (err instanceof AlreadyEncryptedError) {
      // Retry after explicit decrypt
      const decrypted = await decryptPdfDocument(sourceBytes, currentPassword || '');
      const encryptedResult = await encryptPDF(decrypted.pdfBytes, userPassword, encOptions);
      return {
        pdfBytes: encryptedResult,
        pageCount: decrypted.pageCount,
      };
    }
    throw err;
  }
}

/**
 * =========================================================================
 * 11. BATCH TO MULTI-PAGE PDF CONVERTER
 * Converts multiple images (PNG/JPG/WebP/GIF/SVG/BMP), text documents,
 * and existing PDFs into a unified, beautifully styled multi-page PDF.
 * =========================================================================
 */

import { BatchConvertItem, BatchToPdfOptions } from '../types';

export async function convertBatchToPdf(
  items: BatchConvertItem[],
  options: BatchToPdfOptions
): Promise<{ pdfBytes: Uint8Array; pageCount: number }> {
  if (!items || items.length === 0) {
    throw new Error('No items selected for batch conversion.');
  }

  const pdfDoc = await PDFDocument.create();
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const courierFont = await pdfDoc.embedFont(StandardFonts.Courier);

  // Parse background color
  const bgRgb = parseColorToRgb(options.backgroundColor || '#ffffff');

  // Margin values in points (72 pt = 1 inch)
  const marginMap = {
    none: 0,
    narrow: 18,
    normal: 36,
    generous: 54,
  };
  const marginPt = marginMap[options.margin] || 0;

  // Standard Page Dimensions (points)
  const standardPageSizes = {
    A4: [595.28, 841.89],
    Letter: [612.0, 792.0],
    Legal: [612.0, 1008.0],
    Square: [612.0, 612.0],
    Auto: [595.28, 841.89], // Dynamic per image
  };

  // 1. Optional Cover Page
  if (options.includeCoverPage && (options.coverTitle || options.title)) {
    const coverPage = pdfDoc.addPage([595.28, 841.89]);
    const { width: cW, height: cH } = coverPage.getSize();

    // Cover Background
    coverPage.drawRectangle({
      x: 0,
      y: 0,
      width: cW,
      height: cH,
      color: rgb(bgRgb.r, bgRgb.g, bgRgb.b),
    });

    // Decorative top accent band
    coverPage.drawRectangle({
      x: 0,
      y: cH - 24,
      width: cW,
      height: 24,
      color: rgb(0.31, 0.27, 0.9), // Indigo accent
    });

    // Cover Title
    const titleText = options.coverTitle || options.title || 'Compiled Document';
    coverPage.drawText(titleText, {
      x: 50,
      y: cH - 180,
      size: 28,
      font: helveticaBold,
      color: rgb(0.08, 0.12, 0.2),
      maxWidth: cW - 100,
    });

    // Decorative divider line
    coverPage.drawLine({
      start: { x: 50, y: cH - 205 },
      end: { x: cW - 50, y: cH - 205 },
      thickness: 2.5,
      color: rgb(0.31, 0.27, 0.9),
    });

    // Subtitle / Description
    if (options.coverSubtitle) {
      coverPage.drawText(options.coverSubtitle, {
        x: 50,
        y: cH - 240,
        size: 14,
        font: helveticaFont,
        color: rgb(0.35, 0.4, 0.48),
        maxWidth: cW - 100,
      });
    }

    // Metadata block
    coverPage.drawText(`Compiled: ${new Date().toLocaleDateString('en-US', { dateStyle: 'medium' })}  •  Total Items: ${items.length}`, {
      x: 50,
      y: 80,
      size: 10,
      font: helveticaOblique,
      color: rgb(0.5, 0.55, 0.62),
    });
  }

  // Process items in sequence
  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (options.onProgress) {
      options.onProgress(i + 1, items.length);
    }

    if (item.type === 'image') {
      await processImageItemToPdf(pdfDoc, item, options, marginPt, standardPageSizes, bgRgb, helveticaFont);
    } else if (item.type === 'text') {
      await processTextItemToPdf(pdfDoc, item, options, marginPt, standardPageSizes, bgRgb, helveticaFont, helveticaBold, courierFont);
    } else if (item.type === 'pdf') {
      await processPdfItemToPdf(pdfDoc, item);
    }
  }

  // Apply Page Numbers & Footers across pages if enabled
  const totalCreatedPages = pdfDoc.getPageCount();
  if (options.addPageNumbers || options.headerText || options.footerText) {
    for (let pIdx = 0; pIdx < totalCreatedPages; pIdx++) {
      // Skip cover page if requested
      if (options.includeCoverPage && pIdx === 0) continue;

      const page = pdfDoc.getPage(pIdx);
      const { width: pW, height: pH } = page.getSize();
      const pad = Math.max(marginPt, 18);

      // Header Text
      if (options.headerText) {
        page.drawText(options.headerText, {
          x: pad,
          y: pH - pad + 6,
          size: 8,
          font: helveticaFont,
          color: rgb(0.45, 0.45, 0.5),
        });
      }

      // Footer Text & Page Number
      if (options.footerText || options.addPageNumbers) {
        const pageNumText = options.addPageNumbers ? `Page ${pIdx + 1} of ${totalCreatedPages}` : '';
        const footerCombined = [options.footerText, pageNumText].filter(Boolean).join('  •  ');

        page.drawText(footerCombined, {
          x: pad,
          y: pad - 12,
          size: 8,
          font: helveticaFont,
          color: rgb(0.45, 0.45, 0.5),
        });
      }
    }
  }

  const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
  return {
    pdfBytes,
    pageCount: totalCreatedPages,
  };
}

/**
 * Embed an image item (JPG, PNG, WebP, GIF, SVG, etc.) onto one or more PDF pages
 */
async function processImageItemToPdf(
  pdfDoc: PDFDocument,
  item: BatchConvertItem,
  options: BatchToPdfOptions,
  marginPt: number,
  standardPageSizes: Record<string, number[]>,
  bgRgb: { r: number; g: number; b: number },
  font: any
) {
  // Load image through HTML Image element to guarantee universal format support (WebP, GIF, SVG, BMP, JPG, PNG)
  const img = new Image();
  img.crossOrigin = 'anonymous';

  const imgLoaded = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to decode image file: ${item.name}`));
  });

  if (item.dataUrl) {
    img.src = item.dataUrl;
  } else if (item.bytes) {
    const blob = new Blob([item.bytes], { type: item.mimeType || 'image/png' });
    img.src = URL.createObjectURL(blob);
  } else {
    throw new Error(`Missing image data for: ${item.name}`);
  }

  await imgLoaded;

  const rawWidth = img.naturalWidth || img.width || 800;
  const rawHeight = img.naturalHeight || img.height || 600;

  // Rotation consideration
  const rotationDeg = (item.rotation || 0) % 360;
  const is90or270 = rotationDeg === 90 || rotationDeg === 270;
  const renderedWidth = is90or270 ? rawHeight : rawWidth;
  const renderedHeight = is90or270 ? rawWidth : rawHeight;

  // Render on offscreen canvas to apply rotation and normalize to JPEG/PNG bytes
  const canvas = document.createElement('canvas');
  canvas.width = renderedWidth;
  canvas.height = renderedHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create 2D canvas context');

  // Fill canvas background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, renderedWidth, renderedHeight);

  // Rotate & draw image
  ctx.save();
  ctx.translate(renderedWidth / 2, renderedHeight / 2);
  ctx.rotate((rotationDeg * Math.PI) / 180);
  ctx.drawImage(img, -rawWidth / 2, -rawHeight / 2);
  ctx.restore();

  // Compress / Convert to bytes
  const qualityVal = options.quality === 'high' ? 0.95 : options.quality === 'medium' ? 0.85 : 0.70;
  const isPng = item.mimeType === 'image/png' && options.quality === 'high';
  const exportMime = isPng ? 'image/png' : 'image/jpeg';

  const dataUrl = canvas.toDataURL(exportMime, qualityVal);
  const resp = await fetch(dataUrl);
  const arrBuf = await resp.arrayBuffer();
  const imageBytes = new Uint8Array(arrBuf);

  let embeddedImage;
  if (isPng) {
    embeddedImage = await pdfDoc.embedPng(imageBytes);
  } else {
    embeddedImage = await pdfDoc.embedJpg(imageBytes);
  }

  // Calculate Page Size & Orientation
  let pageWidth: number;
  let pageHeight: number;

  if (options.pageSize === 'Auto') {
    // Exact 1:1 image bounds + margins (72 dpi conversion if large)
    const scaleFactor = Math.min(1, 1200 / Math.max(renderedWidth, renderedHeight));
    pageWidth = renderedWidth * scaleFactor * (72 / 96) + marginPt * 2;
    pageHeight = renderedHeight * scaleFactor * (72 / 96) + marginPt * 2;
  } else {
    const baseDim = standardPageSizes[options.pageSize] || standardPageSizes.A4;
    let [dimW, dimH] = baseDim;

    // Apply orientation
    if (options.orientation === 'auto') {
      if (renderedWidth > renderedHeight) {
        pageWidth = Math.max(dimW, dimH);
        pageHeight = Math.min(dimW, dimH);
      } else {
        pageWidth = Math.min(dimW, dimH);
        pageHeight = Math.max(dimW, dimH);
      }
    } else if (options.orientation === 'landscape') {
      pageWidth = Math.max(dimW, dimH);
      pageHeight = Math.min(dimW, dimH);
    } else {
      // Force Portrait
      pageWidth = Math.min(dimW, dimH);
      pageHeight = Math.max(dimW, dimH);
    }
  }

  const page = pdfDoc.addPage([pageWidth, pageHeight]);

  // Fill Page Background
  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
    color: rgb(bgRgb.r, bgRgb.g, bgRgb.b),
  });

  // Calculate Image Draw Dimensions & Positioning
  const printableWidth = Math.max(10, pageWidth - marginPt * 2);
  const printableHeight = Math.max(10, pageHeight - marginPt * 2);

  const imgAspect = renderedWidth / renderedHeight;
  const boxAspect = printableWidth / printableHeight;

  let drawW = printableWidth;
  let drawH = printableHeight;

  if (options.imageFit === 'contain' || options.pageSize === 'Auto') {
    if (imgAspect > boxAspect) {
      drawW = printableWidth;
      drawH = printableWidth / imgAspect;
    } else {
      drawH = printableHeight;
      drawW = printableHeight * imgAspect;
    }
  } else if (options.imageFit === 'cover') {
    if (imgAspect > boxAspect) {
      drawH = printableHeight;
      drawW = printableHeight * imgAspect;
    } else {
      drawW = printableWidth;
      drawH = printableWidth / imgAspect;
    }
  } else if (options.imageFit === 'original') {
    drawW = Math.min(renderedWidth * (72 / 96), printableWidth);
    drawH = drawW / imgAspect;
  }

  const drawX = marginPt + (printableWidth - drawW) / 2;
  const drawY = marginPt + (printableHeight - drawH) / 2;

  page.drawImage(embeddedImage, {
    x: drawX,
    y: drawY,
    width: drawW,
    height: drawH,
  });
}

/**
 * Process a text or markdown or CSV document into formatted, paginated PDF pages
 */
async function processTextItemToPdf(
  pdfDoc: PDFDocument,
  item: BatchConvertItem,
  options: BatchToPdfOptions,
  marginPt: number,
  standardPageSizes: Record<string, number[]>,
  bgRgb: { r: number; g: number; b: number },
  font: any,
  boldFont: any,
  monoFont: any
) {
  let text = item.textContent || '';
  if (!text && item.bytes) {
    text = new TextDecoder('utf-8').decode(item.bytes);
  }

  const baseDim = standardPageSizes[options.pageSize === 'Auto' ? 'A4' : options.pageSize] || standardPageSizes.A4;
  let [pageWidth, pageHeight] = baseDim;
  if (options.orientation === 'landscape') {
    pageWidth = Math.max(baseDim[0], baseDim[1]);
    pageHeight = Math.min(baseDim[0], baseDim[1]);
  }

  const margin = Math.max(marginPt, 36);
  const contentWidth = pageWidth - margin * 2;
  const lines = text.split(/\r?\n/);

  let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let currentY = pageHeight - margin;

  // Background
  currentPage.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
    color: rgb(bgRgb.r, bgRgb.g, bgRgb.b),
  });

  // Header Banner for this document item
  currentPage.drawText(item.name, {
    x: margin,
    y: currentY,
    size: 16,
    font: boldFont,
    color: rgb(0.1, 0.15, 0.25),
    maxWidth: contentWidth,
  });
  currentY -= 20;

  currentPage.drawLine({
    start: { x: margin, y: currentY },
    end: { x: margin + contentWidth, y: currentY },
    thickness: 1.5,
    color: rgb(0.31, 0.27, 0.9),
  });
  currentY -= 20;

  const isCodeOrCsv = item.name.endsWith('.csv') || item.name.endsWith('.json') || item.name.endsWith('.js') || item.name.endsWith('.ts');
  const textFont = isCodeOrCsv ? monoFont : font;
  const fontSize = isCodeOrCsv ? 9 : 10.5;
  const lineHeight = fontSize * 1.45;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];

    // Check if new page needed
    if (currentY < margin + 30) {
      currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      currentPage.drawRectangle({
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
        color: rgb(bgRgb.r, bgRgb.g, bgRgb.b),
      });
      currentY = pageHeight - margin;
    }

    if (!rawLine.trim()) {
      currentY -= lineHeight * 0.8;
      continue;
    }

    const isHeading = rawLine.startsWith('# ') || rawLine.startsWith('## ');
    const displayLine = isHeading ? rawLine.replace(/^#+\s*/, '') : rawLine;
    const lineFont = isHeading ? boldFont : textFont;
    const lineSize = isHeading ? 13 : fontSize;

    // Wrap long lines
    const words = displayLine.split(' ');
    let currentLine = '';

    for (let w = 0; w < words.length; w++) {
      const word = words[w];
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = lineFont.widthOfTextAtSize(testLine, lineSize);

      if (testWidth > contentWidth && currentLine) {
        currentPage.drawText(currentLine, {
          x: margin,
          y: currentY,
          size: lineSize,
          font: lineFont,
          color: isHeading ? rgb(0.1, 0.15, 0.25) : rgb(0.2, 0.25, 0.3),
        });
        currentY -= lineHeight;
        currentLine = word;

        if (currentY < margin + 30) {
          currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
          currentPage.drawRectangle({
            x: 0,
            y: 0,
            width: pageWidth,
            height: pageHeight,
            color: rgb(bgRgb.r, bgRgb.g, bgRgb.b),
          });
          currentY = pageHeight - margin;
        }
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      currentPage.drawText(currentLine, {
        x: margin,
        y: currentY,
        size: lineSize,
        font: lineFont,
        color: isHeading ? rgb(0.1, 0.15, 0.25) : rgb(0.2, 0.25, 0.3),
      });
      currentY -= lineHeight;
    }
  }
}

/**
 * Merge an existing PDF document into the compiled multi-page PDF
 */
async function processPdfItemToPdf(
  pdfDoc: PDFDocument,
  item: BatchConvertItem
) {
  if (!item.bytes && !item.dataUrl) return;

  let bytes = item.bytes;
  if (!bytes && item.dataUrl) {
    const res = await fetch(item.dataUrl);
    const buf = await res.arrayBuffer();
    bytes = new Uint8Array(buf);
  }
  if (!bytes) return;

  const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pageIndices = srcDoc.getPageIndices();
  const copiedPages = await pdfDoc.copyPages(srcDoc, pageIndices);

  for (let p = 0; p < copiedPages.length; p++) {
    const copiedPage = copiedPages[p];
    if (item.rotation) {
      const cur = copiedPage.getRotation().angle;
      copiedPage.setRotation(degrees((cur + item.rotation) % 360));
    }
    pdfDoc.addPage(copiedPage);
  }
}

/**
 * Generate a set of sample gallery items for testing batch conversion
 */
export async function createSampleBatchItems(): Promise<BatchConvertItem[]> {
  const items: BatchConvertItem[] = [];

  // 1. Generate Photo Slide (Canvas)
  const canvas1 = document.createElement('canvas');
  canvas1.width = 1200;
  canvas1.height = 800;
  const ctx1 = canvas1.getContext('2d');
  if (ctx1) {
    // Sunset gradient
    const grad = ctx1.createLinearGradient(0, 0, 1200, 800);
    grad.addColorStop(0, '#f97316');
    grad.addColorStop(0.5, '#ec4899');
    grad.addColorStop(1, '#6366f1');
    ctx1.fillStyle = grad;
    ctx1.fillRect(0, 0, 1200, 800);

    // Modern card graphic
    ctx1.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx1.roundRect(80, 80, 1040, 640, 32);
    ctx1.fill();

    ctx1.fillStyle = '#ffffff';
    ctx1.font = 'bold 54px sans-serif';
    ctx1.fillText('BATCH PHOTO ALBUM', 130, 200);

    ctx1.font = '30px sans-serif';
    ctx1.fillText('Image to Multi-Page PDF Conversion Demo', 130, 260);

    // Decorative graphics
    ctx1.fillStyle = '#ffffff';
    ctx1.beginPath();
    ctx1.arc(950, 400, 100, 0, Math.PI * 2);
    ctx1.fill();

    items.push({
      id: 'sample-img-1',
      name: 'Sunset_Album_Cover.jpg',
      type: 'image',
      mimeType: 'image/jpeg',
      size: 145000,
      dataUrl: canvas1.toDataURL('image/jpeg', 0.9),
      rotation: 0,
      width: 1200,
      height: 800,
    });
  }

  // 2. Generate Infographic Chart (Canvas)
  const canvas2 = document.createElement('canvas');
  canvas2.width = 900;
  canvas2.height = 1200;
  const ctx2 = canvas2.getContext('2d');
  if (ctx2) {
    ctx2.fillStyle = '#0f172a';
    ctx2.fillRect(0, 0, 900, 1200);

    // Title
    ctx2.fillStyle = '#38bdf8';
    ctx2.font = 'bold 44px sans-serif';
    ctx2.fillText('FINANCIAL METRICS', 70, 120);

    ctx2.fillStyle = '#94a3b8';
    ctx2.font = '22px sans-serif';
    ctx2.fillText('Quarterly Growth & Conversion Analytics', 70, 170);

    // Bar chart graphics
    const bars = [
      { label: 'Q1 Growth', val: 320, color: '#38bdf8' },
      { label: 'Q2 Volume', val: 480, color: '#818cf8' },
      { label: 'Q3 Enterprise', val: 620, color: '#34d399' },
      { label: 'Q4 Forecast', val: 780, color: '#f43f5e' },
    ];

    bars.forEach((b, idx) => {
      const y = 280 + idx * 180;
      ctx2.fillStyle = '#334155';
      ctx2.roundRect(70, y, 760, 50, 12);
      ctx2.fill();

      ctx2.fillStyle = b.color;
      ctx2.roundRect(70, y, b.val, 50, 12);
      ctx2.fill();

      ctx2.fillStyle = '#ffffff';
      ctx2.font = 'bold 20px sans-serif';
      ctx2.fillText(b.label, 85, y - 14);
      ctx2.fillText(`+${Math.round(b.val / 8)}%`, 70 + b.val + 20, y + 34);
    });

    items.push({
      id: 'sample-img-2',
      name: 'Q4_Analytics_Infographic.png',
      type: 'image',
      mimeType: 'image/png',
      size: 210000,
      dataUrl: canvas2.toDataURL('image/png'),
      rotation: 0,
      width: 900,
      height: 1200,
    });
  }

  // 3. Generate Project Notes Text Sheet
  items.push({
    id: 'sample-text-3',
    name: 'Executive_Meeting_Notes.md',
    type: 'text',
    mimeType: 'text/markdown',
    size: 2400,
    textContent: `# Project Apollo - Executive Briefing

## 1. Key Accomplishments
- Implemented real-time offline batch conversion for images and documents.
- Integrated military-grade AES-256 password protection & permission locking.
- Enabled multi-format support including PNG, JPEG, WebP, Markdown, CSV, and PDF merges.

## 2. Security & Compliance
- 100% Client-side sandbox execution ensures all user data remains strictly private.
- Zero server uploads or external telemetry transfers.

## 3. Action Items
- Distribute compiled multi-page portfolio report to stakeholders.
- Finalize mobile tablet optimization and tactile haptic triggers.`,
    rotation: 0,
  });

  return items;
}


