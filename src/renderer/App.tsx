import React, { useState, useEffect } from 'react';
import { EngineProvider } from './context/EngineContext';
import { DocumentProvider } from './context/DocumentContext';
import { ThemeProvider } from './context/ThemeContext';
import { SourcePage } from './components/SourcePage/SourcePage';
import { SettingsModal } from './components/Dialogs/SettingsModal';
import { UpdateNotification } from './components/Updater/UpdateNotification';
import { VenvSetupBanner } from './components/Toolbar/VenvSetupBanner';
import { useSourceLabel } from './sourceCommands';

const MainLayout: React.FC = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const label = useSourceLabel();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === ',') {
        event.preventDefault();
        setIsSettingsOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const api = (window as any).regneAPI || (window as any).hypatiaAPI;
    if (api?.onMenuCommand) {
      return api.onMenuCommand((cmd: string) => {
        if (cmd === 'open-settings') setIsSettingsOpen(true);
      });
    }
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--bg-canvas)] font-sans text-[var(--text-primary)]">
      <header className="flex items-center justify-between h-10 px-4 border-b border-[var(--border-color)] bg-[var(--bg-canvas)] shrink-0">
        <span className="text-sm truncate">{label?.title || "Regne"}</span>
        <button
          type="button"
          className="text-sm px-2 py-1"
          onClick={() => setIsSettingsOpen(true)}
        >
          Settings
        </button>
      </header>

      <VenvSetupBanner />

      <main className="flex-1 flex min-h-0 min-w-0 overflow-hidden">
        <SourcePage />
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <UpdateNotification />
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
