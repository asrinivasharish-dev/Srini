import React, { useState, useEffect } from 'react';
import {
  FileImage,
  FileText,
  RotateCw,
  RotateCcw,
  Download,
  Upload,
  Sparkles,
  Check,
  Sliders,
  Archive,
  Image as ImageIcon,
  FileType,
  RefreshCw,
  Eye,
  Layers,
  ArrowRight,
  Sparkle,
  Plus,
  Trash2,
  MoveUp,
  MoveDown,
  Settings2,
  FolderPlus,
  BookOpen,
  FileSpreadsheet,
  FileCheck,
  Maximize2
} from 'lucide-react';
import { ExtractedImagePage, BatchConvertItem, BatchToPdfOptions } from '../types';
import {
  convertPdfToImages,
  convertPdfToDocx,
  createZipFromImages,
  renderPdfPagesToThumbnails,
  rotatePdfDocumentPages,
  convertBatchToPdf,
  createSampleBatchItems,
  formatBytes,
} from '../utils/pdfEngine';
import { triggerHaptic } from '../utils/haptics';
import confetti from 'canvas-confetti';

interface ConvertToolProps {
  initialFile?: { name: string; bytes: Uint8Array } | null;
  onSuccess: (blob: Blob, filename: string, pageCount: number, action: 'convert') => void;
  onPreview: (blob: Blob, filename: string) => void;
  onLoadSample: () => void;
}

type ConvertMode = 'batch_pdf' | 'images' | 'docx' | 'rotate';

export const ConvertTool: React.FC<ConvertToolProps> = ({
  initialFile,
  onSuccess,
  onPreview,
  onLoadSample,
}) => {
  const [fileData, setFileData] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [convertMode, setConvertMode] = useState<ConvertMode>('batch_pdf');
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  // ================= BATCH TO PDF STATE ================= //
  const [batchItems, setBatchItems] = useState<BatchConvertItem[]>([]);
  const [isConvertingBatch, setIsConvertingBatch] = useState(false);
  const [batchOutputName, setBatchOutputName] = useState<string>('Compiled_Batch_Document.pdf');
  const [batchOptions, setBatchOptions] = useState<BatchToPdfOptions>({
    title: 'Compiled Document Album',
    pageSize: 'A4',
    orientation: 'auto',
    margin: 'normal',
    imageFit: 'contain',
    backgroundColor: '#ffffff',
    quality: 'high',
    addPageNumbers: true,
    headerText: '',
    footerText: '',
    includeCoverPage: false,
    coverTitle: 'Project Portfolio & Document Album',
    coverSubtitle: 'Compiled with Mobile Document Studio',
  });
  const [batchResult, setBatchResult] = useState<{ blob: Blob; filename: string; pageCount: number } | null>(null);

  // ================= IMAGE EXTRACTION SETTINGS ================= //
  const [imageFormat, setImageFormat] = useState<'png' | 'jpeg'>('png');
  const [imageDpi, setImageDpi] = useState<number>(150);
  const [jpegQuality, setJpegQuality] = useState<number>(0.92);
  const [extractedImages, setExtractedImages] = useState<ExtractedImagePage[]>([]);
  const [isConvertingImages, setIsConvertingImages] = useState(false);

  // ================= DOCX CONVERSION SETTINGS & RESULT ================= //
  const [isConvertingDocx, setIsConvertingDocx] = useState(false);
  const [docxResult, setDocxResult] = useState<{
    blob: Blob;
    filename: string;
    pageCount: number;
    totalParagraphs: number;
  } | null>(null);

  // ================= INDIVIDUAL PAGE ROTATION MODE ================= //
  const [pageThumbnails, setPageThumbnails] = useState<string[]>([]);
  const [pageRotations, setPageRotations] = useState<number[]>([]);
  const [isRotating, setIsRotating] = useState(false);

  useEffect(() => {
    if (initialFile) {
      loadPdf(initialFile.bytes, initialFile.name);
      // If a PDF is provided, we can default to 'images' or allow 'batch_pdf'
      setConvertMode('images');
    }
  }, [initialFile]);

  const loadPdf = async (bytes: Uint8Array, name: string) => {
    try {
      setIsLoading(true);
      triggerHaptic('medium');
      setFileData(bytes);
      setFileName(name);
      setExtractedImages([]);
      setDocxResult(null);

      const thumbs = await renderPdfPagesToThumbnails(bytes);
      setPageThumbnails(thumbs);
      setPageRotations(new Array(thumbs.length).fill(0));
    } catch (err) {
      console.error('Error loading PDF:', err);
      alert('Unable to read this PDF file.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const bytes = new Uint8Array(reader.result as ArrayBuffer);
      loadPdf(bytes, file.name);
    };
    reader.readAsArrayBuffer(file);
  };

  // ================= BATCH TO PDF HANDLERS ================= //

  const handleBatchFilesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    triggerHaptic('medium');
    setIsLoading(true);

    const newItems: BatchConvertItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg|bmp|avif)$/i.test(file.name);
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isText = file.type.startsWith('text/') || /\.(txt|md|csv|json|js|ts|html)$/i.test(file.name);

      if (isImage) {
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });

        // Measure dimensions
        const dim = await new Promise<{ w: number; h: number }>((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
          img.onerror = () => resolve({ w: 800, h: 600 });
          img.src = dataUrl;
        });

        newItems.push({
          id: `batch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          type: 'image',
          mimeType: file.type || 'image/png',
          size: file.size,
          dataUrl,
          rotation: 0,
          width: dim.w,
          height: dim.h,
        });
      } else if (isPdf) {
        const bytes = await new Promise<Uint8Array>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
          reader.readAsArrayBuffer(file);
        });

        newItems.push({
          id: `batch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          type: 'pdf',
          mimeType: 'application/pdf',
          size: file.size,
          bytes,
          rotation: 0,
        });
      } else if (isText) {
        const textContent = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsText(file);
        });

        newItems.push({
          id: `batch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          type: 'text',
          mimeType: file.type || 'text/plain',
          size: file.size,
          textContent,
          rotation: 0,
        });
      }
    }

    setBatchItems((prev) => [...prev, ...newItems]);
    setIsLoading(false);
    triggerHaptic('success');
    e.target.value = '';
  };

  const handleLoadSampleBatch = async () => {
    try {
      setIsLoading(true);
      triggerHaptic('medium');
      const samples = await createSampleBatchItems();
      setBatchItems(samples);
      triggerHaptic('success');
    } catch (err) {
      console.error('Failed to load sample batch:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMoveBatchItem = (index: number, direction: 'up' | 'down') => {
    triggerHaptic('light');
    setBatchItems((prev) => {
      const copy = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= copy.length) return prev;
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  const handleRotateBatchItem = (index: number) => {
    triggerHaptic('light');
    setBatchItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        rotation: (copy[index].rotation + 90) % 360,
      };
      return copy;
    });
  };

  const handleRemoveBatchItem = (index: number) => {
    triggerHaptic('medium');
    setBatchItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearBatchItems = () => {
    triggerHaptic('medium');
    setBatchItems([]);
    setBatchResult(null);
  };

  const handleConvertBatchToPdf = async (previewOnly = false) => {
    if (batchItems.length === 0) return;

    try {
      setIsConvertingBatch(true);
      triggerHaptic('medium');
      setProgress({ current: 1, total: batchItems.length });

      const result = await convertBatchToPdf(batchItems, {
        ...batchOptions,
        onProgress: (current, total) => {
          setProgress({ current, total });
        },
      });

      const blob = new Blob([result.pdfBytes], { type: 'application/pdf' });
      const finalName = batchOutputName.endsWith('.pdf') ? batchOutputName : `${batchOutputName}.pdf`;

      setBatchResult({
        blob,
        filename: finalName,
        pageCount: result.pageCount,
      });

      if (previewOnly) {
        onPreview(blob, finalName);
      } else {
        triggerHaptic('success');
        confetti({ particleCount: 70, spread: 70, origin: { y: 0.7 } });

        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = finalName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        onSuccess(blob, finalName, result.pageCount, 'convert');
      }
    } catch (err: any) {
      console.error('Batch PDF conversion error:', err);
      alert(err?.message || 'Failed to convert batch items to PDF.');
    } finally {
      setIsConvertingBatch(false);
      setProgress(null);
    }
  };

  // ================= PDF TO IMAGES HANDLERS ================= //

  const handleConvertImages = async () => {
    if (!fileData) return;
    try {
      setIsConvertingImages(true);
      triggerHaptic('medium');
      setProgress({ current: 1, total: pageThumbnails.length || 1 });

      const images = await convertPdfToImages(fileData, {
        format: imageFormat,
        dpi: imageDpi,
        quality: jpegQuality,
        onProgress: (current, total) => {
          setProgress({ current, total });
        },
      });

      setExtractedImages(images);
      triggerHaptic('success');
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.75 } });
    } catch (err) {
      console.error('Error converting PDF to images:', err);
      alert('Failed to convert PDF to images.');
    } finally {
      setIsConvertingImages(false);
      setProgress(null);
    }
  };

  const downloadSingleImage = (img: ExtractedImagePage) => {
    triggerHaptic('light');
    const a = document.createElement('a');
    a.href = img.dataUrl;
    a.download = `${fileName.replace(/\.pdf$/i, '')}_page_${img.pageNumber}.${imageFormat === 'png' ? 'png' : 'jpg'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadAllZip = async () => {
    if (extractedImages.length === 0) return;
    try {
      triggerHaptic('medium');
      const zipName = `${fileName.replace(/\.pdf$/i, '')}_images.zip`;
      const zipResult = await createZipFromImages(extractedImages, zipName);

      triggerHaptic('success');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(zipResult.blob);
      a.download = zipResult.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      onSuccess(zipResult.blob, zipResult.filename, extractedImages.length, 'convert');
    } catch (err) {
      console.error('Error creating ZIP:', err);
      alert('Failed to package images into ZIP.');
    }
  };

  // ================= PDF TO DOCX HANDLERS ================= //

  const handleConvertDocx = async () => {
    if (!fileData) return;
    try {
      setIsConvertingDocx(true);
      triggerHaptic('medium');
      setProgress({ current: 1, total: pageThumbnails.length || 1 });

      const result = await convertPdfToDocx(fileData, {
        title: fileName.replace(/\.pdf$/i, ''),
        onProgress: (current, total) => {
          setProgress({ current, total });
        },
      });

      setDocxResult(result);
      triggerHaptic('success');
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.7 } });
      onSuccess(result.blob, result.filename, result.pageCount, 'convert');
    } catch (err) {
      console.error('Error converting PDF to DOCX:', err);
      alert('Failed to convert PDF to DOCX.');
    } finally {
      setIsConvertingDocx(false);
      setProgress(null);
    }
  };

  const handleDownloadDocx = () => {
    if (!docxResult) return;
    triggerHaptic('success');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(docxResult.blob);
    a.download = docxResult.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // ================= PAGE ROTATION HANDLERS ================= //

  const handleRotatePage = (index: number, delta: number) => {
    triggerHaptic('light');
    setPageRotations((prev) => {
      const copy = [...prev];
      copy[index] = (copy[index] + delta + 360) % 360;
      return copy;
    });
  };

  const handleRotateAll = (delta: number) => {
    triggerHaptic('medium');
    setPageRotations((prev) => prev.map((r) => (r + delta + 360) % 360));
  };

  const handleExportRotatedPdf = async (previewOnly = false) => {
    if (!fileData) return;
    try {
      setIsRotating(true);
      triggerHaptic('medium');

      const rotations = pageRotations.map((deg, idx) => ({
        pageIndex: idx,
        rotationAngle: deg,
      }));

      const rotatedBytes = await rotatePdfDocumentPages(fileData, rotations);
      const blob = new Blob([rotatedBytes], { type: 'application/pdf' });
      const outName = `${fileName.replace(/\.pdf$/i, '')}_Rotated.pdf`;

      if (previewOnly) {
        onPreview(blob, outName);
      } else {
        triggerHaptic('success');
        confetti({ particleCount: 60, spread: 60, origin: { y: 0.75 } });
        onSuccess(blob, outName, pageThumbnails.length, 'convert');
      }
    } catch (err) {
      console.error('Error rotating PDF:', err);
      alert('Failed to save rotated PDF.');
    } finally {
      setIsRotating(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-3 sm:p-5 space-y-4 pb-12 overflow-y-auto bg-[#0B0D12] text-white">
      {/* Top Conversion Mode Selector Bar */}
      <div className="bg-[#151922] rounded-[24px] border border-[#1F2430] p-2.5 shadow-sm max-w-4xl mx-auto w-full">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          <button
            id="tab-mode-batch"
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setConvertMode('batch_pdf');
            }}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl text-xs font-bold transition-all ${
              convertMode === 'batch_pdf'
                ? 'bg-gradient-to-r from-[#4F46E5] to-[#6366F1] text-white shadow-md shadow-indigo-500/25'
                : 'bg-[#0F1218] text-[#9CA3AF] hover:text-white border border-[#232A38]'
            }`}
          >
            <FolderPlus className="w-4 h-4 text-indigo-300" />
            <span>Batch to PDF</span>
          </button>

          <button
            id="tab-mode-images"
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setConvertMode('images');
            }}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl text-xs font-bold transition-all ${
              convertMode === 'images'
                ? 'bg-[#4F46E5] text-white shadow-md shadow-indigo-500/25'
                : 'bg-[#0F1218] text-[#9CA3AF] hover:text-white border border-[#232A38]'
            }`}
          >
            <FileImage className="w-4 h-4 text-blue-400" />
            <span>PDF to Images</span>
          </button>

          <button
            id="tab-mode-docx"
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setConvertMode('docx');
            }}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl text-xs font-bold transition-all ${
              convertMode === 'docx'
                ? 'bg-[#4F46E5] text-white shadow-md shadow-indigo-500/25'
                : 'bg-[#0F1218] text-[#9CA3AF] hover:text-white border border-[#232A38]'
            }`}
          >
            <FileText className="w-4 h-4 text-emerald-400" />
            <span>PDF to Word</span>
          </button>

          <button
            id="tab-mode-rotate"
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setConvertMode('rotate');
            }}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl text-xs font-bold transition-all ${
              convertMode === 'rotate'
                ? 'bg-[#4F46E5] text-white shadow-md shadow-indigo-500/25'
                : 'bg-[#0F1218] text-[#9CA3AF] hover:text-white border border-[#232A38]'
            }`}
          >
            <RotateCw className="w-4 h-4 text-amber-400" />
            <span>Rotate Pages</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODE 1: BATCH TO PDF (Multiple Images / Documents / PDFs -> Single PDF)   */}
      {/* ========================================================================= */}
      {convertMode === 'batch_pdf' && (
        <div className="space-y-4 max-w-4xl mx-auto w-full">
          {/* Header Summary Card */}
          <div className="bg-[#151922] rounded-[24px] border border-[#1F2430] p-4 sm:p-5 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                    <FolderPlus className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-white">Batch Images & Documents to PDF</h3>
                </div>
                <p className="text-xs text-[#8F9CAE] mt-1">
                  Combine multiple photos (JPG, PNG, WebP, GIF, SVG), text notes, and existing documents into a single multi-page PDF.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold shadow-md shadow-indigo-600/25 cursor-pointer active:scale-95 transition-all">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Images / Files</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*,application/pdf,text/*,.md,.csv,.json"
                    onChange={handleBatchFilesUpload}
                    className="hidden"
                  />
                </label>

                {batchItems.length === 0 && (
                  <button
                    type="button"
                    onClick={handleLoadSampleBatch}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#1C222E] hover:bg-[#252E3E] text-indigo-300 text-xs font-medium border border-[#2B3548] active:scale-95 transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Load Demo Gallery</span>
                  </button>
                )}

                {batchItems.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearBatchItems}
                    className="p-2 rounded-full bg-[#1C222E] hover:bg-rose-500/20 text-[#8F9CAE] hover:text-rose-400 border border-[#2B3548] transition-colors"
                    title="Clear All Items"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Empty Upload State */}
          {batchItems.length === 0 ? (
            <div className="rounded-[24px] border-2 border-dashed border-[#232A38] bg-[#11141C] p-8 sm:p-12 text-center flex flex-col items-center justify-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shadow-lg">
                <ImageIcon className="w-8 h-8" />
              </div>

              <div>
                <h4 className="text-base font-bold text-white">No items added yet</h4>
                <p className="text-xs text-[#8F9CAE] max-w-sm mt-1">
                  Upload multiple photos, graphic assets, scanned receipts, markdown notes, or PDF slides to compile them into one polished PDF.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <label className="flex items-center gap-2 px-5 py-3 rounded-full bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 cursor-pointer active:scale-95 transition-all">
                  <Upload className="w-4 h-4" />
                  <span>Choose Files (Batch Multiple)</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*,application/pdf,text/*,.md,.csv,.json"
                    onChange={handleBatchFilesUpload}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={handleLoadSampleBatch}
                  className="flex items-center gap-2 px-5 py-3 rounded-full bg-[#1A1F2B] hover:bg-[#232A3A] text-[#9CA3AF] hover:text-white text-xs font-medium border border-[#283244] active:scale-95 transition-all"
                >
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span>Load Sample Batch Gallery</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Left 2 Cols: Reorderable Item Thumbnails */}
              <div className="lg:col-span-2 space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-indigo-400" />
                    <span>Selected Items ({batchItems.length})</span>
                  </span>
                  <span className="text-[11px] text-[#8F9CAE]">
                    Use arrows to reorder • Tap ↻ to rotate
                  </span>
                </div>

                {/* Items List */}
                <div className="space-y-2.5">
                  {batchItems.map((item, idx) => (
                    <div
                      key={item.id}
                      className="bg-[#151922] border border-[#1F2430] hover:border-indigo-500/50 rounded-2xl p-3 flex items-center gap-3 shadow-sm transition-all group"
                    >
                      {/* Drag / Index Handle */}
                      <div className="w-6 h-6 rounded-lg bg-[#0F1218] text-indigo-300 font-mono text-[11px] font-bold flex items-center justify-center border border-[#232A38] shrink-0">
                        {idx + 1}
                      </div>

                      {/* Thumbnail Preview */}
                      <div className="w-14 h-14 rounded-xl bg-[#0B0D12] border border-[#232A38] overflow-hidden flex items-center justify-center shrink-0 relative">
                        {item.type === 'image' && item.dataUrl ? (
                          <img
                            src={item.dataUrl}
                            alt={item.name}
                            className="w-full h-full object-cover transition-transform duration-200"
                            style={{ transform: `rotate(${item.rotation}deg)` }}
                          />
                        ) : item.type === 'pdf' ? (
                          <div className="flex flex-col items-center justify-center text-rose-400">
                            <BookOpen className="w-6 h-6" />
                            <span className="text-[8px] font-bold mt-0.5">PDF</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center text-emerald-400">
                            <FileText className="w-6 h-6" />
                            <span className="text-[8px] font-bold mt-0.5">TXT</span>
                          </div>
                        )}

                        {item.rotation !== 0 && (
                          <span className="absolute bottom-0 right-0 bg-indigo-600 text-white text-[7px] font-bold px-1 rounded-tl">
                            {item.rotation}°
                          </span>
                        )}
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0 pr-2">
                        <h5 className="text-xs font-semibold text-white truncate">{item.name}</h5>
                        <div className="flex items-center gap-2 text-[10px] text-[#8F9CAE] mt-0.5">
                          <span className="uppercase font-mono font-bold text-indigo-400">{item.type}</span>
                          <span>•</span>
                          <span>{formatBytes(item.size)}</span>
                          {item.width && item.height && (
                            <>
                              <span>•</span>
                              <span>{item.width}×{item.height}px</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Item Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Rotate button for images */}
                        {item.type === 'image' && (
                          <button
                            type="button"
                            onClick={() => handleRotateBatchItem(idx)}
                            className="p-1.5 rounded-lg bg-[#0F1218] hover:bg-[#1E2533] text-[#8F9CAE] hover:text-white border border-[#232A38] transition-colors"
                            title="Rotate 90°"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Move Up */}
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveBatchItem(idx, 'up')}
                          className="p-1.5 rounded-lg bg-[#0F1218] hover:bg-[#1E2533] disabled:opacity-30 text-[#8F9CAE] hover:text-white border border-[#232A38] transition-colors"
                          title="Move Up"
                        >
                          <MoveUp className="w-3.5 h-3.5" />
                        </button>

                        {/* Move Down */}
                        <button
                          type="button"
                          disabled={idx === batchItems.length - 1}
                          onClick={() => handleMoveBatchItem(idx, 'down')}
                          className="p-1.5 rounded-lg bg-[#0F1218] hover:bg-[#1E2533] disabled:opacity-30 text-[#8F9CAE] hover:text-white border border-[#232A38] transition-colors"
                          title="Move Down"
                        >
                          <MoveDown className="w-3.5 h-3.5" />
                        </button>

                        {/* Remove */}
                        <button
                          type="button"
                          onClick={() => handleRemoveBatchItem(idx)}
                          className="p-1.5 rounded-lg bg-[#0F1218] hover:bg-rose-500/20 text-[#8F9CAE] hover:text-rose-400 border border-[#232A38] transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Quick Add More Bar */}
                <label className="flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-[#232A38] hover:border-indigo-500/50 bg-[#11141C] text-xs font-semibold text-[#8F9CAE] hover:text-white cursor-pointer transition-all">
                  <Plus className="w-4 h-4 text-indigo-400" />
                  <span>Add More Images or Documents to Batch</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*,application/pdf,text/*,.md,.csv,.json"
                    onChange={handleBatchFilesUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Right 1 Col: Layout, Page & Export Settings */}
              <div className="space-y-4">
                <div className="bg-[#151922] rounded-[24px] border border-[#1F2430] p-4 sm:p-5 space-y-4 shadow-sm">
                  <div className="flex items-center gap-2 pb-2 border-b border-[#232A38]">
                    <Settings2 className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-bold text-white">PDF Layout & Styling</span>
                  </div>

                  {/* Output Filename */}
                  <div>
                    <label className="text-[11px] font-semibold text-[#8F9CAE] block mb-1">
                      Output PDF Filename
                    </label>
                    <input
                      type="text"
                      value={batchOutputName}
                      onChange={(e) => setBatchOutputName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#0F1218] border border-[#232A38] text-xs text-white focus:outline-none focus:border-indigo-500"
                      placeholder="My_Compiled_Album.pdf"
                    />
                  </div>

                  {/* Page Size */}
                  <div>
                    <label className="text-[11px] font-semibold text-[#8F9CAE] block mb-1">
                      Page Dimensions
                    </label>
                    <select
                      value={batchOptions.pageSize}
                      onChange={(e) =>
                        setBatchOptions((prev) => ({
                          ...prev,
                          pageSize: e.target.value as any,
                        }))
                      }
                      className="w-full px-3 py-2 rounded-xl bg-[#0F1218] border border-[#232A38] text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="A4">A4 (210 × 297 mm Standard)</option>
                      <option value="Letter">US Letter (8.5 × 11 in)</option>
                      <option value="Legal">Legal (8.5 × 14 in)</option>
                      <option value="Auto">Auto (Fit Exact Image Bounds)</option>
                      <option value="Square">Square (1:1 Ratio)</option>
                    </select>
                  </div>

                  {/* Orientation */}
                  <div>
                    <label className="text-[11px] font-semibold text-[#8F9CAE] block mb-1">
                      Page Orientation
                    </label>
                    <div className="grid grid-cols-3 gap-1 bg-[#0F1218] p-1 rounded-xl border border-[#232A38]">
                      {[
                        { id: 'auto', label: 'Auto' },
                        { id: 'portrait', label: 'Portrait' },
                        { id: 'landscape', label: 'Landscape' },
                      ].map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => {
                            triggerHaptic('light');
                            setBatchOptions((prev) => ({
                              ...prev,
                              orientation: o.id as any,
                            }));
                          }}
                          className={`py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                            batchOptions.orientation === o.id
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'text-[#8F9CAE] hover:text-white'
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Margins */}
                  <div>
                    <label className="text-[11px] font-semibold text-[#8F9CAE] block mb-1">
                      Page Margin
                    </label>
                    <div className="grid grid-cols-4 gap-1 bg-[#0F1218] p-1 rounded-xl border border-[#232A38]">
                      {[
                        { id: 'none', label: 'None (0)' },
                        { id: 'narrow', label: 'Narrow' },
                        { id: 'normal', label: 'Normal' },
                        { id: 'generous', label: 'Wide' },
                      ].map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            triggerHaptic('light');
                            setBatchOptions((prev) => ({
                              ...prev,
                              margin: m.id as any,
                            }));
                          }}
                          className={`py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                            batchOptions.margin === m.id
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'text-[#8F9CAE] hover:text-white'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Image Fit */}
                  <div>
                    <label className="text-[11px] font-semibold text-[#8F9CAE] block mb-1">
                      Image Scale / Fit
                    </label>
                    <div className="grid grid-cols-3 gap-1 bg-[#0F1218] p-1 rounded-xl border border-[#232A38]">
                      {[
                        { id: 'contain', label: 'Fit Aspect' },
                        { id: 'cover', label: 'Fill / Crop' },
                        { id: 'original', label: '1:1 Scale' },
                      ].map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => {
                            triggerHaptic('light');
                            setBatchOptions((prev) => ({
                              ...prev,
                              imageFit: f.id as any,
                            }));
                          }}
                          className={`py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                            batchOptions.imageFit === f.id
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'text-[#8F9CAE] hover:text-white'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Page Background */}
                  <div>
                    <label className="text-[11px] font-semibold text-[#8F9CAE] block mb-1">
                      Canvas Background
                    </label>
                    <div className="flex items-center gap-2">
                      {[
                        { label: 'White', color: '#ffffff' },
                        { label: 'Off-White', color: '#f8fafc' },
                        { label: 'Dark Slate', color: '#0f172a' },
                        { label: 'Pure Black', color: '#000000' },
                      ].map((bg) => (
                        <button
                          key={bg.color}
                          type="button"
                          onClick={() => {
                            triggerHaptic('light');
                            setBatchOptions((prev) => ({
                              ...prev,
                              backgroundColor: bg.color,
                            }));
                          }}
                          className={`flex-1 py-1.5 px-1 rounded-xl text-[10px] font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                            batchOptions.backgroundColor === bg.color
                              ? 'border-indigo-500 text-white bg-[#1E2533]'
                              : 'border-[#232A38] text-[#8F9CAE] bg-[#0F1218]'
                          }`}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full border border-gray-400"
                            style={{ backgroundColor: bg.color }}
                          />
                          <span>{bg.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Compression Quality */}
                  <div>
                    <label className="text-[11px] font-semibold text-[#8F9CAE] block mb-1">
                      Image Compression Quality
                    </label>
                    <div className="grid grid-cols-3 gap-1 bg-[#0F1218] p-1 rounded-xl border border-[#232A38]">
                      {[
                        { id: 'high', label: 'HD Crisp (95%)' },
                        { id: 'medium', label: 'Balanced (85%)' },
                        { id: 'compact', label: 'Compact (70%)' },
                      ].map((q) => (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => {
                            triggerHaptic('light');
                            setBatchOptions((prev) => ({
                              ...prev,
                              quality: q.id as any,
                            }));
                          }}
                          className={`py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                            batchOptions.quality === q.id
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'text-[#8F9CAE] hover:text-white'
                          }`}
                        >
                          {q.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Header / Footer & Page Numbers */}
                  <div className="pt-2 border-t border-[#232A38] space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-white">
                      <input
                        type="checkbox"
                        checked={batchOptions.addPageNumbers}
                        onChange={(e) =>
                          setBatchOptions((prev) => ({
                            ...prev,
                            addPageNumbers: e.target.checked,
                          }))
                        }
                        className="rounded text-indigo-600 focus:ring-0"
                      />
                      <span>Include "Page X of Y" Footer</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-xs text-white">
                      <input
                        type="checkbox"
                        checked={batchOptions.includeCoverPage}
                        onChange={(e) =>
                          setBatchOptions((prev) => ({
                            ...prev,
                            includeCoverPage: e.target.checked,
                          }))
                        }
                        className="rounded text-indigo-600 focus:ring-0"
                      />
                      <span>Generate Aesthetic Cover Page</span>
                    </label>

                    {batchOptions.includeCoverPage && (
                      <div className="space-y-2 pl-5 pt-1">
                        <input
                          type="text"
                          value={batchOptions.coverTitle}
                          onChange={(e) =>
                            setBatchOptions((prev) => ({
                              ...prev,
                              coverTitle: e.target.value,
                            }))
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg bg-[#0F1218] border border-[#232A38] text-[11px] text-white"
                          placeholder="Cover Title"
                        />
                        <input
                          type="text"
                          value={batchOptions.coverSubtitle}
                          onChange={(e) =>
                            setBatchOptions((prev) => ({
                              ...prev,
                              coverSubtitle: e.target.value,
                            }))
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg bg-[#0F1218] border border-[#232A38] text-[11px] text-white"
                          placeholder="Cover Subtitle"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress Bar during conversion */}
                {progress && (
                  <div className="bg-[#151922] p-4 rounded-2xl border border-indigo-500/30 space-y-2">
                    <div className="flex items-center justify-between text-xs text-indigo-300 font-semibold">
                      <span>Compiling item {progress.current} of {progress.total}...</span>
                      <span>{Math.round((progress.current / progress.total) * 100)}%</span>
                    </div>
                    <div className="w-full h-2 bg-[#0F1218] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-200"
                        style={{ width: `${(progress.current / progress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-2">
                  <button
                    id="btn-compile-batch-pdf"
                    type="button"
                    disabled={isConvertingBatch || batchItems.length === 0}
                    onClick={() => handleConvertBatchToPdf(false)}
                    className="w-full flex items-center justify-center gap-2 py-3.5 px-5 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-40 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 active:scale-95 transition-all"
                  >
                    <Download className="w-4 h-4" />
                    <span>
                      {isConvertingBatch ? 'Compiling PDF...' : `Compile & Download PDF (${batchItems.length} items)`}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: PDF TO IMAGES                                                     */}
      {/* ========================================================================= */}
      {convertMode === 'images' && (
        <div className="space-y-4 max-w-4xl mx-auto w-full">
          {!fileData ? (
            <div className="bg-[#151922] rounded-[24px] border border-[#1F2430] p-8 text-center flex flex-col items-center justify-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/15 text-blue-400 flex items-center justify-center border border-blue-500/20">
                <FileImage className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Select a PDF to Extract Images</h4>
                <p className="text-xs text-[#8F9CAE] max-w-xs mt-1">
                  Extract high-resolution PNG or JPG images from every page of your PDF document.
                </p>
              </div>
              <label className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md shadow-blue-600/25 cursor-pointer active:scale-95 transition-all">
                <Upload className="w-4 h-4" />
                <span>Upload PDF Document</span>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Settings Card */}
              <div className="bg-[#151922] rounded-[24px] border border-[#1F2430] p-4 sm:p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-blue-400" /> Image Export Settings
                  </span>
                  <span className="text-[11px] text-[#8F9CAE]">
                    {pageThumbnails.length} pages loaded ({fileName})
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Format selection */}
                  <div>
                    <label className="text-[11px] text-[#8F9CAE] font-medium block mb-1.5">
                      Image Format
                    </label>
                    <div className="flex rounded-xl bg-[#0F1218] p-1 border border-[#232A38]">
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          setImageFormat('png');
                        }}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          imageFormat === 'png'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-[#8F9CAE] hover:text-white'
                        }`}
                      >
                        PNG (Lossless / Crisp)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          setImageFormat('jpeg');
                        }}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          imageFormat === 'jpeg'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-[#8F9CAE] hover:text-white'
                        }`}
                      >
                        JPG (Compact Size)
                      </button>
                    </div>
                  </div>

                  {/* DPI / Resolution */}
                  <div>
                    <label className="text-[11px] text-[#8F9CAE] font-medium block mb-1.5">
                      Resolution (DPI)
                    </label>
                    <div className="flex rounded-xl bg-[#0F1218] p-1 border border-[#232A38]">
                      {[
                        { label: '72 DPI (Web)', val: 72 },
                        { label: '150 DPI (Medium)', val: 150 },
                        { label: '300 DPI (HD Print)', val: 300 },
                      ].map((item) => (
                        <button
                          key={item.val}
                          type="button"
                          onClick={() => {
                            triggerHaptic('light');
                            setImageDpi(item.val);
                          }}
                          className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                            imageDpi === item.val
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'text-[#8F9CAE] hover:text-white'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#232A38]">
                  <button
                    id="btn-extract-images"
                    type="button"
                    disabled={isConvertingImages}
                    onClick={handleConvertImages}
                    className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-blue-600/25 active:scale-95 transition-all"
                  >
                    <FileImage className="w-4 h-4" />
                    <span>{isConvertingImages ? 'Extracting Images...' : `Extract All ${pageThumbnails.length} Pages as Images`}</span>
                  </button>
                </div>
              </div>

              {/* Extracted Images Grid */}
              {extractedImages.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-400" /> Extracted Images ({extractedImages.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleDownloadAllZip}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm active:scale-95 transition-all"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      <span>Download All as ZIP</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {extractedImages.map((img) => (
                      <div
                        key={img.pageNumber}
                        className="bg-[#151922] rounded-2xl border border-[#1F2430] p-2.5 space-y-2 flex flex-col"
                      >
                        <div className="aspect-[3/4] bg-[#0F1218] rounded-xl overflow-hidden flex items-center justify-center border border-[#232A38]">
                          <img src={img.dataUrl} alt={img.filename} className="w-full h-full object-contain" />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[#8F9CAE]">
                          <span>Page {img.pageNumber}</span>
                          <span>{formatBytes(img.size)}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => downloadSingleImage(img)}
                          className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg bg-[#0F1218] hover:bg-[#1E2533] text-white text-[11px] font-semibold border border-[#232A38] transition-colors mt-auto"
                        >
                          <Download className="w-3 h-3" />
                          <span>Save {imageFormat.toUpperCase()}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 3: PDF TO WORD (.DOCX)                                               */}
      {/* ========================================================================= */}
      {convertMode === 'docx' && (
        <div className="space-y-4 max-w-4xl mx-auto w-full">
          {!fileData ? (
            <div className="bg-[#151922] rounded-[24px] border border-[#1F2430] p-8 text-center flex flex-col items-center justify-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                <FileText className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Select a PDF to Convert to Word</h4>
                <p className="text-xs text-[#8F9CAE] max-w-xs mt-1">
                  Extract formatted text, headings, and paragraphs directly into editable Microsoft Word (.docx).
                </p>
              </div>
              <label className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md shadow-emerald-600/25 cursor-pointer active:scale-95 transition-all">
                <Upload className="w-4 h-4" />
                <span>Upload PDF Document</span>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          ) : (
            <div className="bg-[#151922] rounded-[24px] border border-[#1F2430] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white">Convert PDF to Microsoft Word (.docx)</h4>
                  <p className="text-xs text-[#8F9CAE] mt-0.5">
                    Extracts document layout, structural headings, and readable text layers with 100% offline client privacy.
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <button
                  id="btn-convert-docx"
                  type="button"
                  disabled={isConvertingDocx}
                  onClick={handleConvertDocx}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-emerald-600/25 active:scale-95 transition-all"
                >
                  <FileText className="w-4 h-4" />
                  <span>{isConvertingDocx ? 'Parsing & Formatting DOCX...' : 'Convert Document to Word (.docx)'}</span>
                </button>
              </div>

              {docxResult && (
                <div className="bg-[#0F1218] rounded-2xl border border-emerald-500/40 p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <Check className="w-5 h-5" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-white">{docxResult.filename}</h5>
                      <span className="text-[11px] text-[#8F9CAE]">
                        {formatBytes(docxResult.blob.size)} • {docxResult.pageCount} Pages • {docxResult.totalParagraphs} Paragraphs
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleDownloadDocx}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md active:scale-95 transition-all"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 4: ROTATE PAGES                                                      */}
      {/* ========================================================================= */}
      {convertMode === 'rotate' && (
        <div className="space-y-4 max-w-4xl mx-auto w-full">
          {!fileData ? (
            <div className="bg-[#151922] rounded-[24px] border border-[#1F2430] p-8 text-center flex flex-col items-center justify-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/20">
                <RotateCw className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Select a PDF to Rotate Pages</h4>
                <p className="text-xs text-[#8F9CAE] max-w-xs mt-1">
                  Adjust individual page orientations or rotate the entire document 90°, 180°, or 270°.
                </p>
              </div>
              <label className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs shadow-md shadow-amber-600/25 cursor-pointer active:scale-95 transition-all">
                <Upload className="w-4 h-4" />
                <span>Upload PDF Document</span>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Batch rotation toolbar */}
              <div className="bg-[#151922] rounded-[24px] border border-[#1F2430] p-4 sm:p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <RotateCw className="w-4 h-4 text-amber-400" /> Rotate Pages
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setPageRotations(new Array(pageThumbnails.length).fill(0));
                    }}
                    className="text-xs text-[#8F9CAE] hover:text-white flex items-center gap-1 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reset Angles</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#232A38]">
                  <button
                    type="button"
                    onClick={() => handleRotateAll(-90)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0F1218] hover:bg-[#1E2533] text-white text-xs border border-[#232A38] transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                    <span>All -90° (Left)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRotateAll(90)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0F1218] hover:bg-[#1E2533] text-white text-xs border border-[#232A38] transition-colors"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-amber-400" />
                    <span>All +90° (Right)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRotateAll(180)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0F1218] hover:bg-[#1E2533] text-white text-xs border border-[#232A38] transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                    <span>All 180° (Flip)</span>
                  </button>
                </div>
              </div>

              {/* Thumbnails grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {pageThumbnails.map((thumb, idx) => {
                  const currentRot = pageRotations[idx] || 0;
                  return (
                    <div
                      key={idx}
                      className="rounded-2xl bg-[#151922] border border-[#1F2430] hover:border-amber-500/50 p-2.5 flex flex-col shadow-sm transition-all"
                    >
                      <div className="relative aspect-[3/4] bg-[#0F1218] rounded-xl overflow-hidden mb-2 flex items-center justify-center border border-[#232A38]">
                        <img
                          src={thumb}
                          alt={`Page ${idx + 1}`}
                          className="w-full h-full object-contain transition-transform duration-300"
                          style={{ transform: `rotate(${currentRot}deg)` }}
                        />
                        <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full bg-[#0F1218]/90 text-white text-[10px] font-bold border border-[#232A38]">
                          #{idx + 1}
                        </span>
                        {currentRot !== 0 && (
                          <span className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-full bg-amber-600 text-white text-[9px] font-semibold">
                            {currentRot}°
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-1 mt-auto pt-1">
                        <button
                          type="button"
                          onClick={() => handleRotatePage(idx, -90)}
                          className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg bg-[#0F1218] hover:bg-[#1E2533] text-[#8F9CAE] hover:text-white text-[11px] border border-[#232A38] transition-colors"
                        >
                          <RotateCcw className="w-3 h-3 text-amber-400" />
                          <span>-90°</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRotatePage(idx, 90)}
                          className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg bg-[#0F1218] hover:bg-[#1E2533] text-[#8F9CAE] hover:text-white text-[11px] border border-[#232A38] transition-colors"
                        >
                          <RotateCw className="w-3 h-3 text-amber-400" />
                          <span>+90°</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Save rotated PDF bottom bar */}
              <div className="sticky bottom-2 z-20 bg-[#151922]/95 backdrop-blur-md p-3.5 rounded-2xl border border-[#1F2430] shadow-2xl flex items-center gap-3">
                <button
                  type="button"
                  disabled={isRotating}
                  onClick={() => handleExportRotatedPdf(false)}
                  className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-amber-600/25 active:scale-95 transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>{isRotating ? 'Saving Rotation...' : 'Save & Download Rotated PDF'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
