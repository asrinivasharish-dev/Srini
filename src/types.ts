export type ActiveTab = 'home' | 'create' | 'edit' | 'security' | 'organize' | 'combine' | 'split' | 'compress' | 'convert' | 'recent';

export interface LoadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  data: Uint8Array;
  pageCount?: number;
  pageThumbnails?: string[];
  lastModified?: number;
}

export interface PageItem {
  id: string;
  originalIndex: number;
  pageNumber: number;
  rotation: number; // 0, 90, 180, 270
  isDeleted: boolean;
  thumbnail?: string;
  sourceDocId?: string;
  sourceDocName?: string;
  isBlank?: boolean;
}

export type SplitMode = 'range' | 'all' | 'interval' | 'custom_select';

export interface SplitRange {
  id: string;
  name: string;
  fromPage: number;
  toPage: number;
}

export type CompressionLevel = 'extreme' | 'recommended' | 'low';

export interface CompressionResult {
  originalSize: number;
  compressedSize: number;
  percentageSaved: number;
  blob: Blob;
  downloadUrl: string;
  filename: string;
}

export type ConversionTarget = 'images_png' | 'images_jpg' | 'docx';

export interface ExtractedImagePage {
  pageNumber: number;
  dataUrl: string;
  blob: Blob;
  filename: string;
  width: number;
  height: number;
  size: number;
}

export interface ProcessedDocument {
  id: string;
  title: string;
  action: 'create' | 'edit' | 'security' | 'organize' | 'combine' | 'split' | 'compress' | 'convert' | 'rotate';
  timestamp: number;
  fileSize: number;
  pageCount: number;
  blob: Blob;
  downloadUrl: string;
  fileType?: string;
}

export interface DocumentSection {
  id: string;
  type: 'heading' | 'paragraph' | 'bullet' | 'callout' | 'table' | 'signature';
  content: string;
  style?: {
    fontSize?: number;
    isBold?: boolean;
    isItalic?: boolean;
    color?: string;
    align?: 'left' | 'center' | 'right';
  };
}

export interface CreateDocOptions {
  title: string;
  author: string;
  pageSize: 'A4' | 'Letter' | 'Legal';
  margin: number;
  sections: DocumentSection[];
  headerText?: string;
  footerText?: string;
  includePageNumbers: boolean;
  themeColor: string;
}

export interface GeminiOcrSection {
  type: 'heading' | 'paragraph' | 'bullet' | 'callout';
  content: string;
}

export interface GeminiOcrResult {
  title?: string;
  fullText: string;
  summary?: string;
  sections?: GeminiOcrSection[];
}

// ================= Annotation & PDF Editing Types ================= //

export type StickyColor = 'yellow' | 'blue' | 'green' | 'pink' | 'purple' | 'amber';

export interface StickyNoteAnnotation {
  id: string;
  pageIndex: number; // 0-indexed
  xPercent: number; // 0 to 100
  yPercent: number; // 0 to 100
  author: string;
  content: string;
  color: StickyColor;
  isResolved: boolean;
  timestamp: number;
}

export type ShapeType = 'rect' | 'circle' | 'line' | 'arrow' | 'highlight' | 'redact';

export interface ShapeAnnotation {
  id: string;
  pageIndex: number;
  type: ShapeType;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
  strokeColor: string;
  fillColor: string;
  opacity: number;
  strokeWidth: number;
}

export interface TextBlockAnnotation {
  id: string;
  pageIndex: number;
  text: string;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  fontSize: number;
  isBold: boolean;
  isItalic: boolean;
  color: string;
  backgroundColor: string;
  isTransparentBg: boolean;
  align: 'left' | 'center' | 'right';
}

export interface ImageOverlayAnnotation {
  id: string;
  pageIndex: number;
  dataUrl: string;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
  stampLabel?: string; // 'APPROVED' | 'CONFIDENTIAL' | 'PAID' | 'DRAFT' | 'VOID' | 'SIGNATURE'
  rotation?: number;
}

export type FormFieldType = 'text' | 'checkbox' | 'date' | 'signature' | 'dropdown';

export interface FormFieldAnnotation {
  id: string;
  pageIndex: number;
  type: FormFieldType;
  name: string;
  label: string;
  placeholder?: string;
  value: string | boolean;
  options?: string[];
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
  isRequired?: boolean;
}

export interface WhiteoutReplaceAnnotation {
  id: string;
  pageIndex: number;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
  originalText?: string;
  replacementText: string;
  fontSize: number;
  isBold: boolean;
  color: string;
}

export interface DocumentAnnotations {
  stickyNotes: StickyNoteAnnotation[];
  shapes: ShapeAnnotation[];
  textBlocks: TextBlockAnnotation[];
  imageOverlays: ImageOverlayAnnotation[];
  formFields: FormFieldAnnotation[];
  whiteouts: WhiteoutReplaceAnnotation[];
}

// ================= Security & Encryption Types ================= //

export type PdfSecurityAlgorithm = 'AES-256' | 'RC4';

export interface PdfSecurityPermissions {
  allowPrinting: boolean;
  allowHighQualityPrint: boolean;
  allowCopying: boolean;
  allowExtraction: boolean;
  allowModifying: boolean;
  allowAnnotating: boolean;
  allowFillingForms: boolean;
  allowAssembly: boolean;
}

export interface PdfSecurityOptions {
  userPassword?: string;
  ownerPassword?: string;
  algorithm: PdfSecurityAlgorithm;
  permissions: PdfSecurityPermissions;
}

export interface PdfSecurityStatus {
  isEncrypted: boolean;
  algorithm?: 'AES-256' | 'AES-128' | 'RC4-128' | 'Unknown';
  hasUserPassword?: boolean;
  hasOwnerPassword?: boolean;
  permissions?: PdfSecurityPermissions;
  unlockedWithPassword?: boolean;
}

// ================= Batch Conversion Types ================= //

export interface BatchConvertItem {
  id: string;
  name: string;
  type: 'image' | 'text' | 'pdf';
  mimeType: string;
  size: number;
  dataUrl?: string;
  textContent?: string;
  bytes?: Uint8Array;
  rotation: number; // 0, 90, 180, 270
  pageCount?: number; // if PDF
  width?: number; // original px
  height?: number; // original px
}

export interface BatchToPdfOptions {
  title?: string;
  pageSize: 'A4' | 'Letter' | 'Legal' | 'Auto' | 'Square';
  orientation: 'auto' | 'portrait' | 'landscape';
  margin: 'none' | 'narrow' | 'normal' | 'generous'; // none=0, narrow=18, normal=36, generous=54 pt
  imageFit: 'contain' | 'cover' | 'original';
  backgroundColor: string; // hex color e.g. #FFFFFF
  quality: 'high' | 'medium' | 'compact';
  addPageNumbers: boolean;
  headerText?: string;
  footerText?: string;
  includeCoverPage?: boolean;
  coverTitle?: string;
  coverSubtitle?: string;
  onProgress?: (current: number, total: number) => void;
}


