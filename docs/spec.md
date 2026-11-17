# Regne spec

A line is Regne. The file is a sequence of statements, and the page shows each one as mathematics. Prose and headings are the exception, and they opt in with a prefix. The left pane is the source. The right pane is the typeset page. A selection in a statement can light the same subexpression on the page.

This replaces the current row of MathLive fields, text blocks, and section widgets. The CAS session stays sequential. SymPy still evaluates mathematics. Pint evaluates units.

## 1. Layout

Two panes, in the Overleaf arrangement.

| Pane | Role |
| --- | --- |
| Left | The source. Monaco. Always the source. |
| Right | The document. Headings, paragraphs, typeset statements, and computed results. |

The page scrolls with the source. A heading, paragraph, or statement owns a range in the file, and the matching block on the right scrolls into view with it. Clicking a block on the page moves the caret to that range.

The right pane is not a second editor. Nothing on the page is typed into. Clicking math there only selects the matching source.

There is no rendered view of the left pane. The source is the file, including the lines that will become paragraphs.

Chrome around the two panes stays out of the writing surface. Symbol palettes, the ribbon, and the per-line mode switch go away. Names and snippets come from Monaco's completion list (`diff`, `integrate`, `solve`, unit names).

## 2. What a person sees

A short file, `cylinder.regne`:

```regne
# Charge in a cylinder

- The holdup is fixed. Pressure and volume are measured.
n := 2 [mol]
P := 10 [bar]
V := 66 [L]
R := 8.314 [J/(mol*K)]
T = P*V / (n*R)

- The temperature follows from the ideal gas law.
```

`n := 2 [mol]` is a statement because nothing marks it otherwise. The page shows the heading and the paragraphs as text, without the `#` or the leading `-`. Each statement becomes a displayed line of mathematics, with its value underneath in the output color:

- \( n := 2\,\mathrm{mol} \)
- \( P := 10\,\mathrm{bar} \)
- \( V := 66\,\mathrm{L} \)
- \( R := 8.314\,\mathrm{J}/(\mathrm{mol}\,\mathrm{K}) \)
- the equation \( T = PV/(nR) \), and under it the solved quantity

Selecting `P*V` highlights only the product \(PV\) inside the typeset equation. The solved temperature is not part of that highlight. It is a different expression.

## 3. The file

The file is UTF-8 text, extension `.regne`.

Leading whitespace does not change the kind of a line. After that, the first characters decide:

| Line | Kind |
| --- | --- |
| empty | Nothing on the page. |
| `//` and the rest of the line | A comment. Nothing on the page. |
| `#`, `##`, or `###`, then a space, then a title | A heading. One, two, or three hashes are the level. The marker is not printed. |
| `-`, then the paragraph | Text. A single space after the dash is skipped. The dash is not printed. |
| anything else | A Regne statement. |

A statement may continue onto the next physical line by ending with `\`. The continuation is still a statement. A heading or a paragraph does not continue that way. One paragraph is one line.

`-` is how prose enters the file. It is not a bullet list. The page prints it as a paragraph.

Inside a paragraph, `$` and `$` wrap one expression. That expression typesets in the sentence. It evaluates when it has a constant value, and the value may sit inline beside it. A call such as `$diff(x^2, x)$` typesets the operator form and does not grow a solved line inside the sentence. `$` has no meaning in a statement. A statement that needs a dollar sign is out of scope.

```regne
# Charge in a cylinder

- The holdup is fixed.
n := 2 [mol]

- The derivative of $x^2$ is taken next.
diff(x^2, x)
```

Blank lines and `//` comments may sit between statements. They do not affect the session. Statements run in document order, and a heading or a paragraph between them does not reset it.

Indentation does not group statements.

A legacy `.regne` file whose first non-whitespace character is `{` is the old JSON document. It can be imported. New work is authored as text. The editor no longer round-trips LaTeX from MathLive into the solver.

## 4. Language

The language is a calculator that looks like Python. It is not Python. There is no indentation, no statements-as-expressions beyond the forms below, and no arbitrary Python execution.

### 4.1 Statements

```text
statement   = assignment | equation | expression
assignment  = lvalue ":=" expression
equation    = expression "=" expression
lvalue      = name | name "(" name ("," name)* ")"
```

Examples, and what they mean:

| Source | Meaning |
| --- | --- |
| `diff(x^2, x)` | Evaluate the call. |
| `0 = x^2 + 2*x - 4` | An equation. Solve for the unknowns. |
| `a := 10 + 5` | Bind `a` in the session. |
| `f(x) := x^2 + 1` | Bind a function. |
| `10 [bar] * 66 [L]` | A product of quantities. |

`=` is an equation, never an assignment. `:=` is the only assignment. `==` is not used.

An equation with one unbound symbol is solved for that symbol. `0 = x^2 + 2*x - 4` solves for `x`. More than one unbound symbol is not guessed. The author writes `solve(equation, name)`. Names already bound in the session are knowns.

### 4.2 Expressions

```text
expression  = conversion
conversion  = comparison ("in" unit)?
comparison  = sum (("<" | "<=" | ">" | ">=") sum)?
sum         = term (("+" | "-") term)*
term        = factor (("*" | "/") factor)*
factor      = power
power       = unary ("^" unary)*
unary       = ("+" | "-") unary | postfix
postfix     = primary unit?
primary     = number | name | call | "(" expression ")" | list
call        = name "(" arguments? ")"
arguments   = expression ("," expression)*
list        = "[" expression ("," expression)* "]"
unit        = "[" unitexpr "]"
```

`^` is power, right-associative. `*` and `/` are left-associative. Juxtaposition is not multiplication: `2x` is an error, and the author writes `2*x`. The one place two tokens sit beside each other without an operator is a value and its unit: `10 [bar]`.

Whitespace around `[` is optional. `10[bar]` and `10 [bar]` are the same quantity.

`[]` has two roles, distinguished by position:

- After a primary, `[...]` is a unit. `10 [bar]`. The inside is a unit expression: names, `*`, `/`, `^`, parentheses, and integer exponents. Commas are an error.
- As a primary, `[...]` is a list. `[1, 2, 3]`. A comma is what makes the brackets a list. `[bar]` in primary position is a list of one name, not a unit. A unit needs a value on its left, or the `in` form.

Unit expression grammar, used only inside unit brackets and after `in`:

```text
unitexpr = unitterm (("/" | "*") unitterm)*
unitterm = unitpow
unitpow  = unitatom ("^" integer)?
unitatom = name | "(" unitexpr ")"
```

`10 [kg*m/s^2]` is one quantity. `(10 [bar] * 66 [L]) in [J]` converts the value into joules. `in` is postfix and binds looser than the arithmetic. Conversion is a request to Pint, not a new kind of algebra.

Comparison operators exist so a relation can be typeset and, later, checked. They do not solve. Solving is `=` or `solve(...)`.

### 4.3 Numbers, names, comments

Numbers are decimals: `10`, `8.314`, `1e-3`. Names are `letter (letter | digit | "_")*`. A single underscore is not a wildcard.

`//` starts a comment that runs to the end of the line. `#` is not a comment. A line that begins with `#` is a heading, defined in section 3.

There are no strings and no attribute access in the first version.

### 4.4 Pretty forms

The page does not print `\mathrm{diff}`. The printer knows a small set of calls and draws them as the mathematics they stand for. The source text does not change.

| Call | Drawn as |
| --- | --- |
| `diff(f, x)` | \(\dfrac{d}{dx} f\) |
| `diff(f, x, n)` | the n-th derivative |
| `integrate(f, x)` | \(\int f \, dx\) |
| `integrate(f, (x, a, b))` | the definite integral |
| `sqrt(a)` | \(\sqrt{a}\) |
| `abs(a)` | \(\lvert a \rvert\) |
| `solve(eqn, x)` | the equation, then the solution set as the value |

Unknown calls print as a function application, \(\mathrm{name}(args)\).

The value under the display is whatever the evaluator returns, printed on its own. For `diff(x^2, x)` the display is the derivative operator applied to \(x^2\), and the value underneath is \(2x\).

### 4.5 Session

Statements run from top to bottom. A binding from `:=` is visible to every statement below it and invisible above it. Headings, paragraphs, blank lines, and comments do not change the session. `restart` on its own line clears the session from that point downward. The page below is computed against the cleared session.

Recompute is debounced, on the order of a third of a second after typing pauses. A statement that does not parse keeps the last good rendering of that statement and shows the error on the source line. One bad line does not blank the rest of the page.

Results are not part of the source. They are a cache keyed by the statement and the bindings it used.

### 4.6 Core names

Always bound, and completed in the editor:

`diff`, `integrate`, `solve`, `simplify`, `factor`, `expand`, `limit`, `series`, `subs`, `sqrt`, `abs`, `log`, `ln`, `exp`, `sin`, `cos`, `tan`, `pi`, `E`, `I`, `oo`, `plot`, `restart`.

`plot(...)` produces a figure on the page under that statement, at the content width, not a line of mathematics. Plot syntax stays the one the worker already accepts (`plot(sin(x), x = -5..5)`), with `=` inside the range read as a plot domain rather than as an equation to solve. That special case belongs to the plot call only.

## 5. Units

A quantity is a magnitude plus a Pint unit. The parser builds the quantity. The evaluator does not ask SymPy to understand brackets.

- `10 [bar]` becomes `10 * ureg("bar")`.
- Multiplication, division, and power of quantities go through Pint.
- `in [J]` is `quantity.to(ureg("J"))`.
- A dimensionless expression stays in SymPy. `diff(x^2, x)` never enters Pint.
- A quantity mixed into `diff`, `integrate`, `solve`, or `simplify` is an error in the first version: "this operation does not take units yet." Arithmetic, assignment, conversion, and display of quantities do.
- The displayed unit is the unit Pint gives back, typeset as `\mathrm{...}` with `\cdot` and `/`, not as a raw Pint string dumped in monotype.
- Offset units (`degC`, `degF`) are accepted only where Pint accepts them. Adding two Celsius temperatures is Pint's error, surfaced under the statement, not a special case we paper over.

Bound names carry their quantity. After `P := 10 [bar]`, a later `P` is that quantity, magnitude and unit together.

## 6. Parser and highlight

The math parser is ours. SymPy's `parse_expr` and Pint's parser are backends, called after our tree exists. They are not the thing the editor highlights through.

Every node stores a span: start and end as UTF-16 offsets into the file, so they match Monaco. The span covers the source text of that node, including the unit brackets of a quantity and excluding surrounding whitespace.

```text
Node        span covers
Quantity    10 [bar]
Mul         10 [bar] * 66 [L]
Power       x^2
Call        diff(x^2, x)
Equation    0 = x^2 + 2*x - 4
```

`to_latex(node, hit)` walks the tree and returns a KaTeX string. `hit` is a span, or nothing.

The hit node is the smallest node whose span contains the editor selection. A caret uses the same rule with an empty selection at the caret. A selection that covers two siblings uses their parent. A selection that sits in whitespace, in a comment, in a heading, or in a paragraph hits no math node. A selection inside `$...$` hits the expression between the dollars.

When a node is the hit, the printer wraps that node's LaTeX and nothing else:

```latex
\htmlClass{regne-hit}{ ... }
```

KaTeX renders this with trust enabled for `htmlClass` and `htmlData`. The class is the only highlight. The page CSS paints it. The wrapper is not part of the exported LaTeX. Export calls `to_latex(node, none)`.

Each rendered node also carries the span that produced it:

```latex
\htmlData{span=120:128}{ x^{2} }
```

A click or drag on the page reads the innermost `span` under the pointer and sets Monaco's selection to it. `mousedown` on the page does not move focus out of the editor.

The reverse direction is the same map. Changing Monaco's selection recomputes `hit` and re-renders the LaTeX of that one statement. Neighboring statements are not reprinted. Hovering a painted node can decorate the matching source range, and that decoration is optional.

Highlight never applies to the computed value. The value is a separate tree, usually from SymPy, and it has no spans back into `diff(sin(x), x)` once the sine has become a cosine. The page may still show the value under the display. Touching the value selects the whole statement, not a fictional subexpression.

Pretty-printing has to preserve the map. `diff(x^2, x)` draws a fraction-style derivative, and the node for `x^2` is still the content of that derivative, wrapped if it is the hit. The printer must not build the picture by string-replacing SymPy's LaTeX.

## 7. Evaluation pipeline

For each statement that parsed:

1. Lower pure mathematics to SymPy. Calls, powers, equations, and function bindings take the path the worker already uses.
2. Lower quantities to Pint. A product of quantities is Pint arithmetic. A symbol bound to a quantity loads that quantity.
3. Ask SymPy for a value when the statement is dimensionless mathematics. Ask Pint when it is a quantity. An equation of quantities is converted to a common base unit on each side and then solved as magnitudes, and the result is labeled with that unit. If that conversion is not possible, the statement errors.
4. Print the input tree with `to_latex` for the display. Print the value with SymPy's `latex` or a Pint printer for the line underneath. The value printer does not take a hit span.

Errors carry the span of the offending node when the parser or the lowering step knows it, and a line-and-column otherwise. The source shows a squiggle. The page shows the message under that display.

## 8. Document pane

The page is HTML, the same sheet the app already draws, not a PDF. Headings and paragraphs render as text. Each statement renders to a display: input mathematics, then the value or the figure or the error.

Export to LaTeX walks the same document tree. Math export uses `to_latex` without a hit. A heading becomes a sectioning command at its level. A paragraph becomes text, with each `$...$` inlined as mathematics. Export is not a second renderer with its own idea of the expression.

Scroll sync uses the file spans of blocks, not a guess from line height. Monaco line heights stay uniform. The page has whatever height the mathematics needs. The two panes meet at spans, so a tall integral does not have to stretch a code line.

## 9. Editor behavior

- One Monaco model for the file. One undo stack. One keymap. One view: the source.
- Tab stays in the editor.
- The line prefix is colored so a heading, a paragraph, and a statement are distinct before the page catches up.
- Completion offers the core names and Pint unit names when the caret is inside unit brackets.
- The page is not in the tab order.
- Debounced recompute, last-good-render on a parse error, as in section 4.5.
- Structural selection: Alt+Up selects the parent node of the current hit, and the highlight on the page grows with it. Alt+Down selects the first child. This is the keyboard form of touching the equation.

## 10. Build order

The language and the highlight are usable before headings are painted on the page.

1. Parser, spans, `to_latex`, and the hit wrapper. Golden tests for the examples in this spec.
2. Lowering to SymPy and Pint. `10 [bar] * 66 [L]`, `a := 10 + 5`, `diff(x^2, x)`, `0 = x^2 + 2*x - 4`.
3. The two panes: Monaco on a `.regne` text file, page on the right, statements rendered. Lines are classified by the prefixes in section 3.
4. Selection in the source moves the hit. Click on the page selects the span.
5. Headings and paragraphs painted on the page, markers omitted.
6. Scroll sync by span.
7. LaTeX export without highlight wrappers.

## 11. Out of scope

- A rendered or rich-text mode on the left.
- A fenced block, or a Markdown document that contains Regne.
- Editing the painted equation.
- A MathLive field, a ribbon, or a symbol drawer.
- Highlighting inside a computed result.
- Bullet lists, emphasis, and links. A `-` line is a paragraph.
- Units inside `diff`, `integrate`, and `solve`, until the dimensionless path and the quantity path are both dull.
- Running arbitrary Python.
- A PDF preview. The page is HTML. PDF can be a later export.
