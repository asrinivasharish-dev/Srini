import React, { useState, useEffect } from 'react';
import {
  Layers,
  Upload,
  Plus,
  Trash2,
  MoveUp,
  MoveDown,
  Download,
  Eye,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { mergeMultiplePdfs, formatBytes } from '../utils/pdfEngine';
import { triggerHaptic } from '../utils/haptics';
import confetti from 'canvas-confetti';

interface CombineToolProps {
  initialFiles?: { name: string; bytes: Uint8Array }[];
  onSuccess: (blob: Blob, filename: string, pageCount: number, action: 'combine') => void;
  onPreview: (blob: Blob, filename: string) => void;
  onLoadSample: () => void;
}

interface MergeQueueItem {
  id: string;
  name: string;
  size: number;
  data: Uint8Array;
  pageCount: number;
  pageRanges: string;
}

export const CombineTool: React.FC<CombineToolProps> = ({
  initialFiles,
  onSuccess,
  onPreview,
  onLoadSample,
}) => {
  const [queue, setQueue] = useState<MergeQueueItem[]>([]);
  const [outputName, setOutputName] = useState('Merged_Master_Document');
  const [isMerging, setIsMerging] = useState(false);

  useEffect(() => {
    if (initialFiles && initialFiles.length > 0 && queue.length === 0) {
      initialFiles.forEach((file) => addPdfToQueue(file.bytes, file.name));
    }
  }, [initialFiles]);

  const addPdfToQueue = async (bytes: Uint8Array, name: string) => {
    try {
      const doc = await PDFDocument.load(bytes);
      const count = doc.getPageCount();
      const newItem: MergeQueueItem = {
        id: Math.random().toString(36).substr(2, 9),
        name,
        size: bytes.byteLength,
        data: bytes,
        pageCount: count,
        pageRanges: '',
      };
      setQueue((prev) => [...prev, newItem]);
    } catch (err) {
      console.error('Failed to parse PDF for merging:', err);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    triggerHaptic('medium');

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const bytes = new Uint8Array(reader.result as ArrayBuffer);
        addPdfToQueue(bytes, file.name);
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    triggerHaptic('light');
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= queue.length) return;
    const copy = [...queue];
    const [moved] = copy.splice(index, 1);
    copy.splice(newIdx, 0, moved);
    setQueue(copy);
  };

  const removeItem = (id: string) => {
    triggerHaptic('light');
    setQueue(queue.filter((q) => q.id !== id));
  };

  const updatePageRange = (id: string, range: string) => {
    setQueue(queue.map((q) => (q.id === id ? { ...q, pageRanges: range } : q)));
  };

  const handleMerge = async (previewOnly = false) => {
    if (queue.length === 0) {
      alert('Please add at least one PDF file to combine.');
      return;
    }

    try {
      setIsMerging(true);
      triggerHaptic('medium');

      const mergedBytes = await mergeMultiplePdfs(
        queue.map((q) => ({
          data: q.data,
          name: q.name,
          pageRanges: q.pageRanges,
        }))
      );

      const blob = new Blob([mergedBytes], { type: 'application/pdf' });
      const filename = outputName.trim() ? outputName.replace(/\s+/g, '_') : 'Merged_Document';

      const mergedDoc = await PDFDocument.load(mergedBytes);
      const totalMergedPages = mergedDoc.getPageCount();

      if (previewOnly) {
        onPreview(blob, filename);
      } else {
        triggerHaptic('success');
        confetti({ particleCount: 70, spread: 70, origin: { y: 0.75 } });
        onSuccess(blob, filename, totalMergedPages, 'combine');
      }
    } catch (err) {
      console.error('Merge error:', err);
      alert('Failed to combine PDFs. Please ensure all files are valid.');
    } finally {
      setIsMerging(false);
    }
  };

  const totalPagesInQueue = queue.reduce((acc, curr) => acc + curr.pageCount, 0);

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 space-y-4 pb-12 overflow-y-auto bg-[#0F1115] text-white">
      <div className="max-w-4xl mx-auto w-full space-y-4">
        {/* Header Info Bento Block */}
        <div className="bg-[#1F2937] rounded-[24px] border border-[#374151] p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#4F46E5]/20 text-[#818CF8] flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wide">
                Smart Merge Queue
              </h3>
            </div>
            <span className="text-xs text-[#9CA3AF]">
              {queue.length} files • ~{totalPagesInQueue} pages
            </span>
          </div>

          <div>
            <label className="text-[11px] text-[#9CA3AF] block mb-1">Merged Document Name</label>
            <input
              type="text"
              value={outputName}
              onChange={(e) => setOutputName(e.target.value)}
              placeholder="e.g. Master_Quarterly_Packet"
              className="w-full bg-[#111827] border border-[#374151] rounded-full px-4 py-2 text-xs text-white font-semibold focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent outline-none"
            />
          </div>
        </div>

        {/* Add Files Dropzone / Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center justify-center gap-2 py-3 px-4 rounded-full bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold text-xs shadow-lg shadow-[#4F46E5]/25 cursor-pointer active:scale-95 transition-all">
            <Plus className="w-4 h-4" />
            <span>Add PDF Files</span>
            <input
              type="file"
              accept="application/pdf"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          <button
            id="btn-combine-sample"
            type="button"
            onClick={onLoadSample}
            className="flex items-center justify-center gap-1.5 py-3 px-4 rounded-full bg-[#1F2937] hover:bg-[#374151] text-[#9CA3AF] hover:text-white text-xs font-medium border border-[#374151] active:scale-95 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#818CF8]" />
            <span>Add Sample Doc</span>
          </button>
        </div>

        {/* File Queue List */}
        {queue.length === 0 ? (
          <div className="rounded-[28px] border-2 border-dashed border-[#24272D] p-10 text-center text-[#9CA3AF] flex flex-col items-center justify-center">
            <Layers className="w-10 h-10 text-[#374151] mb-3" />
            <p className="text-sm font-bold text-white">Merge queue is empty</p>
            <p className="text-xs text-[#9CA3AF] mt-1 max-w-xs leading-relaxed">
              Add 2 or more PDF files to combine them into one structured master file.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-[#9CA3AF] uppercase tracking-wider">
                Execution Order ({queue.length})
              </span>
              <button
                type="button"
                onClick={() => setQueue([])}
                className="text-xs text-[#EF4444] hover:underline"
              >
                Clear All
              </button>
            </div>

            <div className="space-y-2.5">
              {queue.map((item, idx) => (
                <div
                  key={item.id}
                  className="bg-[#1F2937] rounded-[20px] border border-[#374151] p-3.5 shadow-sm space-y-2.5 hover:border-[#4F46E5]/60 transition-all"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <span className="w-6 h-6 rounded-lg bg-[#111827] text-[#818CF8] text-xs font-bold flex items-center justify-center shrink-0 border border-[#374151]">
                        {idx + 1}
                      </span>
                      <div className="truncate">
                        <h4 className="text-xs sm:text-sm font-semibold text-white truncate">{item.name}</h4>
                        <p className="text-[10px] text-[#9CA3AF]">
                          {item.pageCount} {item.pageCount === 1 ? 'page' : 'pages'} • {formatBytes(item.size)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveItem(idx, 'up')}
                        className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-white hover:bg-[#111827] disabled:opacity-20 transition-colors"
                        title="Move up"
                      >
                        <MoveUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === queue.length - 1}
                        onClick={() => moveItem(idx, 'down')}
                        className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-white hover:bg-[#111827] disabled:opacity-20 transition-colors"
                        title="Move down"
                      >
                        <MoveDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="p-1.5 rounded-lg text-[#EF4444] hover:text-rose-300 hover:bg-rose-950/40 ml-1 transition-colors"
                        title="Remove file"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Page range input */}
                  <div className="pt-2 border-t border-[#374151]/60 flex items-center gap-2">
                    <span className="text-[10px] text-[#9CA3AF] shrink-0">Pages to include:</span>
                    <input
                      type="text"
                      value={item.pageRanges}
                      onChange={(e) => updatePageRange(item.id, e.target.value)}
                      placeholder={`All pages (1-${item.pageCount}) or e.g. "1-2, 4"`}
                      className="flex-1 bg-[#111827] border border-[#374151] rounded-lg px-2.5 py-1 text-xs text-white placeholder:text-[#6B7280] focus:ring-1 focus:ring-[#4F46E5] focus:border-transparent outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Button Bar */}
        <div className="sticky bottom-2 z-20 bg-[#1F2937]/95 backdrop-blur-md p-3.5 rounded-[24px] border border-[#374151] shadow-2xl flex items-center gap-3 mt-auto">
          <button
            id="btn-execute-combine"
            type="button"
            disabled={isMerging || queue.length === 0}
            onClick={() => handleMerge(false)}
            className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-full bg-[#4F46E5] hover:bg-[#4338CA] disabled:opacity-40 text-white font-bold text-xs shadow-lg shadow-[#4F46E5]/25 active:scale-95 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>{isMerging ? 'Combining Documents...' : `Merge & Combine (${queue.length} Files)`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
