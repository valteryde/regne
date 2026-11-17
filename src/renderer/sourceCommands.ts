import { useEffect, useState } from "react";

export type SourceCommand =
  | "save"
  | "save-as"
  | "open"
  | "new"
  | "undo"
  | "redo"
  | "export"
  | "export-html"
  | "next-broken";

export interface SourceHeading {
  title: string;
  level: 1 | 2 | 3;
  start: number;
}

export interface SourceLabel {
  title: string;
  dirty: boolean;
  /** A recompute is waiting or in flight. */
  computing: boolean;
  /** Statements that failed to parse. */
  broken: number;
  headings: SourceHeading[];
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
type RevealHandler = (offset: number) => void;

let onCommand: CommandHandler | null = null;
let onOpen: OpenHandler | null = null;
let onReveal: RevealHandler | null = null;

export function sourceCommandsActive(): boolean {
  return onCommand != null;
}

export function registerSourceCommands(
  handler: CommandHandler,
  open: OpenHandler,
  reveal: RevealHandler,
): () => void {
  onCommand = handler;
  onOpen = open;
  onReveal = reveal;
  return () => {
    if (onCommand === handler) onCommand = null;
    if (onOpen === open) onOpen = null;
    if (onReveal === reveal) onReveal = null;
  };
}

export function revealSource(offset: number): void {
  onReveal?.(offset);
}

export function dispatchSourceCommand(command: SourceCommand): void {
  onCommand?.(command);
}

export function dispatchSourceFileOpen(content: string, filePath: string): boolean {
  if (!onOpen) return false;
  onOpen(content, filePath);
  return true;
}
