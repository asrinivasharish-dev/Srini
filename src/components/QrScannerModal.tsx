import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  QrCode,
  X,
  Camera,
  Upload,
  Sparkles,
  Check,
  Copy,
  ExternalLink,
  RefreshCw,
  Zap,
  Globe,
  Wifi,
  User,
  FileText,
  Code2,
  FilePlus,
  Download,
  Eye,
  Sliders,
  ChevronRight,
  ShieldCheck,
  Share2
} from 'lucide-react';
import jsQR from 'jsqr';
import { triggerHaptic } from '../utils/haptics';
import { ParsedQrData, parseQrContent, SAMPLE_QR_PRESETS } from '../utils/qrHelper';
import { DocumentSection, CreateDocOptions } from '../types';
import { createPdfDocument } from '../utils/pdfEngine';
import confetti from 'canvas-confetti';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportNewDocument: (sections: DocumentSection[], title: string, author?: string) => void;
  onAppendSection: (section: DocumentSection) => void;
  onDirectExportPdf?: (blob: Blob, filename: string, pageCount: number) => void;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  isOpen,
  onClose,
  onImportNewDocument,
  onAppendSection,
  onDirectExportPdf,
}) => {
  const [activeTab, setActiveTab] = useState<'camera' | 'upload' | 'samples'>('camera');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Scanned state
  const [scannedResult, setScannedResult] = useState<ParsedQrData | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isExportingDirectPdf, setIsExportingDirectPdf] = useState(false);

  // Camera video / canvas refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Stop camera stream safely
  const stopCamera = useCallback(() => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  }, []);

  // Handle scanned raw text
  const handleQrDetected = useCallback(
    async (rawText: string) => {
      if (!rawText || !rawText.trim()) return;

      stopCamera();
      triggerHaptic('success');
      setIsParsing(true);

      try {
        const parsed = await parseQrContent(rawText);
        setScannedResult(parsed);
      } catch (err) {
        console.error('Failed to parse QR content:', err);
      } finally {
        setIsParsing(false);
      }
    },
    [stopCamera]
  );

  // Scan video loop with requestAnimationFrame
  const scanLoop = useCallback(() => {
    if (!videoRef.current || videoRef.current.readyState < 2) {
      animFrameIdRef.current = requestAnimationFrame(scanLoop);
      return;
    }

    const video = videoRef.current;
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'attemptBoth',
      });

      if (code && code.data && code.data.trim()) {
        handleQrDetected(code.data);
        return;
      }
    }

    animFrameIdRef.current = requestAnimationFrame(scanLoop);
  }, [handleQrDetected]);

  // Start Camera
  const startCamera = useCallback(async () => {
    setCameraError(null);
    stopCamera();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
      }

      setIsScanning(true);
      animFrameIdRef.current = requestAnimationFrame(scanLoop);
    } catch (err: any) {
      console.warn('QR camera access error:', err);
      setCameraError('Camera access unavailable or restricted in this browser session. You can upload an image with a QR code or pick a test sample below.');
      setIsScanning(false);
    }
  }, [facingMode, scanLoop, stopCamera]);

  useEffect(() => {
    if (isOpen && !scannedResult && activeTab === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, scannedResult, activeTab, startCamera, stopCamera]);

  // Toggle Torch if supported
  const toggleTorch = async () => {
    triggerHaptic('light');
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        const capabilities = (track.getCapabilities?.() as any) || {};
        if (capabilities.torch) {
          const nextState = !torchOn;
          await (track as any).applyConstraints({
            advanced: [{ torch: nextState }],
          });
          setTorchOn(nextState);
        } else {
          setTorchOn((prev) => !prev);
        }
      } catch (err) {
        console.log('Torch not supported:', err);
      }
    }
  };

  // Flip camera
  const switchCamera = () => {
    triggerHaptic('light');
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Process image file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    triggerHaptic('medium');
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imgData.data, imgData.width, imgData.height, {
          inversionAttempts: 'attemptBoth',
        });

        if (code && code.data) {
          handleQrDetected(code.data);
        } else {
          alert('No recognizable QR code detected in this photo. Please try a clearer or higher-contrast image.');
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Copy raw content
  const handleCopyRaw = () => {
    if (!scannedResult) return;
    triggerHaptic('light');
    navigator.clipboard.writeText(scannedResult.raw);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Apply as new document
  const handleApplyNewDoc = () => {
    if (!scannedResult) return;
    triggerHaptic('success');
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
    onImportNewDocument(scannedResult.suggestedSections, scannedResult.title, 'QR Importer');
    onClose();
  };

  // Append to current document
  const handleAppendDoc = () => {
    if (!scannedResult) return;
    triggerHaptic('medium');
    scannedResult.suggestedSections.forEach((sec) => {
      onAppendSection(sec);
    });
    onClose();
  };

  // Direct 1-tap PDF compile
  const handleDirectPdfCompile = async () => {
    if (!scannedResult) return;
    try {
      setIsExportingDirectPdf(true);
      triggerHaptic('medium');

      const options: CreateDocOptions = {
        title: scannedResult.title,
        author: 'QR Code Import Studio',
        pageSize: 'A4',
        margin: 36,
        headerText: `QR IMPORT • ${scannedResult.type.toUpperCase()}`,
        footerText: `Generated from QR • ${new Date().toLocaleDateString()}`,
        includePageNumbers: true,
        sections: scannedResult.suggestedSections,
        themeColor: '#4F46E5',
      };

      const pdfBytes = await createPdfDocument(options);
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const filename = `${scannedResult.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;

      triggerHaptic('success');
      confetti({ particleCount: 70, spread: 70, origin: { y: 0.7 } });

      if (onDirectExportPdf) {
        onDirectExportPdf(blob, filename, 1);
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      onClose();
    } catch (err) {
      console.error('Failed direct PDF generation:', err);
      alert('Could not compile PDF.');
    } finally {
      setIsExportingDirectPdf(false);
    }
  };

  const handleResetScan = () => {
    triggerHaptic('light');
    setScannedResult(null);
    setActiveTab('camera');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#13161F] border border-[#232A38] rounded-[28px] max-w-xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl text-white">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#232A38] bg-[#171B26]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white leading-tight">
                {scannedResult ? 'QR Import Synthesis' : 'QR Code Scanner & Importer'}
              </h3>
              <p className="text-[11px] text-[#8F9CAE]">
                {scannedResult ? 'Synthesized document structure ready for PDF' : 'Import URLs, formatted text, and data directly into PDF'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 rounded-full bg-[#1F2533] hover:bg-[#2B3447] text-[#8F9CAE] hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation (Only in scan mode) */}
        {!scannedResult && (
          <div className="px-5 pt-3 bg-[#13161F]">
            <div className="grid grid-cols-3 gap-1 bg-[#0D0F14] p-1 rounded-2xl border border-[#232A38]">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setActiveTab('camera');
                }}
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'camera'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-[#8F9CAE] hover:text-white'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Live Camera</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  stopCamera();
                  setActiveTab('upload');
                }}
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'upload'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-[#8F9CAE] hover:text-white'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload QR Image</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  stopCamera();
                  setActiveTab('samples');
                }}
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'samples'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-[#8F9CAE] hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Demo QRs</span>
              </button>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* ========================================================================= */}
          {/* STATE 1: RESULT FOUND & PARSED                                            */}
          {/* ========================================================================= */}
          {scannedResult ? (
            <div className="space-y-4 animate-fadeIn">
              {/* Top Result Banner */}
              <div className="p-4 rounded-2xl bg-[#171B26] border border-[#232A38] flex items-start gap-3.5 shadow-sm">
                {/* QR Visual Badge */}
                {scannedResult.qrImageDataUrl && (
                  <div className="w-16 h-16 rounded-xl bg-white p-1 border border-indigo-500/40 shrink-0 shadow-md">
                    <img
                      src={scannedResult.qrImageDataUrl}
                      alt="Scanned QR"
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                      {scannedResult.type === 'url' && <Globe className="w-3 h-3 text-sky-400" />}
                      {scannedResult.type === 'vcard' && <User className="w-3 h-3 text-emerald-400" />}
                      {scannedResult.type === 'wifi' && <Wifi className="w-3 h-3 text-amber-400" />}
                      {scannedResult.type === 'markdown' && <FileText className="w-3 h-3 text-indigo-400" />}
                      {scannedResult.type === 'json' && <Code2 className="w-3 h-3 text-purple-400" />}
                      <span>{scannedResult.type}</span>
                    </span>
                    <span className="text-[10px] text-[#8F9CAE] truncate">{scannedResult.subtitle}</span>
                  </div>

                  <h4 className="text-sm font-bold text-white truncate">{scannedResult.title}</h4>
                  <p className="text-xs text-[#8F9CAE] truncate mt-0.5">{scannedResult.raw}</p>
                </div>
              </div>

              {/* Raw Payload Accordion / Copy */}
              <div className="p-3.5 rounded-2xl bg-[#0D0F14] border border-[#1F2430] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#8F9CAE] uppercase tracking-wider">
                    Decoded Payload ({scannedResult.raw.length} chars)
                  </span>

                  <div className="flex items-center gap-2">
                    {scannedResult.type === 'url' && (
                      <a
                        href={scannedResult.raw}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Open Link</span>
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={handleCopyRaw}
                      className="px-2.5 py-1 rounded-lg bg-[#171B26] hover:bg-[#232A38] text-xs text-[#8F9CAE] hover:text-white flex items-center gap-1 transition-colors"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="bg-[#13161F] p-2.5 rounded-xl border border-[#232A38] max-h-24 overflow-y-auto text-[11px] font-mono text-indigo-200/90 whitespace-pre-wrap break-all">
                  {scannedResult.raw}
                </div>
              </div>

              {/* Generated Sections Preview */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Synthesized Document Blocks ({scannedResult.suggestedSections.length})</span>
                </span>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {scannedResult.suggestedSections.map((sec, i) => (
                    <div
                      key={sec.id || i}
                      className="p-2.5 rounded-xl bg-[#171B26] border border-[#232A38] text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase">
                          {sec.type}
                        </span>
                        <span className="text-[10px] text-[#8F9CAE]">#{i + 1}</span>
                      </div>
                      <p className="text-white text-[11px] line-clamp-2 leading-relaxed">{sec.content}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    id="btn-import-as-new-doc"
                    type="button"
                    onClick={handleApplyNewDoc}
                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 active:scale-95 transition-all"
                  >
                    <FilePlus className="w-4 h-4" />
                    <span>Import to Doc Builder</span>
                  </button>

                  <button
                    id="btn-direct-compile-pdf"
                    type="button"
                    disabled={isExportingDirectPdf}
                    onClick={handleDirectPdfCompile}
                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-[#1F2533] hover:bg-[#2B3447] text-white text-xs font-bold border border-[#2B3548] active:scale-95 transition-all"
                  >
                    <Download className="w-4 h-4 text-emerald-400" />
                    <span>{isExportingDirectPdf ? 'Building PDF...' : 'Instant 1-Tap PDF'}</span>
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleAppendDoc}
                    className="flex-1 py-2 rounded-xl bg-[#0D0F14] hover:bg-[#171B26] text-xs text-[#8F9CAE] hover:text-white border border-[#232A38] transition-colors"
                  >
                    + Append to Existing Doc
                  </button>

                  <button
                    type="button"
                    onClick={handleResetScan}
                    className="py-2 px-4 rounded-xl bg-[#0D0F14] hover:bg-[#171B26] text-xs text-indigo-400 hover:text-indigo-300 border border-[#232A38] flex items-center gap-1.5 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Scan Another</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* ========================================================================= */}
              {/* TAB 1: LIVE CAMERA VIEW & SCANNER                                         */}
              {/* ========================================================================= */}
              {activeTab === 'camera' && (
                <div className="space-y-3">
                  {cameraError ? (
                    <div className="p-6 rounded-2xl bg-[#171B26] border border-[#232A38] text-center space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
                        <Camera className="w-6 h-6" />
                      </div>
                      <p className="text-xs text-[#8F9CAE] max-w-sm mx-auto leading-relaxed">
                        {cameraError}
                      </p>
                      <div className="flex justify-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setActiveTab('upload')}
                          className="px-4 py-2 rounded-full bg-indigo-600 text-white text-xs font-semibold shadow-md active:scale-95 transition-all"
                        >
                          Upload QR Image
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab('samples')}
                          className="px-4 py-2 rounded-full bg-[#1F2533] text-indigo-300 text-xs font-medium border border-[#2B3548] active:scale-95 transition-all"
                        >
                          Try Demo Preset
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative aspect-[4/3] sm:aspect-[16/10] bg-black rounded-2xl overflow-hidden border border-[#232A38] flex items-center justify-center shadow-inner">
                      {/* Video Stream */}
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />

                      {/* Viewfinder Reticle & Laser Animation */}
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className="relative w-48 h-48 sm:w-56 sm:h-56 border-2 border-indigo-500/40 rounded-3xl overflow-hidden shadow-2xl bg-indigo-950/10 backdrop-blur-[1px]">
                          {/* Corner Markers */}
                          <div className="absolute top-0 left-0 w-5 h-5 border-t-4 border-l-4 border-indigo-400 rounded-tl-xl" />
                          <div className="absolute top-0 right-0 w-5 h-5 border-t-4 border-r-4 border-indigo-400 rounded-tr-xl" />
                          <div className="absolute bottom-0 left-0 w-5 h-5 border-b-4 border-l-4 border-indigo-400 rounded-bl-xl" />
                          <div className="absolute bottom-0 right-0 w-5 h-5 border-b-4 border-r-4 border-indigo-400 rounded-br-xl" />

                          {/* Animated Scanning Laser Line */}
                          <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent shadow-[0_0_12px_#818cf8] animate-bounce" />
                        </div>
                      </div>

                      {/* Scanning Status Badge */}
                      <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        <span className="text-[11px] font-semibold text-white">Live QR Detection</span>
                      </div>

                      {/* Camera Controls Overlay */}
                      <div className="absolute bottom-3 right-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={toggleTorch}
                          className={`p-2 rounded-full backdrop-blur-md border transition-all ${
                            torchOn
                              ? 'bg-amber-500 text-black border-amber-400 shadow-md shadow-amber-500/30'
                              : 'bg-black/60 text-white border-white/20 hover:bg-black/80'
                          }`}
                          title="Toggle Flash / Torch"
                        >
                          <Zap className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={switchCamera}
                          className="p-2 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 text-white transition-all active:scale-95"
                          title="Switch Camera (Front/Back)"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  <p className="text-center text-[11px] text-[#8F9CAE]">
                    Point your camera directly at any QR code on a screen, paper, or business card
                  </p>
                </div>
              )}

              {/* ========================================================================= */}
              {/* TAB 2: UPLOAD IMAGE WITH QR CODE                                          */}
              {/* ========================================================================= */}
              {activeTab === 'upload' && (
                <div className="space-y-4">
                  <label className="flex flex-col items-center justify-center p-8 sm:p-12 rounded-2xl border-2 border-dashed border-[#232A38] hover:border-indigo-500/50 bg-[#0D0F14] cursor-pointer transition-all space-y-3 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shadow-lg">
                      <Upload className="w-7 h-7" />
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-white">Choose or Drop QR Image</h4>
                      <p className="text-xs text-[#8F9CAE] max-w-xs mt-1">
                        Select a photo, flyer, screenshot, or receipt containing a QR code to decode instantly.
                      </p>
                    </div>

                    <span className="px-4 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md active:scale-95 transition-all">
                      Browse Photos / Files
                    </span>

                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              {/* ========================================================================= */}
              {/* TAB 3: DEMO PRESETS / SAMPLE QR CODES                                     */}
              {/* ========================================================================= */}
              {activeTab === 'samples' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-bold text-white">Test with Demo QR Payloads</span>
                    <span className="text-[10px] text-[#8F9CAE]">Instant 1-tap testing</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {SAMPLE_QR_PRESETS.map((preset) => (
                      <div
                        key={preset.id}
                        onClick={() => {
                          triggerHaptic('medium');
                          handleQrDetected(preset.payload);
                        }}
                        className="p-3.5 rounded-2xl bg-[#171B26] border border-[#232A38] hover:border-indigo-500/60 cursor-pointer active:scale-95 transition-all flex flex-col justify-between group shadow-sm"
                      >
                        <div className="flex items-start gap-2.5 mb-2">
                          <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/30 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                            {preset.icon === 'globe' && <Globe className="w-4 h-4" />}
                            {preset.icon === 'file-text' && <FileText className="w-4 h-4" />}
                            {preset.icon === 'user' && <User className="w-4 h-4" />}
                            {preset.icon === 'wifi' && <Wifi className="w-4 h-4" />}
                          </div>

                          <div className="min-w-0">
                            <h5 className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                              {preset.label}
                            </h5>
                            <p className="text-[11px] text-[#8F9CAE] line-clamp-2 mt-0.5">
                              {preset.desc}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-[#1F2430] text-[10px] text-indigo-400 font-semibold">
                          <span>Simulate Scan</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
