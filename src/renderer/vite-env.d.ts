/// <reference types="vite/client" />

declare module "monaco-editor/editor/editor.api" {
  export { CancellationToken, editor, languages, Range, Uri } from "monaco-editor";
}

declare module "monaco-editor/editor/editor.worker?worker" {
  const WorkerFactory: new () => Worker;
  export default WorkerFactory;
}

declare module "monaco-editor-css";
