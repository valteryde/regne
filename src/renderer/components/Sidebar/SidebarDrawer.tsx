import React from 'react';
import { ListTree, Calculator, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { NavigatorDrawer } from '../Navigator/NavigatorDrawer';
import { PaletteDrawer } from '../Palettes/PaletteDrawer';

export type SidebarTab = 'outline' | 'palettes';

interface SidebarDrawerProps {
  activeTab: SidebarTab;
  isCollapsed: boolean;
  onTabChange: (tab: SidebarTab) => void;
  onToggleCollapse: () => void;
}

export const SidebarDrawer: React.FC<SidebarDrawerProps> = ({
  activeTab,
  isCollapsed,
  onTabChange,
  onToggleCollapse,
}) => {
  return (
    <aside
      className={`${
        isCollapsed ? 'w-11' : 'w-64'
      } bg-[var(--bg-chrome)] border-r border-[var(--border-color)] border-l-2 border-l-[#242e84] flex flex-col shrink-0 select-none overflow-hidden h-full transition-all duration-200 ease-in-out`}
    >
      {/* ========================================================================= */}
      {/* Top Header: Segmented Tabs + Collapse Button OR Centered Expand Button    */}
      {/* ========================================================================= */}
      {isCollapsed ? (
        <div className="h-9 w-full bg-[var(--bg-chrome)] border-b border-[var(--border-color)] flex items-center justify-center shrink-0 select-none">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-1.5 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
            title="Expand Left Bar (Cmd+B)"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="h-9 px-2 bg-[var(--bg-chrome)] border-b border-[var(--border-color)] flex items-center justify-between shrink-0 select-none">
          {/* Segmented Switch */}
          <div className="inline-flex h-6 bg-[var(--bg-subtle)]/70 p-0.5 rounded-[4px] text-xs items-center">
            <button
              type="button"
              onClick={() => onTabChange('outline')}
              className={`h-full px-2.5 flex items-center gap-1.5 rounded-[3px] text-[11px] transition-all cursor-pointer ${
                activeTab === 'outline'
                  ? 'bg-white text-[#242e84] font-semibold shadow-2xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium'
              }`}
              title="Document Outline & Table of Contents (Cmd+Shift+O)"
            >
              <ListTree className="w-3 h-3" />
              <span>Outline</span>
            </button>
            <button
              type="button"
              onClick={() => onTabChange('palettes')}
              className={`h-full px-2.5 flex items-center gap-1.5 rounded-[3px] text-[11px] transition-all cursor-pointer ${
                activeTab === 'palettes'
                  ? 'bg-white text-[#242e84] font-semibold shadow-2xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium'
              }`}
              title="Mathematical Symbol Palettes (Cmd+P)"
            >
              <Calculator className="w-3 h-3" />
              <span>Palettes</span>
            </button>
          </div>

          {/* Collapse Button */}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
            title="Collapse Left Bar (Cmd+B)"
          >
            <PanelLeftClose className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Tab Panel Content: Navigator or Palettes (Expanded) / Icon Rail (Collapsed)*/}
      {/* ========================================================================= */}
      {isCollapsed ? (
        <div className="flex-1 w-full flex flex-col items-center py-2 gap-1.5 overflow-hidden">
          <button
            type="button"
            onClick={() => {
              onTabChange('outline');
              onToggleCollapse();
            }}
            className={`w-7.5 h-7.5 rounded-[4px] flex items-center justify-center transition-all cursor-pointer ${
              activeTab === 'outline'
                ? 'bg-white text-[#242e84] shadow-xs font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
            }`}
            title="Document Outline (Cmd+Shift+O)"
          >
            <ListTree className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              onTabChange('palettes');
              onToggleCollapse();
            }}
            className={`w-7.5 h-7.5 rounded-[4px] flex items-center justify-center transition-all cursor-pointer ${
              activeTab === 'palettes'
                ? 'bg-white text-[#242e84] shadow-xs font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
            }`}
            title="Mathematical Symbol Palettes (Cmd+P)"
          >
            <Calculator className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {activeTab === 'outline' ? (
            <NavigatorDrawer />
          ) : (
            <PaletteDrawer />
          )}
        </div>
      )}
    </aside>
  );
};
