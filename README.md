# Regne

Regne is a document for calculations. The file is the source. The page beside it is the note: headings, prose, and mathematics, with the result under each statement.

A line is a statement unless it says otherwise.

| Line | On the page |
| --- | --- |
| `# Charge in a cylinder` | A heading. The marker is not printed. |
| `-- The holdup is fixed.` | A paragraph. |
| `n := 2 [mol]` | The quantity, and its value underneath. |
| `T = P*V / (n*R)` | The equation, and the solved quantity. |
| `// a note` | Nothing. |

`$diff(x^2, x)$` inside a paragraph typesets in the sentence. `plot(sin(x), x = -5..5)` draws under that statement. A file that still starts with `{` is a legacy document and can be imported as text.

## Run

```bash
npm install
npm run dev
npm test
npm start
```

`npm run dev` serves the window and a local engine. `npm start` builds the desktop app. The app keeps SymPy, Pint, and Kaxe in its own Python environment, and Settings can repair that environment. A release is published by pushing a `v*` tag; the workflow builds macOS and Windows and attaches the installers to the GitHub release.
