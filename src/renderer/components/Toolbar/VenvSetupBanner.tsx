import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, X } from 'lucide-react';
import { VenvSetupState } from '../../../preload';

export const VenvSetupBanner: React.FC = () => {
  const [setupState, setSetupState] = useState<VenvSetupState>({
    isSettingUp: false,
    message: '',
    error: null,
    venvPath: '',
    ready: false,
  });
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);

  useEffect(() => {
    const api = window.regneAPI || window.hypatiaAPI;
    if (!api?.casSympy?.getSetupStatus) return;

    // Fetch initial setup status
    api.casSympy.getSetupStatus().then((state) => {
      if (state) {
        setSetupState(state);
      }
    }).catch(() => {});

    // Subscribe to progress events
    if (api.casSympy.onSetupProgress) {
      const unsub = api.casSympy.onSetupProgress((state) => {
        setSetupState(state);
        if (state.isSettingUp || state.error) {
          setIsDismissed(false);
        }
      });
      return () => {
        unsub();
      };
    }
  }, []);

  if (isDismissed) return null;
  if (!setupState.isSettingUp && !setupState.error) return null;

  const handleRetry = async () => {
    const api = window.regneAPI || window.hypatiaAPI;
    if (!api?.casSympy?.reinstallVenv) return;

    setIsRetrying(true);
    try {
      await api.casSympy.reinstallVenv();
    } catch (err) {
      console.error('[VenvSetupBanner] Reinstall error:', err);
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div
      role="status"
      className={`w-full px-4 py-2 text-xs transition-all flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-chrome)] text-[var(--text-primary)]`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {setupState.error ? (
          <AlertCircle className="w-4 h-4 text-[var(--icon-clay)] shrink-0" />
        ) : (
          <RefreshCw className="w-3.5 h-3.5 text-[var(--icon-steel)] animate-spin shrink-0" />
        )}

        <div className="flex items-center gap-2 truncate">
          <span className="font-semibold tracking-tight">
            {setupState.error ? 'Math Solver Setup Failed' : 'Dedicated Math Engine Setup:'}
          </span>
          <span className="text-[11px] opacity-90 truncate">
            {setupState.error || setupState.message || 'Preparing Python CAS virtual environment...'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-3">
        {setupState.error && (
          <button
            type="button"
            onClick={handleRetry}
            disabled={isRetrying}
            className="px-2.5 py-1 text-[11px] font-medium rounded bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors disabled:cursor-not-allowed flex items-center gap-1"
          >
            {isRetrying && <RefreshCw className="w-3 h-3 animate-spin" />}
            <span>Retry Setup</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          title="Dismiss"
          aria-label="Dismiss banner"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
