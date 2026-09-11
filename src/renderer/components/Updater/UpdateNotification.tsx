import React, { useState, useEffect, useRef } from 'react';
import {
  Download,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  X,
  Sparkles,
  ArrowDownToLine,
  RotateCcw,
} from 'lucide-react';
import { UpdaterState, UpdateProgress } from '../../preload';

export const UpdateNotification: React.FC = () => {
  const [updaterState, setUpdaterState] = useState<UpdaterState>({
    status: 'idle',
    info: null,
    progress: null,
    error: null,
  });
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const dismissTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const api = window.regneAPI || window.hypatiaAPI;
    if (!api?.updater) return;

    // Fetch initial state
    api.updater.getState().then((state) => {
      if (state) {
        setUpdaterState(state);
      }
    }).catch((err) => {
      console.warn('[Updater UI] Could not get initial state:', err);
    });

    // Subscribe to status changes
    const unsubStatus = api.updater.onStatusChange((newState) => {
      setUpdaterState(newState);
      setIsDismissed(false);

      if (newState.status === 'not-available') {
        if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = setTimeout(() => {
          setIsDismissed(true);
        }, 4000);
      }
    });

    // Subscribe to download progress
    const unsubProgress = api.updater.onDownloadProgress((progress) => {
      setUpdaterState((prev) => ({
        ...prev,
        status: 'downloading',
        progress,
      }));
      setIsDismissed(false);
    });

    return () => {
      unsubStatus?.();
      unsubProgress?.();
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  if (isDismissed || updaterState.status === 'idle') {
    return null;
  }

  const formatMB = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '0.0';
    return (bytes / (1024 * 1024)).toFixed(1);
  };

  const formatSpeed = (bytesPerSec?: number) => {
    if (!bytesPerSec || bytesPerSec <= 0) return '0 KB/s';
    if (bytesPerSec > 1024 * 1024) {
      return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
    }
    return `${Math.round(bytesPerSec / 1024)} KB/s`;
  };

  const handleDownload = () => {
    const api = window.regneAPI || window.hypatiaAPI;
    api?.updater.downloadUpdate().catch((err) => {
      console.error('[Updater UI] Download error:', err);
    });
  };

  const handleInstall = () => {
    const api = window.regneAPI || window.hypatiaAPI;
    api?.updater.installUpdate().catch((err) => {
      console.error('[Updater UI] Install error:', err);
    });
  };

  const handleRetry = () => {
    const api = window.regneAPI || window.hypatiaAPI;
    api?.updater.checkForUpdates().catch((err) => {
      console.error('[Updater UI] Check error:', err);
    });
  };

  // 1. Checking State
  if (updaterState.status === 'checking') {
    return (
      <div className="fixed bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
        <div className="flex items-center gap-2.5 px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg shadow-lg text-xs text-[var(--text-secondary)]">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#242e84]" />
          <span>Checking for updates...</span>
        </div>
      </div>
    );
  }

  // 2. Up to date (Not Available)
  if (updaterState.status === 'not-available') {
    return (
      <div className="fixed bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
        <div className="flex items-center gap-2.5 px-3.5 py-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg shadow-lg text-xs text-[var(--text-primary)]">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Regne is up to date ({updaterState.info?.version || 'Latest'})</span>
          <button
            onClick={() => setIsDismissed(true)}
            className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors ml-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // 3. Update Available
  if (updaterState.status === 'available') {
    return (
      <div className="fixed bottom-4 right-4 z-50 w-84 max-w-[calc(100vw-2rem)] animate-in fade-in slide-in-from-bottom-2 duration-200">
        <div className="bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg shadow-xl overflow-hidden">
          <div className="p-3.5 flex items-start gap-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-lg text-[#242e84] shrink-0">
              <ArrowDownToLine className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <h4 className="text-xs font-semibold text-[var(--text-primary)] truncate">
                  Update Available
                </h4>
                <button
                  onClick={() => setIsDismissed(true)}
                  className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Regne <span className="font-semibold text-[var(--text-primary)]">v{updaterState.info?.version}</span> is available to download.
              </p>

              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={handleDownload}
                  className="flex-1 px-3 py-1.5 bg-[#242e84] hover:bg-[#1a2266] text-white rounded text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Update</span>
                </button>
                <button
                  onClick={() => setIsDismissed(true)}
                  className="px-2.5 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] rounded transition-colors cursor-pointer"
                >
                  Later
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 4. Downloading State with Progress Bar
  if (updaterState.status === 'downloading') {
    const percent = Math.min(Math.max(updaterState.progress?.percent ?? 0, 0), 100);
    const transferred = updaterState.progress?.transferred ?? 0;
    const total = updaterState.progress?.total ?? 0;
    const bytesPerSec = updaterState.progress?.bytesPerSecond ?? 0;

    return (
      <div className="fixed bottom-4 right-4 z-50 w-88 max-w-[calc(100vw-2rem)] animate-in fade-in slide-in-from-bottom-2 duration-200">
        <div className="bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg shadow-xl p-3.5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-[#242e84] animate-pulse" />
              <span className="text-xs font-semibold text-[var(--text-primary)]">
                Downloading Regne v{updaterState.info?.version || ''}
              </span>
            </div>
            <span className="text-xs font-mono font-medium text-[#242e84]">
              {Math.round(percent)}%
            </span>
          </div>

          {/* Progress Bar Track */}
          <div className="w-full h-2 bg-[var(--bg-subtle)] rounded-full overflow-hidden relative mb-2">
            <div
              className="h-full bg-[#242e84] rounded-full transition-all duration-300 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>

          {/* Statistics */}
          <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
            <span>
              {formatMB(transferred)} MB {total > 0 ? `of ${formatMB(total)} MB` : ''}
            </span>
            <span>{formatSpeed(bytesPerSec)}</span>
          </div>
        </div>
      </div>
    );
  }

  // 5. Downloaded / Ready to Install
  if (updaterState.status === 'downloaded') {
    return (
      <div className="fixed bottom-4 right-4 z-50 w-84 max-w-[calc(100vw-2rem)] animate-in fade-in slide-in-from-bottom-2 duration-200">
        <div className="bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg shadow-xl overflow-hidden">
          <div className="p-3.5 flex items-start gap-3">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg text-emerald-600 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <h4 className="text-xs font-semibold text-[var(--text-primary)] truncate">
                  Update Ready
                </h4>
                <button
                  onClick={() => setIsDismissed(true)}
                  className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Regne <span className="font-semibold text-[var(--text-primary)]">v{updaterState.info?.version}</span> is ready to install.
              </p>

              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={handleInstall}
                  className="flex-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restart & Install</span>
                </button>
                <button
                  onClick={() => setIsDismissed(true)}
                  className="px-2.5 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] rounded transition-colors cursor-pointer"
                >
                  Later
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 6. Error State
  if (updaterState.status === 'error') {
    return (
      <div className="fixed bottom-4 right-4 z-50 w-88 max-w-[calc(100vw-2rem)] animate-in fade-in slide-in-from-bottom-2 duration-200">
        <div className="bg-[var(--bg-surface)] text-[var(--text-primary)] border border-rose-200 dark:border-rose-900/50 rounded-lg shadow-xl p-3.5">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <h4 className="text-xs font-semibold text-rose-600 dark:text-rose-400 truncate">
                  Update Check Failed
                </h4>
                <button
                  onClick={() => setIsDismissed(true)}
                  className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] mt-1 line-clamp-2">
                {updaterState.error || 'Could not connect to update server.'}
              </p>
              <div className="flex items-center gap-2 mt-2.5">
                <button
                  onClick={handleRetry}
                  className="px-2.5 py-1 bg-[var(--bg-subtle)] hover:bg-[var(--bg-chrome)] text-[var(--text-primary)] rounded text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry</span>
                </button>
                <button
                  onClick={() => setIsDismissed(true)}
                  className="px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default UpdateNotification;
