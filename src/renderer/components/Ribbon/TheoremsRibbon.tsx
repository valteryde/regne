import React from 'react';
import { useDocument } from '../../context/DocumentContext';
import { SectionKind } from '../../types/document';
import { BookOpen, Award, CheckCircle2, FileQuestion } from 'lucide-react';

export const TheoremsRibbon: React.FC = () => {
  const { insertSection, activeElementId } = useDocument();

  const handleInsertTheorem = (kind: SectionKind, defaultTitle: string) => {
    insertSection(2, activeElementId || undefined, kind, defaultTitle);
  };

  return (
    <div className="flex items-stretch h-14 px-2 select-none overflow-visible text-slate-700 bg-white">
      {/* 1. THEOREMS & LEMMAS */}
      <div className="flex flex-col justify-between px-2 py-1 shrink-0">
        <div className="flex items-center gap-1 justify-center flex-1">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleInsertTheorem('theorem', 'Theorem')}
            className="h-7 px-2.5 flex items-center gap-1 text-xs font-semibold hover:bg-slate-100 hover:text-slate-900 rounded-[2px] transition-colors cursor-pointer text-slate-700"
            title="Insert Theorem environment"
          >
            <Award className="w-3.5 h-3.5 text-blue-600" />
            <span>Theorem</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleInsertTheorem('lemma', 'Lemma')}
            className="h-7 px-2 flex items-center text-xs font-semibold hover:bg-slate-100 hover:text-slate-900 rounded-[2px] transition-colors cursor-pointer text-slate-700"
            title="Insert Lemma environment"
          >
            <span>Lemma</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleInsertTheorem('corollary', 'Corollary')}
            className="h-7 px-2 flex items-center text-xs font-semibold hover:bg-slate-100 hover:text-slate-900 rounded-[2px] transition-colors cursor-pointer text-slate-700"
            title="Insert Corollary environment"
          >
            <span>Corollary</span>
          </button>
        </div>
        <div className="text-[9px] font-bold text-slate-400 tracking-wider text-center uppercase select-none">
          Theorems & Lemmas
        </div>
      </div>

      <div className="h-8 w-px bg-slate-200 shrink-0 self-center mx-1" />

      {/* 2. DEFINITIONS & AXIOMS */}
      <div className="flex flex-col justify-between px-2 py-1 shrink-0">
        <div className="flex items-center gap-1 justify-center flex-1">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleInsertTheorem('definition', 'Definition')}
            className="h-7 px-2.5 flex items-center gap-1 text-xs font-semibold hover:bg-slate-100 hover:text-slate-900 rounded-[2px] transition-colors cursor-pointer text-slate-700"
            title="Insert Definition environment"
          >
            <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
            <span>Definition</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleInsertTheorem('section', 'Axiom')}
            className="h-7 px-2 flex items-center text-xs font-semibold hover:bg-slate-100 hover:text-slate-900 rounded-[2px] transition-colors cursor-pointer text-slate-700"
            title="Insert Axiom environment"
          >
            <span>Axiom</span>
          </button>
        </div>
        <div className="text-[9px] font-bold text-slate-400 tracking-wider text-center uppercase select-none">
          Foundations
        </div>
      </div>

      <div className="h-8 w-px bg-slate-200 shrink-0 self-center mx-1" />

      {/* 3. PROOFS & EXAMPLES */}
      <div className="flex flex-col justify-between px-2 py-1 shrink-0">
        <div className="flex items-center gap-1 justify-center flex-1">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleInsertTheorem('proof', 'Proof')}
            className="h-7 px-2.5 flex items-center gap-1 text-xs font-semibold hover:bg-slate-100 hover:text-slate-900 rounded-[2px] transition-colors cursor-pointer text-slate-700"
            title="Insert Proof block"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Proof</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleInsertTheorem('example', 'Example')}
            className="h-7 px-2 flex items-center text-xs font-semibold hover:bg-slate-100 hover:text-slate-900 rounded-[2px] transition-colors cursor-pointer text-slate-700"
            title="Insert Example block"
          >
            <span>Example</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleInsertTheorem('remark', 'Remark')}
            className="h-7 px-2 flex items-center text-xs font-semibold hover:bg-slate-100 hover:text-slate-900 rounded-[2px] transition-colors cursor-pointer text-slate-700"
            title="Insert Remark block"
          >
            <span>Remark</span>
          </button>
        </div>
        <div className="text-[9px] font-bold text-slate-400 tracking-wider text-center uppercase select-none">
          Exposition
        </div>
      </div>
    </div>
  );
};
