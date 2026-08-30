import React, { useState, useEffect } from 'react';
import { ActiveTab, ProcessedDocument } from './types';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AndroidShell } from './components/AndroidShell';
import { TopAppBar } from './components/TopAppBar';
import { BottomNavBar } from './components/BottomNavBar';
import { HomeDashboard } from './components/HomeDashboard';
import { CreateTool } from './components/CreateTool';
import { OrganizeTool } from './components/OrganizeTool';
import { CombineTool } from './components/CombineTool';
import { SplitTool } from './components/SplitTool';
import { CompressTool } from './components/CompressTool';
import { ConvertTool } from './components/ConvertTool';
import { EditTool } from './components/EditTool';
import { SecurityTool } from './components/SecurityTool';
import { RecentFilesDrawer } from './components/RecentFilesDrawer';
import { SettingsDrawer } from './components/SettingsDrawer';
import { PdfViewerModal } from './components/PdfViewerModal';
import { InstallAppModal } from './components/InstallAppModal';
import { generateSamplePdfBytes } from './utils/pdfEngine';
import { triggerHaptic } from './utils/haptics';
import confetti from 'canvas-confetti';

function AppContent() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [tabHistory, setTabHistory] = useState<ActiveTab[]>(['home']);
  const [currentFile, setCurrentFile] = useState<{ name: string; bytes: Uint8Array } | null>(null);
  const [combineFiles, setCombineFiles] = useState<{ name: string; bytes: Uint8Array }[]>([]);
  const [recentDocuments, setRecentDocuments] = useState<ProcessedDocument[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [isInstallOpen, setIsInstallOpen] = useState(false);
  const { isSettingsOpen, setIsSettingsOpen } = useTheme();

  const [previewState, setPreviewState] = useState<{
    isOpen: boolean;
    blob: Blob | null;
    filename: string;
    pageCount?: number;
  }>({
    isOpen: false,
    blob: null,
    filename: '',
    pageCount: 1,
  });

  const navigateTo = (tab: ActiveTab) => {
    triggerHaptic('light');
    setActiveTab(tab);
    setTabHistory((prev) => (prev[prev.length - 1] === tab ? prev : [...prev, tab]));
  };

  const handleAndroidBack = () => {
    triggerHaptic('light');
    if (isSettingsOpen) {
      setIsSettingsOpen(false);
      return;
    }
    if (previewState.isOpen) {
      setPreviewState((prev) => ({ ...prev, isOpen: false }));
      return;
    }

    if (tabHistory.length > 1) {
      const newHistory = [...tabHistory];
      newHistory.pop(); // remove current
      const prevTab = newHistory[newHistory.length - 1] || 'home';
      setTabHistory(newHistory);
      setActiveTab(prevTab);
    } else if (activeTab !== 'home') {
      setActiveTab('home');
      setTabHistory(['home']);
    } else {
      showToast('DocHub Android: Press Home to minimize app', 'info');
    }
  };

  const handleAndroidHome = () => {
    triggerHaptic('medium');
    setIsSettingsOpen(false);
    setActiveTab('home');
    setTabHistory(['home']);
  };

  const handleAndroidRecents = () => {
    triggerHaptic('light');
    navigateTo('recent');
  };

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  const handleLoadSample = async () => {
    try {
      triggerHaptic('medium');
      const sampleBytes = await generateSamplePdfBytes();
      const sampleFile = {
        name: 'Android_Doc_Guide.pdf',
        bytes: sampleBytes,
      };
      setCurrentFile(sampleFile);
      setCombineFiles([sampleFile]);

      if (activeTab === 'home' || activeTab === 'recent' || activeTab === 'create') {
        navigateTo('organize');
      }

      showToast('Sample PDF loaded into Android Workspace', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to generate sample document', 'error');
    }
  };

  const handleQuickUpload = (e: React.ChangeEvent<HTMLInputElement>, targetTab: ActiveTab) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    triggerHaptic('medium');
    const file = files[0];
    const reader = new FileReader();

    reader.onload = () => {
      const bytes = new Uint8Array(reader.result as ArrayBuffer);
      const loaded = { name: file.name, bytes };
      setCurrentFile(loaded);
      setCombineFiles([loaded]);
      navigateTo(targetTab);
      showToast(`Loaded ${file.name} to Android workspace`, 'success');
    };

    reader.readAsArrayBuffer(file);
  };

  const handleDocumentSuccess = (
    blob: Blob,
    filename: string,
    pageCount: number,
    action: ProcessedDocument['action']
  ) => {
    triggerHaptic('success');
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });
    } catch {
      // ignore
    }

    const downloadUrl = URL.createObjectURL(blob);
    const newDoc: ProcessedDocument = {
      id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      title: filename,
      action,
      timestamp: Date.now(),
      fileSize: blob.size,
      pageCount: pageCount || 1,
      blob,
      downloadUrl,
    };

    setRecentDocuments((prev) => [newDoc, ...prev]);
    showToast(`Saved "${filename}" to Android device storage`, 'success');
  };

  const handlePreview = (blob: Blob, filename: string, pageCount?: number) => {
    triggerHaptic('light');
    setPreviewState({
      isOpen: true,
      blob,
      filename,
      pageCount: pageCount || 1,
    });
  };

  const handleClearHistory = () => {
    triggerHaptic('medium');
    setRecentDocuments([]);
    showToast('Android storage history cleared', 'info');
  };

  return (
    <AndroidShell
      activeTab={activeTab}
      onSelectTab={navigateTo}
      recentCount={recentDocuments.length}
      onLoadSample={handleLoadSample}
      onAndroidBack={handleAndroidBack}
      onAndroidHome={handleAndroidHome}
      onAndroidRecents={handleAndroidRecents}
    >
      {/* Android Top Application Bar with Left Corner 3-Lines Menu & Preview */}
      <TopAppBar
        activeTab={activeTab}
        onNavigate={navigateTo}
        onLoadSample={handleLoadSample}
        onOpenRecent={() => navigateTo('recent')}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenInstall={() => setIsInstallOpen(true)}
        onPreview={async () => {
          if (currentFile) {
            const blob = new Blob([currentFile.bytes], { type: 'application/pdf' });
            handlePreview(blob, currentFile.name);
          } else if (recentDocuments.length > 0) {
            const latest = recentDocuments[0];
            handlePreview(latest.blob, latest.title, latest.pageCount);
          } else {
            // Load sample doc and preview immediately
            try {
              const sampleBytes = await generateSamplePdfBytes();
              const blob = new Blob([sampleBytes], { type: 'application/pdf' });
              handlePreview(blob, 'Android_Doc_Guide.pdf', 3);
            } catch (err) {
              console.error(err);
            }
          }
        }}
        hasActiveDocument={Boolean(currentFile || recentDocuments.length > 0)}
        recentCount={recentDocuments.length}
      />

      {/* Android Material 3 Floating Toast / Snackbar */}
      {toast && (
        <div
          id="app-toast"
          className={`fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-xs font-semibold shadow-2xl flex items-center gap-2 backdrop-blur-md border transition-all animate-bounce max-w-[90%] ${
            toast.type === 'success'
              ? 'bg-[#10B981]/90 text-white border-[#10B981]'
              : toast.type === 'error'
              ? 'bg-[#EF4444]/90 text-white border-[#EF4444]'
              : 'bg-[#1F2937]/95 text-white border-[#374151]'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-white animate-pulse shrink-0" />
          <span className="truncate">{toast.message}</span>
        </div>
      )}

      {/* Active Android Screen Content */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {activeTab === 'home' && (
          <HomeDashboard
            onNavigate={navigateTo}
            onLoadSample={handleLoadSample}
            onQuickUpload={handleQuickUpload}
            recentCount={recentDocuments.length}
            onOpenInstall={() => setIsInstallOpen(true)}
          />
        )}

        {activeTab === 'security' && (
          <SecurityTool
            initialFile={currentFile}
            onSuccess={handleDocumentSuccess}
            onPreview={handlePreview}
            onNavigateTab={navigateTo}
          />
        )}

        {activeTab === 'edit' && (
          <EditTool
            currentFile={currentFile}
            onFileLoaded={(file) => {
              setCurrentFile(file);
              setCombineFiles([file]);
            }}
            onSuccess={handleDocumentSuccess}
            onPreview={handlePreview}
            onNavigateTab={navigateTo}
          />
        )}

        {activeTab === 'create' && (
          <CreateTool onSuccess={handleDocumentSuccess} onPreview={handlePreview} />
        )}

        {activeTab === 'organize' && (
          <OrganizeTool
            initialFile={currentFile}
            onSuccess={handleDocumentSuccess}
            onPreview={handlePreview}
            onLoadSample={handleLoadSample}
          />
        )}

        {activeTab === 'combine' && (
          <CombineTool
            initialFiles={combineFiles}
            onSuccess={handleDocumentSuccess}
            onPreview={handlePreview}
            onLoadSample={handleLoadSample}
          />
        )}

        {activeTab === 'split' && (
          <SplitTool
            initialFile={currentFile}
            onSuccess={handleDocumentSuccess}
            onPreview={handlePreview}
            onLoadSample={handleLoadSample}
          />
        )}

        {activeTab === 'compress' && (
          <CompressTool
            initialFile={currentFile}
            onSuccess={handleDocumentSuccess}
            onPreview={handlePreview}
            onLoadSample={handleLoadSample}
          />
        )}

        {activeTab === 'convert' && (
          <ConvertTool
            initialFile={currentFile}
            onSuccess={handleDocumentSuccess}
            onPreview={handlePreview}
            onLoadSample={handleLoadSample}
          />
        )}

        {activeTab === 'recent' && (
          <RecentFilesDrawer
            documents={recentDocuments}
            onPreview={handlePreview}
            onClear={handleClearHistory}
          />
        )}
      </div>

      {/* Android Material 3 Bottom Navigation Bar */}
      <BottomNavBar activeTab={activeTab} onSelectTab={navigateTo} />

      {/* App Settings & System Theme Drawer (Triggered by 3 lines button) */}
      <SettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        activeTab={activeTab}
        onNavigate={navigateTo}
        recentCount={recentDocuments.length}
        onClearHistory={handleClearHistory}
        onOpenInstall={() => setIsInstallOpen(true)}
      />

      {/* Install on Android Phone / APK Helper Modal */}
      <InstallAppModal
        isOpen={isInstallOpen}
        onClose={() => setIsInstallOpen(false)}
      />

      {/* Android Document Viewer Modal */}
      <PdfViewerModal
        isOpen={previewState.isOpen}
        onClose={() => setPreviewState((prev) => ({ ...prev, isOpen: false }))}
        pdfBlob={previewState.blob}
        filename={previewState.filename}
        pageCount={previewState.pageCount}
        onEdit={async () => {
          if (previewState.blob) {
            const buf = await previewState.blob.arrayBuffer();
            const loaded = {
              name: previewState.filename || 'Document.pdf',
              bytes: new Uint8Array(buf),
            };
            setCurrentFile(loaded);
            setCombineFiles([loaded]);
            navigateTo('edit');
          }
        }}
      />
    </AndroidShell>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

