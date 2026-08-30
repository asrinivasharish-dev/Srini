import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Unlock,
  KeyRound,
  Eye,
  EyeOff,
  Printer,
  Copy,
  Edit3,
  MessageSquare,
  FileCheck2,
  FileSignature,
  Layers,
  Sparkles,
  Download,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Zap,
  Info,
  Sliders,
  Settings2
} from 'lucide-react';
import {
  PdfSecurityOptions,
  PdfSecurityPermissions,
  PdfSecurityStatus,
  PdfSecurityAlgorithm,
  ActiveTab
} from '../types';
import {
  encryptPdfDocument,
  decryptPdfDocument,
  checkPdfSecurityStatus,
  formatBytes,
  generateSamplePdfBytes
} from '../utils/pdfEngine';
import { triggerHaptic } from '../utils/haptics';
import confetti from 'canvas-confetti';

interface SecurityToolProps {
  initialFile?: { name: string; bytes: Uint8Array } | null;
  onSuccess: (blob: Blob, filename: string, pageCount: number, action: 'security') => void;
  onPreview: (blob: Blob, filename: string) => void;
  onNavigateTab?: (tab: ActiveTab) => void;
}

type SecurityMode = 'protect' | 'unlock' | 'inspect';

const DEFAULT_PERMISSIONS: PdfSecurityPermissions = {
  allowPrinting: true,
  allowHighQualityPrint: true,
  allowCopying: false,
  allowExtraction: false,
  allowModifying: false,
  allowAnnotating: true,
  allowFillingForms: true,
  allowAssembly: false,
};

export const SecurityTool: React.FC<SecurityToolProps> = ({
  initialFile,
  onSuccess,
  onPreview,
  onNavigateTab,
}) => {
  const [fileData, setFileData] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [activeMode, setActiveMode] = useState<SecurityMode>('protect');
  const [securityStatus, setSecurityStatus] = useState<PdfSecurityStatus | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

  // Protect Mode State
  const [userPassword, setUserPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showUserPassword, setShowUserPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);

  const [useOwnerPassword, setUseOwnerPassword] = useState<boolean>(false);
  const [ownerPassword, setOwnerPassword] = useState<string>('');
  const [showOwnerPassword, setShowOwnerPassword] = useState<boolean>(false);

  const [algorithm, setAlgorithm] = useState<PdfSecurityAlgorithm>('AES-256');
  const [permissions, setPermissions] = useState<PdfSecurityPermissions>(DEFAULT_PERMISSIONS);
  const [currentFilePassword, setCurrentFilePassword] = useState<string>('');
  const [showCurrentPassword, setShowCurrentPassword] = useState<boolean>(false);

  // Unlock Mode State
  const [unlockPassword, setUnlockPassword] = useState<string>('');
  const [showUnlockPassword, setShowUnlockPassword] = useState<boolean>(false);
  const [unlockVerificationState, setUnlockVerificationState] = useState<'idle' | 'testing' | 'valid' | 'invalid'>('idle');

  // Processing State
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processError, setProcessError] = useState<string | null>(null);
  const [resultState, setResultState] = useState<{
    blob: Blob;
    filename: string;
    actionType: 'protected' | 'unlocked';
    pageCount: number;
    size: number;
    downloadUrl: string;
  } | null>(null);

  // Initialize file from props
  useEffect(() => {
    if (initialFile) {
      loadDocument(initialFile.bytes, initialFile.name);
    }
  }, [initialFile]);

  const loadDocument = async (bytes: Uint8Array, name: string) => {
    triggerHaptic('medium');
    setFileData(bytes);
    setFileName(name);
    setResultState(null);
    setProcessError(null);
    setIsAnalyzing(true);
    setUnlockVerificationState('idle');

    try {
      const status = await checkPdfSecurityStatus(bytes);
      setSecurityStatus(status);
      if (status.isEncrypted) {
        setActiveMode('unlock');
      } else {
        setActiveMode('protect');
      }
    } catch {
      setSecurityStatus({ isEncrypted: false });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const bytes = new Uint8Array(reader.result as ArrayBuffer);
      loadDocument(bytes, file.name);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleLoadSample = async () => {
    triggerHaptic('medium');
    const bytes = await generateSamplePdfBytes();
    loadDocument(bytes, 'Confidential_Agreement_Sample.pdf');
  };

  // Password strength calculator
  const calculatePasswordStrength = (pwd: string): { score: number; label: string; color: string } => {
    if (!pwd) return { score: 0, label: 'Empty', color: 'bg-[#374151]' };
    let score = 0;
    if (pwd.length >= 6) score += 1;
    if (pwd.length >= 10) score += 1;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

    if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-rose-500 text-rose-300' };
    if (score <= 3) return { score: 2, label: 'Moderate', color: 'bg-amber-500 text-amber-300' };
    if (score === 4) return { score: 3, label: 'Strong', color: 'bg-emerald-500 text-emerald-300' };
    return { score: 4, label: 'Military-grade', color: 'bg-indigo-500 text-indigo-300' };
  };

  const passwordStrength = calculatePasswordStrength(userPassword);

  // Security Presets
  const applyPreset = (preset: 'confidential' | 'read_only' | 'form_fill' | 'unrestricted') => {
    triggerHaptic('light');
    if (preset === 'confidential') {
      setPermissions({
        allowPrinting: false,
        allowHighQualityPrint: false,
        allowCopying: false,
        allowExtraction: false,
        allowModifying: false,
        allowAnnotating: false,
        allowFillingForms: false,
        allowAssembly: false,
      });
    } else if (preset === 'read_only') {
      setPermissions({
        allowPrinting: true,
        allowHighQualityPrint: true,
        allowCopying: false,
        allowExtraction: false,
        allowModifying: false,
        allowAnnotating: false,
        allowFillingForms: false,
        allowAssembly: false,
      });
    } else if (preset === 'form_fill') {
      setPermissions({
        allowPrinting: true,
        allowHighQualityPrint: true,
        allowCopying: false,
        allowExtraction: false,
        allowModifying: false,
        allowAnnotating: true,
        allowFillingForms: true,
        allowAssembly: false,
      });
    } else if (preset === 'unrestricted') {
      setPermissions({
        allowPrinting: true,
        allowHighQualityPrint: true,
        allowCopying: true,
        allowExtraction: true,
        allowModifying: true,
        allowAnnotating: true,
        allowFillingForms: true,
        allowAssembly: true,
      });
    }
  };

  // Test Password validity before unlocking
  const handleTestUnlockPassword = async () => {
    if (!fileData || !unlockPassword) return;
    triggerHaptic('light');
    setUnlockVerificationState('testing');
    setProcessError(null);

    try {
      const status = await checkPdfSecurityStatus(fileData, unlockPassword);
      if (status.unlockedWithPassword) {
        setUnlockVerificationState('valid');
        triggerHaptic('success');
      } else {
        setUnlockVerificationState('invalid');
        triggerHaptic('warning');
      }
    } catch {
      setUnlockVerificationState('invalid');
      triggerHaptic('warning');
    }
  };

  // Execute Protect & Encrypt
  const handleExecuteProtect = async () => {
    if (!fileData) return;
    setProcessError(null);

    if (!userPassword.trim() && !ownerPassword.trim()) {
      setProcessError('Please provide a User Password or Owner Password to encrypt the document.');
      triggerHaptic('warning');
      return;
    }

    if (confirmPassword && userPassword !== confirmPassword) {
      setProcessError('User passwords do not match. Please check and try again.');
      triggerHaptic('warning');
      return;
    }

    setIsProcessing(true);
    triggerHaptic('medium');

    try {
      const options: PdfSecurityOptions = {
        userPassword: userPassword.trim(),
        ownerPassword: useOwnerPassword && ownerPassword.trim() ? ownerPassword.trim() : undefined,
        algorithm: algorithm,
        permissions: permissions,
      };

      const result = await encryptPdfDocument(
        fileData,
        options,
        securityStatus?.isEncrypted ? currentFilePassword : undefined
      );

      const blob = new Blob([result.pdfBytes], { type: 'application/pdf' });
      const downloadUrl = URL.createObjectURL(blob);
      const outName = fileName.replace(/\.pdf$/i, '') + '_Protected.pdf';

      setResultState({
        blob,
        filename: outName,
        actionType: 'protected',
        pageCount: result.pageCount,
        size: blob.size,
        downloadUrl,
      });

      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.75 },
      });

      triggerHaptic('success');
      onSuccess(blob, outName, result.pageCount, 'security');
    } catch (err: any) {
      console.error('Encryption failed:', err);
      setProcessError(err?.message || 'Failed to encrypt PDF document.');
      triggerHaptic('warning');
    } finally {
      setIsProcessing(false);
    }
  };

  // Execute Unlock & Decrypt
  const handleExecuteUnlock = async () => {
    if (!fileData) return;
    setProcessError(null);
    setIsProcessing(true);
    triggerHaptic('medium');

    try {
      const result = await decryptPdfDocument(fileData, unlockPassword);
      const blob = new Blob([result.pdfBytes], { type: 'application/pdf' });
      const downloadUrl = URL.createObjectURL(blob);
      const outName = fileName.replace(/\.pdf$/i, '').replace(/_Protected$/i, '') + '_Unlocked.pdf';

      setResultState({
        blob,
        filename: outName,
        actionType: 'unlocked',
        pageCount: result.pageCount,
        size: blob.size,
        downloadUrl,
      });

      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.75 },
      });

      triggerHaptic('success');
      onSuccess(blob, outName, result.pageCount, 'security');
    } catch (err: any) {
      console.error('Decryption failed:', err);
      setProcessError(err?.message || 'Incorrect password or unable to decrypt PDF.');
      triggerHaptic('warning');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto no-scrollbar pb-24 px-3 sm:px-4 pt-3 max-w-2xl mx-auto w-full">
      {/* Title & Banner */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
              <span>PDF Security & Encryption</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                AES-256
              </span>
            </h1>
            <p className="text-xs text-[#9CA3AF]">
              Set or remove passwords & customize printing, copying and editing permissions
            </p>
          </div>
        </div>
      </div>

      {/* File Upload / Status Card */}
      {!fileData ? (
        <div className="bg-[#1F2937] border-2 border-dashed border-[#374151] hover:border-emerald-500/60 rounded-2xl p-6 text-center transition-all duration-200 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-3">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-sm font-semibold text-white mb-1">Select a PDF to Secure or Unlock</h2>
          <p className="text-xs text-[#9CA3AF] mb-4 max-w-xs mx-auto">
            Protect sensitive documents with military-grade 256-bit encryption or remove restrictions.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
            <label className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer shadow-md shadow-emerald-600/30 active:scale-95 transition-all">
              <KeyRound className="w-4 h-4" />
              <span>Choose PDF File</span>
              <input
                id="security-file-input"
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>

            <button
              id="security-load-sample-btn"
              onClick={handleLoadSample}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#374151] hover:bg-[#4B5563] text-[#D1D5DB] text-xs font-medium active:scale-95 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Load Sample Contract</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-[#1F2937] border border-[#374151] rounded-2xl p-3.5 mb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  securityStatus?.isEncrypted
                    ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                    : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                }`}
              >
                {securityStatus?.isEncrypted ? <Lock className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">{fileName}</p>
                <div className="flex items-center gap-2 text-[11px] text-[#9CA3AF] mt-0.5">
                  <span>{formatBytes(fileData.length)}</span>
                  <span>•</span>
                  {isAnalyzing ? (
                    <span className="text-amber-400 flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Analyzing security...
                    </span>
                  ) : securityStatus?.isEncrypted ? (
                    <span className="text-rose-400 font-semibold flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Password Protected
                    </span>
                  ) : (
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <Unlock className="w-3 h-3" /> Unencrypted / Open
                    </span>
                  )}
                </div>
              </div>
            </div>

            <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#374151] hover:bg-[#4B5563] text-[#D1D5DB] text-xs cursor-pointer active:scale-95 transition-all shrink-0">
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Change File</span>
              <input
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          </div>
        </div>
      )}

      {/* Segmented Mode Selector */}
      {fileData && (
        <div className="flex items-center p-1 rounded-xl bg-[#1F2937] border border-[#374151] mb-3">
          <button
            id="tab-security-protect"
            onClick={() => {
              triggerHaptic('light');
              setActiveMode('protect');
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeMode === 'protect'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-[#9CA3AF] hover:text-white'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Set Password & Permissions</span>
          </button>

          <button
            id="tab-security-unlock"
            onClick={() => {
              triggerHaptic('light');
              setActiveMode('unlock');
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeMode === 'unlock'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-[#9CA3AF] hover:text-white'
            }`}
          >
            <Unlock className="w-3.5 h-3.5" />
            <span>Remove Password</span>
          </button>

          <button
            id="tab-security-inspect"
            onClick={() => {
              triggerHaptic('light');
              setActiveMode('inspect');
            }}
            className={`flex items-center justify-center gap-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all shrink-0 ${
              activeMode === 'inspect'
                ? 'bg-[#374151] text-white shadow-sm'
                : 'text-[#9CA3AF] hover:text-white'
            }`}
            title="Inspect permissions & encryption details"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
            <span className="hidden sm:inline">Audit</span>
          </button>
        </div>
      )}

      {/* Mode 1: Protect & Set Permissions */}
      {fileData && activeMode === 'protect' && (
        <div className="space-y-3">
          {/* Currently Protected Notice */}
          {securityStatus?.isEncrypted && (
            <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-3 text-xs text-amber-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-white">This PDF is already protected</p>
                  <p className="mt-0.5 text-amber-200/90 text-[11px]">
                    To re-encrypt with new permissions or passwords, enter the existing password below:
                  </p>
                  <div className="mt-2 relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      placeholder="Current document password..."
                      value={currentFilePassword}
                      onChange={(e) => setCurrentFilePassword(e.target.value)}
                      className="w-full bg-[#111827] border border-[#374151] rounded-lg px-3 py-1.5 text-xs text-white placeholder-[#6B7280] pr-8 focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-white"
                    >
                      {showCurrentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Password Setup Card */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-2xl p-4">
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5 mb-2.5">
              <KeyRound className="w-4 h-4 text-emerald-400" />
              <span>Document Open Password</span>
            </h3>

            <div className="space-y-2.5">
              <div>
                <label className="text-[11px] text-[#9CA3AF] block mb-1">
                  User Password (required to open & view PDF)
                </label>
                <div className="relative">
                  <input
                    id="input-user-password"
                    type={showUserPassword ? 'text' : 'password'}
                    placeholder="Enter secure password..."
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    className="w-full bg-[#111827] border border-[#374151] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#6B7280] pr-10 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowUserPassword(!showUserPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-white"
                  >
                    {showUserPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Password Strength Meter */}
              {userPassword && (
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-[#9CA3AF]">Strength:</span>
                    <span className={`font-semibold px-1.5 py-0.2 rounded text-[10px] ${passwordStrength.color}`}>
                      {passwordStrength.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 h-1.5 bg-[#111827] rounded-full overflow-hidden p-0.5 border border-[#374151]">
                    <div className={`h-full rounded-full transition-all duration-300 ${passwordStrength.score >= 1 ? passwordStrength.color : 'bg-transparent'}`} />
                    <div className={`h-full rounded-full transition-all duration-300 ${passwordStrength.score >= 2 ? passwordStrength.color : 'bg-transparent'}`} />
                    <div className={`h-full rounded-full transition-all duration-300 ${passwordStrength.score >= 3 ? passwordStrength.color : 'bg-transparent'}`} />
                    <div className={`h-full rounded-full transition-all duration-300 ${passwordStrength.score >= 4 ? passwordStrength.color : 'bg-transparent'}`} />
                  </div>
                </div>
              )}

              {/* Confirm Password */}
              <div>
                <label className="text-[11px] text-[#9CA3AF] block mb-1">Confirm Password</label>
                <div className="relative">
                  <input
                    id="input-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Re-type password..."
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`w-full bg-[#111827] border rounded-xl px-3.5 py-2 text-xs text-white placeholder-[#6B7280] pr-10 focus:outline-none transition-colors ${
                      confirmPassword && confirmPassword !== userPassword
                        ? 'border-rose-500'
                        : confirmPassword && confirmPassword === userPassword
                        ? 'border-emerald-500'
                        : 'border-[#374151] focus:border-emerald-500'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-white"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPassword && confirmPassword !== userPassword && (
                  <p className="text-[10px] text-rose-400 mt-1">Passwords do not match</p>
                )}
              </div>

              {/* Master / Owner Password Toggle */}
              <div className="pt-2 border-t border-[#374151]">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setUseOwnerPassword(!useOwnerPassword);
                  }}
                  className="flex items-center justify-between w-full text-left text-xs font-semibold text-[#D1D5DB] hover:text-white"
                >
                  <span className="flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Advanced: Master / Owner Password</span>
                  </span>
                  <span className="text-[11px] text-[#818CF8]">
                    {useOwnerPassword ? 'Enabled' : 'Default (Auto)'}
                  </span>
                </button>

                {useOwnerPassword && (
                  <div className="mt-2.5 bg-[#111827] border border-[#374151] rounded-xl p-2.5 space-y-2">
                    <p className="text-[11px] text-[#9CA3AF]">
                      The Owner Password grants administrative rights to bypass permission restrictions.
                    </p>
                    <div className="relative">
                      <input
                        type={showOwnerPassword ? 'text' : 'password'}
                        placeholder="Owner / Admin password..."
                        value={ownerPassword}
                        onChange={(e) => setOwnerPassword(e.target.value)}
                        className="w-full bg-[#1F2937] border border-[#374151] rounded-lg px-3 py-1.5 text-xs text-white placeholder-[#6B7280] pr-8 focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowOwnerPassword(!showOwnerPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-white"
                      >
                        {showOwnerPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-2xl p-3.5">
            <label className="text-xs font-bold text-white flex items-center gap-1.5 mb-2">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Quick Permission Presets</span>
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => applyPreset('confidential')}
                className="px-2.5 py-2 rounded-xl bg-[#111827] hover:bg-[#374151] border border-[#374151] text-left transition-all group"
              >
                <p className="text-[11px] font-bold text-white group-hover:text-amber-300">Confidential</p>
                <p className="text-[9.5px] text-[#9CA3AF] leading-tight mt-0.5">No Print, No Copy, No Edit</p>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('read_only')}
                className="px-2.5 py-2 rounded-xl bg-[#111827] hover:bg-[#374151] border border-[#374151] text-left transition-all group"
              >
                <p className="text-[11px] font-bold text-white group-hover:text-emerald-300">Read & Print</p>
                <p className="text-[9.5px] text-[#9CA3AF] leading-tight mt-0.5">Print allowed, copy blocked</p>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('form_fill')}
                className="px-2.5 py-2 rounded-xl bg-[#111827] hover:bg-[#374151] border border-[#374151] text-left transition-all group"
              >
                <p className="text-[11px] font-bold text-white group-hover:text-indigo-300">Fill & Sign</p>
                <p className="text-[9.5px] text-[#9CA3AF] leading-tight mt-0.5">Forms & comments enabled</p>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('unrestricted')}
                className="px-2.5 py-2 rounded-xl bg-[#111827] hover:bg-[#374151] border border-[#374151] text-left transition-all group"
              >
                <p className="text-[11px] font-bold text-white group-hover:text-teal-300">Full Rights</p>
                <p className="text-[9.5px] text-[#9CA3AF] leading-tight mt-0.5">All actions permitted</p>
              </button>
            </div>
          </div>

          {/* Granular Permission Settings Matrix */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Settings2 className="w-4 h-4 text-emerald-400" />
                <span>Adjust Granular Permissions</span>
              </h3>
              <span className="text-[10px] text-[#9CA3AF]">Advisory Standard ISO 32000</span>
            </div>

            <div className="divide-y divide-[#374151]/60 space-y-2">
              {/* Printing */}
              <div className="pt-2 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#111827] flex items-center justify-center text-[#D1D5DB]">
                    <Printer className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">Printing</p>
                    <p className="text-[10px] text-[#9CA3AF]">Allow sending document to printers</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={permissions.allowPrinting}
                  onChange={(e) => {
                    triggerHaptic('light');
                    setPermissions({
                      ...permissions,
                      allowPrinting: e.target.checked,
                      allowHighQualityPrint: e.target.checked ? permissions.allowHighQualityPrint : false,
                    });
                  }}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
              </div>

              {/* High Quality Printing (if printing is allowed) */}
              {permissions.allowPrinting && (
                <div className="pt-2 pl-9 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-medium text-white">High Quality Printing</p>
                    <p className="text-[9.5px] text-[#9CA3AF]">Uncompressed vector output</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={permissions.allowHighQualityPrint}
                    onChange={(e) => {
                      triggerHaptic('light');
                      setPermissions({ ...permissions, allowHighQualityPrint: e.target.checked });
                    }}
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                  />
                </div>
              )}

              {/* Copying & Extraction */}
              <div className="pt-2 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#111827] flex items-center justify-center text-[#D1D5DB]">
                    <Copy className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">Copying & Content Extraction</p>
                    <p className="text-[10px] text-[#9CA3AF]">Select & copy text, images and tables</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={permissions.allowCopying}
                  onChange={(e) => {
                    triggerHaptic('light');
                    setPermissions({
                      ...permissions,
                      allowCopying: e.target.checked,
                      allowExtraction: e.target.checked,
                    });
                  }}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
              </div>

              {/* Modifying Content */}
              <div className="pt-2 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#111827] flex items-center justify-center text-[#D1D5DB]">
                    <Edit3 className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">Document Modification</p>
                    <p className="text-[10px] text-[#9CA3AF]">Insert, rotate, or delete pages</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={permissions.allowModifying}
                  onChange={(e) => {
                    triggerHaptic('light');
                    setPermissions({ ...permissions, allowModifying: e.target.checked });
                  }}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
              </div>

              {/* Annotations & Comments */}
              <div className="pt-2 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#111827] flex items-center justify-center text-[#D1D5DB]">
                    <MessageSquare className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">Annotations & Comments</p>
                    <p className="text-[10px] text-[#9CA3AF]">Add sticky notes, highlights & markups</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={permissions.allowAnnotating}
                  onChange={(e) => {
                    triggerHaptic('light');
                    setPermissions({ ...permissions, allowAnnotating: e.target.checked });
                  }}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
              </div>

              {/* Form Filling & Signing */}
              <div className="pt-2 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#111827] flex items-center justify-center text-[#D1D5DB]">
                    <FileSignature className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">Form Filling & Digital Signatures</p>
                    <p className="text-[10px] text-[#9CA3AF]">Fill form inputs and apply signatures</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={permissions.allowFillingForms}
                  onChange={(e) => {
                    triggerHaptic('light');
                    setPermissions({ ...permissions, allowFillingForms: e.target.checked });
                  }}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
              </div>

              {/* Document Assembly */}
              <div className="pt-2 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#111827] flex items-center justify-center text-[#D1D5DB]">
                    <Layers className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">Document Assembly</p>
                    <p className="text-[10px] text-[#9CA3AF]">Combine or insert bookmarks and sheets</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={permissions.allowAssembly}
                  onChange={(e) => {
                    triggerHaptic('light');
                    setPermissions({ ...permissions, allowAssembly: e.target.checked });
                  }}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Encryption Algorithm Selection */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-2xl p-3.5">
            <label className="text-xs font-bold text-white block mb-2">Encryption Cipher</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setAlgorithm('AES-256');
                }}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  algorithm === 'AES-256'
                    ? 'bg-emerald-950/40 border-emerald-500 text-white'
                    : 'bg-[#111827] border-[#374151] text-[#9CA3AF]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">AES-256 (Recommended)</span>
                  {algorithm === 'AES-256' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
                <p className="text-[10px] text-[#9CA3AF] mt-0.5">ISO 32000-2 Modern Standard</p>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setAlgorithm('RC4');
                }}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  algorithm === 'RC4'
                    ? 'bg-emerald-950/40 border-emerald-500 text-white'
                    : 'bg-[#111827] border-[#374151] text-[#9CA3AF]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">RC4 128-bit</span>
                  {algorithm === 'RC4' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
                <p className="text-[10px] text-[#9CA3AF] mt-0.5">Legacy Viewers & Older Devices</p>
              </button>
            </div>
          </div>

          {/* Error Message */}
          {processError && (
            <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-3 text-xs text-rose-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{processError}</span>
            </div>
          )}

          {/* Protect Button */}
          <button
            id="btn-encrypt-pdf"
            onClick={handleExecuteProtect}
            disabled={isProcessing || !userPassword}
            className={`w-full py-3.5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 transition-all shadow-lg ${
              isProcessing || !userPassword
                ? 'bg-[#374151] text-[#9CA3AF] cursor-not-allowed'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/30 active:scale-[0.98]'
            }`}
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Encrypting Document...</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>Encrypt & Set Permissions</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Mode 2: Unlock & Remove Password */}
      {fileData && activeMode === 'unlock' && (
        <div className="space-y-3">
          <div className="bg-[#1F2937] border border-[#374151] rounded-2xl p-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center mx-auto mb-2.5">
              <Unlock className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Remove Document Password</h3>
            <p className="text-xs text-[#9CA3AF] max-w-sm mx-auto mb-4">
              Enter the current password to decrypt the file and strip all printing, copying, and editing restrictions.
            </p>

            <div className="max-w-md mx-auto space-y-3 text-left">
              <div>
                <label className="text-[11px] text-[#9CA3AF] block mb-1">Enter Document Password</label>
                <div className="relative">
                  <input
                    id="input-unlock-password"
                    type={showUnlockPassword ? 'text' : 'password'}
                    placeholder="Enter document password..."
                    value={unlockPassword}
                    onChange={(e) => {
                      setUnlockPassword(e.target.value);
                      setUnlockVerificationState('idle');
                      setProcessError(null);
                    }}
                    className="w-full bg-[#111827] border border-[#374151] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#6B7280] pr-10 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowUnlockPassword(!showUnlockPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-white"
                  >
                    {showUnlockPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Password Test Status */}
              {unlockVerificationState === 'valid' && (
                <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Password verified successfully! Ready to unlock.</span>
                </div>
              )}

              {unlockVerificationState === 'invalid' && (
                <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  <span>Incorrect password. Please verify and try again.</span>
                </div>
              )}

              {/* Test Password Button */}
              <button
                type="button"
                onClick={handleTestUnlockPassword}
                disabled={!unlockPassword || unlockVerificationState === 'testing'}
                className="w-full py-2 rounded-lg bg-[#374151] hover:bg-[#4B5563] text-xs font-semibold text-[#D1D5DB] disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
              >
                {unlockVerificationState === 'testing' ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying Password...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Test Password</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {processError && (
            <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-3 text-xs text-rose-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{processError}</span>
            </div>
          )}

          {/* Unlock & Save Button */}
          <button
            id="btn-unlock-pdf"
            onClick={handleExecuteUnlock}
            disabled={isProcessing}
            className={`w-full py-3.5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 transition-all shadow-lg ${
              isProcessing
                ? 'bg-[#374151] text-[#9CA3AF] cursor-not-allowed'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-indigo-600/30 active:scale-[0.98]'
            }`}
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Decrypting & Removing Restrictions...</span>
              </>
            ) : (
              <>
                <Unlock className="w-4 h-4" />
                <span>Remove Password & Decrypt PDF</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Mode 3: Security Inspector & Permission Audit */}
      {fileData && activeMode === 'inspect' && (
        <div className="bg-[#1F2937] border border-[#374151] rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <ShieldCheck className="w-4 h-4 text-teal-400" />
            <span>Document Security Inspector</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-[#111827] p-2.5 rounded-xl border border-[#374151]">
              <span className="text-[#9CA3AF] text-[10px] block">Encryption State</span>
              <span className={`font-bold ${securityStatus?.isEncrypted ? 'text-rose-400' : 'text-emerald-400'}`}>
                {securityStatus?.isEncrypted ? 'Protected (Encrypted)' : 'Unprotected (Plain)'}
              </span>
            </div>

            <div className="bg-[#111827] p-2.5 rounded-xl border border-[#374151]">
              <span className="text-[#9CA3AF] text-[10px] block">Standard</span>
              <span className="font-bold text-white">
                {securityStatus?.isEncrypted ? 'ISO 32000-2 (AES-256)' : 'Standard PDF'}
              </span>
            </div>
          </div>

          <div className="bg-[#111827] p-3 rounded-xl border border-[#374151] space-y-1.5 text-xs">
            <p className="text-[11px] font-bold text-white mb-2">Permission Flags Matrix</p>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="flex items-center justify-between text-[#9CA3AF]">
                <span>Printing:</span>
                <span className={permissions.allowPrinting ? 'text-emerald-400' : 'text-rose-400'}>
                  {permissions.allowPrinting ? 'Allowed' : 'Prohibited'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[#9CA3AF]">
                <span>Text Copying:</span>
                <span className={permissions.allowCopying ? 'text-emerald-400' : 'text-rose-400'}>
                  {permissions.allowCopying ? 'Allowed' : 'Blocked'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[#9CA3AF]">
                <span>Modifications:</span>
                <span className={permissions.allowModifying ? 'text-emerald-400' : 'text-rose-400'}>
                  {permissions.allowModifying ? 'Allowed' : 'Blocked'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[#9CA3AF]">
                <span>Annotations:</span>
                <span className={permissions.allowAnnotating ? 'text-emerald-400' : 'text-rose-400'}>
                  {permissions.allowAnnotating ? 'Allowed' : 'Blocked'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Result Card */}
      {resultState && (
        <div className="mt-4 bg-[#1F2937] border border-emerald-500/40 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs mb-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {resultState.actionType === 'protected'
                ? 'PDF Successfully Encrypted with Password & Permissions'
                : 'PDF Successfully Unlocked and Restrictions Removed'}
            </span>
          </div>

          <div className="bg-[#111827] p-3 rounded-xl border border-[#374151] mb-3 flex items-center justify-between text-xs">
            <div className="min-w-0">
              <p className="font-semibold text-white truncate">{resultState.filename}</p>
              <p className="text-[11px] text-[#9CA3AF]">
                {formatBytes(resultState.size)} • {resultState.pageCount} page(s)
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                id="btn-security-preview-result"
                onClick={() => {
                  triggerHaptic('medium');
                  onPreview(resultState.blob, resultState.filename);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#374151] hover:bg-[#4B5563] text-white text-xs font-semibold active:scale-95 transition-all"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview</span>
              </button>

              <a
                id="btn-security-download-result"
                href={resultState.downloadUrl}
                download={resultState.filename}
                onClick={() => triggerHaptic('success')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/30 active:scale-95 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </a>
            </div>
          </div>

          {onNavigateTab && (
            <div className="flex items-center justify-end gap-2 text-[11px]">
              <span className="text-[#9CA3AF]">Next step:</span>
              <button
                onClick={() => onNavigateTab('edit')}
                className="text-[#818CF8] hover:underline font-semibold"
              >
                Open in Annotator & Editor →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
