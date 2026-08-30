import React, { useState } from 'react';
import {
  PlusCircle,
  LayoutGrid,
  Layers,
  Scissors,
  Minimize2,
  Sparkles,
  ArrowRight,
  Shield,
  Zap,
  FolderOpen,
  Search,
  FileCheck2,
  HardDrive,
  Camera,
  FileType,
  Smartphone,
  CheckCircle2
} from 'lucide-react';
import { ActiveTab } from '../types';
import { triggerHaptic } from '../utils/haptics';

interface HomeDashboardProps {
  onNavigate: (tab: ActiveTab) => void;
  onLoadSample: () => void;
  onQuickUpload?: (e: React.ChangeEvent<HTMLInputElement>, targetTab: ActiveTab) => void;
  recentCount: number;
  onOpenInstall?: () => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  onNavigate,
  onLoadSample,
  onQuickUpload,
  recentCount,
  onOpenInstall,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const tools = [
    {
      id: 'edit' as ActiveTab,
      name: 'Edit, Annotate & OCR',
      desc: 'Add sticky notes, comments, shapes, text blocks & stamps. Rewrite text, create fillable forms, and use AI OCR to edit scanned pages.',
      tag: 'Sticky Notes • Shapes • Forms • OCR',
      color: '#4F46E5',
    },
    {
      id: 'combine' as ActiveTab,
      name: 'Smart Merge',
      desc: 'Combine PDFs, mobile photos, and documents into a unified high-quality file with automatic bookmarks.',
      tag: 'Multi-Format',
      color: '#818CF8',
    },
    {
      id: 'create' as ActiveTab,
      name: 'Create & Scan',
      desc: 'Scan QR codes to import URLs/text, capture physical papers with Android camera, add digital signatures, and build vector PDFs.',
      tag: 'QR Scanner • Camera OCR • Doc Builder',
      color: '#06B6D4',
    },
    {
      id: 'convert' as ActiveTab,
      name: 'Convert & Rotate',
      desc: 'Convert PDF pages to PNG/JPG images, export to editable Word (.docx), or rotate pages.',
      tag: 'PNG • JPG • DOCX',
      color: '#EC4899',
    },
    {
      id: 'organize' as ActiveTab,
      name: 'Page Organizer',
      desc: 'Visual thumbnail grid. Drag & drop reorder, rotate 90°, delete, or duplicate pages on your phone.',
      tag: 'Visual Matrix',
      color: '#6366F1',
    },
    {
      id: 'split' as ActiveTab,
      name: 'Split Document',
      desc: 'Extract page ranges or divide into individual single sheets.',
      tag: 'Extract & Cut',
      color: '#8B5CF6',
    },
    {
      id: 'compress' as ActiveTab,
      name: 'Compress PDF',
      desc: 'Reduce file size by up to 90% for instant WhatsApp, Gmail, or Telegram sharing.',
      tag: '-90% Storage',
      color: '#10B981',
    },
    {
      id: 'security' as ActiveTab,
      name: 'Security & Encryption',
      desc: 'Protect PDF with military-grade AES-256 passwords. Lock or unlock printing, copying, editing, and form fill permissions.',
      tag: 'AES-256 • Passwords • Permissions',
      color: '#10B981',
    },
  ];

  const filteredTools = searchQuery.trim()
    ? tools.filter(
        (t) =>
          t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.tag.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : tools;

  return (
    <div className="flex-1 flex flex-col p-4 space-y-4 overflow-y-auto bg-[#0F1115] text-white">
      {/* Android Mobile Header Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1F2937] border border-[#374151] text-[10px] font-semibold text-[#818CF8]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
            <span>Android On-Device Engine</span>
          </div>

          <div className="flex items-center gap-1 text-[11px] text-[#9CA3AF]">
            <Shield className="w-3 h-3 text-[#10B981]" />
            <span>100% Offline</span>
          </div>
        </div>

        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
            Android Doc Toolkit
          </h1>
          <p className="text-xs text-[#9CA3AF] mt-0.5">
            Create, merge, split, compress, and organize on your Android device.
          </p>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search tools (Merge, Scan, Compress...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#1F2937] border border-[#374151] rounded-2xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-[#6B7280] focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent outline-none transition-all"
          />
        </div>
      </div>

      {/* Quick Action Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
        {onOpenInstall && (
          <button
            id="quick-pill-install"
            onClick={() => {
              triggerHaptic('medium');
              onOpenInstall();
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold shadow-md shadow-emerald-600/30 shrink-0 active:scale-95 transition-all text-xs"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Install on Android (APK/PWA)</span>
          </button>
        )}

        <button
          id="quick-pill-edit"
          onClick={() => {
            triggerHaptic('medium');
            onNavigate('edit');
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold shadow-md shadow-[#4F46E5]/25 shrink-0 active:scale-95 transition-all text-xs"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          <span>Edit & Annotate</span>
        </button>

        <button
          id="quick-pill-create"
          onClick={() => {
            triggerHaptic('medium');
            onNavigate('create');
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1F2937] hover:bg-[#253243] text-white border border-[#374151] font-semibold shrink-0 active:scale-95 transition-all text-xs"
        >
          <PlusCircle className="w-3.5 h-3.5 text-[#06B6D4]" />
          <span>New Document</span>
        </button>

        <button
          id="quick-pill-sample"
          onClick={() => {
            triggerHaptic('medium');
            onLoadSample();
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1F2937] hover:bg-[#253243] text-[#818CF8] border border-[#4F46E5]/30 font-medium shrink-0 active:scale-95 transition-all text-xs"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Load Sample</span>
        </button>

        <button
          id="quick-pill-recent"
          onClick={() => {
            triggerHaptic('light');
            onNavigate('recent');
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1F2937] hover:bg-[#253243] text-[#9CA3AF] hover:text-white border border-[#374151] font-medium shrink-0 active:scale-95 transition-all text-xs"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>Archive ({recentCount})</span>
        </button>

        <button
          id="quick-pill-security"
          onClick={() => {
            triggerHaptic('medium');
            onNavigate('security');
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md shadow-emerald-600/25 shrink-0 active:scale-95 transition-all text-xs"
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Security & Password</span>
        </button>
      </div>

      {/* Android Mobile & Tablet Tool Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filteredTools.map((tool) => (
          <div
            key={tool.id}
            id={`android-card-${tool.id}`}
            onClick={() => {
              triggerHaptic('medium');
              onNavigate(tool.id);
            }}
            className="bg-[#1F2937] hover:bg-[#253243] rounded-2xl p-4 border border-[#374151] flex flex-col justify-between group cursor-pointer transition-all active:scale-[0.98] shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm"
                  style={{ backgroundColor: `${tool.color}30`, color: tool.color, border: `1px solid ${tool.color}50` }}
                >
                  {tool.id === 'combine' && <Layers className="w-5 h-5" />}
                  {tool.id === 'convert' && <FileType className="w-5 h-5" />}
                  {tool.id === 'organize' && <LayoutGrid className="w-5 h-5" />}
                  {tool.id === 'split' && <Scissors className="w-5 h-5" />}
                  {tool.id === 'compress' && <Minimize2 className="w-5 h-5" />}
                  {tool.id === 'create' && <PlusCircle className="w-5 h-5" />}
                  {tool.id === 'edit' && <Sparkles className="w-5 h-5" />}
                  {tool.id === 'security' && <Shield className="w-5 h-5" />}
                </div>

                <div>
                  <h3 className="font-bold text-white text-sm group-hover:text-[#818CF8] transition-colors">
                    {tool.name}
                  </h3>
                  <span className="text-[10px] font-semibold text-[#818CF8] uppercase tracking-wider">
                    {tool.tag}
                  </span>
                </div>
              </div>

              <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-[#9CA3AF] group-hover:text-white group-hover:bg-[#4F46E5] transition-all shrink-0">
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            <p className="text-[#9CA3AF] text-xs mt-2.5 leading-relaxed">
              {tool.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Android Device Storage & APK Install Card */}
      <div 
        onClick={() => {
          if (onOpenInstall) {
            triggerHaptic('medium');
            onOpenInstall();
          }
        }}
        className="p-3.5 bg-gradient-to-r from-[#161922] to-[#1D2230] hover:from-[#1C202C] hover:to-[#242B3C] cursor-pointer rounded-2xl border border-[#273042] flex items-center justify-between text-xs text-[#9CA3AF] mt-2 transition-all active:scale-98 shadow-sm"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 text-white flex items-center justify-center shadow-md shadow-indigo-600/30 shrink-0">
            <Smartphone className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-white text-xs flex items-center gap-1.5">
              <span>Android Mobile &amp; APK Setup</span>
              <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.2 rounded border border-indigo-500/30">Tap to Install</span>
            </div>
            <div className="text-[10px] text-[#9CA3AF]">Scan QR code or install direct APK to your home screen</div>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-indigo-400 font-semibold shrink-0">
          <span>Get App</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  );
};
