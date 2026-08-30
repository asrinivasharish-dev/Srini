import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutGrid,
  RotateCw,
  RotateCcw,
  Trash2,
  Copy,
  Plus,
  Undo2,
  Download,
  Eye,
  Upload,
  ArrowLeft,
  ArrowRight,
  ChevronsLeft,
  ChevronsRight,
  GripVertical,
  Hash,
  ArrowUpDown,
  FileCheck2,
  Sparkles,
  RefreshCw,
  Move,
  Check,
  X
} from 'lucide-react';
import { PageItem } from '../types';
import {
  organizeAndExportPdf,
  renderPdfPagesToThumbnails,
  formatBytes,
} from '../utils/pdfEngine';
import { triggerHaptic } from '../utils/haptics';
import confetti from 'canvas-confetti';

interface OrganizeToolProps {
  initialFile?: { name: string; bytes: Uint8Array } | null;
  onSuccess: (blob: Blob, filename: string, pageCount: number, action: 'organize') => void;
  onPreview: (blob: Blob, filename: string) => void;
  onLoadSample: () => void;
}

export const OrganizeTool: React.FC<OrganizeToolProps> = ({
  initialFile,
  onSuccess,
  onPreview,
  onLoadSample,
}) => {
  const [fileData, setFileData] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [pages, setPages] = useState<PageItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [isExporting, setIsExporting] = useState(false);

  // Drag and drop state (HTML5 and Touch)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Touch drag state
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const touchActiveRef = useRef<boolean>(false);
  const [touchDraggingIndex, setTouchDraggingIndex] = useState<number | null>(null);
  const [touchCoords, setTouchCoords] = useState<{ x: number; y: number } | null>(null);

  // Direct Position Selector Modal
  const [positionModalIndex, setPositionModalIndex] = useState<number | null>(null);
  const [targetPositionInput, setTargetPositionInput] = useState<number>(1);

  useEffect(() => {
    if (initialFile) {
      loadPdfBytes(initialFile.bytes, initialFile.name);
    }
  }, [initialFile]);

  const loadPdfBytes = async (bytes: Uint8Array, name: string) => {
    try {
      setIsLoading(true);
      setLoadingProgress({ current: 0, total: 0 });
      triggerHaptic('medium');
      setFileData(bytes);
      setFileName(name);

      const thumbs = await renderPdfPagesToThumbnails(bytes, 1000, (current, total) => {
        setLoadingProgress({ current, total });
      });
      const initialPages: PageItem[] = thumbs.map((thumb, idx) => ({
        id: `page-${idx + 1}-${Math.random().toString(36).substr(2, 5)}`,
        originalIndex: idx,
        pageNumber: idx + 1,
        rotation: 0,
        isDeleted: false,
        thumbnail: thumb,
      }));

      setPages(initialPages);
    } catch (err) {
      console.error('Error loading PDF for organize:', err);
      alert('Could not parse PDF. Please verify the file is a valid PDF.');
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
      loadPdfBytes(bytes, file.name);
    };
    reader.readAsArrayBuffer(file);
  };

  // Reorder page helper
  const reorderPage = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= pages.length || toIndex >= pages.length) {
      return;
    }
    triggerHaptic('medium');
    const updated = [...pages];
    const [movedItem] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, movedItem);
    setPages(updated);
  };

  // Step movement with arrow buttons
  const movePage = (index: number, direction: 'left' | 'right') => {
    const newIdx = direction === 'left' ? index - 1 : index + 1;
    reorderPage(index, newIdx);
  };

  // Extreme movement (jump to start or end)
  const jumpPage = (index: number, target: 'start' | 'end') => {
    const newIdx = target === 'start' ? 0 : pages.length - 1;
    reorderPage(index, newIdx);
  };

  // Direct position number jump
  const handleOpenPositionModal = (index: number) => {
    triggerHaptic('light');
    setPositionModalIndex(index);
    setTargetPositionInput(index + 1);
  };

  const handleApplyPositionModal = () => {
    if (positionModalIndex === null) return;
    const targetIdx = Math.max(0, Math.min(pages.length - 1, targetPositionInput - 1));
    reorderPage(positionModalIndex, targetIdx);
    setPositionModalIndex(null);
  };

  // HTML5 Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    triggerHaptic('light');
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== targetIndex) {
      reorderPage(draggedIndex, targetIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Mobile Touch Drag handlers
  const handleTouchStart = (e: React.TouchEvent, index: number) => {
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    touchActiveRef.current = false;
    setTouchDraggingIndex(index);
    setDragOverIndex(index);
    setTouchCoords({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchDraggingIndex === null) return;
    const touch = e.touches[0];
    setTouchCoords({ x: touch.clientX, y: touch.clientY });

    if (!touchActiveRef.current && touchStartPos.current) {
      const dx = Math.abs(touch.clientX - touchStartPos.current.x);
      const dy = Math.abs(touch.clientY - touchStartPos.current.y);
      if (dx > 8 || dy > 8) {
        touchActiveRef.current = true;
        triggerHaptic('light');
      }
    }

    if (touchActiveRef.current) {
      const elem = document.elementFromPoint(touch.clientX, touch.clientY);
      const card = elem?.closest('[data-page-index]');
      if (card) {
        const idx = parseInt(card.getAttribute('data-page-index') || '-1', 10);
        if (idx >= 0 && idx < pages.length && idx !== dragOverIndex) {
          setDragOverIndex(idx);
          triggerHaptic('light');
        }
      }
    }
  };

  const handleTouchEnd = () => {
    if (touchDraggingIndex !== null && dragOverIndex !== null && touchDraggingIndex !== dragOverIndex && touchActiveRef.current) {
      reorderPage(touchDraggingIndex, dragOverIndex);
    }
    setTouchDraggingIndex(null);
    setDragOverIndex(null);
    setTouchCoords(null);
    touchStartPos.current = null;
    touchActiveRef.current = false;
  };

  const rotatePage = (id: string, degreesToAdd: number) => {
    triggerHaptic('light');
    setPages(
      pages.map((p) =>
        p.id === id ? { ...p, rotation: (p.rotation + degreesToAdd + 360) % 360 } : p
      )
    );
  };

  const toggleDelete = (id: string) => {
    triggerHaptic('light');
    setPages(
      pages.map((p) => (p.id === id ? { ...p, isDeleted: !p.isDeleted } : p))
    );
  };

  const duplicatePage = (index: number) => {
    triggerHaptic('medium');
    const target = pages[index];
    const newPage: PageItem = {
      ...target,
      id: `copy-${Math.random().toString(36).substr(2, 7)}`,
      pageNumber: pages.length + 1,
    };
    const copy = [...pages];
    copy.splice(index + 1, 0, newPage);
    setPages(copy);
  };

  const addBlankPage = () => {
    triggerHaptic('light');
    const blank: PageItem = {
      id: `blank-${Math.random().toString(36).substr(2, 7)}`,
      originalIndex: -1,
      pageNumber: pages.length + 1,
      rotation: 0,
      isDeleted: false,
      isBlank: true,
    };
    setPages([...pages, blank]);
  };

  const rotateAll = (deg: number) => {
    triggerHaptic('medium');
    setPages(pages.map((p) => ({ ...p, rotation: (p.rotation + deg + 360) % 360 })));
  };

  const reversePageOrder = () => {
    triggerHaptic('medium');
    setPages([...pages].reverse());
  };

  const resetAll = () => {
    triggerHaptic('light');
    // Sort back by original index and reset rotations / deletions
    const sorted = [...pages]
      .filter((p) => !p.isBlank)
      .sort((a, b) => a.originalIndex - b.originalIndex)
      .map((p) => ({ ...p, isDeleted: false, rotation: 0 }));
    setPages(sorted);
  };

  const handleExport = async (previewOnly = false) => {
    if (!fileData) return;
    try {
      setIsExporting(true);
      triggerHaptic('medium');

      const exportedBytes = await organizeAndExportPdf(fileData, pages);
      const blob = new Blob([exportedBytes], { type: 'application/pdf' });
      const outName = fileName.replace(/\.pdf$/i, '') + '_Organized.pdf';
      const activePages = pages.filter((p) => !p.isDeleted).length;

      if (previewOnly) {
        onPreview(blob, outName);
      } else {
        triggerHaptic('success');
        confetti({ particleCount: 60, spread: 60, origin: { y: 0.75 } });
        onSuccess(blob, outName, activePages, 'organize');
      }
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export organized PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  const activeCount = pages.filter((p) => !p.isDeleted).length;

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 space-y-4 pb-12 overflow-y-auto bg-[#0F1115] text-white">
      {!fileData ? (
        <div className="flex-1 flex flex-col items-center justify-center space-y-5 p-6 text-center my-auto">
          <div className="w-16 h-16 rounded-[24px] bg-[#4F46E5]/15 border border-[#4F46E5]/30 text-[#818CF8] flex items-center justify-center shadow-xl">
            <LayoutGrid className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-xl font-bold text-white">Organise & Reorder Pages</h3>
            <p className="text-xs text-[#9CA3AF] max-w-xs mt-1">
              Visual thumbnail matrix. Press & drag cards or use step arrows & position numbering to organize PDF pages with precision.
            </p>
          </div>

          <div className="w-full max-w-xs space-y-2.5">
            <label className="flex items-center justify-center gap-2 py-3 px-5 rounded-full bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold text-xs shadow-lg shadow-[#4F46E5]/25 cursor-pointer active:scale-95 transition-all">
              <Upload className="w-4 h-4" />
              <span>Select PDF to Organise</span>
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            <button
              id="btn-organize-sample"
              type="button"
              onClick={onLoadSample}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-full bg-[#1F2937] hover:bg-[#374151] text-[#9CA3AF] hover:text-white text-xs font-medium border border-[#374151] active:scale-95 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#818CF8]" />
              <span>Load Sample Document</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 max-w-4xl mx-auto w-full">
          {/* File summary & Global Controls */}
          <div className="bg-[#1F2937] rounded-[24px] border border-[#374151] p-4 sm:p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="truncate pr-2">
                <h3 className="text-xs sm:text-sm font-bold text-white truncate">{fileName}</h3>
                <span className="text-[11px] text-[#9CA3AF]">
                  {activeCount} active of {pages.length} pages • {formatBytes(fileData.length)}
                </span>
              </div>

              <label className="text-xs text-[#818CF8] hover:text-white font-semibold cursor-pointer shrink-0 bg-[#4F46E5]/15 px-3 py-1 rounded-full border border-[#4F46E5]/30 transition-colors">
                Change
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#374151]/60 text-xs">
              <button
                type="button"
                onClick={() => rotateAll(90)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#111827] hover:bg-[#253243] text-white border border-[#374151] transition-colors"
                title="Rotate all pages 90 degrees clockwise"
              >
                <RotateCw className="w-3.5 h-3.5 text-[#818CF8]" />
                <span>Rotate All 90°</span>
              </button>

              <button
                type="button"
                onClick={reversePageOrder}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#111827] hover:bg-[#253243] text-white border border-[#374151] transition-colors"
                title="Reverse the entire sequence of pages"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-cyan-400" />
                <span>Reverse Order</span>
              </button>

              <button
                type="button"
                onClick={addBlankPage}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#111827] hover:bg-[#253243] text-white border border-[#374151] transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-[#10B981]" />
                <span>Add Blank Page</span>
              </button>

              <button
                type="button"
                onClick={resetAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#111827] hover:bg-[#253243] text-[#9CA3AF] hover:text-white border border-[#374151] transition-colors ml-auto"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset Original</span>
              </button>
            </div>

            {/* Instruction Tip */}
            <div className="bg-[#111827]/70 rounded-xl px-3 py-2 border border-[#374151]/50 flex items-center justify-between text-[11px] text-[#9CA3AF]">
              <div className="flex items-center gap-2">
                <Move className="w-3.5 h-3.5 text-[#818CF8]" />
                <span><strong>Press & Drag</strong> cards or tap <strong># position badges</strong> to jump directly.</span>
              </div>
              <span className="text-[10px] text-indigo-300/80 font-mono">1 – {pages.length} positions</span>
            </div>
          </div>

          {/* Thumbnails Bento Matrix */}
          {isLoading ? (
            <div className="p-12 text-center text-[#9CA3AF] bg-[#1F2937] rounded-3xl border border-[#374151] space-y-3">
              <div className="w-8 h-8 border-2 border-[#4F46E5] border-t-transparent rounded-full animate-spin mx-auto" />
              <div>
                <p className="text-xs font-semibold text-white">Rendering visual page thumbnails...</p>
                {loadingProgress.total > 0 && (
                  <p className="text-[11px] text-[#818CF8] mt-1 font-mono">
                    Processed {loadingProgress.current} of {loadingProgress.total} pages (Capacity up to 1,000 pages)
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
              {pages.map((page, idx) => {
                const isDel = page.isDeleted;
                const isBeingDragged = draggedIndex === idx || touchDraggingIndex === idx;
                const isDropTarget = (dragOverIndex === idx) && !isBeingDragged;
                const hasMovedFromOriginal = page.originalIndex !== -1 && page.originalIndex !== idx;

                return (
                  <div
                    key={page.id}
                    data-page-index={idx}
                    draggable={!isDel}
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={(e) => handleDrop(e, idx)}
                    onDragEnd={handleDragEnd}
                    className={`relative rounded-[22px] bg-[#1F2937] border transition-all duration-200 p-3 flex flex-col shadow-sm bento-card select-none group ${
                      isDel
                        ? 'border-rose-900/40 opacity-40 bg-rose-950/10'
                        : isBeingDragged
                        ? 'border-[#818CF8] bg-indigo-950/40 opacity-50 scale-95 shadow-xl ring-2 ring-[#818CF8]'
                        : isDropTarget
                        ? 'border-[#818CF8] bg-[#4F46E5]/15 scale-[1.02] shadow-xl ring-2 ring-[#818CF8]'
                        : 'border-[#374151] hover:border-[#4F46E5]/70'
                    }`}
                  >
                    {/* Drop Target indicator bar */}
                    {isDropTarget && (
                      <div className="absolute -top-1.5 left-2 right-2 h-1 bg-[#818CF8] rounded-full shadow-[0_0_8px_#818CF8] animate-pulse z-30" />
                    )}

                    {/* Top Card Info Bar: Position Numbering Badge & Drag Grip */}
                    <div className="flex items-center justify-between gap-1 mb-2">
                      {/* Position Numbering Badge (Clickable for Direct Jump) */}
                      <button
                        type="button"
                        onClick={() => handleOpenPositionModal(idx)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all border shadow-sm ${
                          hasMovedFromOriginal
                            ? 'bg-gradient-to-r from-amber-500/25 to-indigo-500/25 border-amber-400/40 text-amber-300 hover:border-amber-300'
                            : 'bg-[#111827] border-[#374151] text-white hover:border-[#818CF8] hover:text-[#818CF8]'
                        }`}
                        title="Click to jump to a specific position number"
                      >
                        <Hash className="w-3 h-3 text-[#818CF8]" />
                        <span>Pos {idx + 1}</span>
                        {hasMovedFromOriginal && (
                          <span className="text-[9px] text-[#9CA3AF] font-normal">
                            (was {page.originalIndex + 1})
                          </span>
                        )}
                      </button>

                      {/* Drag Handle (Supports Touch & Mouse) */}
                      <div
                        onTouchStart={(e) => handleTouchStart(e, idx)}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        className="p-1 rounded-lg text-[#9CA3AF] hover:text-white bg-[#111827] hover:bg-[#253243] border border-[#374151] cursor-grab active:cursor-grabbing transition-colors flex items-center justify-center"
                        title="Press and drag to reorder page"
                      >
                        <GripVertical className="w-3.5 h-3.5" />
                      </div>
                    </div>

                    {/* Thumbnail card */}
                    <div className="relative aspect-[3/4] bg-[#111827] rounded-xl overflow-hidden mb-2 flex items-center justify-center border border-[#374151]">
                      {page.isBlank ? (
                        <div className="w-full h-full bg-white flex flex-col items-center justify-center text-slate-400">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-600">
                            Blank Page
                          </span>
                        </div>
                      ) : page.thumbnail ? (
                        <img
                          src={page.thumbnail}
                          alt={`Page ${idx + 1}`}
                          className="w-full h-full object-contain transition-transform duration-300"
                          style={{
                            transform: `rotate(${page.rotation}deg)`,
                          }}
                        />
                      ) : (
                        <span className="text-xs text-[#9CA3AF]">Page {idx + 1}</span>
                      )}

                      {/* Rotation badge if rotated */}
                      {page.rotation > 0 && (
                        <span className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-full bg-[#4F46E5] text-white text-[9px] font-semibold shadow-md">
                          {page.rotation}°
                        </span>
                      )}

                      {/* Deleted overlay */}
                      {isDel && (
                        <div className="absolute inset-0 bg-rose-950/85 backdrop-blur-xs flex flex-col items-center justify-center text-rose-300 font-bold text-xs space-y-1">
                          <span>Marked for Removal</span>
                          <span className="text-[10px] font-normal text-rose-400">Will be excluded</span>
                        </div>
                      )}
                    </div>

                    {/* Navigation and Reorder Arrows Row */}
                    <div className="flex items-center justify-between gap-1 py-1 px-1 bg-[#111827]/60 rounded-xl border border-[#374151]/40 mb-2 text-xs">
                      {/* Jump to first */}
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => jumpPage(idx, 'start')}
                        className="p-1 rounded text-[#9CA3AF] hover:text-white hover:bg-[#1F2937] disabled:opacity-20 transition-colors"
                        title="Move to First Position (#1)"
                      >
                        <ChevronsLeft className="w-3.5 h-3.5" />
                      </button>

                      {/* Step Left */}
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => movePage(idx, 'left')}
                        className="p-1 rounded text-[#9CA3AF] hover:text-white hover:bg-[#1F2937] disabled:opacity-20 transition-colors"
                        title="Move 1 step earlier"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>

                      {/* Current Page Index Indicator */}
                      <span className="text-[10px] text-[#9CA3AF] font-mono">
                        {idx + 1} of {pages.length}
                      </span>

                      {/* Step Right */}
                      <button
                        type="button"
                        disabled={idx === pages.length - 1}
                        onClick={() => movePage(idx, 'right')}
                        className="p-1 rounded text-[#9CA3AF] hover:text-white hover:bg-[#1F2937] disabled:opacity-20 transition-colors"
                        title="Move 1 step later"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>

                      {/* Jump to last */}
                      <button
                        type="button"
                        disabled={idx === pages.length - 1}
                        onClick={() => jumpPage(idx, 'end')}
                        className="p-1 rounded text-[#9CA3AF] hover:text-white hover:bg-[#1F2937] disabled:opacity-20 transition-colors"
                        title="Move to Last Position"
                      >
                        <ChevronsRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Page Actions Toolbar (Rotate, Duplicate, Delete) */}
                    <div className="flex items-center justify-between gap-1 mt-auto pt-1 border-t border-[#374151]/50">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => rotatePage(page.id, -90)}
                          className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#818CF8] hover:bg-[#111827] transition-colors"
                          title="Rotate -90° (Left)"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => rotatePage(page.id, 90)}
                          className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#818CF8] hover:bg-[#111827] transition-colors"
                          title="Rotate +90° (Right)"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => duplicatePage(idx)}
                          className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#10B981] hover:bg-[#111827] transition-colors"
                          title="Duplicate Page"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleDelete(page.id)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isDel
                              ? 'text-[#10B981] hover:bg-emerald-950/40'
                              : 'text-[#EF4444] hover:bg-rose-950/40'
                          }`}
                          title={isDel ? 'Restore page' : 'Delete page'}
                        >
                          {isDel ? <Undo2 className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Sticky Bottom Action Bar */}
          <div className="sticky bottom-2 z-20 bg-[#1F2937]/95 backdrop-blur-md p-3.5 rounded-[24px] border border-[#374151] shadow-2xl flex items-center gap-3 mt-auto">
            <button
              id="btn-export-organize"
              type="button"
              disabled={isExporting || activeCount === 0}
              onClick={() => handleExport(false)}
              className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-full bg-[#4F46E5] hover:bg-[#4338CA] disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-[#4F46E5]/25 active:scale-95 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? 'Saving Layout...' : `Export ${activeCount} Pages`}</span>
            </button>
          </div>
        </div>
      )}

      {/* Floating Touch Drag Preview */}
      {touchDraggingIndex !== null && touchCoords && (
        <div
          className="fixed pointer-events-none z-50 transform -translate-x-1/2 -translate-y-1/2 bg-[#1F2937]/95 p-3 rounded-2xl border-2 border-indigo-400 shadow-2xl backdrop-blur-md opacity-90 flex items-center gap-2"
          style={{
            left: `${touchCoords.x}px`,
            top: `${touchCoords.y}px`,
            width: '140px',
          }}
        >
          <GripVertical className="w-4 h-4 text-indigo-400 shrink-0" />
          <div className="truncate text-xs font-bold text-white">
            Moving #{touchDraggingIndex + 1}
            {dragOverIndex !== null && (
              <span className="block text-[10px] text-indigo-300 font-normal">
                To pos #{dragOverIndex + 1}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Direct Position Numbering Modal */}
      {positionModalIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#1F2937] border border-[#374151] rounded-[28px] max-w-sm w-full p-5 shadow-2xl text-white space-y-4">
            <div className="flex items-center justify-between border-b border-[#374151] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-[#818CF8] flex items-center justify-center border border-indigo-500/30">
                  <Hash className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Set Page Position</h4>
                  <p className="text-[11px] text-[#9CA3AF]">
                    Move Page {positionModalIndex + 1} directly to any slot
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPositionModalIndex(null)}
                className="p-1 rounded-full text-[#9CA3AF] hover:text-white bg-[#111827]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="text-center py-2">
                <span className="text-xs text-[#9CA3AF]">Target Position Number</span>
                <div className="flex items-center justify-center gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setTargetPositionInput((prev) => Math.max(1, prev - 1));
                    }}
                    className="w-10 h-10 rounded-xl bg-[#111827] hover:bg-[#253243] border border-[#374151] text-lg font-bold flex items-center justify-center active:scale-95 transition-all"
                  >
                    -
                  </button>

                  <div className="flex items-baseline gap-1 bg-[#111827] px-4 py-2 rounded-2xl border-2 border-indigo-500/50">
                    <input
                      type="number"
                      min={1}
                      max={pages.length}
                      value={targetPositionInput}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val)) {
                          setTargetPositionInput(Math.max(1, Math.min(pages.length, val)));
                        }
                      }}
                      className="w-12 bg-transparent text-center text-xl font-bold text-white focus:outline-none"
                    />
                    <span className="text-xs text-[#9CA3AF]">/ {pages.length}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setTargetPositionInput((prev) => Math.min(pages.length, prev + 1));
                    }}
                    className="w-10 h-10 rounded-xl bg-[#111827] hover:bg-[#253243] border border-[#374151] text-lg font-bold flex items-center justify-center active:scale-95 transition-all"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Quick Jump Shortcuts */}
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setTargetPositionInput(1);
                  }}
                  className="py-1.5 px-2 rounded-xl bg-[#111827] hover:bg-[#253243] border border-[#374151] text-[11px] font-semibold text-[#818CF8] active:scale-95 transition-all"
                >
                  Position #1
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setTargetPositionInput(Math.ceil(pages.length / 2));
                  }}
                  className="py-1.5 px-2 rounded-xl bg-[#111827] hover:bg-[#253243] border border-[#374151] text-[11px] font-semibold text-white active:scale-95 transition-all"
                >
                  Middle (#{Math.ceil(pages.length / 2)})
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setTargetPositionInput(pages.length);
                  }}
                  className="py-1.5 px-2 rounded-xl bg-[#111827] hover:bg-[#253243] border border-[#374151] text-[11px] font-semibold text-emerald-400 active:scale-95 transition-all"
                >
                  Last (#{pages.length})
                </button>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPositionModalIndex(null)}
                className="flex-1 py-2.5 rounded-full bg-[#111827] hover:bg-[#253243] text-xs font-semibold text-[#9CA3AF] border border-[#374151]"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleApplyPositionModal}
                className="flex-1 py-2.5 rounded-full bg-[#4F46E5] hover:bg-[#4338CA] text-xs font-bold text-white shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Move to #{targetPositionInput}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
