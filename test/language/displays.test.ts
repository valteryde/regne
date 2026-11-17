import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readDocument } from "../../src/language/document";
import { FreshValue, reconcileDisplays } from "../../src/language/displays";

const NOTE = `n := 2 [mol]
T = P*V / (n*R)
`;

function valuesFor(fileText: string): FreshValue[] {
  return readDocument(fileText)
    .blocks.filter((block) => block.kind === "statement" && block.error === null)
    .map((block) => ({
      latex: block.kind === "statement" ? `value:${block.source}` : "",
      kind: "expression",
    }));
}

describe("reconcileDisplays", () => {
  test("each parsed statement gets the next value, and the input is the typeset tree", () => {
    const file = readDocument(NOTE);
    const displays = reconcileDisplays(file.blocks, [], valuesFor(NOTE));
    assert.equal(displays.length, 2);
    assert.match(displays[0].inputLatex, /\\mathrm\{mol\}/);
    assert.equal(displays[0].valueLatex, "value:n := 2 [mol]");
    assert.equal(displays[0].stale, false);
    assert.equal(displays[0].error, null);
    assert.match(displays[1].inputLatex, /\\frac/);
  });

  test("a broken statement keeps the previous drawing and reports the error", () => {
    const good = readDocument("T = P*V / (n*R)\n");
    const previous = reconcileDisplays(good.blocks, [], [{ latex: "293\\,\\mathrm{K}", kind: "quantity" }]);
    const broken = readDocument("T = P*V / (\n");
    const displays = reconcileDisplays(broken.blocks, previous, []);
    assert.equal(displays.length, 1);
    assert.equal(displays[0].stale, true);
    assert.equal(displays[0].valueLatex, "293\\,\\mathrm{K}");
    assert.match(displays[0].inputLatex, /\\frac/);
    assert.ok(displays[0].error);
  });

  test("a bad line does not consume the value of the next statement", () => {
    const file = readDocument("2x\nn := 1\n");
    const displays = reconcileDisplays(file.blocks, [], [{ latex: "1", kind: "expression" }]);
    assert.equal(displays[0].stale, false);
    assert.equal(displays[0].inputLatex, "");
    assert.ok(displays[0].error);
    assert.equal(displays[1].valueLatex, "1");
    assert.match(displays[1].inputLatex, / := /);
  });

  test("an evaluation error is shown and is not a stale drawing", () => {
    const file = readDocument("diff(10 [m], x)\n");
    const displays = reconcileDisplays(file.blocks, [], [
      { latex: "", kind: "error", message: "this operation does not take units yet." },
    ]);
    assert.equal(displays[0].stale, false);
    assert.equal(displays[0].error, "this operation does not take units yet.");
    assert.match(displays[0].inputLatex, /\\mathrm\{m\}/);
  });

  test("a heading between statements is not a display", () => {
    const file = readDocument("a := 1\n# Later\nb := 2\n");
    const displays = reconcileDisplays(file.blocks, [], [
      { latex: "1", kind: "expression" },
      { latex: "2", kind: "expression" },
    ]);
    assert.equal(displays.length, 2);
    assert.equal(displays[1].valueLatex, "2");
  });
});
