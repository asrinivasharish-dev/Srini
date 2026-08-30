import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Download,
  Share2,
  ZoomIn,
  ZoomOut,
  FileText,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  ExternalLink,
  RotateCw,
  Edit3,
  BookOpen,
  Sun,
  Moon,
  Sparkles,
  Sliders,
  Eye,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import { triggerHaptic } from '../utils/haptics';
import { formatBytes } from '../utils/pdfEngine';
import * as pdfjsLib from 'pdfjs-dist';

interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfBlob: Blob | null;
  filename: string;
  pageCount?: number;
  onEdit?: () => void;
}

type ReaderTheme = 'dark' | 'sepia' | 'oled' | 'paper';

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({
  isOpen,
  onClose,
  pdfBlob,
  filename,
  pageCount = 1,
  onEdit,
}) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(pageCount || 1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [rotation, setRotation] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [pageCanvases, setPageCanvases] = useState<string[]>([]);
  const [renderError, setRenderError] = useState<string | null>(null);

  // Reader Mode State
  const [isReaderMode, setIsReaderMode] = useState<boolean>(false);
  const [readerTheme, setReaderTheme] = useState<ReaderTheme>('oled');
  const [showReaderHud, setShowReaderHud] = useState<boolean>(true);
  const [readerZoom, setReaderZoom] = useState<number>(1.0);
  const [showGestureTip, setShowGestureTip] = useState<boolean>(false);
  const [pageFlipAnim, setPageFlipAnim] = useState<'left' | 'right' | null>(null);

  const pdfDocRef = useRef<any>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const hudTimeoutRef = useRef<any>(null);

  // Touch gesture tracking for Reader Mode
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  useEffect(() => {
    if (isOpen && pdfBlob) {
      const url = URL.createObjectURL(pdfBlob);
      setObjectUrl(url);
      loadPdf(pdfBlob);

      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setObjectUrl(null);
      setPageCanvases([]);
      setIsLoading(false);
      setRenderError(null);
      setIsReaderMode(false);
    }
  }, [isOpen, pdfBlob]);

  // Auto-hide HUD in Reader Mode after 3.5s
  const resetHudTimer = useCallback(() => {
    if (hudTimeoutRef.current) {
      clearTimeout(hudTimeoutRef.current);
    }
    setShowReaderHud(true);
    hudTimeoutRef.current = setTimeout(() => {
      setShowReaderHud(false);
    }, 3500);
  }, []);

  const loadPdf = async (blob: Blob) => {
    setIsLoading(true);
    setRenderError(null);
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
      const pdf = await loadingTask.promise;
      pdfDocRef.current = pdf;
      setNumPages(pdf.numPages);
      setCurrentPage(1);

      // Render all pages to canvas images for high-performance reading & gestures
      await renderAllPages(pdf, scale, rotation);
    } catch (err: any) {
      console.warn('PDF.js render fallback:', err);
      setRenderError('Could not parse canvas preview, displaying alternative reader mode.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderAllPages = async (pdf: any, currentScale: number, rot: number) => {
    try {
      const renderedImages: string[] = [];
      const total = pdf.numPages;

      for (let i = 1; i <= total; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: currentScale, rotation: rot });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        if (context) {
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          // @ts-ignore
          await page.render({
            canvasContext: context,
            viewport: viewport,
          }).promise;

          renderedImages.push(canvas.toDataURL('image/png'));
        }
      }
      setPageCanvases(renderedImages);
    } catch (e: any) {
      console.error('Error rendering pages to canvas:', e);
    }
  };

  const handleZoomIn = () => {
    triggerHaptic('light');
    const newScale = Math.min(scale + 0.25, 2.5);
    setScale(newScale);
    if (pdfDocRef.current) {
      renderAllPages(pdfDocRef.current, newScale, rotation);
    }
  };

  const handleZoomOut = () => {
    triggerHaptic('light');
    const newScale = Math.max(scale - 0.25, 0.6);
    setScale(newScale);
    if (pdfDocRef.current) {
      renderAllPages(pdfDocRef.current, newScale, rotation);
    }
  };

  const handleRotate = () => {
    triggerHaptic('medium');
    const newRot = (rotation + 90) % 360;
    setRotation(newRot);
    if (pdfDocRef.current) {
      renderAllPages(pdfDocRef.current, scale, newRot);
    }
  };

  // Reader Mode Page Navigation
  const goToNextPage = useCallback(() => {
    if (currentPage < numPages) {
      triggerHaptic('light');
      setPageFlipAnim('left');
      setCurrentPage((prev) => prev + 1);
      setTimeout(() => setPageFlipAnim(null), 300);
      resetHudTimer();
    }
  }, [currentPage, numPages, resetHudTimer]);

  const goToPrevPage = useCallback(() => {
    if (currentPage > 1) {
      triggerHaptic('light');
      setPageFlipAnim('right');
      setCurrentPage((prev) => prev - 1);
      setTimeout(() => setPageFlipAnim(null), 300);
      resetHudTimer();
    }
  }, [currentPage, resetHudTimer]);

  const toggleReaderMode = () => {
    triggerHaptic('medium');
    const nextMode = !isReaderMode;
    setIsReaderMode(nextMode);
    if (nextMode) {
      setShowGestureTip(true);
      resetHudTimer();
      setTimeout(() => setShowGestureTip(false), 4000);
    }
  };

  // Touch Gesture Handlers in Reader Mode
  const handleReaderTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
  };

  const handleReaderTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const deltaTime = Date.now() - touchStartRef.current.time;

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Horizontal Swipe Gesture (turn page)
    if (absX > 45 && absX > absY && deltaTime < 500) {
      if (deltaX < 0) {
        // Swiped Left -> Next page
        goToNextPage();
      } else {
        // Swiped Right -> Prev page
        goToPrevPage();
      }
      touchStartRef.current = null;
      return;
    }

    // Tap Gesture Detection
    if (absX < 15 && absY < 15 && deltaTime < 300) {
      const windowWidth = window.innerWidth;
      const tapX = touch.clientX;

      // Left 25% tap -> Prev Page
      if (tapX < windowWidth * 0.25) {
        goToPrevPage();
      }
      // Right 25% tap -> Next Page
      else if (tapX > windowWidth * 0.75) {
        goToNextPage();
      }
      // Center 50% tap -> Toggle HUD
      else {
        triggerHaptic('light');
        setShowReaderHud((prev) => !prev);
      }
    }

    touchStartRef.current = null;
  };

  // Keyboard navigation for Reader Mode
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isReaderMode) {
        if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ' || e.key.toLowerCase() === 'd') {
          e.preventDefault();
          goToNextPage();
        } else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key.toLowerCase() === 'a') {
          e.preventDefault();
          goToPrevPage();
        } else if (e.key === 'Home') {
          e.preventDefault();
          setCurrentPage(1);
          triggerHaptic('light');
          resetHudTimer();
        } else if (e.key === 'End') {
          e.preventDefault();
          setCurrentPage(numPages);
          triggerHaptic('light');
          resetHudTimer();
        } else if (e.key === 'Escape' || e.key.toLowerCase() === 'r') {
          e.preventDefault();
          toggleReaderMode();
        }
      } else {
        if (e.key.toLowerCase() === 'r' && !['input', 'textarea'].includes((e.target as HTMLElement)?.tagName?.toLowerCase())) {
          toggleReaderMode();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isReaderMode, goToNextPage, goToPrevPage, numPages, resetHudTimer]);

  if (!isOpen || !pdfBlob) return null;

  const handleDownload = () => {
    triggerHaptic('success');
    if (!objectUrl) return;
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleShare = async () => {
    triggerHaptic('medium');
    if (navigator.share && pdfBlob) {
      try {
        const file = new File([pdfBlob], filename.endsWith('.pdf') ? filename : `${filename}.pdf`, {
          type: 'application/pdf',
        });
        await navigator.share({
          files: [file],
          title: filename,
        });
      } catch {
        handleDownload();
      }
    } else {
      handleDownload();
    }
  };

  const handleOpenExternal = () => {
    triggerHaptic('medium');
    if (objectUrl) {
      window.open(objectUrl, '_blank');
    }
  };

  // Reader Mode Theme Styles
  const getThemeBg = () => {
    switch (readerTheme) {
      case 'oled':
        return 'bg-black text-white';
      case 'sepia':
        return 'bg-[#1C1814] text-[#E8DCC4]';
      case 'paper':
        return 'bg-[#2B2D30] text-[#E0E2E4]';
      case 'dark':
      default:
        return 'bg-[#0D1017] text-white';
    }
  };

  const getPageBg = () => {
    switch (readerTheme) {
      case 'sepia':
        return 'bg-[#2A241E] border-[#3D352C]';
      case 'oled':
        return 'bg-[#111111] border-[#222222]';
      case 'paper':
        return 'bg-[#1E2022] border-[#383A3E]';
      case 'dark':
      default:
        return 'bg-[#161B22] border-[#2E3642]';
    }
  };

  // =========================================================================
  // RENDER: FULLSCREEN DISTRACTION-FREE READER MODE
  // =========================================================================
  if (isReaderMode) {
    const currentImg = pageCanvases[currentPage - 1];
    const readingProgressPercent = Math.round((currentPage / numPages) * 100);

    return (
      <div
        id="pdf-fullscreen-reader"
        onTouchStart={handleReaderTouchStart}
        onTouchEnd={handleReaderTouchEnd}
        onMouseMove={resetHudTimer}
        className={`fixed inset-0 z-50 ${getThemeBg()} flex flex-col justify-between overflow-hidden select-none transition-colors duration-300`}
      >
        {/* Floating Top HUD */}
        <div
          className={`absolute top-4 left-4 right-4 z-40 flex items-center justify-between pointer-events-none transition-all duration-300 transform ${
            showReaderHud ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
          }`}
        >
          {/* Left: Document Name & Page status */}
          <div className="flex items-center gap-2.5 bg-black/75 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-2xl pointer-events-auto">
            <BookOpen className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-white truncate max-w-[140px] sm:max-w-[240px]">
              {filename}
            </span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-emerald-300">
              {currentPage} / {numPages}
            </span>
          </div>

          {/* Right: Theme Selector & Exit Reader Mode Button */}
          <div className="flex items-center gap-2 pointer-events-auto">
            {/* Theme Picker Pill */}
            <div className="flex items-center bg-black/75 backdrop-blur-md p-1 rounded-full border border-white/10 shadow-2xl">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setReaderTheme('oled');
                }}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                  readerTheme === 'oled'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="OLED Pure Black"
              >
                OLED
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setReaderTheme('sepia');
                }}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                  readerTheme === 'sepia'
                    ? 'bg-[#E8DCC4] text-[#1C1814] shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="Warm Sepia Eye-Care"
              >
                Sepia
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setReaderTheme('dark');
                }}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                  readerTheme === 'dark'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="Deep Night Blue"
              >
                Night
              </button>
            </div>

            {/* Exit Reader Mode */}
            <button
              id="btn-exit-reader-mode"
              type="button"
              onClick={toggleReaderMode}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 active:scale-95 transition-all"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exit Reader</span>
            </button>
          </div>
        </div>

        {/* First-time Gesture Tip Banner */}
        {showGestureTip && (
          <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-40 bg-emerald-950/90 border border-emerald-500/40 text-emerald-200 px-4 py-2 rounded-2xl text-xs font-medium backdrop-blur-md shadow-2xl animate-fadeIn flex items-center gap-2">
            <span>👈 Swipe left/right or tap sides to turn pages • Tap center for controls</span>
          </div>
        )}

        {/* Central Page Display Canvas */}
        <div className="flex-1 relative flex items-center justify-center p-2 sm:p-6 overflow-hidden">
          {/* Subtle Left Side Tap Indicator Area */}
          <button
            type="button"
            onClick={goToPrevPage}
            disabled={currentPage <= 1}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-black/40 hover:bg-black/80 text-white/60 hover:text-white backdrop-blur-md border border-white/10 disabled:opacity-0 transition-all opacity-0 hover:opacity-100 focus:opacity-100"
            title="Previous Page (Left Arrow / Swipe Right)"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          {/* Central Page Card with smooth flip animation */}
          <div
            className={`relative max-w-full max-h-[88vh] sm:max-h-[92vh] flex items-center justify-center p-1.5 sm:p-3 rounded-2xl border shadow-2xl transition-all duration-300 ${getPageBg()} ${
              pageFlipAnim === 'left'
                ? 'translate-x-4 opacity-75 scale-[0.98]'
                : pageFlipAnim === 'right'
                ? '-translate-x-4 opacity-75 scale-[0.98]'
                : 'translate-x-0 opacity-100 scale-100'
            }`}
          >
            {currentImg ? (
              <img
                src={currentImg}
                alt={`Page ${currentPage}`}
                className="max-h-[84vh] sm:max-h-[88vh] w-auto max-w-full object-contain rounded-lg shadow-md bg-white select-none pointer-events-none"
              />
            ) : (
              <div className="p-16 text-center text-zinc-400">
                <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <span>Loading Page {currentPage}...</span>
              </div>
            )}
          </div>

          {/* Subtle Right Side Tap Indicator Area */}
          <button
            type="button"
            onClick={goToNextPage}
            disabled={currentPage >= numPages}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-black/40 hover:bg-black/80 text-white/60 hover:text-white backdrop-blur-md border border-white/10 disabled:opacity-0 transition-all opacity-0 hover:opacity-100 focus:opacity-100"
            title="Next Page (Right Arrow / Swipe Left)"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>

        {/* Floating Bottom HUD (Controls & Progress) */}
        <div
          className={`absolute bottom-4 left-4 right-4 z-40 flex flex-col items-center gap-2 pointer-events-none transition-all duration-300 transform ${
            showReaderHud ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          {/* Quick Page Slider Pill */}
          <div className="flex items-center gap-3 bg-black/80 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/10 shadow-2xl pointer-events-auto">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => {
                triggerHaptic('light');
                setCurrentPage(1);
                resetHudTimer();
              }}
              className="p-1 text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
              title="First Page"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={goToPrevPage}
              className="p-1 text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Slider */}
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={1}
                max={numPages}
                value={currentPage}
                onChange={(e) => {
                  triggerHaptic('light');
                  setCurrentPage(parseInt(e.target.value, 10));
                  resetHudTimer();
                }}
                className="w-24 sm:w-48 accent-emerald-500 cursor-pointer h-1.5 bg-zinc-700 rounded-lg"
              />
              <span className="text-xs font-mono font-bold text-white min-w-[65px] text-center">
                {currentPage} / {numPages}
              </span>
            </div>

            <button
              type="button"
              disabled={currentPage >= numPages}
              onClick={goToNextPage}
              className="p-1 text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              disabled={currentPage >= numPages}
              onClick={() => {
                triggerHaptic('light');
                setCurrentPage(numPages);
                resetHudTimer();
              }}
              className="p-1 text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
              title="Last Page"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Ultra-thin Reading Progress Bar at the very bottom */}
        <div className="w-full h-1 bg-white/5 relative z-40">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300 shadow-[0_0_8px_#10B981]"
            style={{ width: `${readingProgressPercent}%` }}
          />
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER: STANDARD MODAL VIEW
  // =========================================================================
  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
      <div className="bg-[#1F2937] border border-[#374151] rounded-[28px] sm:rounded-[32px] w-full max-w-4xl h-[90vh] overflow-hidden shadow-2xl flex flex-col text-white">
        {/* Top bar */}
        <div className="px-4 sm:px-5 py-3 border-b border-[#374151] flex items-center justify-between bg-[#111827]">
          <div className="flex items-center gap-3 overflow-hidden pr-2">
            <div className="w-8 h-8 rounded-xl bg-[#4F46E5]/20 text-[#818CF8] flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="truncate">
              <h3 className="font-bold text-white text-sm truncate">{filename}</h3>
              <p className="text-[11px] text-[#9CA3AF]">
                {formatBytes(pdfBlob.size)} • {numPages} Page{numPages > 1 ? 's' : ''} • Bento PDF Viewer
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* READER MODE TOGGLE BUTTON */}
            <button
              id="btn-viewer-reader-mode"
              type="button"
              onClick={toggleReaderMode}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-600/35 to-teal-600/35 hover:from-emerald-600/50 hover:to-teal-600/50 border border-emerald-500/50 text-xs font-semibold text-emerald-300 hover:text-white shadow-sm active:scale-95 transition-all"
              title="Enter distraction-free Reader Mode (Shortkey: R)"
            >
              <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Reader Mode</span>
            </button>

            {/* Zoom Controls */}
            <div className="hidden sm:flex items-center bg-[#1F2937] rounded-full px-2 py-1 border border-[#374151] text-xs">
              <button
                type="button"
                onClick={handleZoomOut}
                className="p-1 text-[#9CA3AF] hover:text-white transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] px-2 font-mono text-[#818CF8]">
                {Math.round(scale * 100)}%
              </span>
              <button
                type="button"
                onClick={handleZoomIn}
                className="p-1 text-[#9CA3AF] hover:text-white transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleRotate}
              className="p-2 rounded-full bg-[#1F2937] hover:bg-[#374151] text-[#9CA3AF] hover:text-white border border-[#374151] transition-all"
              title="Rotate 90°"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>

            {objectUrl && (
              <button
                type="button"
                onClick={handleOpenExternal}
                className="hidden sm:flex p-2 rounded-full bg-[#1F2937] hover:bg-[#374151] text-[#9CA3AF] hover:text-white border border-[#374151] transition-all"
                title="Open in New Tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              id="btn-viewer-share"
              onClick={handleShare}
              className="p-2 rounded-full bg-[#1F2937] hover:bg-[#374151] text-[#9CA3AF] hover:text-white border border-[#374151] transition-all"
              title="Share / Save PDF"
            >
              <Share2 className="w-4 h-4" />
            </button>

            {onEdit && (
              <button
                id="btn-viewer-edit"
                onClick={() => {
                  triggerHaptic('medium');
                  onEdit();
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1F2937] hover:bg-[#374151] text-[#818CF8] hover:text-white border border-[#4F46E5]/40 text-xs font-semibold active:scale-95 transition-all"
                title="Edit, annotate, add sticky notes, shapes or forms"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Edit & Annotate</span>
              </button>
            )}

            <button
              id="btn-viewer-download"
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 rounded-full bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold shadow-md shadow-[#4F46E5]/25 active:scale-95 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>

            <button
              id="btn-viewer-close"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[#1F2937] hover:bg-[#374151] text-[#9CA3AF] hover:text-white flex items-center justify-center ml-1 border border-[#374151]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* PDF Reader Canvas Area */}
        <div
          ref={canvasContainerRef}
          className="flex-1 bg-[#0F1115] relative flex flex-col items-center overflow-y-auto p-4 sm:p-6 space-y-4"
        >
          {isLoading ? (
            <div className="flex flex-col items-center justify-center space-y-3 m-auto py-12">
              <div className="w-8 h-8 border-3 border-[#4F46E5] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-[#9CA3AF] font-medium">Rendering high-resolution pages...</p>
            </div>
          ) : pageCanvases.length > 0 ? (
            pageCanvases.map((imgSrc, idx) => (
              <div
                key={idx}
                className="flex flex-col items-center bg-[#1F2937] p-2 sm:p-3 rounded-2xl border border-[#374151] shadow-2xl transition-all"
              >
                <div className="text-[11px] text-[#9CA3AF] font-medium mb-2 px-2 py-0.5 rounded-full bg-[#111827] border border-[#374151]">
                  Page {idx + 1} of {numPages}
                </div>
                <img
                  src={imgSrc}
                  alt={`Page ${idx + 1}`}
                  className="rounded-lg shadow-lg max-w-full bg-white transition-transform"
                />
              </div>
            ))
          ) : objectUrl ? (
            <iframe
              src={`${objectUrl}#toolbar=0&navpanes=0&scrollbar=1`}
              className="w-full h-full border-0 bg-[#0F1115] rounded-xl"
              title="PDF Preview"
            />
          ) : (
            <div className="text-[#9CA3AF] text-sm m-auto">No preview available</div>
          )}
        </div>

        {/* Bottom Status / Navigation bar */}
        <div className="px-5 py-2.5 bg-[#111827] border-t border-[#374151] flex items-center justify-between text-xs text-[#9CA3AF]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#10B981]" />
            <span className="font-medium text-white text-[11px]">Private Client Sandbox</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleReaderMode}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
            >
              <BookOpen className="w-3 h-3" />
              <span>Full-Screen Reader (Press 'R')</span>
            </button>

            <span className="text-[11px] text-[#9CA3AF]">
              {numPages} Page{numPages > 1 ? 's' : ''} Rendered
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

