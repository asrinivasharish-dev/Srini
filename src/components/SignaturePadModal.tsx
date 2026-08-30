import React, { useRef, useState, useEffect } from 'react';
import { X, Check, RotateCcw, PenTool } from 'lucide-react';
import { triggerHaptic } from '../utils/haptics';

interface SignaturePadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (signatureDataUrl: string) => void;
}

export const SignaturePadModal: React.FC<SignaturePadModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [penColor, setPenColor] = useState('#1e293b');
  const [penWidth, setPenWidth] = useState(3);

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        setHasDrawn(false);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setHasDrawn(true);
    triggerHaptic('light');

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.lineWidth = penWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = penColor;
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    triggerHaptic('medium');
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const saveSignature = () => {
    if (!canvasRef.current) return;
    triggerHaptic('success');
    const dataUrl = canvasRef.current.toDataURL('image/png');
    onSave(dataUrl);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#1F2937] border border-[#374151] rounded-[28px] w-full max-w-md overflow-hidden shadow-2xl flex flex-col text-white">
        <div className="px-5 py-4 border-b border-[#374151] flex items-center justify-between bg-[#111827]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#4F46E5]/20 text-[#818CF8] flex items-center justify-center">
              <PenTool className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-white text-base">Draw Signature</h3>
          </div>
          <button
            id="btn-close-sig"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#1F2937] hover:bg-[#374151] text-[#9CA3AF] hover:text-white flex items-center justify-center border border-[#374151]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col items-center">
          <p className="text-xs text-[#9CA3AF] mb-3 self-start">
            Sign with your finger or stylus inside the box:
          </p>

          <div className="w-full bg-white rounded-2xl overflow-hidden shadow-inner border-2 border-dashed border-[#4B5563] touch-none">
            <canvas
              ref={canvasRef}
              width={380}
              height={180}
              className="w-full h-44 cursor-crosshair block"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>

          {/* Pen options */}
          <div className="w-full flex items-center justify-between mt-4 px-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#9CA3AF]">Color:</span>
              <button
                type="button"
                onClick={() => setPenColor('#1e293b')}
                className={`w-6 h-6 rounded-full bg-slate-900 border-2 ${penColor === '#1e293b' ? 'border-[#4F46E5] scale-110' : 'border-[#4B5563]'}`}
              />
              <button
                type="button"
                onClick={() => setPenColor('#1d4ed8')}
                className={`w-6 h-6 rounded-full bg-blue-700 border-2 ${penColor === '#1d4ed8' ? 'border-[#818CF8] scale-110' : 'border-[#4B5563]'}`}
              />
              <button
                type="button"
                onClick={() => setPenColor('#047857')}
                className={`w-6 h-6 rounded-full bg-emerald-700 border-2 ${penColor === '#047857' ? 'border-emerald-300 scale-110' : 'border-[#4B5563]'}`}
              />
            </div>

            <button
              id="btn-clear-sig"
              type="button"
              onClick={clearCanvas}
              className="flex items-center gap-1 text-xs text-[#EF4444] hover:text-rose-300 font-semibold px-3 py-1 rounded-full bg-rose-950/40 border border-rose-900/50 active:scale-95 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Clear
            </button>
          </div>
        </div>

        <div className="px-5 py-3.5 bg-[#111827] border-t border-[#374151] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full text-xs font-semibold text-[#9CA3AF] hover:text-white hover:bg-[#1F2937] transition-all"
          >
            Cancel
          </button>
          <button
            id="btn-save-sig"
            type="button"
            disabled={!hasDrawn}
            onClick={saveSignature}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-[#4F46E5] hover:bg-[#4338CA] disabled:opacity-40 disabled:pointer-events-none text-white shadow-lg shadow-[#4F46E5]/25 active:scale-95 transition-all"
          >
            <Check className="w-4 h-4" />
            Apply Signature
          </button>
        </div>
      </div>
    </div>
  );
};
