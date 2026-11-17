import { editor, languages } from "monaco-editor/editor/editor.api";
import { insideUnit, suggestions } from "../../../language/complete";
import { Paint, paintLine, statementContinues } from "../../../language/highlight";

let registered = false;

const SCOPE: Record<Paint["tone"], string> = {
  comment: "comment",
  heading: "keyword",
  marker: "string",
  prose: "type",
  function: "predefined",
  variable: "variable",
  number: "number",
  operator: "operator",
  unit: "unit",
};

class RegneLine implements languages.IState {
  constructor(readonly continued: boolean) {}

  clone(): languages.IState {
    return new RegneLine(this.continued);
  }

  equals(other: languages.IState): boolean {
    return other instanceof RegneLine && other.continued === this.continued;
  }
}

function defineRegneTheme(): void {
  editor.defineTheme("regne", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "8eb4ff" },
      { token: "string", foreground: "e0a15c" },
      { token: "type", foreground: "c8c2b6" },
      { token: "comment", foreground: "9a948c" },
      { token: "predefined", foreground: "f0a8a4" },
      { token: "variable", foreground: "8eb4f8" },
      { token: "number", foreground: "7dcea0" },
      { token: "operator", foreground: "d4b4e8" },
      { token: "unit", foreground: "f0a070" },
    ],
    colors: {
      "editor.background": "#100f0e",
      "editor.foreground": "#e6e2d8",
      "editorLineNumber.foreground": "#8f8a82",
      "editorLineNumber.activeForeground": "#e6e2d8",
      "editor.lineHighlightBackground": "#24211e",
      "editor.lineHighlightBorder": "#00000000",
      "editor.selectionBackground": "#3a342c",
      "editor.inactiveSelectionBackground": "#2c2926",
      "editorCursor.foreground": "#e6e2d8",
      "editorWidget.background": "#171614",
      "editorWidget.border": "#2c2926",
      "editorSuggestWidget.background": "#171614",
      "editorSuggestWidget.border": "#2c2926",
      "editorSuggestWidget.foreground": "#e6e2d8",
      "editorSuggestWidget.selectedBackground": "#24211e",
      "editorSuggestWidget.highlightForeground": "#e0b15c",
      "editorHoverWidget.background": "#171614",
      "editorHoverWidget.border": "#2c2926",
      "scrollbarSlider.background": "#2c292680",
      "scrollbarSlider.hoverBackground": "#8f8a8280",
    },
  });
  editor.setTheme("regne");
}

/** Colors statements, headings, and paragraphs, and completes names and units. */
export function registerRegneLanguage(): void {
  if (registered) {
    defineRegneTheme();
    return;
  }
  registered = true;
  try {
    languages.register({ id: "regne" });
  } catch {
    // A reload registers the language again. The tokenizer below replaces the old one.
  }
  languages.setTokensProvider("regne", {
    getInitialState: () => new RegneLine(false),
    tokenize(line, state) {
      const continued = state instanceof RegneLine && state.continued;
      const paints = paintLine(line, continued);
      const tokens = paints.map((paint) => ({ startIndex: paint.start, scopes: SCOPE[paint.tone] }));
      if (tokens.length === 0 || tokens[0].startIndex !== 0) {
        tokens.unshift({ startIndex: 0, scopes: "" });
      }
      return { tokens, endState: new RegneLine(statementContinues(line, continued)) };
    },
  });
  defineRegneTheme();
  languages.registerCompletionItemProvider("regne", {
    triggerCharacters: ["[", " "],
    provideCompletionItems(model, position) {
      const before = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };
      const unit = insideUnit(before);
      return {
        suggestions: suggestions(before).slice(0, 80).map((name) => ({
          label: name,
          kind: unit ? languages.CompletionItemKind.Unit : languages.CompletionItemKind.Function,
          insertText: name,
          range,
        })),
      };
    },
  });
}

defineRegneTheme();
