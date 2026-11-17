import { editor, languages } from "monaco-editor/editor/editor.api";
import { insideUnit, suggestions } from "../../../language/complete";

let registered = false;

/** Colors a heading, a paragraph prefix, and a comment, and completes names and units. */
export function registerRegneLanguage(): void {
  if (registered) return;
  registered = true;
  languages.register({ id: "regne" });
  languages.setMonarchTokensProvider("regne", {
    tokenizer: {
      root: [
        [/^[ \t]*\/\/.*$/, "comment"],
        [/^[ \t]*#{1,3}[ \t].*$/, "keyword"],
        [/^[ \t]*-/, "string", "@prose"],
      ],
      prose: [[/.*$/, "type", "@pop"]],
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
