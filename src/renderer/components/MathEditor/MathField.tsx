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
  onEvaluateInPlace?: () => void;
  onInsertBelow?: () => void;
  onDelete?: () => void;
  onBackspaceAtStart?: () => void;
  onDeleteAtEnd?: () => void;
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
      onEvaluateInPlace,
      onInsertBelow,
      onDelete,
      onBackspaceAtStart,
      onDeleteAtEnd,
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
    const lastEmittedValueRef = useRef<string>(value || '');

    // Keep callback refs stable so event listeners are attached only once
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    const onEvaluateRef = useRef(onEvaluate);
    onEvaluateRef.current = onEvaluate;

    const onEvaluateInPlaceRef = useRef(onEvaluateInPlace);
    onEvaluateInPlaceRef.current = onEvaluateInPlace;

    const onInsertBelowRef = useRef(onInsertBelow);
    onInsertBelowRef.current = onInsertBelow;

    const onDeleteRef = useRef(onDelete);
    onDeleteRef.current = onDelete;

    const onBackspaceAtStartRef = useRef(onBackspaceAtStart);
    onBackspaceAtStartRef.current = onBackspaceAtStart;

    const onDeleteAtEndRef = useRef(onDeleteAtEnd);
    onDeleteAtEndRef.current = onDeleteAtEnd;

    const onFocusRef = useRef(onFocus);
    onFocusRef.current = onFocus;

    const onNavigateUpRef = useRef(onNavigateUp);
    onNavigateUpRef.current = onNavigateUp;

    const onNavigateDownRef = useRef(onNavigateDown);
    onNavigateDownRef.current = onNavigateDown;

    useImperativeHandle(ref, () => ({
      insert: (snippet: string) => {
        const mf = mfRef.current;
        if (mf) {
          mf.executeCommand(['insert', snippet]);
          lastEmittedValueRef.current = mf.value;
          onChangeRef.current?.(mf.value);
          try {
            (mf as any).focus({ preventScroll: true });
          } catch {
            mf.focus();
          }
        }
      },
      focus: (atEnd = false) => {
        const mf = mfRef.current;
        if (mf) {
          try {
            (mf as any).focus({ preventScroll: true });
          } catch {
            mf.focus();
          }
          const cmd = atEnd ? 'moveToMathfieldEnd' : 'moveToMathfieldStart';
          try {
            mf.executeCommand(cmd);
          } catch {
            // fallback
          }
        }
      },
      getValue: () => {
        return mfRef.current?.value || '';
      },
    }));

    // Main initialization effect - runs on mount and when readOnly changes
    useEffect(() => {
      const mf = mfRef.current;
      if (!mf) return;

      mf.readOnly = readOnly;
      mf.smartFence = false;
      mf.smartSuperscript = true;
      (mf as any).mathVirtualKeyboardPolicy = 'manual';

      // Override MathLive's default onScrollIntoView hook.
      // By default, MathLive calls this.host.scrollIntoView({ block: 'nearest' })
      // on EVERY single keystroke. Intercepting it and making it a no-op ensures that
      // the document scroll position NEVER jumps or shifts while the user is typing math.
      (mf as any).onScrollIntoView = () => {
        // Absolutely no-op: never scroll the document container when writing math
      };

      // Configure inline shortcuts:
      // Remove all shortcuts containing letters (e.g. 'pi', 'delta', 'alpha', 'in', 'sin', etc.)
      // so users can freely type multi-letter words and variable names (like 'pillage', 'inside', 'delta')
      // without them being prematurely replaced by symbols.
      // Symbols must be entered explicitly via backslash (e.g. \pi, \delta, \alpha).
      try {
        const rawShortcuts = (mf as any).inlineShortcuts || {};
        const nonLetterShortcuts: Record<string, any> = {};
        for (const [key, val] of Object.entries(rawShortcuts)) {
          if (!/[a-zA-Z]/.test(key)) {
            nonLetterShortcuts[key] = val;
          }
        }
        (mf as any).inlineShortcuts = nonLetterShortcuts;
        (mf as any).onInlineShortcut = () => '';

        // Add CAS function macros for LaTeX mode (e.g. \solve, \diff, \integrate)
        const casFunctions = [
          'plot', 'solve', 'diff', 'factor', 'expand', 'simplify',
          'integrate', 'limit', 'series', 'det', 'inv',
          'trace', 'rank', 'subs', 'evalf', 'restart',
          'collect', 'cancel', 'apart', 'together', 'radsimp',
          'trigsimp', 'powsimp', 'logcombine', 'nsimplify',
        ];
        const casMacros: Record<string, string> = {};
        for (const fn of casFunctions) {
          casMacros[fn] = `\\operatorname{${fn}}`;
        }
        (mf as any).macros = {
          ...((mf as any).macros || {}),
          ...casMacros,
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
      const applyHideTogglesStyle = () => {
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
            /* Eliminate MathLive's default 39px min-height and container padding */
            .ML__container {
              min-height: 0 !important;
              padding: 0 !important;
              margin: 0 !important;
              align-items: center !important;
            }
            .ML__content {
              padding: 1px 0 !important;
            }
            /* Prevent dark/opaque background box over parentheses, fractions, or roots */
            .ML__contains-highlight {
              display: none !important;
              background: transparent !important;
            }
            .ML__contains-caret.ML__close,
            .ML__contains-caret.ML__open,
            .ML__contains-caret > .ML__close,
            .ML__contains-caret > .ML__open {
              color: var(--contains-highlight-color, #2563eb) !important;
              opacity: 1 !important;
            }
            .ML__smart-fence__close {
              opacity: 0.6 !important;
              color: inherit !important;
            }
            /* Prevent keyboard-sink from escaping the mathfield or causing viewport scroll jumps */
            .ML__keyboard-sink {
              position: absolute !important;
              top: 0 !important;
              left: 0 !important;
              width: 1px !important;
              height: 1px !important;
              opacity: 0.001 !important;
              pointer-events: none !important;
            }
          `;
          mf.shadowRoot.appendChild(style);
        }
      };

      applyHideTogglesStyle();
      requestAnimationFrame(applyHideTogglesStyle);

      if (value && mf.value !== value) {
        (mf as any).setValue(value, { suppressChangeNotifications: true });
      }

      const handleInput = () => {
        if (onChangeRef.current && mfRef.current) {
          lastEmittedValueRef.current = mfRef.current.value;
          onChangeRef.current(mfRef.current.value);
        }
      };

      const handleMoveOut = (e: any) => {
        const dir = e.detail?.direction;
        if (
          (dir === 'upward' || dir === 'up' || dir === 'backward' || dir === 'left') &&
          onNavigateUpRef.current
        ) {
          e.preventDefault?.();
          onNavigateUpRef.current();
        } else if (
          (dir === 'downward' || dir === 'down' || dir === 'forward' || dir === 'right') &&
          onNavigateDownRef.current
        ) {
          e.preventDefault?.();
          onNavigateDownRef.current();
        }
      };

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          // If MathLive is in LaTeX input mode (e.g. user typed \delta and presses Enter to resolve it),
          // allow MathLive to handle Enter to complete the LaTeX command into the symbol atom first.
          if ((mf as any).mode === 'latex') {
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          if (e.metaKey || e.ctrlKey) {
            if (onEvaluateInPlaceRef.current) onEvaluateInPlaceRef.current();
            else if (onEvaluateRef.current) onEvaluateRef.current();
          } else if (e.shiftKey) {
            if (onInsertBelowRef.current) onInsertBelowRef.current();
          } else if (onEvaluateRef.current) {
            onEvaluateRef.current();
          }
        } else if (e.key === 'Backspace') {
          if (!mf.value || mf.value.trim() === '') {
            if (onDeleteRef.current) {
              e.preventDefault();
              e.stopPropagation();
              onDeleteRef.current();
            }
          } else if (
            mf.selectionIsCollapsed &&
            mf.position === 0 &&
            onBackspaceAtStartRef.current
          ) {
            e.preventDefault();
            e.stopPropagation();
            onBackspaceAtStartRef.current();
          }
        } else if (e.key === 'Delete') {
          if (
            mf.selectionIsCollapsed &&
            mf.position === mf.lastOffset &&
            onDeleteAtEndRef.current
          ) {
            e.preventDefault();
            e.stopPropagation();
            onDeleteAtEndRef.current();
          }
        }
      };

      const handleFocus = () => {
        if (onFocusRef.current) {
          onFocusRef.current();
        }
      };

      mf.addEventListener('input', handleInput);
      mf.addEventListener('keydown', handleKeyDown, true);
      mf.addEventListener('move-out', handleMoveOut);
      mf.addEventListener('focus', handleFocus);

      return () => {
        mf.removeEventListener('input', handleInput);
        mf.removeEventListener('keydown', handleKeyDown, true);
        mf.removeEventListener('move-out', handleMoveOut);
        mf.removeEventListener('focus', handleFocus);
      };
    }, [readOnly]);

    // Keep value synchronized when changed externally (e.g. Undo, Redo, Ribbon insert)
    useEffect(() => {
      const mf = mfRef.current;
      if (!mf) return;

      // If this update was emitted from typing in this field, do not re-set the value,
      // which preserves cursor position and prevents interruptions.
      if (value === lastEmittedValueRef.current && mf.value === value) {
        return;
      }

      // External change detected (Undo, Redo, Ribbon insert, or external clear)
      lastEmittedValueRef.current = value || '';
      if (mf.value !== value) {
        (mf as any).setValue(value || '', { suppressChangeNotifications: true });

        const isFocused =
          mf.hasFocus?.() ||
          document.activeElement === mf ||
          mf.shadowRoot?.contains(document.activeElement);

        if (isFocused) {
          try {
            mf.executeCommand('moveToMathfieldEnd');
          } catch {
            // ignore
          }
        }
      }
    }, [value]);

    return (
      <math-field
        ref={mfRef}
        style={{
          fontSize,
          color: color || (readOnly ? 'var(--math-output-color)' : 'var(--math-input-color)'),
          display: 'block',
          position: 'relative',
          outline: 'none',
          border: 'none',
          background: 'transparent',
          padding: '0px',
          minWidth: '60px',
          lineHeight: '1.25',
          ['--contains-highlight-background-color' as any]: 'transparent',
          ['--contains-highlight-color' as any]: '#2563eb',
          ['--smart-fence-color' as any]: 'currentColor',
          ['--smart-fence-opacity' as any]: '0.6',
        }}
        className={`select-text ${readOnly ? 'cursor-default' : 'cursor-text'} ${className}`}
      />
    );
  }
);

MathField.displayName = 'MathField';
