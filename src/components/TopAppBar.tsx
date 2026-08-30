import React from 'react';
import { ArrowLeft, Sparkles, FileText, Menu, Settings, Eye, Smartphone } from 'lucide-react';
import { ActiveTab } from '../types';
import { triggerHaptic } from '../utils/haptics';

interface TopAppBarProps {
  activeTab: ActiveTab;
  onNavigate: (tab: ActiveTab) => void;
  onLoadSample?: () => void;
  onOpenRecent?: () => void;
  onOpenSettings?: () => void;
  onOpenInstall?: () => void;
  onPreview?: () => void;
  hasActiveDocument?: boolean;
  recentCount?: number;
}

export const TopAppBar: React.FC<TopAppBarProps> = ({
  activeTab,
  onNavigate,
  onLoadSample,
  onOpenRecent,
  onOpenSettings,
  onOpenInstall,
  onPreview,
  hasActiveDocument = false,
  recentCount = 0,
}) => {
  const getTabTitle = () => {
    switch (activeTab) {
      case 'home':
        return 'Document Studio';
      case 'security':
        return 'PDF Security & Permissions';
      case 'edit':
        return 'Edit, Annotate & OCR';
      case 'create':
        return 'Create Document';
      case 'organize':
        return 'Organise Pages';
      case 'convert':
        return 'Convert & Rotate';
      case 'combine':
        return 'Smart Merge';
      case 'split':
        return 'Split File';
      case 'compress':
        return 'Compress PDF';
      case 'recent':
        return 'Processed Files';
      default:
        return 'Document Studio';
    }
  };

  const isHome = activeTab === 'home';

  return (
    <header className="sticky top-0 z-30 bg-[#0F1115]/95 backdrop-blur-md px-3 sm:px-4 py-2.5 sm:py-3 border-b border-[#24272D] flex items-center justify-between">
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Top Left Corner 3-Lines Hamburger Menu Button */}
        <button
          id="btn-top-menu-settings"
          onClick={() => {
            triggerHaptic('medium');
            if (onOpenSettings) onOpenSettings();
          }}
          className="w-9 h-9 rounded-full bg-[#1F2937] hover:bg-[#374151] active:scale-95 text-white flex items-center justify-center transition-all border border-[#374151]"
          title="App Settings & System Themes (Dark/Light Mode)"
        >
          <Menu className="w-5 h-5 text-indigo-300" />
        </button>

        {!isHome && (
          <button
            id="btn-app-bar-back"
            onClick={() => {
              triggerHaptic('light');
              onNavigate('home');
            }}
            className="w-9 h-9 rounded-full bg-[#1F2937] hover:bg-[#374151] active:scale-95 text-white flex items-center justify-center transition-all border border-[#374151]"
            title="Back to Bento Home"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}

        <div>
          <h1 className="text-sm sm:text-base font-bold tracking-tight text-white flex items-center gap-2">
            {getTabTitle()}
          </h1>
          <p className="text-[10px] text-[#9CA3AF] font-medium hidden xs:block">
            {isHome ? 'Fast, Private & Offline Document Tools' : 'Local device processing'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Preview Button in Title Bar */}
        {onPreview && (
          <button
            id="btn-top-preview"
            onClick={() => {
              triggerHaptic('light');
              onPreview();
            }}
            disabled={!hasActiveDocument && isHome}
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-[#1F2937] hover:bg-[#374151] text-white border border-[#374151] text-xs font-semibold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Preview Current Document"
          >
            <Eye className="w-3.5 h-3.5 text-[#818CF8]" />
            <span className="text-[11px]">Preview</span>
          </button>
        )}

        {onLoadSample && (
          <button
            id="btn-top-sample"
            onClick={() => {
              triggerHaptic('medium');
              onLoadSample();
            }}
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-[#4F46E5]/15 hover:bg-[#4F46E5]/25 text-[#818CF8] border border-[#4F46E5]/30 text-xs font-semibold transition-all active:scale-95"
            title="Load Sample Document"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="text-[11px] hidden sm:inline">Sample</span>
          </button>
        )}

        {onOpenRecent && (
          <button
            id="btn-top-recent"
            onClick={() => {
              triggerHaptic('light');
              onOpenRecent();
            }}
            className="relative p-2 rounded-full bg-[#1F2937] hover:bg-[#374151] text-[#9CA3AF] hover:text-white border border-[#374151] active:scale-95 transition-all"
            title="Processed Files History"
          >
            <FileText className="w-4 h-4" />
            {recentCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#4F46E5] text-white text-[9px] font-bold flex items-center justify-center shadow-sm">
                {recentCount}
              </span>
            )}
          </button>
        )}

        {/* Install on Android Mobile / APK Button */}
        {onOpenInstall && (
          <button
            id="btn-top-install-app"
            onClick={() => {
              triggerHaptic('medium');
              onOpenInstall();
            }}
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 rounded-full bg-gradient-to-r from-indigo-600/30 to-purple-600/30 hover:from-indigo-600/40 hover:to-purple-600/40 text-indigo-300 border border-indigo-500/40 text-xs font-semibold transition-all active:scale-95 shadow-sm"
            title="Install App on Android Mobile / APK"
          >
            <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[11px] font-bold">APK / App</span>
          </button>
        )}

        {/* Quick Settings Shortcut button */}
        <button
          id="btn-top-quick-settings"
          onClick={() => {
            triggerHaptic('light');
            if (onOpenSettings) onOpenSettings();
          }}
          className="p-2 rounded-full bg-[#1F2937] hover:bg-[#374151] text-[#9CA3AF] hover:text-white border border-[#374151] active:scale-95 transition-all"
          title="Open Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};

