import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Upload,
  Sparkles,
  Download,
  Share2,
  Trash2,
  Plus,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Type,
  Square,
  Circle,
  Highlighter,
  ShieldAlert,
  MessageSquare,
  Stamp,
  CheckSquare,
  Calendar,
  PenTool,
  Eraser,
  Copy,
  Layers,
  Save,
  Eye,
  Settings,
  X,
  Check,
  Move,
  ArrowRight,
  Sliders,
  Scissors,
  FilePlus,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import {
  DocumentAnnotations,
  StickyNoteAnnotation,
  ShapeAnnotation,
  TextBlockAnnotation,
  ImageOverlayAnnotation,
  FormFieldAnnotation,
  WhiteoutReplaceAnnotation,
  StickyColor,
  ShapeType,
  FormFieldType,
  ProcessedDocument,
  GeminiOcrResult,
  DocumentSection
} from '../types';
import {
  applyAnnotationsToPdf,
  renderSinglePageToImage,
  insertBlankPageToPdf,
  duplicatePageInPdf,
  deletePageFromPdf,
  rotatePdfDocumentPages,
  formatBytes,
  createPdfDocument
} from '../utils/pdfEngine';
import { triggerHaptic } from '../utils/haptics';
import { SignaturePadModal } from './SignaturePadModal';
import { GeminiOcrModal } from './GeminiOcrModal';
import { extractTextFromImageWithGemini } from '../utils/geminiOcr';
import * as pdfjsLib from 'pdfjs-dist';

interface EditToolProps {
  currentFile: { name: string; bytes: Uint8Array } | null;
  onFileLoaded: (file: { name: string; bytes: Uint8Array }) => void;
  onSuccess: (
    blob: Blob,
    filename: string,
    pageCount: number,
    action: ProcessedDocument['action']
  ) => void;
  onPreview: (blob: Blob, filename: string, pageCount?: number) => void;
  onNavigateTab: (tab: any) => void;
}

type ActiveTool =
  | 'select'
  | 'text'
  | 'sticky'
  | 'shape_rect'
  | 'shape_circle'
  | 'shape_highlight'
  | 'shape_redact'
  | 'shape_arrow'
  | 'shape_line'
  | 'whiteout'
  | 'stamp'
  | 'form_text'
  | 'form_checkbox'
  | 'form_date'
  | 'form_sign';

export const EditTool: React.FC<EditToolProps> = ({
  currentFile,
  onFileLoaded,
  onSuccess,
  onPreview,
  onNavigateTab,
}) => {
  // Document State
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [docName, setDocName] = useState<string>('Document.pdf');
  const [numPages, setNumPages] = useState<number>(1);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [pageImage, setPageImage] = useState<string | null>(null);
  const [isRenderingPage, setIsRenderingPage] = useState<boolean>(false);
  const [zoomScale, setZoomScale] = useState<number>(1.0);

  // Editor Mode
  const [activeTool, setActiveTool] = useState<ActiveTool>('select');
  const [mode, setMode] = useState<'design' | 'fill'>('design'); // Form Fill Mode vs Design Mode
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Annotations State
  const [annotations, setAnnotations] = useState<DocumentAnnotations>({
    stickyNotes: [],
    shapes: [],
    textBlocks: [],
    imageOverlays: [],
    formFields: [],
    whiteouts: [],
  });

  // Selected item for property inspector
  const [selectedItem, setSelectedItem] = useState<{
    category: 'sticky' | 'shape' | 'text' | 'image' | 'form' | 'whiteout';
    id: string;
  } | null>(null);

  // Sticky notes sidebar drawer
  const [showNotesDrawer, setShowNotesDrawer] = useState<boolean>(false);

  // Modals
  const [isSigModalOpen, setIsSigModalOpen] = useState<boolean>(false);
  const [activeSigFieldId, setActiveSigFieldId] = useState<string | null>(null);
  const [isOcrModalOpen, setIsOcrModalOpen] = useState<boolean>(false);
  const [ocrLoading, setOcrLoading] = useState<boolean>(false);
  const [ocrResult, setOcrResult] = useState<GeminiOcrResult | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);

  // Canvas Reference for relative click coordinates
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageOverlayInputRef = useRef<HTMLInputElement | null>(null);

  // Load Initial PDF
  useEffect(() => {
    if (currentFile && currentFile.bytes) {
      setPdfBytes(currentFile.bytes);
      setDocName(currentFile.name || 'Document.pdf');
      loadDocumentInfo(currentFile.bytes);
    }
  }, [currentFile]);

  // Load Document Info
  const loadDocumentInfo = async (bytes: Uint8Array) => {
    try {
      const loadingTask = pdfjsLib.getDocument({ data: bytes.slice(0) });
      const pdf = await loadingTask.promise;
      setNumPages(pdf.numPages);
      setCurrentPageIndex(0);
      renderPage(bytes, 0);
    } catch (e) {
      console.warn('PDF info loading fallback:', e);
      setNumPages(1);
      setCurrentPageIndex(0);
      renderPage(bytes, 0);
    }
  };

  // Render specific page
  const renderPage = async (bytes: Uint8Array, pageIdx: number) => {
    setIsRenderingPage(true);
    try {
      const { dataUrl } = await renderSinglePageToImage(bytes, pageIdx, 1.8);
      setPageImage(dataUrl);
    } catch (err) {
      console.error('Failed to render page image:', err);
    } finally {
      setIsRenderingPage(false);
    }
  };

  const changePage = (newIndex: number) => {
    if (newIndex < 0 || newIndex >= numPages || !pdfBytes) return;
    triggerHaptic('light');
    setCurrentPageIndex(newIndex);
    setSelectedItem(null);
    renderPage(pdfBytes, newIndex);
  };

  // File Upload Handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const bytes = new Uint8Array(reader.result as ArrayBuffer);
      setPdfBytes(bytes);
      setDocName(file.name);
      onFileLoaded({ name: file.name, bytes });
      loadDocumentInfo(bytes);
      // Reset annotations
      setAnnotations({
        stickyNotes: [],
        shapes: [],
        textBlocks: [],
        imageOverlays: [],
        formFields: [],
        whiteouts: [],
      });
      triggerHaptic('success');
    };
    reader.readAsArrayBuffer(file);
  };

  // Canvas Click Handler (adds element at click position)
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool === 'select' || mode === 'fill') return;
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const xPercent = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
    const yPercent = Math.max(0, Math.min(100, (clickY / rect.height) * 100));

    triggerHaptic('light');

    switch (activeTool) {
      case 'sticky': {
        const newSticky: StickyNoteAnnotation = {
          id: Math.random().toString(36).substr(2, 7),
          pageIndex: currentPageIndex,
          xPercent,
          yPercent,
          author: 'Editor',
          content: 'Add your note here...',
          color: 'yellow',
          isResolved: false,
          timestamp: Date.now(),
        };
        setAnnotations((prev) => ({
          ...prev,
          stickyNotes: [...prev.stickyNotes, newSticky],
        }));
        setSelectedItem({ category: 'sticky', id: newSticky.id });
        setActiveTool('select');
        break;
      }

      case 'text': {
        const newText: TextBlockAnnotation = {
          id: Math.random().toString(36).substr(2, 7),
          pageIndex: currentPageIndex,
          text: 'New Text Block',
          xPercent,
          yPercent,
          widthPercent: 35,
          fontSize: 14,
          isBold: false,
          isItalic: false,
          color: '#0F172A',
          backgroundColor: '#FFFFFF',
          isTransparentBg: false,
          align: 'left',
        };
        setAnnotations((prev) => ({
          ...prev,
          textBlocks: [...prev.textBlocks, newText],
        }));
        setSelectedItem({ category: 'text', id: newText.id });
        setActiveTool('select');
        break;
      }

      case 'whiteout': {
        const newWhiteout: WhiteoutReplaceAnnotation = {
          id: Math.random().toString(36).substr(2, 7),
          pageIndex: currentPageIndex,
          xPercent,
          yPercent,
          widthPercent: 30,
          heightPercent: 4,
          replacementText: 'Rewritten Text',
          fontSize: 12,
          isBold: false,
          color: '#0F172A',
        };
        setAnnotations((prev) => ({
          ...prev,
          whiteouts: [...prev.whiteouts, newWhiteout],
        }));
        setSelectedItem({ category: 'whiteout', id: newWhiteout.id });
        setActiveTool('select');
        break;
      }

      case 'shape_rect':
      case 'shape_circle':
      case 'shape_highlight':
      case 'shape_redact':
      case 'shape_line':
      case 'shape_arrow': {
        const typeMap: Record<string, ShapeType> = {
          shape_rect: 'rect',
          shape_circle: 'circle',
          shape_highlight: 'highlight',
          shape_redact: 'redact',
          shape_line: 'line',
          shape_arrow: 'arrow',
        };
        const shapeType = typeMap[activeTool] || 'rect';
        const newShape: ShapeAnnotation = {
          id: Math.random().toString(36).substr(2, 7),
          pageIndex: currentPageIndex,
          type: shapeType,
          xPercent,
          yPercent,
          widthPercent: shapeType === 'highlight' ? 40 : 25,
          heightPercent: shapeType === 'highlight' ? 3 : shapeType === 'redact' ? 5 : 15,
          strokeColor: shapeType === 'highlight' ? '#FACC15' : shapeType === 'redact' ? '#000000' : '#4F46E5',
          fillColor:
            shapeType === 'highlight'
              ? '#FACC15'
              : shapeType === 'redact'
              ? '#000000'
              : 'transparent',
          opacity: shapeType === 'highlight' ? 0.4 : 1,
          strokeWidth: 2,
        };
        setAnnotations((prev) => ({
          ...prev,
          shapes: [...prev.shapes, newShape],
        }));
        setSelectedItem({ category: 'shape', id: newShape.id });
        setActiveTool('select');
        break;
      }

      case 'form_text':
      case 'form_checkbox':
      case 'form_date':
      case 'form_sign': {
        const typeMap: Record<string, FormFieldType> = {
          form_text: 'text',
          form_checkbox: 'checkbox',
          form_date: 'date',
          form_sign: 'signature',
        };
        const fType = typeMap[activeTool] || 'text';
        const newField: FormFieldAnnotation = {
          id: Math.random().toString(36).substr(2, 7),
          pageIndex: currentPageIndex,
          type: fType,
          name: `field_${Date.now().toString(36).substr(4)}`,
          label: fType === 'signature' ? 'Signature' : fType === 'date' ? 'Date' : fType === 'checkbox' ? 'I Agree' : 'Text Input',
          placeholder: fType === 'text' ? 'Enter text here...' : fType === 'date' ? 'YYYY-MM-DD' : '',
          value: fType === 'checkbox' ? false : '',
          xPercent,
          yPercent,
          widthPercent: fType === 'checkbox' ? 5 : fType === 'signature' ? 35 : 30,
          heightPercent: fType === 'checkbox' ? 3.5 : fType === 'signature' ? 8 : 4.5,
          isRequired: false,
        };
        setAnnotations((prev) => ({
          ...prev,
          formFields: [...prev.formFields, newField],
        }));
        setSelectedItem({ category: 'form', id: newField.id });
        setActiveTool('select');
        break;
      }
    }
  };

  // Add Rubber Stamp Badge
  const addStamp = (label: string) => {
    triggerHaptic('medium');
    const newStamp: ImageOverlayAnnotation = {
      id: Math.random().toString(36).substr(2, 7),
      pageIndex: currentPageIndex,
      dataUrl: '',
      stampLabel: label,
      xPercent: 35,
      yPercent: 20,
      widthPercent: 30,
      heightPercent: 8,
    };
    setAnnotations((prev) => ({
      ...prev,
      imageOverlays: [...prev.imageOverlays, newStamp],
    }));
    setSelectedItem({ category: 'image', id: newStamp.id });
    setActiveTool('select');
  };

  // Add Custom Image Overlay or Signature
  const handleCustomImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const newImg: ImageOverlayAnnotation = {
        id: Math.random().toString(36).substr(2, 7),
        pageIndex: currentPageIndex,
        dataUrl,
        xPercent: 30,
        yPercent: 30,
        widthPercent: 35,
        heightPercent: 20,
      };
      setAnnotations((prev) => ({
        ...prev,
        imageOverlays: [...prev.imageOverlays, newImg],
      }));
      setSelectedItem({ category: 'image', id: newImg.id });
      triggerHaptic('success');
    };
    reader.readAsDataURL(file);
  };

  // Delete Selected Annotation
  const handleDeleteSelected = () => {
    if (!selectedItem) return;
    triggerHaptic('medium');
    const { category, id } = selectedItem;
    if (category === 'sticky') {
      setAnnotations((prev) => ({
        ...prev,
        stickyNotes: prev.stickyNotes.filter((x) => x.id !== id),
      }));
    } else if (category === 'shape') {
      setAnnotations((prev) => ({
        ...prev,
        shapes: prev.shapes.filter((x) => x.id !== id),
      }));
    } else if (category === 'text') {
      setAnnotations((prev) => ({
        ...prev,
        textBlocks: prev.textBlocks.filter((x) => x.id !== id),
      }));
    } else if (category === 'image') {
      setAnnotations((prev) => ({
        ...prev,
        imageOverlays: prev.imageOverlays.filter((x) => x.id !== id),
      }));
    } else if (category === 'form') {
      setAnnotations((prev) => ({
        ...prev,
        formFields: prev.formFields.filter((x) => x.id !== id),
      }));
    } else if (category === 'whiteout') {
      setAnnotations((prev) => ({
        ...prev,
        whiteouts: prev.whiteouts.filter((x) => x.id !== id),
      }));
    }
    setSelectedItem(null);
  };

  // Page Operations
  const handleInsertBlankPage = async () => {
    if (!pdfBytes) return;
    triggerHaptic('medium');
    try {
      const updated = await insertBlankPageToPdf(pdfBytes, currentPageIndex);
      setPdfBytes(updated);
      setNumPages((prev) => prev + 1);
      setCurrentPageIndex((prev) => prev + 1);
      renderPage(updated, currentPageIndex + 1);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDuplicatePage = async () => {
    if (!pdfBytes) return;
    triggerHaptic('medium');
    try {
      const updated = await duplicatePageInPdf(pdfBytes, currentPageIndex);
      setPdfBytes(updated);
      setNumPages((prev) => prev + 1);
      setCurrentPageIndex((prev) => prev + 1);
      renderPage(updated, currentPageIndex + 1);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeletePage = async () => {
    if (!pdfBytes || numPages <= 1) return;
    triggerHaptic('heavy');
    try {
      const updated = await deletePageFromPdf(pdfBytes, currentPageIndex);
      setPdfBytes(updated);
      setNumPages((prev) => prev - 1);
      const nextIdx = Math.max(0, currentPageIndex - 1);
      setCurrentPageIndex(nextIdx);
      renderPage(updated, nextIdx);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRotateCurrentPage = async () => {
    if (!pdfBytes) return;
    triggerHaptic('light');
    try {
      const updated = await rotatePdfDocumentPages(pdfBytes, [
        { pageIndex: currentPageIndex, rotationAngle: 90 },
      ]);
      setPdfBytes(updated);
      renderPage(updated, currentPageIndex);
    } catch (e) {
      console.error(e);
    }
  };

  // Run Gemini OCR on Current Page
  const handleOcrActivePage = async () => {
    if (!pageImage) return;
    triggerHaptic('medium');
    setOcrLoading(true);
    setOcrError(null);
    setOcrResult(null);
    setIsOcrModalOpen(true);

    try {
      const result = await extractTextFromImageWithGemini(pageImage);
      setOcrResult(result);
      triggerHaptic('success');
    } catch (err: any) {
      setOcrError(err.message || 'Failed to extract text from page using Gemini');
      triggerHaptic('warning');
    } finally {
      setOcrLoading(false);
    }
  };

  // OCR Apply to Document Sections
  const handleApplyOcrSections = (sections: DocumentSection[], newTitle?: string) => {
    // Convert extracted structured blocks into editable Text Blocks overlaid on the page
    triggerHaptic('success');
    let currentY = 15;
    const newBlocks: TextBlockAnnotation[] = [];

    sections.forEach((sec) => {
      newBlocks.push({
        id: Math.random().toString(36).substr(2, 7),
        pageIndex: currentPageIndex,
        text: sec.content,
        xPercent: 10,
        yPercent: currentY,
        widthPercent: 80,
        fontSize: sec.type === 'heading' ? 18 : 12,
        isBold: sec.type === 'heading',
        isItalic: false,
        color: '#0F172A',
        backgroundColor: '#FFFFFF',
        isTransparentBg: false,
        align: 'left',
      });
      currentY += sec.type === 'heading' ? 7 : Math.min(25, 4 + sec.content.length * 0.05);
    });

    // Add whiteout mask over original text if requested
    const bigWhiteout: WhiteoutReplaceAnnotation = {
      id: Math.random().toString(36).substr(2, 7),
      pageIndex: currentPageIndex,
      xPercent: 8,
      yPercent: 12,
      widthPercent: 84,
      heightPercent: 78,
      replacementText: '',
      fontSize: 12,
      isBold: false,
      color: '#000000',
    };

    setAnnotations((prev) => ({
      ...prev,
      whiteouts: [...prev.whiteouts, bigWhiteout],
      textBlocks: [...prev.textBlocks, ...newBlocks],
    }));
  };

  // Save Document with Annotations
  const handleSaveDocument = async () => {
    if (!pdfBytes) return;
    triggerHaptic('medium');
    setIsSaving(true);
    try {
      const finalBytes = await applyAnnotationsToPdf(pdfBytes, annotations);
      const blob = new Blob([finalBytes], { type: 'application/pdf' });
      const cleanName = docName.replace(/\.[^/.]+$/, '');
      const finalName = `${cleanName}_edited.pdf`;

      onSuccess(blob, finalName, numPages, 'edit');
      onPreview(blob, finalName, numPages);
    } catch (err: any) {
      console.error('Failed to save annotated PDF:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Filter current page annotations
  const curPageStickies = annotations.stickyNotes.filter((x) => x.pageIndex === currentPageIndex);
  const curPageShapes = annotations.shapes.filter((x) => x.pageIndex === currentPageIndex);
  const curPageTexts = annotations.textBlocks.filter((x) => x.pageIndex === currentPageIndex);
  const curPageImages = annotations.imageOverlays.filter((x) => x.pageIndex === currentPageIndex);
  const curPageForms = annotations.formFields.filter((x) => x.pageIndex === currentPageIndex);
  const curPageWhiteouts = annotations.whiteouts.filter((x) => x.pageIndex === currentPageIndex);

  // Selected item object lookup
  const currentSelectedObj = selectedItem
    ? selectedItem.category === 'sticky'
      ? annotations.stickyNotes.find((x) => x.id === selectedItem.id)
      : selectedItem.category === 'shape'
      ? annotations.shapes.find((x) => x.id === selectedItem.id)
      : selectedItem.category === 'text'
      ? annotations.textBlocks.find((x) => x.id === selectedItem.id)
      : selectedItem.category === 'image'
      ? annotations.imageOverlays.find((x) => x.id === selectedItem.id)
      : selectedItem.category === 'form'
      ? annotations.formFields.find((x) => x.id === selectedItem.id)
      : selectedItem.category === 'whiteout'
      ? annotations.whiteouts.find((x) => x.id === selectedItem.id)
      : null
    : null;

  return (
    <div className="flex-1 flex flex-col bg-[#0F1115] text-white overflow-hidden select-none">
      {/* Hidden file pickers */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="application/pdf"
        className="hidden"
      />
      <input
        type="file"
        ref={imageOverlayInputRef}
        onChange={handleCustomImageUpload}
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
      />

      {/* TOP SUB-HEADER TOOLBAR */}
      <div className="bg-[#111827] border-b border-[#24272D] px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-8 h-8 rounded-xl bg-[#4F46E5]/20 border border-[#4F46E5]/30 text-[#818CF8] flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4" />
          </div>
          <div className="truncate">
            <h2 className="text-xs sm:text-sm font-bold text-white truncate">{docName}</h2>
            <p className="text-[10px] text-[#9CA3AF]">
              {pdfBytes ? `${formatBytes(pdfBytes.length)} • ${numPages} Pages` : 'No file loaded'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Mode Switch (Design vs Fill Form) */}
          <div className="bg-[#1F2937] p-0.5 rounded-full border border-[#374151] flex items-center text-xs">
            <button
              id="btn-mode-design"
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setMode('design');
              }}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                mode === 'design' ? 'bg-[#4F46E5] text-white shadow-sm' : 'text-[#9CA3AF]'
              }`}
            >
              Edit & Annotate
            </button>
            <button
              id="btn-mode-fill"
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setMode('fill');
                setSelectedItem(null);
              }}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                mode === 'fill' ? 'bg-[#10B981] text-white shadow-sm' : 'text-[#9CA3AF]'
              }`}
            >
              Fill Form Live
            </button>
          </div>

          <button
            id="btn-edit-change-file"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 rounded-xl bg-[#1F2937] hover:bg-[#374151] text-[#9CA3AF] hover:text-white border border-[#374151] transition-all"
            title="Open another PDF"
          >
            <Upload className="w-4 h-4" />
          </button>

          <button
            id="btn-edit-save-pdf"
            type="button"
            disabled={!pdfBytes || isSaving}
            onClick={handleSaveDocument}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-bold shadow-md shadow-[#4F46E5]/30 active:scale-95 transition-all disabled:opacity-50"
          >
            {isSaving ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>Save PDF</span>
          </button>
        </div>
      </div>

      {/* SECONDARY ACTION & TOOL PICKER BAR */}
      <div className="bg-[#181D26] border-b border-[#24272D] px-2 py-1.5 flex items-center justify-between gap-1 overflow-x-auto no-scrollbar shrink-0 text-xs">
        {/* Main Tool Categories */}
        <div className="flex items-center gap-1">
          <button
            id="tool-select"
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setActiveTool('select');
            }}
            className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition-all ${
              activeTool === 'select'
                ? 'bg-[#4F46E5] text-white'
                : 'text-[#9CA3AF] hover:text-white bg-[#1F2937]'
            }`}
          >
            <Move className="w-3 h-3" />
            <span>Select</span>
          </button>

          <button
            id="tool-text"
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setActiveTool('text');
            }}
            className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition-all ${
              activeTool === 'text'
                ? 'bg-[#4F46E5] text-white'
                : 'text-[#9CA3AF] hover:text-white bg-[#1F2937]'
            }`}
          >
            <Type className="w-3 h-3" />
            <span>Text Box</span>
          </button>

          <button
            id="tool-whiteout"
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setActiveTool('whiteout');
            }}
            className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition-all ${
              activeTool === 'whiteout'
                ? 'bg-[#4F46E5] text-white'
                : 'text-[#9CA3AF] hover:text-white bg-[#1F2937]'
            }`}
            title="Whiteout and replace existing text"
          >
            <Eraser className="w-3 h-3 text-amber-400" />
            <span>Rewrite Text</span>
          </button>

          <button
            id="tool-sticky"
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setActiveTool('sticky');
            }}
            className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition-all ${
              activeTool === 'sticky'
                ? 'bg-[#4F46E5] text-white'
                : 'text-[#9CA3AF] hover:text-white bg-[#1F2937]'
            }`}
          >
            <MessageSquare className="w-3 h-3 text-yellow-300" />
            <span>Sticky Note</span>
          </button>

          {/* Shapes Dropdown / Selectors */}
          <button
            id="tool-rect"
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setActiveTool('shape_rect');
            }}
            className={`p-1.5 rounded-lg transition-all ${
              activeTool === 'shape_rect'
                ? 'bg-[#4F46E5] text-white'
                : 'text-[#9CA3AF] hover:text-white bg-[#1F2937]'
            }`}
            title="Rectangle Shape"
          >
            <Square className="w-3.5 h-3.5" />
          </button>

          <button
            id="tool-circle"
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setActiveTool('shape_circle');
            }}
            className={`p-1.5 rounded-lg transition-all ${
              activeTool === 'shape_circle'
                ? 'bg-[#4F46E5] text-white'
                : 'text-[#9CA3AF] hover:text-white bg-[#1F2937]'
            }`}
            title="Circle Shape"
          >
            <Circle className="w-3.5 h-3.5" />
          </button>

          <button
            id="tool-highlight"
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setActiveTool('shape_highlight');
            }}
            className={`p-1.5 rounded-lg transition-all ${
              activeTool === 'shape_highlight'
                ? 'bg-[#4F46E5] text-white'
                : 'text-[#9CA3AF] hover:text-white bg-[#1F2937]'
            }`}
            title="Highlighter Pen"
          >
            <Highlighter className="w-3.5 h-3.5 text-yellow-300" />
          </button>

          <button
            id="tool-redact"
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setActiveTool('shape_redact');
            }}
            className={`p-1.5 rounded-lg transition-all ${
              activeTool === 'shape_redact'
                ? 'bg-[#4F46E5] text-white'
                : 'text-[#9CA3AF] hover:text-white bg-[#1F2937]'
            }`}
            title="Redact Privacy Block"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
          </button>
        </div>

        {/* Forms & OCR Tools */}
        <div className="flex items-center gap-1 border-l border-[#374151] pl-2">
          {/* Form Field Trigger */}
          <button
            id="tool-form-text"
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setActiveTool('form_text');
            }}
            className={`px-2 py-1 rounded-lg font-semibold flex items-center gap-1 transition-all ${
              activeTool === 'form_text'
                ? 'bg-[#4F46E5] text-white'
                : 'text-[#9CA3AF] hover:text-white bg-[#1F2937]'
            }`}
            title="Add fillable form input field"
          >
            <CheckSquare className="w-3 h-3 text-emerald-400" />
            <span>+ Form Field</span>
          </button>

          {/* Rubber Stamp Button */}
          <div className="relative group">
            <button
              id="tool-stamp-trigger"
              type="button"
              className="px-2 py-1 rounded-lg font-semibold flex items-center gap-1 text-[#9CA3AF] hover:text-white bg-[#1F2937]"
            >
              <Stamp className="w-3 h-3 text-cyan-400" />
              <span>Stamps</span>
            </button>
            <div className="absolute top-full left-0 mt-1 hidden group-hover:flex flex-col bg-[#1F2937] border border-[#374151] rounded-xl p-1.5 shadow-2xl z-50 min-w-[130px]">
              {['APPROVED', 'CONFIDENTIAL', 'PAID', 'DRAFT', 'URGENT', 'FINAL'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => addStamp(st)}
                  className="px-2.5 py-1 rounded text-left text-[11px] font-bold text-white hover:bg-[#374151] flex items-center justify-between"
                >
                  <span>{st}</span>
                </button>
              ))}
              <div className="border-t border-[#374151] my-1" />
              <button
                type="button"
                onClick={() => imageOverlayInputRef.current?.click()}
                className="px-2.5 py-1 rounded text-left text-[10px] font-semibold text-[#818CF8] hover:bg-[#374151]"
              >
                + Upload Custom Image
              </button>
            </div>
          </div>

          {/* Gemini AI OCR for Page */}
          <button
            id="btn-ocr-page"
            type="button"
            onClick={handleOcrActivePage}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#4F46E5]/40 to-[#818CF8]/40 hover:from-[#4F46E5]/60 hover:to-[#818CF8]/60 border border-[#818CF8]/40 text-[#818CF8] hover:text-white font-bold transition-all shadow-sm"
            title="Convert scanned page into editable text blocks using Gemini"
          >
            <Sparkles className="w-3 h-3 text-amber-300 animate-pulse" />
            <span>AI OCR Edit</span>
          </button>
        </div>
      </div>

      {/* MAIN WORKSPACE AREA */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Center Canvas / Document Viewport */}
        <div className="flex-1 bg-[#0A0C10] overflow-auto flex flex-col items-center p-3 sm:p-6 relative">
          {/* Active Canvas Holder */}
          <div
            ref={canvasRef}
            onClick={handleCanvasClick}
            className={`relative bg-white shadow-2xl rounded-sm transition-all border border-[#374151] ${
              activeTool !== 'select' ? 'cursor-crosshair' : 'cursor-default'
            }`}
            style={{
              width: `${Math.round(595 * zoomScale)}px`,
              minHeight: `${Math.round(842 * zoomScale)}px`,
            }}
          >
            {/* Background Page Image */}
            {isRenderingPage ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-xs text-slate-700 space-y-2">
                <div className="w-6 h-6 border-2 border-[#4F46E5] border-t-transparent rounded-full animate-spin" />
                <span className="text-[11px] font-medium text-slate-600">Rendering Page...</span>
              </div>
            ) : pageImage ? (
              <img
                src={pageImage}
                alt={`Page ${currentPageIndex + 1}`}
                className="w-full h-full object-contain pointer-events-none"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-slate-500">
                <p className="text-xs">No PDF Loaded. Tap Open PDF to load a file.</p>
              </div>
            )}

            {/* OVERLAY LAYER 1: Whiteouts & Text Rewrites */}
            {curPageWhiteouts.map((w) => {
              const isSelected = selectedItem?.category === 'whiteout' && selectedItem.id === w.id;
              return (
                <div
                  key={w.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerHaptic('light');
                    setSelectedItem({ category: 'whiteout', id: w.id });
                  }}
                  className={`absolute bg-white transition-all ${
                    isSelected ? 'ring-2 ring-[#4F46E5] shadow-lg z-30' : 'border border-dashed border-slate-300'
                  }`}
                  style={{
                    left: `${w.xPercent}%`,
                    top: `${w.yPercent}%`,
                    width: `${w.widthPercent}%`,
                    height: `${w.heightPercent}%`,
                  }}
                >
                  <div className="w-full h-full p-1 flex items-center">
                    {mode === 'fill' ? (
                      <span className="text-xs text-slate-900 font-medium">{w.replacementText}</span>
                    ) : (
                      <input
                        type="text"
                        value={w.replacementText}
                        onChange={(e) => {
                          const val = e.target.value;
                          setAnnotations((prev) => ({
                            ...prev,
                            whiteouts: prev.whiteouts.map((item) =>
                              item.id === w.id ? { ...item, replacementText: val } : item
                            ),
                          }));
                        }}
                        className="w-full h-full bg-transparent text-xs text-slate-900 outline-none font-medium"
                        placeholder="Type replacement text..."
                      />
                    )}
                  </div>
                </div>
              );
            })}

            {/* OVERLAY LAYER 2: Shapes & Highlighters */}
            {curPageShapes.map((s) => {
              const isSelected = selectedItem?.category === 'shape' && selectedItem.id === s.id;
              return (
                <div
                  key={s.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerHaptic('light');
                    setSelectedItem({ category: 'shape', id: s.id });
                  }}
                  className={`absolute transition-all ${
                    isSelected ? 'ring-2 ring-[#4F46E5] z-30' : ''
                  } ${s.type === 'circle' ? 'rounded-full' : 'rounded-xs'}`}
                  style={{
                    left: `${s.xPercent}%`,
                    top: `${s.yPercent}%`,
                    width: `${s.widthPercent}%`,
                    height: `${s.heightPercent}%`,
                    border: `${s.strokeWidth}px solid ${s.strokeColor}`,
                    backgroundColor: s.fillColor,
                    opacity: s.opacity,
                  }}
                >
                  {s.type === 'redact' && (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-[8px] font-bold text-white tracking-wider">[REDACTED]</span>
                    </div>
                  )}
                </div>
              );
            })}

            {/* OVERLAY LAYER 3: Text Blocks */}
            {curPageTexts.map((t) => {
              const isSelected = selectedItem?.category === 'text' && selectedItem.id === t.id;
              return (
                <div
                  key={t.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerHaptic('light');
                    setSelectedItem({ category: 'text', id: t.id });
                  }}
                  className={`absolute p-1.5 transition-all ${
                    isSelected
                      ? 'ring-2 ring-[#4F46E5] shadow-xl z-40'
                      : t.isTransparentBg
                      ? ''
                      : 'shadow-sm border border-slate-200'
                  }`}
                  style={{
                    left: `${t.xPercent}%`,
                    top: `${t.yPercent}%`,
                    width: `${t.widthPercent}%`,
                    backgroundColor: t.isTransparentBg ? 'transparent' : t.backgroundColor,
                  }}
                >
                  {mode === 'fill' ? (
                    <div
                      className="whitespace-pre-wrap leading-tight"
                      style={{
                        fontSize: `${t.fontSize}px`,
                        fontWeight: t.isBold ? 'bold' : 'normal',
                        fontStyle: t.isItalic ? 'italic' : 'normal',
                        color: t.color,
                        textAlign: t.align,
                      }}
                    >
                      {t.text}
                    </div>
                  ) : (
                    <textarea
                      rows={Math.max(1, t.text.split('\n').length)}
                      value={t.text}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAnnotations((prev) => ({
                          ...prev,
                          textBlocks: prev.textBlocks.map((item) =>
                            item.id === t.id ? { ...item, text: val } : item
                          ),
                        }));
                      }}
                      className="w-full bg-transparent outline-none resize-none leading-tight"
                      style={{
                        fontSize: `${t.fontSize}px`,
                        fontWeight: t.isBold ? 'bold' : 'normal',
                        fontStyle: t.isItalic ? 'italic' : 'normal',
                        color: t.color,
                        textAlign: t.align,
                      }}
                    />
                  )}
                </div>
              );
            })}

            {/* OVERLAY LAYER 4: Rubber Stamps & Custom Images */}
            {curPageImages.map((img) => {
              const isSelected = selectedItem?.category === 'image' && selectedItem.id === img.id;
              return (
                <div
                  key={img.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerHaptic('light');
                    setSelectedItem({ category: 'image', id: img.id });
                  }}
                  className={`absolute transition-all ${
                    isSelected ? 'ring-2 ring-[#4F46E5] z-40' : ''
                  }`}
                  style={{
                    left: `${img.xPercent}%`,
                    top: `${img.yPercent}%`,
                    width: `${img.widthPercent}%`,
                    height: `${img.heightPercent}%`,
                  }}
                >
                  {img.stampLabel ? (
                    <div className="w-full h-full border-2 border-rose-600 rounded-lg p-0.5 bg-rose-600/10 flex items-center justify-center shadow-md rotate-[-5deg]">
                      <div className="w-full h-full border border-rose-600/50 rounded flex items-center justify-center">
                        <span className="font-extrabold text-rose-700 tracking-wider text-xs sm:text-sm">
                          {img.stampLabel}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <img
                      src={img.dataUrl}
                      alt="Overlay"
                      className="w-full h-full object-contain shadow-md rounded"
                    />
                  )}
                </div>
              );
            })}

            {/* OVERLAY LAYER 5: Interactive Form Fields */}
            {curPageForms.map((f) => {
              const isSelected = selectedItem?.category === 'form' && selectedItem.id === f.id;
              return (
                <div
                  key={f.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerHaptic('light');
                    setSelectedItem({ category: 'form', id: f.id });
                  }}
                  className={`absolute transition-all bg-[#F4F6FF] border border-[#4F46E5]/60 rounded p-1 flex flex-col justify-center ${
                    isSelected ? 'ring-2 ring-[#4F46E5] shadow-lg z-40' : 'hover:border-[#4F46E5]'
                  }`}
                  style={{
                    left: `${f.xPercent}%`,
                    top: `${f.yPercent}%`,
                    width: `${f.widthPercent}%`,
                    height: `${f.heightPercent}%`,
                  }}
                >
                  {f.label && (
                    <span className="text-[8px] font-bold text-[#4F46E5] truncate leading-none mb-0.5">
                      {f.label}
                    </span>
                  )}

                  {f.type === 'checkbox' ? (
                    <div className="flex items-center justify-center h-full">
                      <input
                        type="checkbox"
                        checked={f.value === true || f.value === 'true'}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setAnnotations((prev) => ({
                            ...prev,
                            formFields: prev.formFields.map((item) =>
                              item.id === f.id ? { ...item, value: val } : item
                            ),
                          }));
                        }}
                        className="w-4 h-4 rounded text-[#4F46E5] focus:ring-0"
                      />
                    </div>
                  ) : f.type === 'signature' ? (
                    <div
                      onClick={() => {
                        setActiveSigFieldId(f.id);
                        setIsSigModalOpen(true);
                      }}
                      className="w-full h-full bg-white/70 rounded border border-dashed border-[#4F46E5]/40 flex items-center justify-center cursor-pointer hover:bg-white"
                    >
                      {f.value ? (
                        <img
                          src={String(f.value)}
                          alt="Signature"
                          className="h-full object-contain"
                        />
                      ) : (
                        <div className="flex items-center gap-1 text-[9px] text-[#4F46E5] font-semibold">
                          <PenTool className="w-2.5 h-2.5" />
                          <span>Tap to Sign</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <input
                      type={f.type === 'date' ? 'date' : 'text'}
                      value={String(f.value || '')}
                      placeholder={f.placeholder || 'Enter value...'}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAnnotations((prev) => ({
                          ...prev,
                          formFields: prev.formFields.map((item) =>
                            item.id === f.id ? { ...item, value: val } : item
                          ),
                        }));
                      }}
                      className="w-full h-full bg-transparent text-[10px] text-slate-800 outline-none font-medium placeholder-slate-400"
                    />
                  )}
                </div>
              );
            })}

            {/* OVERLAY LAYER 6: Sticky Note Pins */}
            {curPageStickies.map((st) => {
              const isSelected = selectedItem?.category === 'sticky' && selectedItem.id === st.id;
              const colorBg =
                st.color === 'yellow'
                  ? 'bg-amber-300 border-amber-500 text-amber-950'
                  : st.color === 'blue'
                  ? 'bg-sky-300 border-sky-500 text-sky-950'
                  : st.color === 'green'
                  ? 'bg-emerald-300 border-emerald-500 text-emerald-950'
                  : st.color === 'pink'
                  ? 'bg-pink-300 border-pink-500 text-pink-950'
                  : 'bg-purple-300 border-purple-500 text-purple-950';

              return (
                <div
                  key={st.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerHaptic('light');
                    setSelectedItem({ category: 'sticky', id: st.id });
                    setShowNotesDrawer(true);
                  }}
                  className={`absolute w-7 h-7 rounded-full shadow-lg border flex items-center justify-center cursor-pointer transition-all hover:scale-110 ${colorBg} ${
                    isSelected ? 'ring-3 ring-[#4F46E5] scale-125 z-50' : 'z-30'
                  }`}
                  style={{
                    left: `${st.xPercent}%`,
                    top: `${st.yPercent}%`,
                  }}
                  title={st.content}
                >
                  <MessageSquare className="w-3.5 h-3.5 fill-current" />
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT SIDEBAR: Properties Inspector / Sticky Notes List */}
        <div className="w-full md:w-72 bg-[#111827] border-t md:border-t-0 md:border-l border-[#24272D] flex flex-col shrink-0 p-3.5 space-y-3 overflow-y-auto max-h-[40vh] md:max-h-full">
          {/* Inspector Header */}
          <div className="flex items-center justify-between border-b border-[#24272D] pb-2">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-[#818CF8]" />
              <span>Inspector & Properties</span>
            </span>

            {selectedItem && (
              <button
                id="btn-delete-element"
                type="button"
                onClick={handleDeleteSelected}
                className="p-1 rounded-lg text-rose-400 hover:bg-rose-950/30 transition-all flex items-center gap-1 text-[10px] font-bold"
              >
                <Trash2 className="w-3 h-3" />
                <span>Delete</span>
              </button>
            )}
          </div>

          {/* Active Item Properties */}
          {selectedItem && currentSelectedObj ? (
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#818CF8]">
                  {selectedItem.category} Element
                </span>
                <span className="text-[10px] text-[#9CA3AF] font-mono">
                  Page {currentPageIndex + 1}
                </span>
              </div>

              {/* Text Block Properties */}
              {selectedItem.category === 'text' && (
                <div className="space-y-2">
                  <label className="text-[10px] text-[#9CA3AF] font-medium">Text Content</label>
                  <textarea
                    rows={3}
                    value={(currentSelectedObj as TextBlockAnnotation).text}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAnnotations((prev) => ({
                        ...prev,
                        textBlocks: prev.textBlocks.map((item) =>
                          item.id === selectedItem.id ? { ...item, text: val } : item
                        ),
                      }));
                    }}
                    className="w-full bg-[#1F2937] border border-[#374151] rounded-xl p-2 text-xs text-white outline-none"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-[#9CA3AF]">Font Size</label>
                      <input
                        type="number"
                        min={8}
                        max={48}
                        value={(currentSelectedObj as TextBlockAnnotation).fontSize}
                        onChange={(e) => {
                          const size = parseInt(e.target.value) || 12;
                          setAnnotations((prev) => ({
                            ...prev,
                            textBlocks: prev.textBlocks.map((item) =>
                              item.id === selectedItem.id ? { ...item, fontSize: size } : item
                            ),
                          }));
                        }}
                        className="w-full bg-[#1F2937] border border-[#374151] rounded-lg p-1.5 text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-[#9CA3AF]">Text Color</label>
                      <input
                        type="color"
                        value={(currentSelectedObj as TextBlockAnnotation).color}
                        onChange={(e) => {
                          const val = e.target.value;
                          setAnnotations((prev) => ({
                            ...prev,
                            textBlocks: prev.textBlocks.map((item) =>
                              item.id === selectedItem.id ? { ...item, color: val } : item
                            ),
                          }));
                        }}
                        className="w-full h-8 bg-[#1F2937] border border-[#374151] rounded-lg cursor-pointer p-0.5"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const isB = !(currentSelectedObj as TextBlockAnnotation).isBold;
                        setAnnotations((prev) => ({
                          ...prev,
                          textBlocks: prev.textBlocks.map((item) =>
                            item.id === selectedItem.id ? { ...item, isBold: isB } : item
                          ),
                        }));
                      }}
                      className={`flex-1 py-1 rounded text-center font-bold text-xs ${
                        (currentSelectedObj as TextBlockAnnotation).isBold
                          ? 'bg-[#4F46E5] text-white'
                          : 'bg-[#1F2937] text-[#9CA3AF]'
                      }`}
                    >
                      Bold
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const isT = !(currentSelectedObj as TextBlockAnnotation).isTransparentBg;
                        setAnnotations((prev) => ({
                          ...prev,
                          textBlocks: prev.textBlocks.map((item) =>
                            item.id === selectedItem.id ? { ...item, isTransparentBg: isT } : item
                          ),
                        }));
                      }}
                      className={`flex-1 py-1 rounded text-center text-xs ${
                        (currentSelectedObj as TextBlockAnnotation).isTransparentBg
                          ? 'bg-[#4F46E5] text-white'
                          : 'bg-[#1F2937] text-[#9CA3AF]'
                      }`}
                    >
                      Transparent BG
                    </button>
                  </div>
                </div>
              )}

              {/* Sticky Note Properties */}
              {selectedItem.category === 'sticky' && (
                <div className="space-y-2">
                  <label className="text-[10px] text-[#9CA3AF] font-medium">Comment</label>
                  <textarea
                    rows={4}
                    value={(currentSelectedObj as StickyNoteAnnotation).content}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAnnotations((prev) => ({
                        ...prev,
                        stickyNotes: prev.stickyNotes.map((item) =>
                          item.id === selectedItem.id ? { ...item, content: val } : item
                        ),
                      }));
                    }}
                    className="w-full bg-[#1F2937] border border-[#374151] rounded-xl p-2 text-xs text-white outline-none"
                  />

                  <div className="flex items-center gap-1.5">
                    {(['yellow', 'blue', 'green', 'pink', 'purple'] as StickyColor[]).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          setAnnotations((prev) => ({
                            ...prev,
                            stickyNotes: prev.stickyNotes.map((item) =>
                              item.id === selectedItem.id ? { ...item, color: c } : item
                            ),
                          }));
                        }}
                        className={`w-6 h-6 rounded-full border ${
                          (currentSelectedObj as StickyNoteAnnotation).color === c
                            ? 'ring-2 ring-white scale-110'
                            : ''
                        } ${
                          c === 'yellow'
                            ? 'bg-amber-300'
                            : c === 'blue'
                            ? 'bg-sky-400'
                            : c === 'green'
                            ? 'bg-emerald-400'
                            : c === 'pink'
                            ? 'bg-pink-400'
                            : 'bg-purple-400'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Form Field Properties */}
              {selectedItem.category === 'form' && (
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] text-[#9CA3AF]">Field Label</label>
                    <input
                      type="text"
                      value={(currentSelectedObj as FormFieldAnnotation).label}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAnnotations((prev) => ({
                          ...prev,
                          formFields: prev.formFields.map((item) =>
                            item.id === selectedItem.id ? { ...item, label: val } : item
                          ),
                        }));
                      }}
                      className="w-full bg-[#1F2937] border border-[#374151] rounded-lg p-1.5 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-[#9CA3AF]">Field Type</label>
                    <select
                      value={(currentSelectedObj as FormFieldAnnotation).type}
                      onChange={(e) => {
                        const val = e.target.value as FormFieldType;
                        setAnnotations((prev) => ({
                          ...prev,
                          formFields: prev.formFields.map((item) =>
                            item.id === selectedItem.id ? { ...item, type: val } : item
                          ),
                        }));
                      }}
                      className="w-full bg-[#1F2937] border border-[#374151] rounded-lg p-1.5 text-xs text-white"
                    >
                      <option value="text">Text Input</option>
                      <option value="checkbox">Checkbox</option>
                      <option value="date">Date Picker</option>
                      <option value="signature">Digital Signature</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3 text-xs text-[#9CA3AF]">
              <div className="bg-[#1F2937]/60 rounded-xl p-3 border border-[#374151] space-y-1.5">
                <p className="text-white font-semibold text-xs">Page Manipulation</p>
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={handleInsertBlankPage}
                    className="flex items-center justify-center gap-1 p-2 rounded-lg bg-[#1F2937] hover:bg-[#374151] text-white text-[10px] font-semibold border border-[#374151]"
                  >
                    <FilePlus className="w-3 h-3 text-[#818CF8]" />
                    <span>Insert Blank</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDuplicatePage}
                    className="flex items-center justify-center gap-1 p-2 rounded-lg bg-[#1F2937] hover:bg-[#374151] text-white text-[10px] font-semibold border border-[#374151]"
                  >
                    <Copy className="w-3 h-3 text-emerald-400" />
                    <span>Duplicate</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRotateCurrentPage}
                    className="flex items-center justify-center gap-1 p-2 rounded-lg bg-[#1F2937] hover:bg-[#374151] text-white text-[10px] font-semibold border border-[#374151]"
                  >
                    <RotateCw className="w-3 h-3 text-cyan-400" />
                    <span>Rotate 90°</span>
                  </button>

                  <button
                    type="button"
                    disabled={numPages <= 1}
                    onClick={handleDeletePage}
                    className="flex items-center justify-center gap-1 p-2 rounded-lg bg-[#1F2937] hover:bg-[#374151] text-rose-400 text-[10px] font-semibold border border-[#374151] disabled:opacity-30"
                  >
                    <Trash2 className="w-3 h-3 text-rose-400" />
                    <span>Delete Page</span>
                  </button>
                </div>
              </div>

              <div className="bg-[#1F2937]/60 rounded-xl p-3 border border-[#374151] space-y-1">
                <p className="text-white font-semibold text-xs">Sticky Notes on Page</p>
                <p className="text-[10px] text-[#9CA3AF]">
                  {curPageStickies.length} note{curPageStickies.length === 1 ? '' : 's'} on page {currentPageIndex + 1}. Tap on any note pin on the canvas to edit.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM PAGINATION & ZOOM BAR */}
      <div className="bg-[#111827] border-t border-[#24272D] px-4 py-2 flex items-center justify-between shrink-0 text-xs">
        {/* Zoom */}
        <div className="flex items-center gap-1 bg-[#1F2937] rounded-full px-2 py-1 border border-[#374151]">
          <button
            type="button"
            onClick={() => setZoomScale((prev) => Math.max(0.6, prev - 0.15))}
            className="p-0.5 text-[#9CA3AF] hover:text-white"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono px-1 text-[#818CF8]">
            {Math.round(zoomScale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoomScale((prev) => Math.min(2.0, prev + 0.15))}
            className="p-0.5 text-[#9CA3AF] hover:text-white"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Page Selector */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={currentPageIndex <= 0}
            onClick={() => changePage(currentPageIndex - 1)}
            className="p-1 rounded-lg bg-[#1F2937] hover:bg-[#374151] text-white disabled:opacity-30 border border-[#374151]"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="text-xs font-bold text-white">
            Page {currentPageIndex + 1} of {numPages}
          </span>

          <button
            type="button"
            disabled={currentPageIndex >= numPages - 1}
            onClick={() => changePage(currentPageIndex + 1)}
            className="p-1 rounded-lg bg-[#1F2937] hover:bg-[#374151] text-white disabled:opacity-30 border border-[#374151]"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Merge / Split Shortcuts */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onNavigateTab('combine')}
            className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#1F2937] hover:bg-[#374151] text-[#9CA3AF] hover:text-white text-[10px] border border-[#374151]"
          >
            <Layers className="w-3 h-3" />
            <span>Merge Docs</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('split')}
            className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#1F2937] hover:bg-[#374151] text-[#9CA3AF] hover:text-white text-[10px] border border-[#374151]"
          >
            <Scissors className="w-3 h-3" />
            <span>Split Range</span>
          </button>
        </div>
      </div>

      {/* Signature Pad Modal */}
      <SignaturePadModal
        isOpen={isSigModalOpen}
        onClose={() => setIsSigModalOpen(false)}
        onSaveSignature={(dataUrl) => {
          if (activeSigFieldId) {
            setAnnotations((prev) => ({
              ...prev,
              formFields: prev.formFields.map((item) =>
                item.id === activeSigFieldId ? { ...item, value: dataUrl } : item
              ),
            }));
          }
          setIsSigModalOpen(false);
        }}
      />

      {/* Gemini OCR Page Recognition Modal */}
      <GeminiOcrModal
        isOpen={isOcrModalOpen}
        onClose={() => setIsOcrModalOpen(false)}
        imagePreviewUrl={pageImage}
        ocrResult={ocrResult}
        isLoading={ocrLoading}
        errorMessage={ocrError}
        onRetry={handleOcrActivePage}
        onApplyToDocument={handleApplyOcrSections}
        onAppendSection={(sec) => {
          // Append as a single text block
          const newBlock: TextBlockAnnotation = {
            id: Math.random().toString(36).substr(2, 7),
            pageIndex: currentPageIndex,
            text: sec.content,
            xPercent: 15,
            yPercent: 30,
            widthPercent: 70,
            fontSize: 12,
            isBold: false,
            isItalic: false,
            color: '#0F172A',
            backgroundColor: '#FFFFFF',
            isTransparentBg: false,
            align: 'left',
          };
          setAnnotations((prev) => ({
            ...prev,
            textBlocks: [...prev.textBlocks, newBlock],
          }));
        }}
      />
    </div>
  );
};
