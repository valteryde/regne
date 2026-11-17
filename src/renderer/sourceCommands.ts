import { useEffect, useState } from "react";

export type SourceCommand = "save" | "save-as" | "open" | "new" | "undo" | "redo";

export interface SourceLabel {
  title: string;
  dirty: boolean;
}

let sourceLabel: SourceLabel | null = null;
const labelListeners = new Set<() => void>();

export function publishSourceLabel(label: SourceLabel | null): void {
  sourceLabel = label;
  labelListeners.forEach((listener) => listener());
}

export function useSourceLabel(): SourceLabel | null {
  const [label, setLabel] = useState(sourceLabel);
  useEffect(() => {
    const listener = () => setLabel(sourceLabel);
    labelListeners.add(listener);
    setLabel(sourceLabel);
    return () => {
      labelListeners.delete(listener);
    };
  }, []);
  return label;
}

type CommandHandler = (command: SourceCommand) => void;
type OpenHandler = (content: string, filePath: string) => void;

let onCommand: CommandHandler | null = null;
let onOpen: OpenHandler | null = null;

export function sourceCommandsActive(): boolean {
  return onCommand != null;
}

export function registerSourceCommands(handler: CommandHandler, open: OpenHandler): () => void {
  onCommand = handler;
  onOpen = open;
  return () => {
    if (onCommand === handler) onCommand = null;
    if (onOpen === open) onOpen = null;
  };
}

export function dispatchSourceCommand(command: SourceCommand): void {
  onCommand?.(command);
}

export function dispatchSourceFileOpen(content: string, filePath: string): boolean {
  if (!onOpen) return false;
  onOpen(content, filePath);
  return true;
}
