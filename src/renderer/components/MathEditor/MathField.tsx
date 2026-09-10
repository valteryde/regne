import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import 'mathlive';
import type { MathfieldElement } from 'mathlive';

export interface MathFieldHandle {
  insert: (snippet: string) => void;
  focus: (atEnd?: boolean) => void;
  getValue: () => string;
}

interface MathFieldProps {
  value: string;
  onChange?: (val: string) => void;
  onEvaluate?: () => void;
  onDelete?: () => void;
  onFocus?: () => void;
  onNavigateUp?: () => void;
  onNavigateDown?: () => void;
  readOnly?: boolean;
  color?: string;
  fontSize?: string;
  className?: string;
  placeholder?: string;
}

export const MathField = forwardRef<MathFieldHandle, MathFieldProps>(
  (
    {
      value,
      onChange,
      onEvaluate,
      onDelete,
      onFocus,
      onNavigateUp,
      onNavigateDown,
      readOnly = false,
      color,
      fontSize = '1.25rem',
      className = '',
      placeholder,
    },
    ref
  ) => {
    const mfRef = useRef<MathfieldElement | null>(null);

    useImperativeHandle(ref, () => ({
      insert: (snippet: string) => {
        const mf = mfRef.current;
        if (mf) {
          mf.executeCommand(['insert', snippet]);
          mf.focus();
        }
      },
      focus: (atEnd = false) => {
        const mf = mfRef.current;
        if (mf) {
          mf.focus();
          const cmd = atEnd ? 'moveToMathfieldEnd' : 'moveToMathfieldStart';
          try {
            mf.executeCommand(cmd);
          } catch {
            // fallback
          }
          requestAnimationFrame(() => {
            if (mf) {
              mf.focus();
              try {
                mf.executeCommand(cmd);
              } catch {
                // fallback
              }
            }
          });
        }
      },
      getValue: () => {
        return mfRef.current?.value || '';
      },
    }));

    useEffect(() => {
      const mf = mfRef.current;
      if (!mf) return;

      mf.readOnly = readOnly;
      mf.smartFence = true;
      mf.smartSuperscript = true;

      // Make CAS function names render upright (not italic/cursive)
      try {
        const casFunctions = [
          'solve', 'diff', 'factor', 'expand', 'simplify',
          'integrate', 'limit', 'series', 'det', 'inv',
          'trace', 'rank', 'subs', 'evalf', 'restart',
          'collect', 'cancel', 'apart', 'together', 'radsimp',
          'trigsimp', 'powsimp', 'logcombine', 'nsimplify',
        ];
        const casShortcuts: Record<string, string> = {};
        for (const fn of casFunctions) {
          casShortcuts[fn] = `\\operatorname{${fn}}`;
        }
        (mf as any).inlineShortcuts = {
          ...(mf as any).inlineShortcuts,
          ...casShortcuts,
        };
      } catch {
        // ignore if not supported
      }

      try {
        (mf as any).menuItems = [];
      } catch {
        // ignore
      }

      // Hide toggles and hamburger menu inside shadowRoot
      const hideToggles = () => {
        if (!mf.shadowRoot) return;

        if (!mf.shadowRoot.querySelector('style[data-hide-toggles]')) {
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
          `;
          mf.shadowRoot.appendChild(style);
        }

        const elements = mf.shadowRoot.querySelectorAll(
          '.ML__toggles, .ML__menu-toggle, [part="menu-toggle"], [part="virtual-keyboard-toggle"]'
        );
        elements.forEach((el) => {
          const htmlEl = el as HTMLElement;
          htmlEl.style.setProperty('display', 'none', 'important');
          htmlEl.style.setProperty('width', '0', 'important');
          htmlEl.style.setProperty('height', '0', 'important');
          htmlEl.style.setProperty('visibility', 'hidden', 'important');
        });
      };

      hideToggles();

      let observer: MutationObserver | null = null;
      if (mf.shadowRoot) {
        observer = new MutationObserver(() => {
          hideToggles();
        });
        observer.observe(mf.shadowRoot, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['style', 'class'],
        });
      }

      if (mf.value !== value) {
        (mf as any).setValue(value, { suppressChangeNotifications: true });
      }

      const handleInput = () => {
        if (onChange) {
          onChange(mf.value);
        }
      };

      const handleMoveOut = (e: any) => {
        const dir = e.detail?.direction;
        if ((dir === 'upward' || dir === 'up') && onNavigateUp) {
          e.preventDefault?.();
          onNavigateUp();
        } else if ((dir === 'downward' || dir === 'down') && onNavigateDown) {
          e.preventDefault?.();
          onNavigateDown();
        }
      };

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          if (onEvaluate) {
            onEvaluate();
          }
        } else if (e.key === 'Backspace' && (!mf.value || mf.value.trim() === '')) {
          if (onDelete) {
            e.preventDefault();
            e.stopPropagation();
            onDelete();
          }
        }
      };

      const handleFocus = () => {
        if (onFocus) {
          onFocus();
        }
      };

      mf.addEventListener('input', handleInput);
      mf.addEventListener('keydown', handleKeyDown, true);
      mf.addEventListener('move-out', handleMoveOut);
      mf.addEventListener('focus', handleFocus);

      return () => {
        observer?.disconnect();
        mf.removeEventListener('input', handleInput);
        mf.removeEventListener('keydown', handleKeyDown, true);
        mf.removeEventListener('move-out', handleMoveOut);
        mf.removeEventListener('focus', handleFocus);
      };
    }, [readOnly, onChange, onEvaluate, onDelete, onFocus, onNavigateUp, onNavigateDown, value]);

    // Keep value synchronized if changed externally
    useEffect(() => {
      const mf = mfRef.current;
      if (mf && mf.value !== value) {
        (mf as any).setValue(value, { suppressChangeNotifications: true });
      }
    }, [value]);

    return (
      <math-field
        ref={mfRef}
        style={{
          fontSize,
          color: color || (readOnly ? 'var(--math-output-color)' : 'var(--math-input-color)'),
          display: 'inline-block',
          outline: 'none',
          border: 'none',
          background: 'transparent',
          padding: '2px 0px',
          minWidth: '60px',
        }}
        className={`select-text ${readOnly ? 'cursor-default' : 'cursor-text'} ${className}`}
      />
    );
  }
);

MathField.displayName = 'MathField';
