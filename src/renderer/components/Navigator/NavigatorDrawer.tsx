import React, { useState, useMemo } from 'react';
import { useDocument } from '../../context/DocumentContext';
import { computeOutline, OutlineItem } from '../../utils/outline';
import {
  ListTree,
  Search,
  Plus,
  ChevronDown,
  ChevronRight,
  Trash2,
} from 'lucide-react';
import { SectionKind } from '../../../types/document';

export const NavigatorDrawer: React.FC = () => {
  const {
    document: doc,
    activeElementId,
    insertSection,
    toggleSectionCollapse,
    scrollToElement,
    deleteElement,
  } = useDocument();

  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isOutlineOpen, setIsOutlineOpen] = useState(true);

  // Compute outline items from elements
  const outlineItems = useMemo(() => computeOutline(doc.elements), [doc.elements]);

  // Filter outline items by search query
  const filteredOutline = useMemo(() => {
    if (!searchTerm.trim()) return outlineItems;
    const q = searchTerm.toLowerCase();
    return outlineItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.numberLabel.toLowerCase().includes(q) ||
        item.displayLabel.toLowerCase().includes(q)
    );
  }, [outlineItems, searchTerm]);

  // Derive active section (either the active element itself if it is a section, or the enclosing section)
  const activeSectionId = useMemo(() => {
    if (!activeElementId) return outlineItems[0]?.id || null;
    // Check if active element is directly an outline section
    const direct = outlineItems.find((item) => item.id === activeElementId);
    if (direct) return direct.id;

    // Find the enclosing section before activeElementId
    const activeIdx = doc.elements.findIndex((e) => e.id === activeElementId);
    if (activeIdx === -1) return null;

    for (let i = activeIdx; i >= 0; i--) {
      if (doc.elements[i].type === 'section') {
        return doc.elements[i].id;
      }
    }
    return outlineItems[0]?.id || null;
  }, [activeElementId, outlineItems, doc.elements]);

  const handleAddSection = (level: 1 | 2 | 3 = 1, kind: SectionKind = 'section') => {
    const newId = insertSection(level, activeElementId || undefined, kind, '');
    scrollToElement(newId);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 select-none overflow-hidden bg-[var(--bg-chrome)] transition-colors">
      {/* ========================================================================= */}
      {/* Header: NAVIGATOR (with Search)                                           */}
      {/* ========================================================================= */}
      <div className="px-3 py-2 border-b border-[var(--border-color)] bg-[var(--bg-chrome)] flex items-center justify-between">
        <span className="text-xs font-bold tracking-wider text-[var(--text-secondary)] uppercase">
          Navigator
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsSearchOpen((v) => !v)}
            className={`p-1 rounded transition-colors cursor-pointer ${
              isSearchOpen || searchTerm
                ? 'bg-[var(--bg-subtle)] text-[#242e84]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
            }`}
            title="Search outline"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Expandable Quick Search Input */}
      {isSearchOpen && (
        <div className="p-2 border-b border-[var(--border-color)] bg-[var(--bg-surface)]">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-[var(--text-muted)]" />
            <input
              type="text"
              autoFocus
              placeholder="Filter sections..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-7 pr-2 py-1 text-xs bg-[var(--bg-subtle)]/60 rounded border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#242e84]"
            />
          </div>
        </div>
      )}

      {/* Main Navigator Body */}
      <div className="flex-1 overflow-y-auto">
        {/* ========================================================================= */}
        {/* Document Outline                                                          */}
        {/* ========================================================================= */}
        <div className="py-2">
          {/* Section Header */}
          <div className="px-3 py-1 flex items-center justify-between group">
            <button
              type="button"
              onClick={() => setIsOutlineOpen((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#242e84] hover:text-[#1a2266] transition-colors cursor-pointer select-none"
            >
              <ListTree className="w-3.5 h-3.5" />
              <span>Document Outline</span>
            </button>
            <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
              <button
                type="button"
                onClick={() => handleAddSection(1, 'section')}
                className="p-0.5 rounded text-[var(--text-muted)] hover:text-[#242e84] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
                title="Add Section"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsOutlineOpen((v) => !v)}
                className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                {isOutlineOpen ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Outline Items List */}
          {isOutlineOpen && (
            <div className="mt-1 space-y-0.5 px-1.5">
              {filteredOutline.length === 0 ? (
                <div className="px-3 py-3 text-xs text-[var(--text-muted)] italic text-center">
                  {searchTerm ? 'No matching sections' : 'No sections yet. Click + to add one.'}
                </div>
              ) : (
                filteredOutline.map((item) => {
                  const isActive = activeSectionId === item.id;
                  const isTheorem = item.kind === 'theorem';
                  const isLemma = item.kind === 'lemma';

                  return (
                    <div
                      key={item.id}
                      onClick={() => scrollToElement(item.id)}
                      className={`group/item flex items-center justify-between py-1 px-2 rounded-[3px] text-xs cursor-pointer transition-colors ${
                        item.level === 1
                          ? 'font-medium'
                          : item.level === 2
                          ? 'pl-5'
                          : 'pl-8 text-[11px]'
                      } ${
                        isActive
                          ? 'text-[#242e84] bg-blue-100/60 font-semibold'
                          : 'text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        {item.elementCount > 0 && (
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSectionCollapse(item.id);
                            }}
                            className="w-3.5 h-3.5 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0"
                            title={item.collapsed ? 'Expand section' : 'Collapse section'}
                          >
                            {item.collapsed ? (
                              <ChevronRight className="w-3 h-3 text-[#242e84]" />
                            ) : (
                              <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
                            )}
                          </button>
                        )}
                        <span
                          className={`truncate ${
                            isTheorem
                              ? 'text-[#242e84] font-medium'
                              : isLemma
                              ? 'text-indigo-700 font-medium'
                              : ''
                          }`}
                        >
                          {item.displayLabel}
                        </span>
                      </div>

                      {/* Right hover actions */}
                      <div className="hidden group-hover/item:flex items-center gap-1 shrink-0 ml-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddSection(
                              (Math.min(3, item.level + 1) as 1 | 2 | 3),
                              item.level === 1 ? 'subsection' : 'subsubsection'
                            );
                          }}
                          className="p-0.5 rounded text-[var(--text-muted)] hover:text-[#242e84] hover:bg-white/80"
                          title="Add subsection"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteElement(item.id);
                          }}
                          className="p-0.5 rounded text-[var(--text-muted)] hover:text-red-600 hover:bg-white/80"
                          title="Delete section"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Bar: Quick Add Section & Document Stats */}
      <div className="p-2 border-t border-[var(--border-color)] bg-[var(--bg-chrome)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
        <span>{outlineItems.length} {outlineItems.length === 1 ? 'section' : 'sections'}</span>
        <button
          type="button"
          onClick={() => handleAddSection(1, 'section')}
          className="flex items-center gap-1 text-xs font-semibold text-[#242e84] hover:text-[#1a2266] px-1.5 py-0.5 rounded hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
        >
          <Plus className="w-3 h-3" />
          <span>Section</span>
        </button>
      </div>
    </div>
  );
};
