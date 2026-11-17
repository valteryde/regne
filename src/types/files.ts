export interface DirEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

export interface SearchHit {
  filePath: string;
  line: number;
  offset: number;
  preview: string;
  matchStart: number;
  matchLength: number;
}
