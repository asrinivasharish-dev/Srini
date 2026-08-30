import React, { useState } from 'react';
import {
  X,
  Moon,
  Sun,
  Laptop,
  Palette,
  Vibrate,
  ShieldCheck,
  Trash2,
  Cpu,
  Info,
  Check,
  ChevronRight,
  Layers,
  Sparkles,
  Lock,
  Scissors,
  Minimize2,
  FileCheck,
  PlusCircle,
  Clock,
  ExternalLink,
  Smartphone
} from 'lucide-react';
import { useTheme, AppThemeMode, AccentColor } from '../context/ThemeContext';
import { ActiveTab } from '../types';
import { triggerHaptic } from '../utils/haptics';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: ActiveTab;
  onNavigate: (tab: ActiveTab) => void;
  recentCount: number;
  onClearHistory?: () => void;
  onOpenInstall?: () => void;
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  isOpen,
  onClose,
  activeTab,
  onNavigate,
  recentCount,
  onClearHistory,
  onOpenInstall,
}) => {
  const {
    themeMode,
    resolvedTheme,
    accentColor,
    hapticsEnabled,
    setThemeMode,
    setAccentColor,
    setHapticsEnabled,
  } = useTheme();

  const [activeSection, setActiveSection] = useState<'theme' | 'navigation' | 'storage' | 'about'>('theme');
  const [clearedNotice, setClearedNotice] = useState<boolean>(false);

  if (!isOpen) return null;

  const accentThemes: { id: AccentColor; name: string; hex: string; bg: string; border: string }[] = [
    { id: 'indigo', name: 'Pixel Indigo', hex: '#4F46E5', bg: 'bg-indigo-600', border: 'border-indigo-500' },
    { id: 'emerald', name: 'Material Mint', hex: '#059669', bg: 'bg-emerald-600', border: 'border-emerald-500' },
    { id: 'amber', name: 'Sunset Amber', hex: '#D97706', bg: 'bg-amber-600', border: 'border-amber-500' },
    { id: 'rose', name: 'Coral Rose', hex: '#E11D48', bg: 'bg-rose-600', border: 'border-rose-500' },
    { id: 'cyan', name: 'Ocean Cyan', hex: '#0891B2', bg: 'bg-cyan-600', border: 'border-cyan-500' },
  ];

  const toolsList: { id: ActiveTab; label: string; desc: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'Home Studio', desc: 'Bento dashboard & quick tools', icon: <Layers className="w-4 h-4 text-indigo-400" /> },
    { id: 'create', label: 'Create Document', desc: 'Author PDFs from scratch', icon: <PlusCircle className="w-4 h-4 text-emerald-400" /> },
    { id: 'edit', label: 'Edit & Annotate', desc: 'Visual markup, OCR & signatures', icon: <Sparkles className="w-4 h-4 text-blue-400" /> },
    { id: 'security', label: 'PDF Security', desc: 'Encrypt, password & watermarks', icon: <Lock className="w-4 h-4 text-amber-400" /> },
    { id: 'organize', label: 'Organise Pages', desc: 'Reorder, rotate & delete pages', icon: <Layers className="w-4 h-4 text-purple-400" /> },
    { id: 'combine', label: 'Smart Merge', desc: 'Combine multiple PDF files', icon: <PlusCircle className="w-4 h-4 text-teal-400" /> },
    { id: 'split', label: 'Split File', desc: 'Extract custom page ranges', icon: <Scissors className="w-4 h-4 text-rose-400" /> },
    { id: 'compress', label: 'Compress PDF', desc: 'Extreme size optimization', icon: <Minimize2 className="w-4 h-4 text-cyan-400" /> },
    { id: 'convert', label: 'Convert & Rotate', desc: 'Export images & word documents', icon: <FileCheck className="w-4 h-4 text-orange-400" /> },
    { id: 'recent', label: 'Processed Files', desc: 'Local device download archives', icon: <Clock className="w-4 h-4 text-zinc-400" /> },
  ];

  const handleThemeChange = (mode: AppThemeMode) => {
    triggerHaptic('medium');
    setThemeMode(mode);
  };

  const handleAccentChange = (acc: AccentColor) => {
    triggerHaptic('light');
    setAccentColor(acc);
  };

  const handleHapticsToggle = () => {
    const next = !hapticsEnabled;
    if (next) {
      triggerHaptic('success');
    }
    setHapticsEnabled(next);
  };

  const handleClearCache = () => {
    triggerHaptic('medium');
    if (onClearHistory) {
      onClearHistory();
    }
    setClearedNotice(true);
    setTimeout(() => setClearedNotice(false), 3000);
  };

  const isLight = resolvedTheme === 'light';

  return (
    <div className="fixed inset-0 z-50 flex overflow-hidden animate-fadeIn">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={() => {
          triggerHaptic('light');
          onClose();
        }}
      />

      {/* Material 3 Android Navigation & Settings Drawer */}
      <div
        className={`relative w-full max-w-[340px] sm:max-w-[380px] h-full flex flex-col shadow-2xl z-50 transform transition-transform duration-300 ease-out border-r ${
          isLight
            ? 'bg-[#F8FAFC] text-[#0F172A] border-slate-200'
            : 'bg-[#12151C] text-white border-[#24272D]'
        }`}
      >
        {/* Drawer Header */}
        <div
          className={`p-4 sm:p-5 flex items-center justify-between border-b shrink-0 ${
            isLight ? 'bg-white border-slate-200' : 'bg-[#0F1115] border-[#24272D]'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">App Settings</h2>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-[#9CA3AF]'}`}>
                System theme & studio preferences
              </p>
            </div>
          </div>

          <button
            id="btn-close-settings-drawer"
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            className={`p-2 rounded-full transition-all active:scale-95 ${
              isLight
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                : 'bg-[#1F2937] hover:bg-[#374151] text-[#9CA3AF] hover:text-white'
            }`}
            title="Close Settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section Navigation Tabs */}
        <div
          className={`px-3 py-2 border-b flex items-center gap-1 shrink-0 text-xs font-semibold overflow-x-auto no-scrollbar ${
            isLight ? 'bg-slate-100/80 border-slate-200' : 'bg-[#0B0D12] border-[#24272D]'
          }`}
        >
          <button
            id="tab-settings-theme"
            onClick={() => {
              triggerHaptic('light');
              setActiveSection('theme');
            }}
            className={`px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 shrink-0 ${
              activeSection === 'theme'
                ? 'bg-indigo-600 text-white shadow-sm'
                : isLight
                ? 'text-slate-600 hover:bg-slate-200'
                : 'text-[#9CA3AF] hover:bg-[#1F2937]'
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
            <span>Theme & Look</span>
          </button>

          <button
            id="tab-settings-nav"
            onClick={() => {
              triggerHaptic('light');
              setActiveSection('navigation');
            }}
            className={`px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 shrink-0 ${
              activeSection === 'navigation'
                ? 'bg-indigo-600 text-white shadow-sm'
                : isLight
                ? 'text-slate-600 hover:bg-slate-200'
                : 'text-[#9CA3AF] hover:bg-[#1F2937]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Tool Hub</span>
          </button>

          <button
            id="tab-settings-storage"
            onClick={() => {
              triggerHaptic('light');
              setActiveSection('storage');
            }}
            className={`px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 shrink-0 ${
              activeSection === 'storage'
                ? 'bg-indigo-600 text-white shadow-sm'
                : isLight
                ? 'text-slate-600 hover:bg-slate-200'
                : 'text-[#9CA3AF] hover:bg-[#1F2937]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Privacy</span>
          </button>
        </div>

        {/* Scrollable Settings Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* SECTION 1: SYSTEM THEME & APPEARANCE */}
          {activeSection === 'theme' && (
            <div className="space-y-5 animate-fadeIn">
              {/* System Color Scheme Selector */}
              <div>
                <label className={`block text-xs font-bold uppercase tracking-wider mb-2.5 ${isLight ? 'text-slate-600' : 'text-[#9CA3AF]'}`}>
                  System Color Theme
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {/* Dark Mode */}
                  <button
                    id="btn-theme-dark"
                    onClick={() => handleThemeChange('dark')}
                    className={`p-3 rounded-2xl flex flex-col items-center justify-center gap-2 border transition-all text-center ${
                      themeMode === 'dark'
                        ? 'bg-indigo-600/15 border-indigo-500 text-indigo-400 ring-2 ring-indigo-500/30'
                        : isLight
                        ? 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                        : 'bg-[#1A1D24] border-[#2E333D] hover:border-[#4B5563] text-[#9CA3AF]'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-[#0F1115] border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                      <Moon className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold">Dark Mode</span>
                    {themeMode === 'dark' && (
                      <span className="text-[9px] bg-indigo-500 text-white px-2 py-0.5 rounded-full font-bold">Active</span>
                    )}
                  </button>

                  {/* Light Mode */}
                  <button
                    id="btn-theme-light"
                    onClick={() => handleThemeChange('light')}
                    className={`p-3 rounded-2xl flex flex-col items-center justify-center gap-2 border transition-all text-center ${
                      themeMode === 'light'
                        ? 'bg-amber-500/15 border-amber-500 text-amber-600 ring-2 ring-amber-500/30'
                        : isLight
                        ? 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                        : 'bg-[#1A1D24] border-[#2E333D] hover:border-[#4B5563] text-[#9CA3AF]'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-600">
                      <Sun className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold">Light Mode</span>
                    {themeMode === 'light' && (
                      <span className="text-[9px] bg-amber-500 text-white px-2 py-0.5 rounded-full font-bold">Active</span>
                    )}
                  </button>

                  {/* System Auto */}
                  <button
                    id="btn-theme-system"
                    onClick={() => handleThemeChange('system')}
                    className={`p-3 rounded-2xl flex flex-col items-center justify-center gap-2 border transition-all text-center ${
                      themeMode === 'system'
                        ? 'bg-teal-500/15 border-teal-500 text-teal-400 ring-2 ring-teal-500/30'
                        : isLight
                        ? 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                        : 'bg-[#1A1D24] border-[#2E333D] hover:border-[#4B5563] text-[#9CA3AF]'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400">
                      <Laptop className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold">System Auto</span>
                    {themeMode === 'system' && (
                      <span className="text-[9px] bg-teal-500 text-white px-2 py-0.5 rounded-full font-bold">Active</span>
                    )}
                  </button>
                </div>
              </div>

              {/* Material You Accent Color Picker */}
              <div
                className={`p-4 rounded-2xl border ${
                  isLight ? 'bg-white border-slate-200' : 'bg-[#161922] border-[#24272D]'
                }`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Palette className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold">Material You Accent Palette</span>
                </div>
                <p className={`text-[11px] mb-3 leading-relaxed ${isLight ? 'text-slate-500' : 'text-[#9CA3AF]'}`}>
                  Customize the signature highlights, badges, and focus indicators across DocHub Studio.
                </p>
                <div className="flex items-center justify-between gap-2">
                  {accentThemes.map((acc) => (
                    <button
                      key={acc.id}
                      id={`btn-accent-${acc.id}`}
                      onClick={() => handleAccentChange(acc.id)}
                      className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all ${acc.bg} active:scale-90 ${
                        accentColor === acc.id
                          ? 'ring-4 ring-offset-2 ring-white/50 scale-110 shadow-lg'
                          : 'opacity-80 hover:opacity-100 hover:scale-105'
                      }`}
                      title={acc.name}
                    >
                      {accentColor === acc.id && <Check className="w-5 h-5 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Haptic Tactile Feedback Setting */}
              <div
                className={`p-4 rounded-2xl border flex items-center justify-between ${
                  isLight ? 'bg-white border-slate-200' : 'bg-[#161922] border-[#24272D]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                    <Vibrate className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold block">Haptic Vibrations</span>
                    <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-[#9CA3AF]'}`}>
                      Tactile micro-feedback for taps & swipes
                    </span>
                  </div>
                </div>

                <button
                  id="btn-toggle-haptics"
                  onClick={handleHapticsToggle}
                  className={`w-12 h-6 rounded-full transition-colors relative p-0.5 border ${
                    hapticsEnabled
                      ? 'bg-indigo-600 border-indigo-500'
                      : isLight
                      ? 'bg-slate-300 border-slate-400'
                      : 'bg-[#24272D] border-[#374151]'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      hapticsEnabled ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* SECTION 2: TOOL HUB SHORTCUTS */}
          {activeSection === 'navigation' && (
            <div className="space-y-2 animate-fadeIn">
              <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${isLight ? 'text-slate-600' : 'text-[#9CA3AF]'}`}>
                Direct Tool Navigation
              </p>
              {toolsList.map((tool) => {
                const isActive = activeTab === tool.id;
                return (
                  <button
                    key={tool.id}
                    id={`btn-drawer-nav-${tool.id}`}
                    onClick={() => {
                      triggerHaptic('light');
                      onNavigate(tool.id);
                      onClose();
                    }}
                    className={`w-full p-3 rounded-2xl flex items-center justify-between border transition-all text-left ${
                      isActive
                        ? 'bg-indigo-600/15 border-indigo-500 text-indigo-400 font-semibold'
                        : isLight
                        ? 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                        : 'bg-[#161922] hover:bg-[#1F2937] border-[#24272D] text-[#D1D5DB]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center">
                        {tool.icon}
                      </div>
                      <div>
                        <div className="text-xs font-bold">{tool.label}</div>
                        <div className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-[#9CA3AF]'}`}>
                          {tool.desc}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-50" />
                  </button>
                );
              })}
            </div>
          )}

          {/* SECTION 3: PRIVACY & STORAGE */}
          {activeSection === 'storage' && (
            <div className="space-y-4 animate-fadeIn">
              {/* 100% Client-Side Privacy Badge */}
              <div
                className={`p-4 rounded-2xl border ${
                  isLight
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-xs mb-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>100% Client-Side Device Sandbox</span>
                </div>
                <p className="text-[11px] leading-relaxed opacity-90">
                  All PDF editing, signing, page reorganizing, compression, and encryption happen strictly inside your browser. No files are ever sent to remote servers.
                </p>
              </div>

              {/* Local Storage & Cache Summary */}
              <div
                className={`p-4 rounded-2xl border space-y-3 ${
                  isLight ? 'bg-white border-slate-200' : 'bg-[#161922] border-[#24272D]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">Processed Files History</span>
                  <span className="text-xs font-mono font-bold bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full">
                    {recentCount} Items
                  </span>
                </div>

                <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-[#9CA3AF]'}`}>
                  History items are temporarily cached in your current session memory for instant re-download.
                </p>

                <button
                  id="btn-clear-cache-settings"
                  onClick={handleClearCache}
                  className="w-full py-2.5 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Storage & Reset Cache</span>
                </button>

                {clearedNotice && (
                  <p className="text-[10px] text-center text-emerald-400 font-semibold animate-fadeIn">
                    ✓ Cache cleared successfully
                  </p>
                )}
              </div>

              {/* Mobile Install & APK Setup */}
              {onOpenInstall && (
                <div
                  className={`p-4 rounded-2xl border space-y-2.5 ${
                    isLight ? 'bg-indigo-50/70 border-indigo-100' : 'bg-indigo-950/20 border-indigo-900/30'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-indigo-400 text-xs">
                    <Smartphone className="w-4 h-4 text-indigo-400" />
                    <span>Install on Mobile / APK</span>
                  </div>
                  <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                    Run this app fullscreen on Android with offline storage, camera scanning, and no browser URL bars.
                  </p>
                  <button
                    onClick={() => {
                      triggerHaptic('medium');
                      onClose();
                      onOpenInstall();
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md shadow-indigo-600/25"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Open Install &amp; APK Setup</span>
                  </button>
                </div>
              )}

              {/* System Specs */}
              <div
                className={`p-4 rounded-2xl border space-y-2 text-xs ${
                  isLight ? 'bg-white border-slate-200 text-slate-600' : 'bg-[#161922] border-[#24272D] text-[#9CA3AF]'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-white mb-2">
                  <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                  <span className={isLight ? 'text-slate-900' : 'text-white'}>DocHub Android OS</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span>Engine:</span>
                  <span className={`font-mono ${isLight ? 'text-slate-800' : 'text-white'}`}>pdf-lib + Canvas M3</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span>Version:</span>
                  <span className={`font-mono ${isLight ? 'text-slate-800' : 'text-white'}`}>v2.4.0-stable</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span>Environment:</span>
                  <span className={`font-mono ${isLight ? 'text-slate-800' : 'text-white'}`}>Responsive Multi-Device</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className={`p-3.5 border-t text-center text-[10px] shrink-0 ${
            isLight ? 'bg-slate-100 border-slate-200 text-slate-500' : 'bg-[#0F1115] border-[#24272D] text-[#6B7280]'
          }`}
        >
          <span>DocHub Studio • Built for Phones, Tablets & Desktops</span>
        </div>
      </div>
    </div>
  );
};
