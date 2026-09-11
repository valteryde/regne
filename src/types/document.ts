export type ElementType = 'text' | 'math' | 'section';

export type SectionKind =
  | 'section'
  | 'subsection'
  | 'subsubsection'
  | 'theorem'
  | 'lemma'
  | 'corollary'
  | 'definition'
  | 'proof'
  | 'example'
  | 'remark';

export interface TextElement {
  id: string;
  type: 'text';
  content: string;
  color?: string;
  backgroundColor?: string;
}

export interface MathElement {
  id: string;
  type: 'math';
  input: string;
  evaluated: boolean;
  isEvaluating?: boolean;
  resultLatex?: string;
  resultText?: string;
  resultPlotSvg?: string;
  resultType?: string;
  error?: string;
  errorCol?: number;    // 0-based column offset within errorSource where the problem was detected
  errorSource?: string; // the preprocessed expression string that caused the error
  color?: string;
  backgroundColor?: string;
}

export interface SectionElement {
  id: string;
  type: 'section';
  title: string;
  level: 1 | 2 | 3;
  kind?: SectionKind;
  collapsed?: boolean;
}

export type DocumentElement = TextElement | MathElement | SectionElement;

export interface RegneDocument {
  id: string;
  title: string;
  version: string;
  createdAt: number;
  updatedAt: number;
  elements: DocumentElement[];
}

export type HypatiaDocument = RegneDocument;
