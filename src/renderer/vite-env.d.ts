/// <reference types="vite/client" />

declare module "monaco-editor/editor/editor.api" {
  export { CancellationToken, editor, KeyCode, KeyMod, languages, Range, Uri } from "monaco-editor";
}

declare module "monaco-editor/editor/contrib/wordOperations/browser/wordOperations.js";
declare module "monaco-editor/editor/contrib/wordPartOperations/browser/wordPartOperations.js";

declare module "monaco-editor/editor/editor.worker?worker" {
  const WorkerFactory: new () => Worker;
  export default WorkerFactory;
}

declare module "monaco-editor-css";
