import React, { useState } from 'react';
import {
  Sparkles,
  X,
  Copy,
  Check,
  FileText,
  Plus,
  RefreshCw,
  AlignLeft,
  Type,
  Info,
  List,
  AlertCircle,
  Download,
  Layers
} from 'lucide-react';
import { GeminiOcrResult, DocumentSection } from '../types';
import { triggerHaptic } from '../utils/haptics';

interface GeminiOcrModalProps {
  isOpen: boolean;
  onClose: () => void;
  imagePreviewUrl: string | null;
  ocrResult: GeminiOcrResult | null;
  isLoading: boolean;
  errorMessage: string | null;
  onRetry: () => void;
  onApplyToDocument: (sections: DocumentSection[], newTitle?: string) => void;
  onAppendSection: (section: DocumentSection) => void;
}

export const GeminiOcrModal: React.FC<GeminiOcrModalProps> = ({
  isOpen,
  onClose,
  imagePreviewUrl,
  ocrResult,
  isLoading,
  errorMessage,
  onRetry,
  onApplyToDocument,
  onAppendSection,
}) => {
  const [activeTab, setActiveTab] = useState<'structured' | 'fulltext'>('structured');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyText = async () => {
    if (!ocrResult?.fullText) return;
    try {
      await navigator.clipboard.writeText(ocrResult.fullText);
      triggerHaptic('success');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleApplyFullDocument = () => {
    if (!ocrResult) return;
    triggerHaptic('success');

    const newSections: DocumentSection[] = [];

    if (ocrResult.sections && ocrResult.sections.length > 0) {
      ocrResult.sections.forEach((sec) => {
        newSections.push({
          id: Math.random().toString(36).substr(2, 7),
          type: sec.type,
          content: sec.content,
        });
      });
    } else if (ocrResult.fullText) {
      // Split into paragraphs if structured sections weren't provided
      const paragraphs = ocrResult.fullText.split(/\n\n+/).filter((p) => p.trim());
      paragraphs.forEach((p, idx) => {
        newSections.push({
          id: Math.random().toString(36).substr(2, 7),
          type: idx === 0 && p.length < 60 ? 'heading' : 'paragraph',
          content: p.trim(),
        });
      });
    }

    onApplyToDocument(newSections, ocrResult.title);
    onClose();
  };

  const handleAppendAsParagraph = () => {
    if (!ocrResult?.fullText) return;
    triggerHaptic('medium');
    const newSec: DocumentSection = {
      id: Math.random().toString(36).substr(2, 7),
      type: 'paragraph',
      content: ocrResult.fullText,
    };
    onAppendSection(newSec);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-[#1F2937] border border-[#374151] rounded-[28px] sm:rounded-[32px] w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh] text-white">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#374151] flex items-center justify-between bg-[#111827]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#4F46E5]/25 text-[#818CF8] flex items-center justify-center border border-[#4F46E5]/40 shadow-sm">
              <Sparkles className="w-4 h-4 text-[#818CF8]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-white text-sm sm:text-base">Gemini Camera OCR</h3>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#4F46E5]/30 text-[#818CF8] border border-[#4F46E5]/40">
                  AI
                </span>
              </div>
              <p className="text-[10px] text-[#9CA3AF]">
                Optical text & structure recognition
              </p>
            </div>
          </div>

          <button
            id="btn-close-ocr-modal"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#1F2937] hover:bg-[#374151] text-[#9CA3AF] hover:text-white flex items-center justify-center border border-[#374151]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Scanned thumbnail preview header */}
          {imagePreviewUrl && (
            <div className="bg-[#111827] rounded-2xl p-2.5 border border-[#374151] flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-black overflow-hidden shrink-0 border border-[#374151] flex items-center justify-center">
                <img
                  src={imagePreviewUrl}
                  alt="Scanned Camera Frame"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#818CF8]">
                  Captured Camera Source
                </span>
                <p className="text-xs text-white truncate font-medium">
                  {ocrResult?.title || 'Camera Document Frame'}
                </p>
                {ocrResult?.summary && (
                  <p className="text-[10px] text-[#9CA3AF] line-clamp-1 mt-0.5">
                    {ocrResult.summary}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center">
              <div className="relative">
                <div className="w-16 h-16 rounded-3xl bg-[#4F46E5]/20 border border-[#4F46E5]/40 flex items-center justify-center text-[#818CF8] animate-pulse">
                  <Sparkles className="w-8 h-8" />
                </div>
                <div className="absolute -inset-1 rounded-3xl border-2 border-[#818CF8] border-t-transparent animate-spin" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Analyzing Image with Gemini...</h4>
                <p className="text-xs text-[#9CA3AF] mt-1 max-w-xs leading-relaxed">
                  Extracting text, recognizing typography, preserving paragraphs, and formatting layout blocks.
                </p>
              </div>
            </div>
          )}

          {/* Error State */}
          {!isLoading && errorMessage && (
            <div className="bg-rose-950/20 border border-[#EF4444]/40 rounded-2xl p-4 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-[#EF4444]/20 text-[#EF4444] flex items-center justify-center mx-auto">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Extraction Failed</h4>
                <p className="text-xs text-rose-300 mt-1 max-w-xs mx-auto leading-relaxed">
                  {errorMessage}
                </p>
              </div>
              <button
                id="btn-retry-ocr"
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#4F46E5] text-white text-xs font-bold shadow-md hover:bg-[#4338CA] active:scale-95 transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Try Again</span>
              </button>
            </div>
          )}

          {/* Success state */}
          {!isLoading && !errorMessage && ocrResult && (
            <div className="space-y-3.5">
              {/* Tab Selector */}
              <div className="bg-[#111827] p-1 rounded-xl border border-[#374151] flex items-center justify-between gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setActiveTab('structured');
                  }}
                  className={`flex-1 py-1.5 px-3 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    activeTab === 'structured'
                      ? 'bg-[#4F46E5] text-white shadow-sm'
                      : 'text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Structured Blocks ({ocrResult.sections?.length || 0})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setActiveTab('fulltext');
                  }}
                  className={`flex-1 py-1.5 px-3 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    activeTab === 'fulltext'
                      ? 'bg-[#4F46E5] text-white shadow-sm'
                      : 'text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Plain Text</span>
                </button>
              </div>

              {/* View 1: Structured Blocks */}
              {activeTab === 'structured' && (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {ocrResult.sections && ocrResult.sections.length > 0 ? (
                    ocrResult.sections.map((sec, idx) => (
                      <div
                        key={idx}
                        className="bg-[#111827] border border-[#374151] rounded-2xl p-3 space-y-1"
                      >
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#818CF8]">
                          <span className="flex items-center gap-1">
                            {sec.type === 'heading' && <Type className="w-3 h-3 text-[#818CF8]" />}
                            {sec.type === 'paragraph' && <AlignLeft className="w-3 h-3 text-sky-400" />}
                            {sec.type === 'bullet' && <List className="w-3 h-3 text-[#10B981]" />}
                            {sec.type === 'callout' && <Info className="w-3 h-3 text-amber-400" />}
                            {sec.type}
                          </span>
                        </div>
                        <p
                          className={`text-xs text-slate-200 leading-relaxed ${
                            sec.type === 'heading'
                              ? 'font-bold text-white text-sm'
                              : sec.type === 'callout'
                              ? 'bg-amber-950/20 text-amber-200 p-2 rounded-lg border border-amber-500/20'
                              : ''
                          }`}
                        >
                          {sec.content}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="bg-[#111827] border border-[#374151] rounded-2xl p-4 text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {ocrResult.fullText}
                    </div>
                  )}
                </div>
              )}

              {/* View 2: Plain Text */}
              {activeTab === 'fulltext' && (
                <div className="space-y-2">
                  <div className="relative">
                    <textarea
                      readOnly
                      rows={8}
                      value={ocrResult.fullText}
                      className="w-full bg-[#111827] border border-[#374151] rounded-2xl p-3 text-xs text-white leading-relaxed outline-none resize-none font-mono"
                    />
                    <button
                      id="btn-copy-ocr-text"
                      type="button"
                      onClick={handleCopyText}
                      className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-[#1F2937] hover:bg-[#374151] border border-[#374151] text-[11px] font-semibold text-white flex items-center gap-1 shadow-sm active:scale-95 transition-all"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3 h-3 text-[#10B981]" />
                          <span className="text-[#10B981]">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-[#818CF8]" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {!isLoading && !errorMessage && ocrResult && (
          <div className="px-5 py-3.5 bg-[#111827] border-t border-[#374151] flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <button
              id="btn-append-ocr-paragraph"
              type="button"
              onClick={handleAppendAsParagraph}
              className="w-full sm:w-auto px-4 py-2 rounded-full bg-[#1F2937] hover:bg-[#374151] text-[#9CA3AF] hover:text-white border border-[#374151] text-xs font-semibold active:scale-95 transition-all"
            >
              + Append as Note
            </button>

            <button
              id="btn-apply-ocr-document"
              type="button"
              onClick={handleApplyFullDocument}
              className="w-full sm:flex-1 flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-full bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-bold shadow-lg shadow-[#4F46E5]/30 active:scale-95 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span>Apply to Document Builder</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
