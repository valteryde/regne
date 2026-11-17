const DOCUMENT_EXTENSIONS = new Set(['regne', 'hypatia', 'json']);

export function baseName(filePath: string): string {
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1] || filePath;
}

export function parentDirectory(filePath: string): string | null {
  const slash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  if (slash <= 0) return null;
  return filePath.slice(0, slash);
}

export function relativePath(root: string, filePath: string): string {
  const separator = filePath.includes('\\') && !filePath.includes('/') ? '\\' : '/';
  const prefix = root.endsWith('/') || root.endsWith('\\') ? root : root + separator;
  if (filePath.startsWith(prefix)) return filePath.slice(prefix.length);
  if (filePath === root) return baseName(filePath);
  return baseName(filePath);
}

export function ancestorDirectories(root: string, filePath: string): string[] {
  const sep = root.includes('\\') && !root.includes('/') ? '\\' : '/';
  const prefix = root.endsWith('/') || root.endsWith('\\') ? root : root + sep;
  if (!filePath.startsWith(prefix)) return [];
  const parts = filePath.slice(prefix.length).split(/[/\\]/).filter(Boolean);
  parts.pop();
  const dirs: string[] = [];
  let dir = root.replace(/[/\\]+$/, '');
  for (const part of parts) {
    dir = `${dir}${sep}${part}`;
    dirs.push(dir);
  }
  return dirs;
}

export function samePath(left: string | null | undefined, right: string | null | undefined): boolean {
  if (!left || !right) return false;
  if (left === right) return true;
  return left.replace(/[/\\]+$/, '') === right.replace(/[/\\]+$/, '');
}

export function isDocumentFile(filePath: string): boolean {
  const name = baseName(filePath);
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return false;
  return DOCUMENT_EXTENSIONS.has(name.slice(dot + 1).toLowerCase());
}
