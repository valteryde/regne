import React, { useState, useEffect } from 'react';
import { EngineProvider } from './context/EngineContext';
import { DocumentProvider } from './context/DocumentContext';
import { ThemeProvider } from './context/ThemeContext';
import { SourcePage } from './components/SourcePage/SourcePage';
import { SettingsModal } from './components/Dialogs/SettingsModal';
import { UpdateNotification } from './components/Updater/UpdateNotification';
import { DocumentHeader } from './components/Header/DocumentHeader';
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
      <DocumentHeader label={label} onOpenSettings={() => setIsSettingsOpen(true)} />

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
