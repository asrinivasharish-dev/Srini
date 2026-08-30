import React, { useState } from 'react';
import {
  FileText,
  Image as ImageIcon,
  Plus,
  Trash2,
  Camera,
  PenTool,
  Download,
  Eye,
  FileCheck,
  AlignLeft,
  CheckCircle2,
  Sparkles,
  MoveUp,
  MoveDown,
  Info,
  Type,
  ScanText,
  Copy,
  QrCode
} from 'lucide-react';
import { CreateDocOptions, DocumentSection, GeminiOcrResult } from '../types';
import { createPdfDocument, createPdfFromImages, formatBytes } from '../utils/pdfEngine';
import { triggerHaptic } from '../utils/haptics';
import { SignaturePadModal } from './SignaturePadModal';
import { CameraScannerModal } from './CameraScannerModal';
import { GeminiOcrModal } from './GeminiOcrModal';
import { QrScannerModal } from './QrScannerModal';
import { extractTextFromImageWithGemini } from '../utils/geminiOcr';
import confetti from 'canvas-confetti';

interface CreateToolProps {
  onSuccess: (blob: Blob, filename: string, pageCount: number, action: 'create') => void;
  onPreview: (blob: Blob, filename: string) => void;
}

export const CreateTool: React.FC<CreateToolProps> = ({ onSuccess, onPreview }) => {
  const [activeSubMode, setActiveSubMode] = useState<'editor' | 'images' | 'templates'>('editor');

  // Editor state
  const [docTitle, setDocTitle] = useState('My Official Document');
  const [docAuthor, setDocAuthor] = useState('');
  const [pageSize, setPageSize] = useState<'A4' | 'Letter' | 'Legal'>('A4');
  const [headerText, setHeaderText] = useState('DOC-REPORT • CONFIDENTIAL');
  const [footerText, setFooterText] = useState('Generated with DocHub Android');
  const [includePageNumbers, setIncludePageNumbers] = useState(true);
  const [sections, setSections] = useState<DocumentSection[]>([
    {
      id: '1',
      type: 'heading',
      content: '1. Project Overview & Scope',
    },
    {
      id: '2',
      type: 'paragraph',
      content: 'This document was created directly inside the mobile document toolkit. You can customize the headings, paragraphs, callout alerts, and attach digital signatures.',
    },
    {
      id: '3',
      type: 'bullet',
      content: 'Fully offline and client-side processing',
    },
    {
      id: '4',
      type: 'bullet',
      content: 'Direct export to high-resolution vector PDF',
    },
    {
      id: '5',
      type: 'callout',
      content: 'Action Required: Review document contents, verify layout, and sign before exporting.',
    },
  ]);

  // Image mode state
  const [imageList, setImageList] = useState<{ id: string; name: string; dataUrl: string }[]>([]);

  // Modals
  const [isSigModalOpen, setIsSigModalOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Gemini OCR State
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<GeminiOcrResult | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrImagePreview, setOcrImagePreview] = useState<string | null>(null);

  // Template loaders
  const loadTemplate = (type: 'memo' | 'invoice' | 'checklist') => {
    triggerHaptic('medium');
    if (type === 'memo') {
      setDocTitle('Internal Memorandum');
      setDocAuthor('Operations Team');
      setHeaderText('INTERNAL MEMORANDUM');
      setSections([
        { id: '1', type: 'heading', content: 'MEMO: System Update & Guidelines' },
        { id: '2', type: 'paragraph', content: 'Please be informed that the new PDF workflow policies take effect immediately across all mobile and workstation terminals.' },
        { id: '3', type: 'bullet', content: 'All documents must be compressed before archiving.' },
        { id: '4', type: 'bullet', content: 'Pages must be reordered and verified using the Organise tool.' },
        { id: '5', type: 'callout', content: 'Note: Confidential documents should be merged and encrypted locally.' },
      ]);
    } else if (type === 'invoice') {
      setDocTitle('Commercial Service Invoice');
      setDocAuthor('DocHub Billing Dept');
      setHeaderText('INVOICE #INV-2026-0891');
      setSections([
        { id: '1', type: 'heading', content: 'INVOICE DETAILS' },
        { id: '2', type: 'paragraph', content: 'Billed To: Client Acme Corp. • Terms: Net 30 • Date: ' + new Date().toLocaleDateString() },
        { id: '3', type: 'bullet', content: 'Item 1: Document Processing Engine License ($450.00)' },
        { id: '4', type: 'bullet', content: 'Item 2: Mobile PDF Organizer Integration ($250.00)' },
        { id: '5', type: 'callout', content: 'Payment Due in 30 days. Remit funds to DocHub Global.' },
      ]);
    } else if (type === 'checklist') {
      setDocTitle('Field Inspection Signoff');
      setDocAuthor('Quality Assurance Specialist');
      setHeaderText('COMPLIANCE CHECKLIST');
      setSections([
        { id: '1', type: 'heading', content: 'Safety & Verification Points' },
        { id: '2', type: 'bullet', content: 'Document integrity verified via client-side check' },
        { id: '3', type: 'bullet', content: 'Color profile balanced for printing and digital archiving' },
        { id: '4', type: 'bullet', content: 'Metadata signed and secured' },
        { id: '5', type: 'callout', content: 'Certified complete and verified.' },
      ]);
    }
    setActiveSubMode('editor');
  };

  const addSection = (type: DocumentSection['type']) => {
    triggerHaptic('light');
    const newSec: DocumentSection = {
      id: Math.random().toString(36).substr(2, 7),
      type,
      content:
        type === 'heading'
          ? 'New Section Title'
          : type === 'bullet'
          ? 'New list item'
          : type === 'callout'
          ? 'Important notice...'
          : 'Enter descriptive paragraph text here...',
    };
    setSections([...sections, newSec]);
  };

  const removeSection = (id: string) => {
    triggerHaptic('light');
    setSections(sections.filter((s) => s.id !== id));
  };

  const updateSection = (id: string, content: string) => {
    setSections(sections.map((s) => (s.id === id ? { ...s, content } : s)));
  };

  const moveSection = (index: number, direction: 'up' | 'down') => {
    triggerHaptic('light');
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= sections.length) return;
    const copy = [...sections];
    const [moved] = copy.splice(index, 1);
    copy.splice(newIdx, 0, moved);
    setSections(copy);
  };

  const handleSignatureSaved = (sigDataUrl: string) => {
    triggerHaptic('success');
    const newSec: DocumentSection = {
      id: Math.random().toString(36).substr(2, 7),
      type: 'signature',
      content: sigDataUrl,
    };
    setSections([...sections, newSec]);
    setIsSigModalOpen(false);
  };

  const handleStartOcr = async (imageDataUrl: string) => {
    triggerHaptic('medium');
    setOcrImagePreview(imageDataUrl);
    setOcrLoading(true);
    setOcrError(null);
    setOcrResult(null);
    setIsOcrModalOpen(true);
    setIsCameraOpen(false);

    try {
      const data = await extractTextFromImageWithGemini(imageDataUrl);
      setOcrResult(data);
      triggerHaptic('success');
    } catch (err: any) {
      console.error('OCR failed:', err);
      setOcrError(err.message || 'Failed to extract text with Gemini. Please verify your connection or try again.');
      triggerHaptic('warning');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleApplyOcrToDocument = (newSections: DocumentSection[], newTitle?: string) => {
    if (newTitle && newTitle.trim()) {
      setDocTitle(newTitle.trim());
    }
    setSections(newSections);
    setActiveSubMode('editor');
    triggerHaptic('success');
  };

  const handleAppendOcrSection = (newSection: DocumentSection) => {
    setSections((prev) => [...prev, newSection]);
    setActiveSubMode('editor');
    triggerHaptic('medium');
  };

  // QR Import Handlers
  const handleImportFromQr = (newSections: DocumentSection[], newTitle: string, newAuthor?: string) => {
    if (newTitle && newTitle.trim()) {
      setDocTitle(newTitle.trim());
    }
    if (newAuthor) {
      setDocAuthor(newAuthor);
    }
    setSections(newSections);
    setActiveSubMode('editor');
    triggerHaptic('success');
  };

  const handleAppendQrSection = (newSection: DocumentSection) => {
    setSections((prev) => [...prev, newSection]);
    setActiveSubMode('editor');
    triggerHaptic('medium');
  };

  const handleDirectExportFromQr = (blob: Blob, filename: string, pageCount: number) => {
    onSuccess(blob, filename, pageCount, 'create');
  };

  const handleCameraCapture = (imageDataUrl: string) => {
    triggerHaptic('success');
    const newItem = {
      id: Math.random().toString(36).substr(2, 7),
      name: `Scan_${new Date().toLocaleTimeString().replace(/:/g, '')}.jpg`,
      dataUrl: imageDataUrl,
    };
    setImageList((prev) => [...prev, newItem]);
    setIsCameraOpen(false);
    setActiveSubMode('images');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    triggerHaptic('medium');

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        setImageList((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).substr(2, 7),
            name: file.name,
            dataUrl: reader.result as string,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (id: string) => {
    triggerHaptic('light');
    setImageList(imageList.filter((img) => img.id !== id));
  };

  const handleGeneratePdf = async (previewOnly = false) => {
    try {
      setIsGenerating(true);
      triggerHaptic('medium');
      let pdfBytes: Uint8Array;
      const filename = docTitle.trim() ? docTitle.replace(/\s+/g, '_') : 'Document';

      if (activeSubMode === 'editor') {
        const options: CreateDocOptions = {
          title: docTitle,
          author: docAuthor,
          pageSize,
          margin: 35,
          headerText,
          footerText,
          includePageNumbers,
          sections,
          themeColor: '#4F46E5',
        };
        pdfBytes = await createPdfDocument(options);
      } else {
        if (imageList.length === 0) {
          alert('Please add or scan at least one image/photo.');
          setIsGenerating(false);
          return;
        }
        pdfBytes = await createPdfFromImages(imageList, { pageSize: 'A4' });
      }

      const blob = new Blob([pdfBytes], { type: 'application/pdf' });

      if (previewOnly) {
        onPreview(blob, filename);
      } else {
        triggerHaptic('success');
        confetti({ particleCount: 60, spread: 60, origin: { y: 0.75 } });
        onSuccess(blob, filename, activeSubMode === 'editor' ? 1 : imageList.length, 'create');
      }
    } catch (err) {
      console.error('Failed to create PDF:', err);
      alert('Error creating PDF. Please check your inputs.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 space-y-4 pb-12 overflow-y-auto bg-[#0F1115] text-white">
      <div className="max-w-4xl mx-auto w-full space-y-4">
        {/* Sub-mode Navigation Tabs */}
        <div className="bg-[#1F2937] p-1.5 rounded-full border border-[#374151] flex items-center justify-between gap-1">
          <button
            id="tab-create-editor"
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setActiveSubMode('editor');
            }}
            className={`flex-1 py-1.5 px-3 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeSubMode === 'editor'
                ? 'bg-[#4F46E5] text-white shadow-md'
                : 'text-[#9CA3AF] hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Doc Builder</span>
          </button>

          <button
            id="tab-create-images"
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setActiveSubMode('images');
            }}
            className={`flex-1 py-1.5 px-3 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeSubMode === 'images'
                ? 'bg-[#4F46E5] text-white shadow-md'
                : 'text-[#9CA3AF] hover:text-white'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Photos to PDF</span>
            {imageList.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-white text-[#4F46E5] text-[10px] font-bold flex items-center justify-center">
                {imageList.length}
              </span>
            )}
          </button>

          <button
            id="tab-create-templates"
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setActiveSubMode('templates');
            }}
            className={`flex-1 py-1.5 px-3 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeSubMode === 'templates'
                ? 'bg-[#4F46E5] text-white shadow-md'
                : 'text-[#9CA3AF] hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Templates</span>
          </button>
        </div>

        {/* 1. DOCUMENT BUILDER SUBMODE */}
        {activeSubMode === 'editor' && (
          <div className="space-y-4">
            {/* Metadata Bento Card */}
            <div className="bg-[#1F2937] rounded-[24px] border border-[#374151] p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Document Settings
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-[#9CA3AF]">Size:</span>
                  <select
                    value={pageSize}
                    onChange={(e: any) => setPageSize(e.target.value)}
                    className="bg-[#111827] text-white text-xs px-2.5 py-1 rounded-lg border border-[#374151] focus:ring-1 focus:ring-[#4F46E5] outline-none"
                  >
                    <option value="A4">A4</option>
                    <option value="Letter">US Letter</option>
                    <option value="Legal">Legal</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-[#9CA3AF] block mb-1">Document Title</label>
                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="Enter title..."
                  className="w-full bg-[#111827] border border-[#374151] rounded-full px-4 py-2 text-sm text-white font-semibold focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-[#9CA3AF] block mb-1">Author / Signer</label>
                  <input
                    type="text"
                    value={docAuthor}
                    onChange={(e) => setDocAuthor(e.target.value)}
                    placeholder="Optional author..."
                    className="w-full bg-[#111827] border border-[#374151] rounded-full px-3.5 py-1.5 text-xs text-white focus:ring-1 focus:ring-[#4F46E5] outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#9CA3AF] block mb-1">Header Label</label>
                  <input
                    type="text"
                    value={headerText}
                    onChange={(e) => setHeaderText(e.target.value)}
                    placeholder="Optional header..."
                    className="w-full bg-[#111827] border border-[#374151] rounded-full px-3.5 py-1.5 text-xs text-white focus:ring-1 focus:ring-[#4F46E5] outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Quick Add Content Bar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <button
                id="btn-qr-scanner-trigger"
                type="button"
                onClick={() => {
                  triggerHaptic('medium');
                  setIsQrScannerOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-indigo-600/35 to-violet-600/35 hover:from-indigo-600/50 hover:to-violet-600/50 border border-indigo-400/50 text-xs text-white font-semibold whitespace-nowrap active:scale-95 transition-all shadow-sm"
              >
                <QrCode className="w-3.5 h-3.5 text-indigo-300 animate-pulse" />
                <span>Scan QR Code</span>
              </button>

              <button
                id="btn-ocr-camera-trigger"
                type="button"
                onClick={() => {
                  triggerHaptic('medium');
                  setIsCameraOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#1F2937] hover:bg-[#374151] border border-[#374151] text-xs text-white whitespace-nowrap active:scale-95 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>AI OCR</span>
              </button>

              <button
                type="button"
                onClick={() => addSection('heading')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#1F2937] hover:bg-[#374151] border border-[#374151] text-xs text-white whitespace-nowrap active:scale-95 transition-all"
              >
                <Type className="w-3.5 h-3.5 text-[#818CF8]" />
                <span>+ Heading</span>
              </button>

              <button
                type="button"
                onClick={() => addSection('paragraph')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#1F2937] hover:bg-[#374151] border border-[#374151] text-xs text-white whitespace-nowrap active:scale-95 transition-all"
              >
                <AlignLeft className="w-3.5 h-3.5 text-sky-400" />
                <span>+ Paragraph</span>
              </button>

              <button
                type="button"
                onClick={() => addSection('bullet')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#1F2937] hover:bg-[#374151] border border-[#374151] text-xs text-white whitespace-nowrap active:scale-95 transition-all"
              >
                <Plus className="w-3.5 h-3.5 text-[#10B981]" />
                <span>+ Bullet Item</span>
              </button>

              <button
                type="button"
                onClick={() => addSection('callout')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#1F2937] hover:bg-[#374151] border border-[#374151] text-xs text-white whitespace-nowrap active:scale-95 transition-all"
              >
                <Info className="w-3.5 h-3.5 text-amber-400" />
                <span>+ Note Box</span>
              </button>

              <button
                type="button"
                onClick={() => setIsSigModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#4F46E5]/20 hover:bg-[#4F46E5]/30 border border-[#4F46E5]/40 text-xs text-[#818CF8] whitespace-nowrap active:scale-95 transition-all"
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>+ Signature</span>
              </button>
            </div>

            {/* Sections List */}
            <div className="space-y-2.5">
              {sections.map((section, idx) => (
                <div
                  key={section.id}
                  className="bg-[#1F2937] rounded-[20px] border border-[#374151] p-3.5 relative group transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF] flex items-center gap-1.5">
                      {section.type === 'heading' && <Type className="w-3 h-3 text-[#818CF8]" />}
                      {section.type === 'paragraph' && <AlignLeft className="w-3 h-3 text-sky-400" />}
                      {section.type === 'bullet' && <Plus className="w-3 h-3 text-[#10B981]" />}
                      {section.type === 'callout' && <Info className="w-3 h-3 text-amber-400" />}
                      {section.type === 'signature' && <PenTool className="w-3 h-3 text-violet-400" />}
                      {section.type}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveSection(idx, 'up')}
                        className="p-1 rounded-lg text-[#9CA3AF] hover:text-white disabled:opacity-20 transition-colors"
                        title="Move up"
                      >
                        <MoveUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === sections.length - 1}
                        onClick={() => moveSection(idx, 'down')}
                        className="p-1 rounded-lg text-[#9CA3AF] hover:text-white disabled:opacity-20 transition-colors"
                        title="Move down"
                      >
                        <MoveDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSection(section.id)}
                        className="p-1 rounded-lg text-[#EF4444] hover:text-rose-300 ml-1 transition-colors"
                        title="Delete block"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {section.type === 'signature' ? (
                    <div className="bg-white rounded-xl p-2 flex items-center justify-center border border-[#374151]">
                      <img
                        src={section.content}
                        alt="Signature"
                        className="h-14 object-contain"
                      />
                    </div>
                  ) : section.type === 'paragraph' || section.type === 'callout' ? (
                    <textarea
                      rows={2}
                      value={section.content}
                      onChange={(e) => updateSection(section.id, e.target.value)}
                      className="w-full bg-[#111827] border border-[#374151] rounded-xl p-2.5 text-xs text-white focus:ring-1 focus:ring-[#4F46E5] outline-none resize-y"
                    />
                  ) : (
                    <input
                      type="text"
                      value={section.content}
                      onChange={(e) => updateSection(section.id, e.target.value)}
                      className="w-full bg-[#111827] border border-[#374151] rounded-xl px-3 py-1.5 text-xs text-white focus:ring-1 focus:ring-[#4F46E5] outline-none"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. PHOTOS TO PDF SUBMODE */}
        {activeSubMode === 'images' && (
          <div className="space-y-4">
            {/* Action trigger banner */}
            <div className="grid grid-cols-2 gap-3">
              <button
                id="btn-scan-camera"
                type="button"
                onClick={() => {
                  triggerHaptic('medium');
                  setIsCameraOpen(true);
                }}
                className="p-5 rounded-[24px] bg-[#1F2937] border border-[#374151] hover:border-[#4F46E5]/60 text-white flex flex-col items-center justify-center gap-2 active:scale-95 transition-all shadow-sm"
              >
                <div className="w-11 h-11 rounded-full bg-[#4F46E5] flex items-center justify-center text-white shadow-md shadow-[#4F46E5]/30">
                  <Camera className="w-5 h-5" />
                </div>
                <span className="text-xs sm:text-sm font-bold">Scan Paper Page</span>
                <span className="text-[10px] text-[#818CF8]">With Auto-Enhance</span>
              </button>

              <label className="p-5 rounded-[24px] bg-[#1F2937] border border-[#374151] hover:border-[#4F46E5]/60 text-white flex flex-col items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all shadow-sm">
                <div className="w-11 h-11 rounded-full bg-[#111827] border border-[#374151] flex items-center justify-center text-[#818CF8]">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <span className="text-xs sm:text-sm font-bold">Gallery Photos</span>
                <span className="text-[10px] text-[#9CA3AF]">Upload JPG, PNG</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Image List */}
            {imageList.length === 0 ? (
              <div className="rounded-[28px] border-2 border-dashed border-[#24272D] p-10 text-center text-[#9CA3AF] flex flex-col items-center justify-center">
                <ImageIcon className="w-10 h-10 text-[#374151] mb-3" />
                <p className="text-sm font-bold text-white">No images added yet</p>
                <p className="text-xs text-[#9CA3AF] mt-1 max-w-xs leading-relaxed">
                  Scan pages with your camera or select photos from your device to compile into PDF
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-[#9CA3AF] uppercase tracking-wider">
                    Pages in PDF ({imageList.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setImageList([])}
                    className="text-xs text-[#EF4444] hover:underline"
                  >
                    Clear All
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {imageList.map((img, idx) => (
                    <div
                      key={img.id}
                      className="relative rounded-[20px] bg-[#1F2937] border border-[#374151] p-2.5 overflow-hidden group shadow-sm flex flex-col"
                    >
                      <div className="relative aspect-[3/4] bg-[#111827] rounded-xl overflow-hidden mb-2 flex items-center justify-center">
                        <img
                          src={img.dataUrl}
                          alt={img.name}
                          className="w-full h-full object-contain"
                        />
                        <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-sm text-white text-[10px] font-bold">
                          Page {idx + 1}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-auto px-1 gap-1">
                        <button
                          id={`btn-ocr-image-${img.id}`}
                          type="button"
                          onClick={() => handleStartOcr(img.dataUrl)}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#4F46E5]/20 hover:bg-[#4F46E5]/35 text-[#818CF8] hover:text-white border border-[#4F46E5]/30 text-[10px] font-semibold active:scale-95 transition-all"
                          title="Extract text using Gemini AI OCR"
                        >
                          <Sparkles className="w-3 h-3 text-amber-300" />
                          <span>AI OCR</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => removeImage(img.id)}
                          className="p-1 text-[#EF4444] hover:text-rose-300 rounded-lg hover:bg-rose-950/30 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. TEMPLATES SUBMODE */}
        {activeSubMode === 'templates' && (
          <div className="space-y-3">
            <p className="text-xs text-[#9CA3AF] px-1">
              Pick a pre-formatted structure to instantly populate the document builder:
            </p>

            <div
              onClick={() => loadTemplate('memo')}
              className="p-4 rounded-[22px] bg-[#1F2937] border border-[#374151] hover:border-[#4F46E5]/60 cursor-pointer active:scale-95 transition-all flex items-center gap-3.5 bento-card"
            >
              <div className="w-10 h-10 rounded-2xl bg-[#4F46E5]/20 text-[#818CF8] flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Executive Memo</h4>
                <p className="text-xs text-[#9CA3AF]">Formal company memorandum layout</p>
              </div>
            </div>

            <div
              onClick={() => loadTemplate('invoice')}
              className="p-4 rounded-[22px] bg-[#1F2937] border border-[#374151] hover:border-[#4F46E5]/60 cursor-pointer active:scale-95 transition-all flex items-center gap-3.5 bento-card"
            >
              <div className="w-10 h-10 rounded-2xl bg-[#10B981]/20 text-[#10B981] flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Service Invoice</h4>
                <p className="text-xs text-[#9CA3AF]">Itemized billing breakdown template</p>
              </div>
            </div>

            <div
              onClick={() => loadTemplate('checklist')}
              className="p-4 rounded-[22px] bg-[#1F2937] border border-[#374151] hover:border-[#4F46E5]/60 cursor-pointer active:scale-95 transition-all flex items-center gap-3.5 bento-card"
            >
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Audit Checklist</h4>
                <p className="text-xs text-[#9CA3AF]">Inspection & compliance signoff sheet</p>
              </div>
            </div>

            <div
              id="template-qr-importer"
              onClick={() => {
                triggerHaptic('medium');
                setIsQrScannerOpen(true);
              }}
              className="p-4 rounded-[22px] bg-gradient-to-r from-[#1F2937] to-indigo-950/30 border border-indigo-500/40 hover:border-indigo-400 cursor-pointer active:scale-95 transition-all flex items-center gap-3.5 bento-card shadow-sm"
            >
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/25 text-indigo-300 flex items-center justify-center border border-indigo-500/30">
                <QrCode className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>Import via QR Code</span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-500/30 text-indigo-300 uppercase">Scanner</span>
                </h4>
                <p className="text-xs text-[#9CA3AF]">Scan URLs, markdown docs, or vCards to auto-generate PDF</p>
              </div>
            </div>
          </div>
        )}

        {/* Floating Bottom Export Bar */}
        <div className="sticky bottom-2 z-20 bg-[#1F2937]/95 backdrop-blur-md p-3.5 rounded-[24px] border border-[#374151] shadow-2xl flex items-center gap-3 mt-auto">
          <button
            id="btn-generate-create"
            type="button"
            disabled={isGenerating}
            onClick={() => handleGeneratePdf(false)}
            className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-full bg-[#4F46E5] hover:bg-[#4338CA] disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-[#4F46E5]/25 active:scale-95 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>{isGenerating ? 'Building PDF...' : 'Create & Download PDF'}</span>
          </button>
        </div>
      </div>

      {/* Modals */}
      <SignaturePadModal
        isOpen={isSigModalOpen}
        onClose={() => setIsSigModalOpen(false)}
        onSave={handleSignatureSaved}
      />

      <CameraScannerModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraCapture}
        onExtractText={handleStartOcr}
      />

      <GeminiOcrModal
        isOpen={isOcrModalOpen}
        onClose={() => setIsOcrModalOpen(false)}
        imagePreviewUrl={ocrImagePreview}
        ocrResult={ocrResult}
        isLoading={ocrLoading}
        errorMessage={ocrError}
        onRetry={() => {
          if (ocrImagePreview) {
            handleStartOcr(ocrImagePreview);
          }
        }}
        onApplyToDocument={handleApplyOcrToDocument}
        onAppendSection={handleAppendOcrSection}
      />

      <QrScannerModal
        isOpen={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
        onImportNewDocument={handleImportFromQr}
        onAppendSection={handleAppendQrSection}
        onDirectExportPdf={handleDirectExportFromQr}
      />
    </div>
  );
};
