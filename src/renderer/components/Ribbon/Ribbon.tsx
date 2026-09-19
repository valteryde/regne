import React, { useState, useRef, useEffect } from 'react';
import { useDocument } from '../../context/DocumentContext';
import { useEngine } from '../../context/EngineContext';
import { RegneMascot } from '../Brand/RegneMascot';
import { MainRibbon } from './MainRibbon';
import { EquationRibbon } from './EquationRibbon';
import { TheoremsRibbon } from './TheoremsRibbon';
import { SymbolsRibbon } from './SymbolsRibbon';
import { LayoutRibbon } from './LayoutRibbon';
import { ReviewRibbon } from './ReviewRibbon';
import {
  Settings,
  ChevronUp,
  ChevronDown,
  PanelLeft,
} from 'lucide-react';

export type RibbonTab =
  | 'main'
  | 'equation'
  | 'theorems'
  | 'symbols'
  | 'layout'
  | 'review';

export interface RibbonProps {
  sidebarOpen: boolean;
  activeSidebarTab: 'outline' | 'palettes';
  onToggleSidebar?: () => void;
  onToggleOutline?: () => void;
  onTogglePalettes: () => void;
  onOpenExportModal: () => void;
  onOpenSettingsModal: () => void;
}

export const Ribbon: React.FC<RibbonProps> = ({
  sidebarOpen,
  activeSidebarTab,
  onToggleSidebar,
  onToggleOutline,
  onTogglePalettes,
  onOpenExportModal,
  onOpenSettingsModal,
}) => {
  const {
    document: doc,
    newDocument,
    saveDocument,
    openDocument,
    undo,
    redo,
    canUndo,
    canRedo,
    evaluateAll,
  } = useDocument();

  const { reset } = useEngine();

  const [activeTab, setActiveTab] = useState<RibbonTab>('main');
  const [isRibbonCollapsed, setIsRibbonCollapsed] = useState<boolean>(false);

  // Top Menu Bar dropdown menus
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenu) return;
    const handleDown = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handleDown);
    return () => document.removeEventListener('mousedown', handleDown);
  }, [openMenu]);

  const isAnyEvaluating = doc.elements.some((el) => el.type === 'math' && el.isEvaluating);

  const tabs: { id: RibbonTab; shortLabel: string; fullLabel: string }[] = [
    { id: 'main', shortLabel: 'MAIN', fullLabel: 'MAIN' },
    { id: 'equation', shortLabel: 'EQUATION', fullLabel: 'EQUATION' },
    { id: 'theorems', shortLabel: 'THEOREMS', fullLabel: 'THEOREMS & PROOFS' },
    { id: 'symbols', shortLabel: 'SYMBOLS', fullLabel: 'SYMBOLS & PALETTE' },
    { id: 'layout', shortLabel: 'LAYOUT', fullLabel: 'DOCUMENT LAYOUT' },
    { id: 'review', shortLabel: 'REVIEW', fullLabel: 'REVIEW & SYNC' },
  ];

  return (
    <header className="flex flex-col select-none shrink-0 bg-white border-b border-[#e5e7eb] shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition-colors relative z-30">
      {/* ========================================================================= */}
      {/* SINGLE UNIFIED TOP BAR: Brand, File Menu, Ribbon Tabs, Title & Controls  */}
      {/* ========================================================================= */}
      <div
        ref={menuBarRef}
        className="h-8 bg-white text-slate-800 flex items-center justify-between px-3 border-b border-[#e5e7eb] text-xs relative select-none"
      >
        {/* Left: Mascot, File Dropdown, and Ribbon Tabs */}
        <div className="flex items-center gap-1.5 h-full shrink-0">
          <RegneMascot size={20} className="mr-1 shrink-0" isEvaluating={isAnyEvaluating} />

          {/* FILE MENU */}
          <div className="relative h-full flex items-center">
            <button
              type="button"
              onClick={() => setOpenMenu(openMenu === 'file' ? null : 'file')}
              className={`h-6 px-2 flex items-center gap-1 text-[11px] font-semibold rounded hover:bg-slate-100 transition-colors cursor-pointer ${
                openMenu === 'file' ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-700'
              }`}
            >
              <span>File</span>
              <ChevronDown className="w-2.5 h-2.5 opacity-60 ml-0.5" />
            </button>

            {openMenu === 'file' && (
              <div className="absolute left-0 top-full mt-1 w-52 bg-white rounded-md shadow-xl border border-slate-200 py-1 z-50 text-xs select-none animate-in fade-in zoom-in-95 duration-100">
                <button
                  onClick={() => {
                    newDocument();
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 text-left text-slate-700"
                >
                  <span>New Document</span>
                  <span className="text-slate-400 text-[10px] font-mono">⌘N</span>
                </button>
                <button
                  onClick={() => {
                    openDocument();
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 text-left text-slate-700"
                >
                  <span>Open Document...</span>
                  <span className="text-slate-400 text-[10px] font-mono">⌘O</span>
                </button>
                <div className="h-px bg-slate-100 my-1" />
                <button
                  onClick={() => {
                    saveDocument(false);
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 text-left text-slate-700"
                >
                  <span>Save</span>
                  <span className="text-slate-400 text-[10px] font-mono">⌘S</span>
                </button>
                <button
                  onClick={() => {
                    saveDocument(true);
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 text-left text-slate-700"
                >
                  <span>Save As...</span>
                  <span className="text-slate-400 text-[10px] font-mono">⇧⌘S</span>
                </button>
                <button
                  onClick={() => {
                    onOpenExportModal();
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 text-left text-slate-700"
                >
                  <span>Export LaTeX / HTML...</span>
                </button>
                <div className="h-px bg-slate-100 my-1" />
                <button
                  disabled={!canUndo}
                  onClick={() => {
                    undo();
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed text-left text-slate-700"
                >
                  <span>Undo</span>
                  <span className="text-slate-400 text-[10px] font-mono">⌘Z</span>
                </button>
                <button
                  disabled={!canRedo}
                  onClick={() => {
                    redo();
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed text-left text-slate-700"
                >
                  <span>Redo</span>
                  <span className="text-slate-400 text-[10px] font-mono">⇧⌘Z</span>
                </button>
                <div className="h-px bg-slate-100 my-1" />
                <button
                  onClick={() => {
                    evaluateAll();
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 text-left text-slate-700"
                >
                  <span>Evaluate All Expressions</span>
                  <span className="text-slate-400 text-[10px] font-mono">⇧⌘Enter</span>
                </button>
                <button
                  onClick={() => {
                    reset();
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 text-left text-slate-700"
                >
                  <span>Restart Engine Session</span>
                  <span className="text-slate-400 text-[10px] font-mono">restart;</span>
                </button>
                <div className="h-px bg-slate-100 my-1" />
                <button
                  onClick={() => {
                    onOpenSettingsModal();
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 text-left text-slate-700"
                >
                  <span>Preferences...</span>
                  <span className="text-slate-400 text-[10px] font-mono">⌘,</span>
                </button>
              </div>
            )}
          </div>

          {/* Subtle divider */}
          <div className="h-3.5 w-px bg-slate-200 mx-0.5 shrink-0" />

          {/* Ribbon Category Tabs */}
          <nav className="flex items-center gap-0.5 h-full">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id && !isRibbonCollapsed;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    if (activeTab === tab.id && !isRibbonCollapsed) {
                      // Click active tab keeps it open
                    } else {
                      setActiveTab(tab.id);
                      setIsRibbonCollapsed(false);
                    }
                    setOpenMenu(null);
                  }}
                  className={`h-full px-2.5 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer relative flex items-center shrink-0 ${
                    isActive
                      ? 'text-[#242e84] bg-slate-50/80 border-b-2 border-b-[#242e84] font-extrabold -mb-[1px]'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/70 font-semibold'
                  }`}
                >
                  <span className="hidden xl:inline">{tab.fullLabel}</span>
                  <span className="inline xl:hidden">{tab.shortLabel}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right: Settings & Collapse */}
        <div className="flex items-center gap-1 shrink-0">

          <button
            type="button"
            onClick={onOpenSettingsModal}
            className="h-6 w-6 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer"
            title="Settings (Cmd+,)"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsRibbonCollapsed((v) => !v)}
            className="h-6 w-6 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors cursor-pointer"
            title={isRibbonCollapsed ? 'Expand Ribbon Toolbar' : 'Collapse Ribbon Toolbar'}
          >
            {isRibbonCollapsed ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ACTIVE RIBBON CONTENT PANEL (Hidden when collapsed)                      */}
      {/* ========================================================================= */}
      {!isRibbonCollapsed && (
        <div className="bg-white transition-all duration-150 animate-in fade-in slide-in-from-top-1 overflow-visible">
          {activeTab === 'main' && <MainRibbon />}
          {activeTab === 'equation' && <EquationRibbon />}
          {activeTab === 'theorems' && <TheoremsRibbon />}
          {activeTab === 'symbols' && (
            <SymbolsRibbon
              onTogglePalettes={onTogglePalettes}
              isPalettesOpen={sidebarOpen && activeSidebarTab === 'palettes'}
            />
          )}
          {activeTab === 'layout' && <LayoutRibbon />}
          {activeTab === 'review' && <ReviewRibbon />}
        </div>
      )}
    </header>
  );
};
