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

/** Colors statements, headings, and paragraphs, and completes names and units. */
export function registerRegneLanguage(): void {
  if (registered) return;
  registered = true;
  languages.register({ id: "regne" });
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
  editor.defineTheme("regne", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "1d4ed8" },
      { token: "string", foreground: "b45309" },
      { token: "type", foreground: "3f3f46" },
      { token: "comment", foreground: "6b7280" },
      { token: "predefined", foreground: "7f1d1d" },
      { token: "variable", foreground: "1e3a8a" },
      { token: "number", foreground: "0f766e" },
      { token: "operator", foreground: "6d28d9" },
      { token: "unit", foreground: "c2410c" },
    ],
    colors: {},
  });
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
