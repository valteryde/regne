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
  path: string | null;
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
type OpenHandler = (content: string, filePath: string, revealOffset?: number) => void;
type RevealHandler = (offset: number) => void;
type InsertHandler = (name: string) => void;

let onCommand: CommandHandler | null = null;
let onOpen: OpenHandler | null = null;
let onReveal: RevealHandler | null = null;
let onInsert: InsertHandler | null = null;

export function sourceCommandsActive(): boolean {
  return onCommand != null;
}

export function registerSourceCommands(
  handler: CommandHandler,
  open: OpenHandler,
  reveal: RevealHandler,
  insert: InsertHandler,
): () => void {
  onCommand = handler;
  onOpen = open;
  onReveal = reveal;
  onInsert = insert;
  return () => {
    if (onCommand === handler) onCommand = null;
    if (onOpen === open) onOpen = null;
    if (onReveal === reveal) onReveal = null;
    if (onInsert === insert) onInsert = null;
  };
}

export function insertSource(name: string): void {
  onInsert?.(name);
}

export function revealSource(offset: number): void {
  onReveal?.(offset);
}

export function dispatchSourceCommand(command: SourceCommand): void {
  onCommand?.(command);
}

export function dispatchSourceFileOpen(content: string, filePath: string, revealOffset?: number): boolean {
  if (!onOpen) return false;
  onOpen(content, filePath, revealOffset);
  return true;
}
