import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, Check, X, Image as ImageIcon, Sliders, Sparkles } from 'lucide-react';
import { triggerHaptic } from '../utils/haptics';

interface CameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageDataUrl: string) => void;
  onExtractText?: (imageDataUrl: string) => void;
}

export const CameraScannerModal: React.FC<CameraScannerModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  onExtractText,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'bw' | 'grayscale' | 'contrast' | 'original'>('contrast');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isOpen && !capturedImage) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode, capturedImage]);

  const startCamera = async () => {
    setErrorMsg(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.warn('Camera access error:', err);
      setErrorMsg('Camera access was restricted or not found. You can also pick a photo from gallery.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const switchCamera = () => {
    triggerHaptic('light');
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const takeSnapshot = () => {
    if (!videoRef.current) return;
    triggerHaptic('heavy');
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const rawData = canvas.toDataURL('image/jpeg', 0.95);
      setCapturedImage(rawData);
      stopCamera();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      triggerHaptic('medium');
      const reader = new FileReader();
      reader.onload = () => {
        setCapturedImage(reader.result as string);
        stopCamera();
      };
      reader.readAsDataURL(file);
    }
  };

  const applyFilterToImage = async (dataUrl: string, mode: 'bw' | 'grayscale' | 'contrast' | 'original'): Promise<string> => {
    if (mode === 'original') return dataUrl;

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imgData.data;

        for (let i = 0; i < d.length; i += 4) {
          const r = d[i];
          const g = d[i + 1];
          const b = d[i + 2];
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;

          if (mode === 'grayscale') {
            d[i] = gray;
            d[i + 1] = gray;
            d[i + 2] = gray;
          } else if (mode === 'bw') {
            const val = gray > 135 ? 255 : 0;
            d[i] = val;
            d[i + 1] = val;
            d[i + 2] = val;
          } else if (mode === 'contrast') {
            // Document text enhancement
            const contrast = 1.35;
            const factor = (259 * (contrast * 100 + 255)) / (255 * (259 - contrast * 100));
            d[i] = factor * (r - 128) + 128;
            d[i + 1] = factor * (g - 128) + 128;
            d[i + 2] = factor * (b - 128) + 128;
          }
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      };
      img.src = dataUrl;
    });
  };

  const confirmCapture = async () => {
    if (!capturedImage) return;
    try {
      setIsProcessing(true);
      triggerHaptic('success');
      const filtered = await applyFilterToImage(capturedImage, filterMode);
      onCapture(filtered);
    } catch (err) {
      console.error(err);
      onCapture(capturedImage);
    } finally {
      setIsProcessing(false);
    }
  };

  const retake = () => {
    triggerHaptic('light');
    setCapturedImage(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-[#1F2937] border border-[#374151] rounded-[28px] sm:rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl flex flex-col text-white">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#374151] flex items-center justify-between bg-[#111827]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#4F46E5]/20 text-[#818CF8] flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-white text-base">Paper Scanner</h3>
          </div>
          <button
            id="btn-close-camera"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#1F2937] hover:bg-[#374151] text-[#9CA3AF] hover:text-white flex items-center justify-center border border-[#374151]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewfinder / Preview */}
        <div className="relative aspect-[4/3] bg-[#0F1115] overflow-hidden flex items-center justify-center">
          {!capturedImage ? (
            <>
              {errorMsg ? (
                <div className="p-6 text-center text-[#9CA3AF] space-y-3">
                  <p className="text-xs">{errorMsg}</p>
                  <label className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#4F46E5] text-white text-xs font-semibold cursor-pointer shadow-md">
                    <ImageIcon className="w-4 h-4" />
                    <span>Pick Image from Files</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              ) : (
                <div className="relative w-full h-full flex items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover max-h-[380px]"
                  />
                  {/* Document Grid Alignment Guide Overlay */}
                  <div className="absolute inset-8 border-2 border-dashed border-[#818CF8]/60 rounded-2xl pointer-events-none flex items-center justify-center">
                    <span className="text-[10px] bg-black/70 text-[#818CF8] px-3 py-1 rounded-full backdrop-blur-sm">
                      Align document edges here
                    </span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="relative w-full h-full flex items-center justify-center p-3">
              <img
                src={capturedImage}
                alt="Captured document"
                className="max-h-[340px] w-auto object-contain rounded-2xl shadow-lg border border-[#374151]"
              />
            </div>
          )}
        </div>

        {/* Filter controls when image is captured */}
        {capturedImage && (
          <div className="p-3 bg-[#111827] border-t border-[#374151] flex items-center justify-between gap-1 overflow-x-auto">
            <span className="text-[11px] text-[#9CA3AF] font-medium ml-1 flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-[#818CF8]" /> Filter:
            </span>
            {(['contrast', 'bw', 'grayscale', 'original'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setFilterMode(m);
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-all ${
                  filterMode === m
                    ? 'bg-[#4F46E5] text-white shadow-sm'
                    : 'bg-[#1F2937] text-[#9CA3AF] hover:text-white border border-[#374151]'
                }`}
              >
                {m === 'contrast' ? 'Enhanced' : m === 'bw' ? 'Document B&W' : m}
              </button>
            ))}
          </div>
        )}

        {/* Bottom Actions */}
        <div className="px-5 py-4 bg-[#111827] border-t border-[#374151] flex items-center justify-between">
          {!capturedImage ? (
            <>
              <label className="p-2.5 rounded-full bg-[#1F2937] text-[#9CA3AF] hover:text-white border border-[#374151] cursor-pointer active:scale-95 transition-all">
                <ImageIcon className="w-5 h-5" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <button
                id="btn-snap-photo"
                type="button"
                onClick={takeSnapshot}
                className="w-14 h-14 rounded-full bg-[#4F46E5] hover:bg-[#4338CA] ring-4 ring-[#4F46E5]/30 flex items-center justify-center text-white shadow-xl active:scale-90 transition-all"
                title="Take Document Photo"
              >
                <div className="w-6 h-6 rounded-full bg-white" />
              </button>

              <button
                type="button"
                onClick={switchCamera}
                className="p-2.5 rounded-full bg-[#1F2937] text-[#9CA3AF] hover:text-white border border-[#374151] active:scale-95 transition-all"
                title="Flip Camera"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </>
          ) : (
            <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={retake}
                  className="flex-1 sm:flex-initial px-3.5 py-2 rounded-full text-xs font-semibold text-[#9CA3AF] bg-[#1F2937] hover:text-white border border-[#374151] active:scale-95 transition-all"
                >
                  Retake
                </button>

                {onExtractText && (
                  <button
                    id="btn-ocr-camera-scanner"
                    type="button"
                    disabled={isProcessing}
                    onClick={() => {
                      if (!capturedImage) return;
                      triggerHaptic('medium');
                      onExtractText(capturedImage);
                    }}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold bg-[#4F46E5] hover:bg-[#4338CA] text-white shadow-md shadow-[#4F46E5]/25 active:scale-95 transition-all"
                    title="Extract text using Gemini AI OCR"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Extract Text (AI)</span>
                  </button>
                )}
              </div>

              <button
                id="btn-confirm-scanner"
                type="button"
                disabled={isProcessing}
                onClick={confirmCapture}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-[#10B981] hover:bg-emerald-500 text-white shadow-lg shadow-[#10B981]/20 active:scale-95 transition-all"
              >
                <Check className="w-4 h-4" />
                {isProcessing ? 'Processing...' : 'Use Document Page'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
