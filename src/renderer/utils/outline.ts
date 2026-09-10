import { DocumentElement, SectionElement } from '../../types/document';

export interface OutlineItem {
  id: string;
  index: number;
  title: string;
  level: 1 | 2 | 3;
  kind: string;
  numberLabel: string;
  displayLabel: string;
  collapsed: boolean;
  elementCount: number;
}

/**
 * Computes hierarchical outline items with numbering and labels
 * matching LaTeX / academic paper styling (e.g., §1 Introduction, Theorem 2.4, Lemma 2.5).
 */
export function computeOutline(elements: DocumentElement[]): OutlineItem[] {
  const items: OutlineItem[] = [];
  let sec1Count = 0;
  let sec2Count = 0;
  let sec3Count = 0;
  let theoremCount = 0;
  let lemmaCount = 0;

  elements.forEach((el, index) => {
    if (el.type !== 'section') return;
    const sec = el as SectionElement;
    const level = sec.level || 1;
    const kind = sec.kind || 'section';

    let numberLabel = '';

    if (level === 1) {
      sec1Count++;
      sec2Count = 0;
      sec3Count = 0;
      theoremCount = 0;
      lemmaCount = 0;
      numberLabel = `§${sec1Count}`;
    } else if (level === 2) {
      sec2Count++;
      sec3Count = 0;
      if (kind === 'theorem') {
        theoremCount++;
        numberLabel = `Theorem ${sec1Count > 0 ? `${sec1Count}.` : ''}${theoremCount}`;
      } else if (kind === 'lemma') {
        lemmaCount++;
        numberLabel = `Lemma ${sec1Count > 0 ? `${sec1Count}.` : ''}${lemmaCount}`;
      } else if (kind === 'definition') {
        numberLabel = `Def ${sec1Count > 0 ? `${sec1Count}.` : ''}${sec2Count}`;
      } else {
        numberLabel = sec1Count > 0 ? `§${sec1Count}.${sec2Count}` : `§${sec2Count}`;
      }
    } else {
      sec3Count++;
      if (kind === 'theorem') {
        theoremCount++;
        numberLabel = `Theorem ${sec1Count > 0 ? `${sec1Count}.` : ''}${theoremCount}`;
      } else if (kind === 'lemma') {
        lemmaCount++;
        numberLabel = `Lemma ${sec1Count > 0 ? `${sec1Count}.` : ''}${lemmaCount}`;
      } else {
        numberLabel = sec1Count > 0 ? `§${sec1Count}.${sec2Count}.${sec3Count}` : `§${sec3Count}`;
      }
    }

    // Calculate how many elements belong to this section
    let count = 0;
    for (let j = index + 1; j < elements.length; j++) {
      const nextEl = elements[j];
      if (nextEl.type === 'section') {
        const nextSec = nextEl as SectionElement;
        const nextLevel = nextSec.level || 1;
        if (nextLevel <= level) {
          break;
        }
      }
      count++;
    }

    const titleText = sec.title?.trim() || 'Untitled Section';
    const displayLabel = numberLabel ? `${numberLabel} ${titleText}` : titleText;

    items.push({
      id: sec.id,
      index,
      title: titleText,
      level,
      kind,
      numberLabel,
      displayLabel,
      collapsed: Boolean(sec.collapsed),
      elementCount: count,
    });
  });

  return items;
}

/**
 * Returns a Set of element IDs that should be hidden because an enclosing section is collapsed.
 */
export function getCollapsedElementIds(elements: DocumentElement[]): Set<string> {
  const hiddenIds = new Set<string>();

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (el.type === 'section' && (el as SectionElement).collapsed) {
      const currentLevel = (el as SectionElement).level || 1;
      // Hide all subsequent elements until a section of equal or higher level (<= currentLevel)
      for (let j = i + 1; j < elements.length; j++) {
        const next = elements[j];
        if (next.type === 'section') {
          const nextLevel = (next as SectionElement).level || 1;
          if (nextLevel <= currentLevel) {
            break;
          }
        }
        hiddenIds.add(next.id);
      }
    }
  }

  return hiddenIds;
}
