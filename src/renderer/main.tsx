import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Permanently remove MathLive menu toggle and virtual keyboard toggle from all math-fields
if (typeof Element !== 'undefined') {
  const origAttachShadow = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (init: ShadowRootInit) {
    const shadow = origAttachShadow.call(this, init);
    if (this.tagName && this.tagName.toLowerCase() === 'math-field') {
      const style = document.createElement('style');
      style.setAttribute('data-hide-toggles', 'true');
      style.textContent = `
        .ML__toggles,
        .ML__menu-toggle,
        .ML__virtual-keyboard-toggle,
        [part="menu-toggle"],
        [part="virtual-keyboard-toggle"] {
          display: none !important;
          visibility: hidden !important;
          width: 0 !important;
          height: 0 !important;
          min-width: 0 !important;
          min-height: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }

        /* Prevent dark/opaque background box over parentheses, fractions, or roots */
        .ML__contains-highlight {
          display: none !important;
          background: transparent !important;
        }

        /* Delimiters (parentheses, brackets) keep normal formula text color */
        .ML__contains-caret.ML__close,
        .ML__contains-caret.ML__open,
        .ML__contains-caret > .ML__close,
        .ML__contains-caret > .ML__open {
          color: inherit !important;
          opacity: 1 !important;
        }

        .ML__smart-fence__close {
          color: inherit !important;
          opacity: 1 !important;
        }
      `;
      shadow.appendChild(style);
    }
    return shadow;
  };
}

// Ensure globally that math-field does not automatically convert any letter-based shortcuts (e.g. pi, delta, in, sin)
if (typeof window !== 'undefined' && window.customElements) {
  window.customElements.whenDefined('math-field').then(() => {
    const MathfieldElementClass = window.customElements.get('math-field') as any;
    if (MathfieldElementClass?.prototype) {
      const origConnected = MathfieldElementClass.prototype.connectedCallback;
      if (origConnected) {
        MathfieldElementClass.prototype.connectedCallback = function () {
          origConnected.apply(this, arguments);
          try {
            if (this.inlineShortcuts) {
              const current = this.inlineShortcuts;
              let hasLetterShortcut = false;
              const nonLetterShortcuts: Record<string, any> = {};
              for (const k of Object.keys(current)) {
                if (/[a-zA-Z]/.test(k)) {
                  hasLetterShortcut = true;
                } else {
                  nonLetterShortcuts[k] = current[k];
                }
              }
              if (hasLetterShortcut) {
                this.inlineShortcuts = nonLetterShortcuts;
              }
            }
            this.onInlineShortcut = () => '';
          } catch {
            // ignore
          }
        };
      }
    }
  });
}

window.addEventListener('error', (e) => {
  console.error('[Global Renderer Error]:', e.message, e.filename, e.lineno, e.error);
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('[Global Unhandled Rejection]:', e.reason);
});

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'monospace', color: '#b91c1c', background: '#fef2f2', height: '100vh', overflow: 'auto' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>Something went wrong while rendering Regne.</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem' }}>{this.state.error?.stack || this.state.error?.message}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}
