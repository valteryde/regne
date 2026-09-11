import React, { useState, useEffect, useRef } from 'react';
import { EngineProvider } from './context/EngineContext';
import { DocumentProvider, useDocument } from './context/DocumentContext';
import { ThemeProvider } from './context/ThemeContext';
import { Toolbar } from './components/Toolbar/Toolbar';
import { SidebarDrawer, SidebarTab } from './components/Sidebar/SidebarDrawer';
import { MathDocument } from './components/Document/MathDocument';
import { DocumentRuler } from './components/Ruler/DocumentRuler';
import { ExportModal } from './components/Dialogs/ExportModal';
import { SettingsModal } from './components/Dialogs/SettingsModal';

const MainLayout: React.FC = () => {
  const { isRulerVisible, rulerPosition } = useDocument();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>('outline');
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const documentScrollRef = useRef<HTMLDivElement | null>(null);

  // Keyboard shortcut: Cmd+, or Ctrl+, opens Settings
  // Cmd+B / Ctrl+B toggles sidebar collapse/expand
  // Cmd+Shift+O opens/toggles Outline
  // Cmd+P / Ctrl+P opens/toggles Palettes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setIsSettingsOpen(true);
      } else if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsSidebarCollapsed((prev) => !prev);
      } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        setIsSidebarCollapsed((prev) => {
          if (prev) {
            setActiveSidebarTab('outline');
            return false;
          }
          if (activeSidebarTab !== 'outline') {
            setActiveSidebarTab('outline');
            return false;
          }
          return true;
        });
      } else if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setIsSidebarCollapsed((prev) => {
          if (prev) {
            setActiveSidebarTab('palettes');
            return false;
          }
          if (activeSidebarTab !== 'palettes') {
            setActiveSidebarTab('palettes');
            return false;
          }
          return true;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSidebarTab]);

  // Listen to native menu command
  useEffect(() => {
    const api = (window as any).regneAPI || (window as any).hypatiaAPI;
    if (api?.onMenuCommand) {
      return api.onMenuCommand((cmd: string) => {
        if (cmd === 'open-settings') {
          setIsSettingsOpen(true);
        } else if (cmd === 'toggle-palette' || cmd === 'toggle-sidebar') {
          setIsSidebarCollapsed((prev) => !prev);
        }
      });
    }
  }, []);

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((prev) => !prev);
  };

  const handleToggleOutline = () => {
    if (isSidebarCollapsed) {
      setIsSidebarCollapsed(false);
      setActiveSidebarTab('outline');
    } else if (activeSidebarTab === 'outline') {
      setIsSidebarCollapsed(true);
    } else {
      setActiveSidebarTab('outline');
    }
  };

  const handleTogglePalettes = () => {
    if (isSidebarCollapsed) {
      setIsSidebarCollapsed(false);
      setActiveSidebarTab('palettes');
    } else if (activeSidebarTab === 'palettes') {
      setIsSidebarCollapsed(true);
    } else {
      setActiveSidebarTab('palettes');
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--bg-canvas)] font-sans text-[var(--text-primary)] transition-colors">
      {/* Ribbon Toolbar */}
      <Toolbar
        sidebarOpen={!isSidebarCollapsed}
        activeSidebarTab={activeSidebarTab}
        onToggleSidebar={handleToggleSidebar}
        onToggleOutline={handleToggleOutline}
        onTogglePalettes={handleTogglePalettes}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onOpenSettingsModal={() => setIsSettingsOpen(true)}
      />

      {/* Main Document Workspace */}
      <div className="flex-1 flex overflow-hidden bg-[var(--bg-canvas)]">
        <SidebarDrawer
          activeTab={activeSidebarTab}
          isCollapsed={isSidebarCollapsed}
          onTabChange={(tab) => setActiveSidebarTab(tab)}
          onToggleCollapse={handleToggleSidebar}
        />

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-[var(--bg-canvas)]">
          {isRulerVisible && rulerPosition === 'top' && (
            <DocumentRuler scrollRef={documentScrollRef} />
          )}

          <MathDocument containerRef={documentScrollRef} />

          {isRulerVisible && rulerPosition === 'bottom' && (
            <DocumentRuler scrollRef={documentScrollRef} />
          )}
        </main>
      </div>

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <EngineProvider>
        <DocumentProvider>
          <MainLayout />
        </DocumentProvider>
      </EngineProvider>
    </ThemeProvider>
  );
};

export default App;
