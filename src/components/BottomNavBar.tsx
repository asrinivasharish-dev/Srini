import React, { useEffect, useRef } from 'react';
import { PlusCircle, LayoutGrid, Layers, Scissors, Minimize2, Home, FileType, Edit3, Shield } from 'lucide-react';
import { ActiveTab } from '../types';
import { triggerHaptic } from '../utils/haptics';

interface BottomNavBarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({ activeTab, onSelectTab }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);

  const tabs: { id: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: string }[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'organize', label: 'Organise', icon: LayoutGrid },
    { id: 'split', label: 'Split', icon: Scissors },
    { id: 'combine', label: 'Merge', icon: Layers },
    { id: 'compress', label: 'Compress', icon: Minimize2 },
    { id: 'convert', label: 'Convert', icon: FileType },
    { id: 'edit', label: 'OCR & Edit', icon: Edit3 },
    { id: 'create', label: 'Create', icon: PlusCircle },
    { id: 'security', label: 'Security', icon: Shield, badge: 'AES' },
  ];

  // Auto-scroll the active tab button into view when activeTab changes
  useEffect(() => {
    if (activeTabRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const element = activeTabRef.current;
      
      const containerRect = container.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();

      // Check if partially or completely out of visible container width
      if (elementRect.left < containerRect.left || elementRect.right > containerRect.right) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        });
      }
    }
  }, [activeTab]);

  return (
    <nav className="sticky bottom-0 z-30 bg-[#0B0D12]/95 backdrop-blur-xl border-t border-[#1F2430] py-1.5 sm:py-2 px-1 select-none">
      {/* Horizontally Scrollable Container with Centering on Wide Screens */}
      <div
        ref={scrollContainerRef}
        className="flex items-center sm:justify-center gap-1 overflow-x-auto no-scrollbar scroll-smooth px-1 py-0.5 max-w-5xl mx-auto"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              ref={isActive ? activeTabRef : undefined}
              id={`nav-tab-${tab.id}`}
              onClick={() => {
                triggerHaptic('light');
                onSelectTab(tab.id);
              }}
              className={`flex items-center gap-1.5 px-2 py-2 sm:py-2.5 rounded-xl shrink-0 transition-all duration-150 active:scale-95 group relative ${
                isActive
                  ? 'bg-gradient-to-r from-[#4F46E5] to-[#6366F1] text-white shadow-md shadow-indigo-600/30 font-semibold'
                  : 'bg-[#151922] hover:bg-[#1C222E] text-[#9CA3AF] hover:text-white border border-[#232A38]/60'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-3.5 h-3.5 transition-transform duration-150 ${
                    isActive ? 'scale-105 text-white' : 'text-[#8F9CAE] group-hover:text-white'
                  }`}
                />
                {tab.badge && !isActive && (
                  <span className="absolute -top-1 -right-1.5 text-[6.5px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-full px-0.5 py-0 leading-tight">
                    {tab.badge}
                  </span>
                )}
              </div>

              <span
                className={`text-[11px] leading-tight whitespace-nowrap tracking-tight transition-colors ${
                  isActive ? 'text-white font-semibold' : 'text-[#9CA3AF] group-hover:text-white font-medium'
                }`}
              >
                {tab.label}
              </span>

              {isActive && (
                <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse ml-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

