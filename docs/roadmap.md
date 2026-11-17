# Regne roadmap

Work through these phases in order. Each phase has a finish line. Do not start the next phase by widening the current one.

The language, the highlight rule, and the two panes are defined in [spec.md](spec.md). This file is the order of work. When the two disagree, the spec wins.

The app today is a page of MathLive rows, a ribbon, and a sidebar. The worker in `src/engine/sympyWorker.py` evaluates a string with SymPy. That worker stays. MathLive, the ribbon, and the palettes come out only after a text `.regne` file opens in the new panes. A bare line is a statement. A heading starts with `#`. A paragraph starts with `-- `.

## Decisions that the rest of the work assumes

The parser and `to_latex` live in TypeScript, in `src/language/`. The editor retints one statement on every selection change. That cannot wait on a Python round trip.

The worker does not parse. It evaluates an IR the TypeScript parser emits, using SymPy for dimensionless mathematics and Pint for quantities. `parse_expr` stops being the structure of a statement. It may remain inside the worker only as a temporary helper while a call is lowered, and it is deleted once the IR covers that call.

Spans are UTF-16 offsets into the file, matching Monaco. A hit is the smallest node whose span contains the selection. The computed value is a second tree and never receives a hit.

One Monaco model owns the file. The page is not editable and is not in the tab order.

## Phase 1. Parser, spans, and LaTeX

New code: `src/language/ast.ts`, `src/language/parse.ts`, `src/language/hit.ts`, `src/language/toLatex.ts`. Tests beside the existing node runner, one file per area under `test/language/`. No UI.

Build the grammar in spec sections 4.1–4.3, including the two meanings of `[]`, trailing `\` continuation, and `//` comments. `#` is not a comment. Every node stores a span that covers its source text and not the surrounding whitespace.

`toLatex(node, hit)` prints the pretty forms in spec section 4.4. `hit` is the span of the hit node, or null. A hit wraps only that node in `\htmlClass{regne-hit}{...}`. Every printed node carries `\htmlData{span=start:end}{...}`, including when `hit` is null, so a click still has a span. `toLatex(node, null)` contains no `regne-hit`. Export, in phase 7, drops both wrappers. Pretty-printing walks the tree. It does not rewrite a SymPy LaTeX string.

`hitNode(root, selection)` implements the caret, the exact node, the parent of two siblings, and "whitespace hits nothing."

Finish line:

- The examples in spec sections 2, 4.1, and 4.4 parse.
- `10 [bar]` is a quantity. `[1, 2]` is a list. `2x` is a parse error with a span.
- `diff(x^2, x)` prints a derivative, and a selection of `x^2` wraps only the differentiated expression.
- `toLatex` with no hit contains no `regne-hit`.
- A selection in a comment or in spaces returns no hit.

Leave out evaluation, units arithmetic, Monaco, and the page.

## Phase 2. Lowering to SymPy and Pint

The parser emits a JSON IR. `src/engine/sympyWorker.py` gains one entry point that accepts that IR and returns the value LaTeX, the value text, a result kind (`expression`, `equation`, `quantity`, `plot`, `error`), and an error span when it has one.

Pint is a worker dependency. `10 [bar] * 66 [L]` multiplies through Pint. `(10 [bar] * 66 [L]) in [J]` converts. The value printer typesets the unit with `\mathrm`, `\cdot`, and `/`. It does not dump Pint's string in monotype.

Dimensionless statements take the SymPy path the worker already has: `diff`, `integrate`, `solve`, `simplify`, `factor`, `expand`, `limit`, `series`, `subs`, `sqrt`, `abs`, the trig and exponential names, `pi`, `E`, `I`, `oo`. `a := 10 + 5` binds in the worker session. `f(x) := x^2 + 1` binds a function. `0 = x^2 + 2*x - 4` solves for the single unbound name. Two unbound names return an error that names `solve`.

A quantity passed to `diff`, `integrate`, `solve`, or `simplify` returns the error "this operation does not take units yet." Offset units succeed only where Pint accepts them.

`plot(...)` still returns an SVG. The `=` inside a plot domain is a domain, not an equation. `restart` clears the worker session.

Tests for the IR walker live with the worker. Use ward for those Python tests. The node tests from phase 1 stay the parser tests. Add a handful of IR fixtures that run the worker: the four expressions named in spec section 10 step 2, one unit conversion, one rejected `diff` of a quantity, and one plot smoke.

Finish line: those fixtures return the value described in the spec, and the input LaTeX still comes from `toLatex`, not from the worker.

Leave out the document, the cache, and debounce. This phase evaluates one statement, then a short list of statements in order so bindings carry down.

## Phase 3. The file, and the two panes

`src/language/document.ts` classifies each line of a `.regne` buffer the way spec section 3 says. A bare line is a statement. `#` is a heading. `-- ` is a paragraph. `//` is a comment. It records a file span for every block and every statement. `$...$` inside a paragraph is its own span. A trailing `\` joins statement lines before parse.

The shell replaces `MathDocument` as the body of `App.tsx`:

- Left: Monaco, one model, the buffer. There is no second view of this pane.
- Right: the existing sheet, HTML, KaTeX through `KaTeXRenderer` with trust turned on for `htmlClass` and `htmlData`.

At this phase the page renders statements only. Headings and paragraphs are kept in the model and shown as their raw text, markers included, until phase 5. Each statement is a display: input from `toLatex`, then the value, the figure, or the error underneath.

Open and save treat `.regne` as text in `src/main/main.ts`. A file whose first non-whitespace character is `{` is left for the legacy import in phase 7. The default new file is the cylinder note from spec section 2. Autosave writes the source only. Results are a memory cache keyed by the statement text and the bindings it used. They are not written into the file.

Recompute waits about a third of a second after typing stops. A statement that fails to parse keeps its last good display and reports the error. One bad statement does not clear the page.

Finish line: opening the cylinder note shows five displays and the solved temperature. Editing `66` changes the temperature after the pause. Breaking the last line keeps the previous temperature on the page and marks the source line. A line without a prefix is never treated as prose.

Leave the ribbon and MathLive mounted but unused, so this phase can land without a delete of the old editor in the same change. Do not build scroll sync or export here.

## Phase 4. Touch the code, see the term

Selection changes in Monaco call `hitNode` and re-render only that statement's input LaTeX. Neighboring statements stay as they are.

A `mousedown` on the page does not move focus. The innermost `span` under the pointer becomes Monaco's selection. Dragging across the painted math extends that selection to the union of the spans touched, then `hitNode` picks the covering node. Clicking the computed value or a plot selects the whole statement.

Alt+Up selects the parent node's span. Alt+Down selects the first child's span. The page highlight grows and shrinks with that selection.

Hovering a painted node may decorate the matching source range. Ship the click path first. Hover is optional and does not block the finish line.

Finish line: in the cylinder note, selecting `P*V` lights only the product in the typeset equation. The solved temperature stays unlit. Clicking the product selects `P*V` in Monaco. Alt+Up from there selects the whole right-hand side.

## Phase 5. Headings and paragraphs on the page

Paint the markers away. A `#` line becomes a heading at its level. A `-- ` line becomes a paragraph, without the dashes. `$...$` inside that paragraph typesets inline, under the rules in spec section 3. Statements stay displays.

The document tree used here is the same tree export will walk later.

Finish line: the cylinder note shows the heading and both paragraphs as a page, with the five displays between them. The markers `#` and `--` do not appear on the page.

## Phase 6. Scroll sync

Each block's file span is an anchor on the page. Scrolling the editor reveals the block that contains the caret. Scrolling the page moves the editor to the block at the top of the page. Clicking a paragraph on the page puts the caret at that span.

Monaco's line height stays uniform. A tall integral does not stretch a source line. Sync uses spans, not `lineNumber * lineHeight`.

Finish line: a note long enough to scroll keeps the caret's block on screen in both panes. Clicking the closing paragraph puts the caret in that paragraph.

## Phase 7. Export, import, and removal

Export walks the phase 5 document tree. Math uses `toLatex(node, null)`. A heading becomes a sectioning command. A paragraph becomes text, with `$...$` inlined. The exported file contains no `htmlClass` and no `htmlData`.

Completion offers the core names from spec section 4.6, and Pint unit names when the caret is inside unit brackets. Monaco colors a heading, a paragraph prefix, and a statement differently.

Import reads a legacy JSON `.regne` file, recognized by a leading `{`, into the text language: text becomes `-- ` lines, math `input` becomes a bare statement, sections become `#` lines. The import is lossy where the old file stored LaTeX that is not the new language, and it says so rather than inventing a translation.

Then remove the unused editor: MathLive, the ribbons, the palettes, the per-line mode switch, and the section widgets. Settings for the engine and the Python environment stay. The menu keeps file, edit, and export. It loses insert-math and the sidebar chords that existed for the palettes.

Finish line: export of the cylinder note is LaTeX a person can compile, with no highlight markup. An old JSON `.regne` file opens as text with prefixes. The window is the two panes and the settings entry, and the app builds without `mathlive`.

## After this roadmap

These are real, and they are not part of the seven phases:

- A rendered view of the source pane.
- Bullet lists, emphasis, and links.
- Units inside `diff`, `integrate`, and `solve`.
- PDF. The page is HTML until export grows a second target.
- Checking comparisons. The parser accepts `<` and friends so they typeset. They do not solve.
- Editing the painted equation.

## Working agreement

A phase is done when its finish line is true in the running app, or in the test suite for phases 1 and 2. A phase does not add a pane, a shortcut, or a syntax form the spec does not name. The cylinder note is the manual check from phase 3 onward. If that note is wrong on screen, the phase is not finished.
