import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { importLegacy } from "../../src/language/import";

describe("a legacy document", () => {
  test("text, math, and sections become the text language, and LaTeX is named", () => {
    const source = JSON.stringify({
      elements: [
        { type: "section", title: "Charge", level: 1, kind: "section" },
        { type: "text", content: "The holdup is <b>fixed</b>." },
        { type: "section", title: "A theorem", level: 2, kind: "theorem" },
        { type: "math", input: "n := 2 [mol]" },
        { type: "math", input: "\\frac{d}{dx}\\sin(x)" },
      ],
    });
    const imported = importLegacy(source);
    assert.match(imported.text, /^# Charge\n/);
    assert.match(imported.text, /- The holdup is fixed\./);
    assert.match(imported.text, /## A theorem/);
    assert.match(imported.text, /n := 2 \[mol\]/);
    assert.match(imported.text, /\/\/ \\frac/);
    assert.equal(imported.text.includes("<b>"), false);
    assert.equal(imported.notes[0], "Text formatting was dropped.");
    assert.equal(imported.notes.some((note) => note.startsWith("A theorem became a heading")), true);
    assert.equal(imported.notes.some((note) => note.startsWith("Left a formula as a comment")), true);
  });

  test("a file that is not a document says so", () => {
    const imported = importLegacy("{ not json");
    assert.match(imported.text, /not a document/);
    assert.equal(imported.notes.length, 1);
  });
});
