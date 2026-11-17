import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { insideUnit, lineTone, suggestions, unitInsert } from "../../src/language/complete";

describe("line color", () => {
  test("a heading, a paragraph, a comment, and a statement are different", () => {
    assert.equal(lineTone("# Charge in a cylinder"), "heading");
    assert.equal(lineTone("## Next"), "heading");
    assert.equal(lineTone("### Detail"), "heading");
    assert.equal(lineTone("-- The holdup is fixed."), "paragraph");
    assert.equal(lineTone("  -- Indented"), "paragraph");
    assert.equal(lineTone("-5"), "statement");
    assert.equal(lineTone("--x"), "statement");
    assert.equal(lineTone("--5"), "statement");
    assert.equal(lineTone("- The holdup is fixed."), "statement");
    assert.equal(lineTone("// a note"), "comment");
    assert.equal(lineTone("n := 2 [mol]"), "statement");
    assert.equal(lineTone("#title"), "statement");
    assert.equal(lineTone("#### Too many"), "statement");
  });
});

describe("completion", () => {
  test("a prefix offers the core names, and a unit bracket offers pint names", () => {
    assert.deepEqual(suggestions("di"), ["diff"]);
    assert.equal(suggestions("n := 2 [ba").includes("bar"), true);
    assert.equal(suggestions("x in [J").includes("J"), true);
    assert.equal(insideUnit("n := 2 [mol"), true);
    assert.equal(insideUnit("[1, 2"), false);
    assert.equal(insideUnit("n := 2 [mol] + "), false);
    assert.equal(suggestions("n := 2 ").includes("diff"), true);
  });

  test("a picked unit is bracketed unless the caret is already inside a unit", () => {
    assert.deepEqual(unitInsert("n := 10 ", "bar"), { text: "[bar]", caret: 4 });
    assert.equal(unitInsert("n := 10 ", "bar").text[4], "]");
    assert.deepEqual(unitInsert("x in ", "J"), { text: "[J]", caret: 2 });
    assert.deepEqual(unitInsert("[1, ", "m"), { text: "[m]", caret: 2 });
    assert.deepEqual(unitInsert("n := 10 [", "bar"), { text: "bar", caret: 3 });
    assert.deepEqual(unitInsert("n := 10 [ba", "bar"), { text: "bar", caret: 3 });
  });
});
