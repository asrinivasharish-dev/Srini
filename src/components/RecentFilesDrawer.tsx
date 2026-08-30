import React, { useState, useMemo } from 'react';
import {
  FileText,
  Download,
  Eye,
  Trash2,
  Clock,
  CheckCircle2,
  Sparkles,
  Share2,
  Search,
  X,
  Filter,
  FileType,
  Check
} from 'lucide-react';
import { ProcessedDocument } from '../types';
import { formatBytes } from '../utils/pdfEngine';
import { triggerHaptic } from '../utils/haptics';

interface RecentFilesDrawerProps {
  documents: ProcessedDocument[];
  onPreview: (blob: Blob, filename: string) => void;
  onClear: () => void;
}

type FileTypeCategory = 'all' | 'pdf' | 'docx' | 'zip' | 'image';

export const RecentFilesDrawer: React.FC<RecentFilesDrawerProps> = ({
  documents,
  onPreview,
  onClear,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FileTypeCategory>('all');
  const [sharingDocId, setSharingDocId] = useState<string | null>(null);
  const [drawerToast, setDrawerToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const showDrawerToast = (message: string, type: 'success' | 'info' = 'info') => {
    setDrawerToast({ message, type });
    setTimeout(() => {
      setDrawerToast(null);
    }, 3000);
  };

  const getDocExtension = (title: string, blob?: Blob): string => {
    const lower = title.toLowerCase();
    if (lower.endsWith('.pdf')) return 'pdf';
    if (lower.endsWith('.docx') || lower.endsWith('.doc')) return 'docx';
    if (lower.endsWith('.zip')) return 'zip';
    if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image';
    if (blob?.type.includes('pdf')) return 'pdf';
    if (blob?.type.includes('word') || blob?.type.includes('document')) return 'docx';
    if (blob?.type.includes('zip')) return 'zip';
    if (blob?.type.includes('image')) return 'image';
    return 'pdf';
  };

  const getDocTypeLabel = (doc: ProcessedDocument): string => {
    const ext = getDocExtension(doc.title, doc.blob);
    switch (ext) {
      case 'pdf':
        return 'PDF';
      case 'docx':
        return 'DOCX';
      case 'zip':
        return 'ZIP';
      case 'image':
        return 'Image';
      default:
        return ext.toUpperCase();
    }
  };

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const ext = getDocExtension(doc.title, doc.blob);

      // Category filter
      if (selectedCategory !== 'all' && ext !== selectedCategory) {
        return false;
      }

      // Search query filter (matches name, extension, file type label, or action)
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const titleMatch = doc.title.toLowerCase().includes(query);
        const actionMatch = doc.action.toLowerCase().includes(query);
        const extMatch = ext.toLowerCase().includes(query);
        const typeLabelMatch = getDocTypeLabel(doc).toLowerCase().includes(query);

        // Also support search terms like 'word', 'archive', 'photo'
        const aliasMatch =
          (query === 'word' && ext === 'docx') ||
          (query === 'archive' && ext === 'zip') ||
          (query === 'picture' && ext === 'image') ||
          (query === 'photo' && ext === 'image');

        if (!titleMatch && !actionMatch && !extMatch && !typeLabelMatch && !aliasMatch) {
          return false;
        }
      }

      return true;
    });
  }, [documents, searchQuery, selectedCategory]);

  const downloadDoc = (doc: ProcessedDocument) => {
    triggerHaptic('success');
    const a = document.createElement('a');
    a.href = doc.downloadUrl;
    a.download =
      doc.title.endsWith('.pdf') || doc.title.endsWith('.zip') || doc.title.endsWith('.docx')
        ? doc.title
        : `${doc.title}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showDrawerToast(`Saved "${doc.title}" to storage`, 'success');
  };

  const shareDoc = async (doc: ProcessedDocument) => {
    triggerHaptic('medium');
    setSharingDocId(doc.id);

    const filename = doc.title.endsWith('.pdf') || doc.title.endsWith('.zip') || doc.title.endsWith('.docx')
      ? doc.title
      : `${doc.title}.pdf`;

    const mimeType =
      doc.blob?.type ||
      (filename.endsWith('.pdf')
        ? 'application/pdf'
        : filename.endsWith('.docx')
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : filename.endsWith('.zip')
        ? 'application/zip'
        : 'application/octet-stream');

    try {
      if (typeof navigator !== 'undefined' && navigator.share && doc.blob) {
        const file = new File([doc.blob], filename, { type: mimeType });

        // Check if file sharing is supported by navigator.canShare
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: doc.title,
            text: `Document from DocHub Android: ${doc.title}`,
          });
          showDrawerToast('Shared via Android Share Sheet', 'success');
        } else {
          // Fallback to text/url sharing or download
          await navigator.share({
            title: doc.title,
            text: `DocHub document: ${doc.title}`,
            url: doc.downloadUrl,
          });
          showDrawerToast('Shared document link', 'success');
        }
      } else {
        // Fallback for browsers / environments without navigator.share
        downloadDoc(doc);
        showDrawerToast('Sharing not supported on this browser. File downloaded.', 'info');
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        // User dismissed the native share sheet
      } else {
        // On error, trigger download as reliable fallback
        downloadDoc(doc);
      }
    } finally {
      setTimeout(() => setSharingDocId(null), 1000);
    }
  };

  const getActionBadgeColor = (action: ProcessedDocument['action']) => {
    switch (action) {
      case 'create':
        return 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30';
      case 'organize':
        return 'bg-[#818CF8]/15 text-[#818CF8] border-[#818CF8]/30';
      case 'combine':
        return 'bg-[#4F46E5]/20 text-[#818CF8] border-[#4F46E5]/40';
      case 'split':
        return 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30';
      case 'compress':
        return 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30';
      case 'convert':
        return 'bg-[#EC4899]/15 text-[#EC4899] border-[#EC4899]/30';
      default:
        return 'bg-[#1F2937] text-[#9CA3AF] border-[#374151]';
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 space-y-3.5 pb-12 overflow-y-auto bg-[#0F1115] text-white relative">
      {/* Mini Toast Notification for Drawer Actions */}
      {drawerToast && (
        <div
          id="drawer-feedback-toast"
          className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-2xl flex items-center gap-2 backdrop-blur-md border bg-[#1F2937]/95 text-white border-[#4F46E5] animate-bounce"
        >
          <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
          <span>{drawerToast.message}</span>
        </div>
      )}

      {/* Header and counter */}
      <div className="flex items-center justify-between px-1 w-full">
        <div>
          <h3 className="text-base font-bold text-white">Android Storage Archive</h3>
          <p className="text-[11px] text-[#9CA3AF]">
            {documents.length} document(s) in local storage
          </p>
        </div>

        {documents.length > 0 && (
          <button
            id="btn-clear-recent-all"
            type="button"
            onClick={onClear}
            className="text-xs text-[#EF4444] hover:text-rose-300 font-semibold hover:underline"
          >
            Clear All
          </button>
        )}
      </div>

      {documents.length > 0 && (
        <div className="space-y-2">
          {/* Real-time Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="recent-files-search-input"
              type="text"
              placeholder="Search by name, format (PDF, DOCX, ZIP), or action..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#1F2937] border border-[#374151] rounded-2xl pl-9.5 pr-9 py-2.5 text-xs text-white placeholder-[#6B7280] focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent outline-none transition-all"
            />
            {searchQuery && (
              <button
                id="btn-clear-recent-search"
                onClick={() => {
                  triggerHaptic('light');
                  setSearchQuery('');
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#9CA3AF] hover:text-white rounded-full bg-[#374151]/50 hover:bg-[#374151]"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Format / Type filter chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            {(
              [
                { id: 'all', label: 'All Files' },
                { id: 'pdf', label: 'PDF' },
                { id: 'docx', label: 'Word (DOCX)' },
                { id: 'zip', label: 'ZIP Archive' },
                { id: 'image', label: 'Images' },
              ] as { id: FileTypeCategory; label: string }[]
            ).map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  id={`filter-chip-${cat.id}`}
                  onClick={() => {
                    triggerHaptic('light');
                    setSelectedCategory(cat.id);
                  }}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all ${
                    isSelected
                      ? 'bg-[#4F46E5] text-white shadow-sm'
                      : 'bg-[#1F2937] text-[#9CA3AF] hover:text-white border border-[#374151]'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Search match stats */}
          {(searchQuery.trim() || selectedCategory !== 'all') && (
            <div className="flex items-center justify-between text-[11px] text-[#9CA3AF] px-1">
              <span>
                Found <span className="text-white font-bold">{filteredDocuments.length}</span> of {documents.length} document(s)
              </span>
              {(searchQuery.trim() || selectedCategory !== 'all') && (
                <button
                  id="btn-reset-filters"
                  onClick={() => {
                    triggerHaptic('light');
                    setSearchQuery('');
                    setSelectedCategory('all');
                  }}
                  className="text-[#818CF8] hover:underline font-medium text-[11px]"
                >
                  Reset filters
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {documents.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center space-y-3 p-8 text-center my-auto">
          <div className="w-14 h-14 rounded-2xl bg-[#1F2937] border border-[#374151] flex items-center justify-center text-[#6B7280] shadow-md">
            <FileText className="w-7 h-7" />
          </div>
          <p className="text-sm font-semibold text-white">No documents processed yet</p>
          <p className="text-xs text-[#9CA3AF] max-w-xs leading-relaxed">
            Any files you create, organize, merge, split, or compress will appear here for instant Android download and sharing.
          </p>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center space-y-3 p-6 text-center my-6 bg-[#161922] rounded-2xl border border-[#24272D]">
          <div className="w-12 h-12 rounded-xl bg-[#1F2937] flex items-center justify-center text-[#9CA3AF]">
            <Search className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-white">No matching documents</p>
            <p className="text-[11px] text-[#9CA3AF] mt-0.5">
              No files matched &ldquo;{searchQuery}&rdquo; {selectedCategory !== 'all' ? `in category ${selectedCategory.toUpperCase()}` : ''}
            </p>
          </div>
          <button
            id="btn-clear-search-empty-state"
            onClick={() => {
              triggerHaptic('light');
              setSearchQuery('');
              setSelectedCategory('all');
            }}
            className="px-3 py-1.5 rounded-full bg-[#4F46E5] text-white text-xs font-semibold hover:bg-[#4338CA] transition-all"
          >
            Clear Search
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 w-full">
          {filteredDocuments.map((doc) => {
            const extLabel = getDocTypeLabel(doc);
            const isSharing = sharingDocId === doc.id;

            return (
              <div
                key={doc.id}
                id={`recent-item-${doc.id}`}
                className="bg-[#1F2937] rounded-2xl border border-[#374151] p-3.5 shadow-md space-y-3 transition-all hover:border-[#4F46E5]/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <div className="w-9 h-9 rounded-xl bg-[#111827] border border-[#374151] text-[#818CF8] flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <h4 className="text-xs font-bold text-white truncate">{doc.title}</h4>
                      <div className="flex items-center gap-1.5 text-[10px] text-[#9CA3AF] mt-0.5">
                        <span className="font-semibold text-[#818CF8]">{extLabel}</span>
                        <span>•</span>
                        <span>{formatBytes(doc.fileSize)}</span>
                        <span>•</span>
                        <span>{doc.pageCount}p</span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5 text-[#6B7280]">
                          <Clock className="w-2.5 h-2.5" />
                          {new Date(doc.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${getActionBadgeColor(
                      doc.action
                    )}`}
                  >
                    {doc.action}
                  </span>
                </div>

                {/* Android Action buttons */}
                <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-[#374151]/60 text-xs">
                  <button
                    type="button"
                    id={`btn-preview-doc-${doc.id}`}
                    onClick={() => onPreview(doc.blob, doc.title)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#111827] hover:bg-[#253243] text-white text-[11px] font-semibold border border-[#374151] active:scale-95 transition-all"
                  >
                    <Eye className="w-3 h-3 text-[#818CF8]" />
                    <span>Preview</span>
                  </button>

                  {/* Web Share API Action Button */}
                  <button
                    type="button"
                    id={`btn-share-doc-${doc.id}`}
                    onClick={() => shareDoc(doc)}
                    disabled={isSharing}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-[11px] font-semibold border active:scale-95 transition-all ${
                      isSharing
                        ? 'bg-[#10B981]/20 border-[#10B981] text-[#10B981]'
                        : 'bg-[#111827] hover:bg-[#253243] border-[#374151] hover:border-[#10B981]/50'
                    }`}
                    title="Share with Android apps via Web Share API"
                  >
                    <Share2 className={`w-3 h-3 ${isSharing ? 'animate-spin text-[#10B981]' : 'text-[#10B981]'}`} />
                    <span>{isSharing ? 'Sharing...' : 'Share'}</span>
                  </button>

                  <button
                    type="button"
                    id={`btn-save-doc-${doc.id}`}
                    onClick={() => downloadDoc(doc)}
                    className="flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[11px] font-bold shadow-sm active:scale-95 transition-all"
                  >
                    <Download className="w-3 h-3" />
                    <span>Save</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
