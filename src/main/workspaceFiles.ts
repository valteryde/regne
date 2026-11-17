import * as fs from 'fs/promises';
import * as path from 'path';
import { DirEntry, SearchHit } from '../types/files';

const SKIP_DIRECTORIES = new Set([
  'node_modules',
  'dist',
  'dist-test',
  'venv',
  '.venv',
  '__pycache__',
]);

const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'icns', 'pdf',
  'zip', 'gz', 'tgz', 'dmg', 'woff', 'woff2', 'ttf', 'otf',
  'mp3', 'mp4', 'mov', 'wav', 'ogg', 'wasm', 'pyc', 'exe',
  'dll', 'so', 'dylib', 'class', 'jar', '7z', 'rar', 'bin', 'pak',
]);

const MAX_MATCHES = 200;
const MAX_PER_FILE = 30;
const MAX_FILES = 5000;
const MAX_FILE_BYTES = 1024 * 1024;
const PREVIEW_BUDGET = 160;

export function isInsideRoot(root: string, target: string): boolean {
  const base = path.resolve(root);
  const resolved = path.resolve(target);
  const relative = path.relative(base, resolved);
  if (relative === '') return true;
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

function skippedDirectory(name: string): boolean {
  return name.startsWith('.') || SKIP_DIRECTORIES.has(name);
}

function binaryExtension(name: string): boolean {
  const dot = name.lastIndexOf('.');
  if (dot < 0) return false;
  return BINARY_EXTENSIONS.has(name.slice(dot + 1).toLowerCase());
}

export async function listDirectory(root: string, dirPath: string): Promise<DirEntry[]> {
  if (!root) throw new Error('Open a folder first.');
  const base = path.resolve(root);
  const dir = path.resolve(dirPath);
  if (!isInsideRoot(base, dir)) throw new Error('That path is outside the open folder.');
  const stat = await fs.stat(dir);
  if (!stat.isDirectory()) throw new Error('That path is not a folder.');
  const names = await fs.readdir(dir, { withFileTypes: true });
  const entries: DirEntry[] = names.map((entry) => ({
    name: entry.name,
    path: path.join(dir, entry.name),
    isDirectory: entry.isDirectory(),
  }));
  entries.sort((left, right) => {
    if (left.isDirectory !== right.isDirectory) return left.isDirectory ? -1 : 1;
    return left.name.localeCompare(right.name, undefined, { sensitivity: 'base', numeric: true });
  });
  return entries;
}

export async function searchFolder(
  root: string,
  query: string,
): Promise<{ hits: SearchHit[]; truncated: boolean }> {
  const needle = query.trim();
  if (!needle) return { hits: [], truncated: false };
  if (!root) throw new Error('Open a folder first.');
  const base = path.resolve(root);
  const stat = await fs.stat(base);
  if (!stat.isDirectory()) throw new Error('That path is not a folder.');
  const state: SearchState = { hits: [], truncated: false, filesRead: 0 };
  await walk(base, needle, state);
  return { hits: state.hits, truncated: state.truncated };
}

interface SearchState {
  hits: SearchHit[];
  truncated: boolean;
  filesRead: number;
}

async function walk(dir: string, query: string, state: SearchState): Promise<void> {
  if (state.truncated) return;
  let names;
  try {
    names = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  const sorted = [...names].sort((left, right) => {
    if (left.isDirectory() !== right.isDirectory()) return left.isDirectory() ? -1 : 1;
    return left.name.localeCompare(right.name, undefined, { sensitivity: 'base', numeric: true });
  });
  for (const entry of sorted) {
    if (state.truncated) return;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (skippedDirectory(entry.name)) continue;
      await walk(full, query, state);
      continue;
    }
    if (!entry.isFile() || binaryExtension(entry.name)) continue;
    if (state.filesRead >= MAX_FILES) {
      state.truncated = true;
      return;
    }
    state.filesRead += 1;
    await searchFile(full, query, state);
  }
}

async function searchFile(filePath: string, query: string, state: SearchState): Promise<void> {
  let stat;
  try {
    stat = await fs.stat(filePath);
  } catch {
    return;
  }
  if (!stat.isFile() || stat.size === 0 || stat.size > MAX_FILE_BYTES) return;
  let text: string;
  try {
    text = await fs.readFile(filePath, 'utf8');
  } catch {
    return;
  }
  const room = Math.min(MAX_PER_FILE, MAX_MATCHES - state.hits.length);
  if (room <= 0) {
    state.truncated = true;
    return;
  }
  const found = hitsInText(filePath, text, query, room + 1);
  if (found.length > room) {
    state.hits.push(...found.slice(0, room));
    state.truncated = true;
    return;
  }
  state.hits.push(...found);
  if (state.hits.length >= MAX_MATCHES) state.truncated = true;
}

export function hitsInText(filePath: string, text: string, query: string, limit: number): SearchHit[] {
  if (!query || limit <= 0 || text.includes('\0')) return [];
  const sensitive = text.toLowerCase().length !== text.length || query.toLowerCase().length !== query.length;
  const haystack = sensitive ? text : text.toLowerCase();
  const needle = sensitive ? query : query.toLowerCase();
  const hits: SearchHit[] = [];
  const cursor = { line: 1, start: 0 };
  let from = 0;
  while (hits.length < limit) {
    const index = haystack.indexOf(needle, from);
    if (index < 0) break;
    const bounds = lineBounds(text, index, cursor);
    const rawLine = text.slice(bounds.start, bounds.end).replace(/\r$/, '');
    const matchIndex = index - bounds.start;
    const preview = clipPreview(rawLine, matchIndex, query.length);
    hits.push({
      filePath,
      line: bounds.line,
      offset: index,
      preview: preview.text,
      matchStart: preview.matchStart,
      matchLength: preview.matchLength,
    });
    from = index + Math.max(query.length, 1);
  }
  return hits;
}

function lineBounds(
  text: string,
  index: number,
  cursor: { line: number; start: number },
): { line: number; start: number; end: number } {
  while (cursor.start < index) {
    const next = text.indexOf('\n', cursor.start);
    if (next < 0 || next >= index) break;
    cursor.line += 1;
    cursor.start = next + 1;
  }
  const newline = text.indexOf('\n', index);
  return {
    line: cursor.line,
    start: cursor.start,
    end: newline < 0 ? text.length : newline,
  };
}

function clipPreview(
  line: string,
  matchIndex: number,
  matchLength: number,
): { text: string; matchStart: number; matchLength: number } {
  const flat = line.replace(/\t/g, ' ');
  if (flat.length <= PREVIEW_BUDGET) {
    return { text: flat, matchStart: matchIndex, matchLength };
  }
  let start = Math.max(0, matchIndex - 48);
  let end = Math.min(flat.length, start + PREVIEW_BUDGET);
  start = Math.max(0, end - PREVIEW_BUDGET);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < flat.length ? '…' : '';
  const body = flat.slice(start, end);
  const text = prefix + body + suffix;
  const matchStart = prefix.length + (matchIndex - start);
  const visible = Math.max(0, Math.min(matchLength, body.length - (matchIndex - start)));
  return { text, matchStart, matchLength: visible };
}
