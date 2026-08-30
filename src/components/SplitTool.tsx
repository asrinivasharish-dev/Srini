import React, { useState, useEffect } from 'react';
import {
  Scissors,
  Upload,
  Sparkles,
  Download,
  Eye,
  FileText,
  Layers,
  FolderArchive,
  CheckCircle,
  Plus,
  Trash2,
  Sliders,
  CheckSquare
} from 'lucide-react';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import { SplitMode, SplitRange } from '../types';
import {
  splitPdfDocument,
  renderPdfPagesToThumbnails,
  formatBytes,
} from '../utils/pdfEngine';
import { triggerHaptic } from '../utils/haptics';
import confetti from 'canvas-confetti';

interface SplitToolProps {
  initialFile?: { name: string; bytes: Uint8Array } | null;
  onSuccess: (blob: Blob, filename: string, pageCount: number, action: 'split') => void;
  onPreview: (blob: Blob, filename: string) => void;
  onLoadSample: () => void;
}

export const SplitTool: React.FC<SplitToolProps> = ({
  initialFile,
  onSuccess,
  onPreview,
  onLoadSample,
}) => {
  const [fileData, setFileData] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [pageCount, setPageCount] = useState(0);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [splitMode, setSplitMode] = useState<SplitMode>('all');

  // Mode configurations
  const [ranges, setRanges] = useState<SplitRange[]>([
    { id: '1', name: 'Part_1', fromPage: 1, toPage: 1 },
  ]);
  const [interval, setInterval] = useState(1);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set([1]));

  const [isProcessing, setIsProcessing] = useState(false);
  const [splitResults, setSplitResults] = useState<{ filename: string; data: Uint8Array; pageCount: number }[] | null>(null);

  useEffect(() => {
    if (initialFile) {
      loadPdf(initialFile.bytes, initialFile.name);
    }
  }, [initialFile]);

  const loadPdf = async (bytes: Uint8Array, name: string) => {
    try {
      setIsProcessing(true);
      triggerHaptic('medium');
      setFileData(bytes);
      setFileName(name);
      setSplitResults(null);

      const doc = await PDFDocument.load(bytes);
      const count = doc.getPageCount();
      setPageCount(count);

      // Set default ranges
      if (count > 1) {
        setRanges([
          { id: '1', name: 'Part_1', fromPage: 1, toPage: Math.ceil(count / 2) },
          { id: '2', name: 'Part_2', fromPage: Math.ceil(count / 2) + 1, toPage: count },
        ]);
      } else {
        setRanges([{ id: '1', name: 'Part_1', fromPage: 1, toPage: 1 }]);
      }

      const thumbs = await renderPdfPagesToThumbnails(bytes);
      setThumbnails(thumbs);
      setSelectedPages(new Set([1]));
    } catch (err) {
      console.error('Split load error:', err);
      alert('Could not load PDF file.');
    } finally {
      setIsProcessing(false);
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

  const addRange = () => {
    triggerHaptic('light');
    const last = ranges[ranges.length - 1];
    const from = last ? Math.min(pageCount, last.toPage + 1) : 1;
    const to = Math.min(pageCount, from + 1);
    setRanges([
      ...ranges,
      {
        id: Math.random().toString(36).substr(2, 7),
        name: `Part_${ranges.length + 1}`,
        fromPage: from,
        toPage: to,
      },
    ]);
  };

  const removeRange = (id: string) => {
    triggerHaptic('light');
    setRanges(ranges.filter((r) => r.id !== id));
  };

  const updateRange = (id: string, field: 'fromPage' | 'toPage' | 'name', value: any) => {
    setRanges(
      ranges.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const toggleSelectPage = (pageIdx: number) => {
    triggerHaptic('light');
    const next = new Set(selectedPages);
    if (next.has(pageIdx)) next.delete(pageIdx);
    else next.add(pageIdx);
    setSelectedPages(next);
  };

  // Perform the split operation
  const handleExecuteSplit = async () => {
    if (!fileData) return;

    try {
      setIsProcessing(true);
      triggerHaptic('medium');

      const config: any = {};
      if (splitMode === 'range') {
        config.ranges = ranges.map((r) => ({
          from: Number(r.fromPage),
          to: Number(r.toPage),
          name: r.name,
        }));
      } else if (splitMode === 'interval') {
        config.interval = Number(interval);
      } else if (splitMode === 'custom_select') {
        config.selectedPages = Array.from(selectedPages);
      }

      const results = await splitPdfDocument(fileData, splitMode, config);
      setSplitResults(results);
      triggerHaptic('success');
      confetti({ particleCount: 60, spread: 60, origin: { y: 0.75 } });
    } catch (err) {
      console.error('Failed to split:', err);
      alert('Error occurred during split operation.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Download all as ZIP
  const downloadAsZip = async () => {
    if (!splitResults || splitResults.length === 0) return;
    try {
      triggerHaptic('medium');
      const zip = new JSZip();
      splitResults.forEach((res) => {
        zip.file(res.filename, res.data);
      });
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const baseName = fileName.replace(/\.pdf$/i, '');
      const zipName = `${baseName}_Split_Files.zip`;

      triggerHaptic('success');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(zipBlob);
      a.download = zipName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      onSuccess(zipBlob, zipName, splitResults.length, 'split');
    } catch (err) {
      console.error('ZIP generation error:', err);
    }
  };

  const downloadPart = (part: { filename: string; data: Uint8Array; pageCount: number }) => {
    triggerHaptic('success');
    const blob = new Blob([part.data], { type: 'application/pdf' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = part.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 space-y-4 pb-12 overflow-y-auto bg-[#0F1115] text-white">
      {!fileData ? (
        <div className="flex-1 flex flex-col items-center justify-center space-y-5 p-6 text-center my-auto">
          <div className="w-16 h-16 rounded-[24px] bg-[#4F46E5]/15 border border-[#4F46E5]/30 text-[#818CF8] flex items-center justify-center shadow-xl">
            <Scissors className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-xl font-bold text-white">Split PDF Document</h3>
            <p className="text-xs text-[#9CA3AF] max-w-xs mt-1">
              Extract page ranges, split into single pages, or download parts as a ZIP archive.
            </p>
          </div>

          <div className="w-full max-w-xs space-y-2.5">
            <label className="flex items-center justify-center gap-2 py-3 px-5 rounded-full bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold text-xs shadow-lg shadow-[#4F46E5]/25 cursor-pointer active:scale-95 transition-all">
              <Upload className="w-4 h-4" />
              <span>Select PDF to Split</span>
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            <button
              id="btn-split-sample"
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
        <div className="space-y-4 max-w-3xl mx-auto w-full">
          {/* File Overview card */}
          <div className="bg-[#1F2937] rounded-2xl border border-[#374151] p-4 shadow-sm flex items-center justify-between">
            <div className="truncate pr-2">
              <h3 className="text-xs sm:text-sm font-bold text-white truncate">{fileName}</h3>
              <span className="text-[11px] text-[#9CA3AF]">
                {pageCount} {pageCount === 1 ? 'page' : 'pages'} total • {formatBytes(fileData.length)}
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

          {/* Split Mode Selector Tabs */}
          <div className="bg-[#1F2937] p-1.5 rounded-full border border-[#374151] grid grid-cols-4 gap-1">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setSplitMode('all');
                setSplitResults(null);
              }}
              className={`py-1.5 px-1 rounded-full text-[11px] font-semibold text-center transition-all ${
                splitMode === 'all'
                  ? 'bg-[#4F46E5] text-white shadow-md'
                  : 'text-[#9CA3AF] hover:text-white'
              }`}
            >
              Single Pages
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setSplitMode('range');
                setSplitResults(null);
              }}
              className={`py-1.5 px-1 rounded-full text-[11px] font-semibold text-center transition-all ${
                splitMode === 'range'
                  ? 'bg-[#4F46E5] text-white shadow-md'
                  : 'text-[#9CA3AF] hover:text-white'
              }`}
            >
              By Ranges
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setSplitMode('interval');
                setSplitResults(null);
              }}
              className={`py-1.5 px-1 rounded-full text-[11px] font-semibold text-center transition-all ${
                splitMode === 'interval'
                  ? 'bg-[#4F46E5] text-white shadow-md'
                  : 'text-[#9CA3AF] hover:text-white'
              }`}
            >
              Intervals
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setSplitMode('custom_select');
                setSplitResults(null);
              }}
              className={`py-1.5 px-1 rounded-full text-[11px] font-semibold text-center transition-all ${
                splitMode === 'custom_select'
                  ? 'bg-[#4F46E5] text-white shadow-md'
                  : 'text-[#9CA3AF] hover:text-white'
              }`}
            >
              Select Pages
            </button>
          </div>

          {/* Mode Configuration panels */}
          {splitMode === 'all' && (
            <div className="bg-[#1F2937] rounded-2xl border border-[#374151] p-4 text-xs text-[#9CA3AF] space-y-1">
              <span className="font-bold text-white block">Extract Every Page</span>
              <p>Each of the {pageCount} pages will be extracted as a standalone PDF file inside a downloadable ZIP archive.</p>
            </div>
          )}

          {splitMode === 'range' && (
            <div className="bg-[#1F2937] rounded-2xl border border-[#374151] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Custom Page Ranges ({ranges.length})
                </span>
                <button
                  type="button"
                  onClick={addRange}
                  className="flex items-center gap-1 text-xs text-[#818CF8] hover:text-white font-semibold bg-[#4F46E5]/15 px-3 py-1 rounded-full border border-[#4F46E5]/30 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Range</span>
                </button>
              </div>

              <div className="space-y-2">
                {ranges.map((rng, i) => (
                  <div
                    key={rng.id}
                    className="flex items-center gap-2 bg-[#111827] p-2.5 rounded-xl border border-[#374151]"
                  >
                    <input
                      type="text"
                      value={rng.name}
                      onChange={(e) => updateRange(rng.id, 'name', e.target.value)}
                      placeholder={`Part_${i + 1}`}
                      className="w-28 bg-[#1F2937] border border-[#374151] rounded-lg px-2 py-1 text-xs text-white"
                    />

                    <div className="flex items-center gap-1.5 text-xs text-[#9CA3AF]">
                      <span>Pages</span>
                      <input
                        type="number"
                        min={1}
                        max={pageCount}
                        value={rng.fromPage}
                        onChange={(e) => updateRange(rng.id, 'fromPage', parseInt(e.target.value) || 1)}
                        className="w-14 bg-[#1F2937] border border-[#374151] rounded-lg px-1.5 py-1 text-xs text-white text-center"
                      />
                      <span>to</span>
                      <input
                        type="number"
                        min={rng.fromPage}
                        max={pageCount}
                        value={rng.toPage}
                        onChange={(e) => updateRange(rng.id, 'toPage', parseInt(e.target.value) || pageCount)}
                        className="w-14 bg-[#1F2937] border border-[#374151] rounded-lg px-1.5 py-1 text-xs text-white text-center"
                      />
                    </div>

                    {ranges.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRange(rng.id)}
                        className="p-1 text-[#EF4444] hover:bg-rose-950/40 rounded-lg ml-auto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {splitMode === 'interval' && (
            <div className="bg-[#1F2937] rounded-2xl border border-[#374151] p-4 space-y-2">
              <span className="text-xs font-bold text-white block">Split Interval</span>
              <p className="text-xs text-[#9CA3AF]">
                Split this document into smaller PDF files every fixed number of pages:
              </p>
              <div className="flex items-center gap-3 pt-2">
                <span className="text-xs text-white">Pages per document:</span>
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, pageCount)}
                  value={interval}
                  onChange={(e) => setInterval(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 bg-[#111827] border border-[#374151] rounded-xl px-3 py-1.5 text-xs text-white font-bold text-center"
                />
                <span className="text-xs text-[#818CF8] font-semibold">
                  (Will create ~{Math.ceil(pageCount / interval)} files)
                </span>
              </div>
            </div>
          )}

          {splitMode === 'custom_select' && (
            <div className="space-y-2">
              <span className="text-xs font-bold text-[#9CA3AF] px-1">
                Tap Pages to Extract ({selectedPages.size} selected)
              </span>
              <div className="grid grid-cols-3 gap-2.5">
                {thumbnails.map((thumb, idx) => {
                  const pNum = idx + 1;
                  const isSelected = selectedPages.has(pNum);
                  return (
                    <div
                      key={pNum}
                      onClick={() => toggleSelectPage(pNum)}
                      className={`relative rounded-2xl p-2 bg-[#1F2937] border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-[#4F46E5] ring-2 ring-[#4F46E5]/40'
                          : 'border-[#374151] opacity-70 hover:opacity-100'
                      }`}
                    >
                      <div className="aspect-[3/4] bg-[#111827] rounded-xl overflow-hidden flex items-center justify-center mb-1.5">
                        <img src={thumb} alt={`Page ${pNum}`} className="w-full h-full object-contain" />
                      </div>
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[10px] text-white font-bold">P. {pNum}</span>
                        {isSelected && <CheckCircle className="w-3.5 h-3.5 text-[#818CF8]" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Execution Button */}
          {!splitResults && (
            <button
              id="btn-split-execute"
              type="button"
              disabled={isProcessing}
              onClick={handleExecuteSplit}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-full bg-[#4F46E5] hover:bg-[#4338CA] text-white font-bold text-xs sm:text-sm shadow-lg shadow-[#4F46E5]/25 active:scale-95 transition-all"
            >
              <Scissors className="w-4 h-4" />
              <span>{isProcessing ? 'Splitting PDF...' : 'Execute Split Operation'}</span>
            </button>
          )}

          {/* Split Results View */}
          {splitResults && (
            <div className="space-y-3 bg-[#1F2937] rounded-[28px] border border-[#374151] p-5 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-[#10B981]" />
                  <h4 className="text-xs sm:text-sm font-bold text-white">
                    Generated {splitResults.length} Document Parts
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={downloadAsZip}
                  className="flex items-center gap-1 text-xs font-bold text-[#818CF8] hover:text-white bg-[#4F46E5]/15 px-3 py-1.5 rounded-full border border-[#4F46E5]/30 transition-colors"
                >
                  <FolderArchive className="w-3.5 h-3.5" />
                  <span>Download ZIP</span>
                </button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {splitResults.map((part, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-2xl bg-[#111827] border border-[#374151] text-xs"
                  >
                    <div className="truncate pr-2">
                      <span className="font-semibold text-white truncate block">{part.filename}</span>
                      <span className="text-[10px] text-[#9CA3AF]">
                        {part.pageCount} page(s) • {formatBytes(part.data.byteLength)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const blob = new Blob([part.data], { type: 'application/pdf' });
                          onPreview(blob, part.filename);
                        }}
                        className="p-2 text-[#9CA3AF] hover:text-white bg-[#1F2937] border border-[#374151] rounded-full"
                        title="Preview part"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#818CF8]" />
                      </button>

                      <button
                        type="button"
                        onClick={() => downloadPart(part)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold text-xs shadow-sm"
                      >
                        <Download className="w-3 h-3" />
                        <span>Save</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
