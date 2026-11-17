import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { CYLINDER_NOTE, readDocument, statementsIn } from "../../src/language/document";

function kinds(source: string): string[] {
  return readDocument(source).blocks.map((block) => block.kind);
}

describe("readDocument", () => {
  test("the cylinder note is a heading, two paragraphs, and five statements", () => {
    const file = readDocument(CYLINDER_NOTE);
    assert.equal(file.legacy, false);
    assert.deepEqual(
      file.blocks.map((block) => block.kind),
      ["heading", "blank", "paragraph", "statement", "statement", "statement", "statement", "statement", "blank", "paragraph"],
    );
    const heading = file.blocks[0];
    assert.equal(heading.kind, "heading");
    if (heading.kind === "heading") {
      assert.equal(heading.level, 1);
      assert.equal(heading.title, "Charge in a cylinder");
      assert.equal(CYLINDER_NOTE.slice(heading.marker.start, heading.marker.end), "#");
    }
    const statements = statementsIn(file);
    assert.equal(statements.length, 5);
    assert.equal(statements.every((block) => block.error === null && block.parsed !== null), true);
    assert.equal(statements[0].source, "n := 2 [mol]");
    assert.equal(statements[4].source, "T = P*V / (n*R)");
    const prose = file.blocks.filter((block) => block.kind === "paragraph");
    assert.equal(prose.length, 2);
    if (prose[0].kind === "paragraph") {
      assert.equal(prose[0].text.startsWith("-"), false);
      assert.match(prose[0].text, /^The holdup/);
    }
  });

  test("a bare line is a statement, and a hash without a space is not a heading", () => {
    const file = readDocument("n := 2\n#title\n## Two\n### Three\n#### Four\n");
    assert.equal(file.blocks[0].kind, "statement");
    assert.equal(file.blocks[1].kind, "statement");
    if (file.blocks[1].kind === "statement") assert.ok(file.blocks[1].error);
    assert.equal(file.blocks[2].kind, "heading");
    if (file.blocks[2].kind === "heading") assert.equal(file.blocks[2].level, 2);
    assert.equal(file.blocks[3].kind, "heading");
    if (file.blocks[3].kind === "heading") assert.equal(file.blocks[3].level, 3);
    assert.equal(file.blocks[4].kind, "statement");
  });

  test("a dash is a paragraph, and one space after it is not part of the text", () => {
    const file = readDocument("- The holdup is fixed.\n-No space\n");
    const first = file.blocks[0];
    const second = file.blocks[1];
    assert.equal(first.kind, "paragraph");
    assert.equal(second.kind, "paragraph");
    if (first.kind === "paragraph") assert.equal(first.text, "The holdup is fixed.");
    if (second.kind === "paragraph") assert.equal(second.text, "No space");
  });

  test("comments and blank lines are not statements", () => {
    const file = readDocument("n := 1\n\n// quiet\n  // also\nn := 2\n");
    assert.deepEqual(kinds("n := 1\n\n// quiet\n  // also\nn := 2\n"), [
      "statement",
      "blank",
      "comment",
      "comment",
      "statement",
    ]);
    assert.equal(statementsIn(file).length, 2);
  });

  test("leading whitespace does not change the kind", () => {
    assert.deepEqual(kinds("  # Title\n\t- Paragraph\n  n := 1\n"), ["heading", "paragraph", "statement"]);
  });

  test("a trailing backslash joins a statement and not a paragraph", () => {
    const joined = readDocument("a + \\\nb\n");
    assert.equal(joined.blocks.length, 1);
    assert.equal(joined.blocks[0].kind, "statement");
    if (joined.blocks[0].kind === "statement") {
      assert.equal(joined.blocks[0].error, null);
      assert.equal(joined.blocks[0].parsed?.node.type, "binary");
      assert.equal(joined.blocks[0].source, "a + \\\nb");
    }

    const prose = readDocument("- stays one line \\\nnext\n");
    assert.deepEqual(
      prose.blocks.map((block) => block.kind),
      ["paragraph", "statement"],
    );
  });

  test("dollars inside a paragraph are an expression, and a bare dollar line is a statement", () => {
    const file = readDocument("- The derivative of $x^2$ is taken next.\n$x$\n");
    const paragraph = file.blocks[0];
    assert.equal(paragraph.kind, "paragraph");
    if (paragraph.kind !== "paragraph") return;
    assert.equal(paragraph.math.length, 1);
    assert.equal(paragraph.math[0].source, "x^2");
    assert.equal(paragraph.math[0].error, null);
    assert.equal(paragraph.math[0].parsed?.node.type, "binary");
    const slice = "- The derivative of $x^2$ is taken next.".slice(
      paragraph.math[0].span.start,
      paragraph.math[0].span.end,
    );
    assert.equal(slice, "$x^2$");
    assert.equal(file.blocks[1].kind, "statement");
  });

  test("an unclosed dollar stays text", () => {
    const file = readDocument("- price is $12\n");
    const paragraph = file.blocks[0];
    assert.equal(paragraph.kind, "paragraph");
    if (paragraph.kind === "paragraph") assert.equal(paragraph.math.length, 0);
  });

  test("one bad statement does not swallow the next", () => {
    const file = readDocument("2x\nn := 1\n");
    assert.equal(file.blocks[0].kind, "statement");
    assert.equal(file.blocks[1].kind, "statement");
    if (file.blocks[0].kind === "statement") assert.ok(file.blocks[0].error);
    if (file.blocks[1].kind === "statement") assert.equal(file.blocks[1].error, null);
  });

  test("a file that opens with a brace is the old JSON document", () => {
    assert.equal(readDocument("{\n  \"rows\": []\n}").legacy, true);
    assert.equal(readDocument("  {\n").blocks.length, 0);
    assert.equal(readDocument("// note\n{\n").legacy, false);
  });

  test("an empty file and a trailing newline", () => {
    assert.equal(readDocument("").blocks.length, 0);
    assert.deepEqual(kinds("a\n"), ["statement"]);
    assert.deepEqual(kinds("a\n\n"), ["statement", "blank"]);
  });
});
