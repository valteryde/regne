import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { CYLINDER_NOTE, readDocument } from "../../src/language/document";
import { FreshValue } from "../../src/language/displays";
import { paint } from "../../src/language/session";
import { anchorAt, constantLatex, evaluationPlan, pageDocument, pageText } from "../../src/language/page";

const TEMPERATURE: FreshValue = { latex: "3969.21\\,\\mathrm{K}", kind: "quantity" };

function fiveValues(): FreshValue[] {
  return [
    { latex: "2\\,\\mathrm{mol}", kind: "quantity" },
    { latex: "10\\,\\mathrm{bar}", kind: "quantity" },
    { latex: "66\\,\\mathrm{l}", kind: "quantity" },
    { latex: "8.314\\,\\mathrm{J}/(\\mathrm{mol}\\cdot\\mathrm{K})", kind: "quantity" },
    TEMPERATURE,
  ];
}

describe("the painted page", () => {
  test("the cylinder note is a heading, two paragraphs, and five displays", () => {
    const blocks = pageDocument(CYLINDER_NOTE, paint(CYLINDER_NOTE, fiveValues(), []), null);
    const heading = blocks.find((block) => block.kind === "heading");
    const paragraphs = blocks.filter((block) => block.kind === "paragraph");
    const displays = blocks.filter((block) => block.kind === "display");
    assert.equal(heading?.kind, "heading");
    if (heading?.kind === "heading") assert.equal(heading.title, "Charge in a cylinder");
    assert.equal(paragraphs.length, 2);
    if (paragraphs[0]?.kind === "paragraph" && paragraphs[1]?.kind === "paragraph") {
      assert.equal(paragraphs[0].parts.map((part) => (part.kind === "text" ? part.text : "")).join(""), "The holdup is fixed. Pressure and volume are measured.");
      assert.equal(paragraphs[1].parts.map((part) => (part.kind === "text" ? part.text : "")).join(""), "The temperature follows from the ideal gas law.");
    }
    assert.equal(displays.length, 5);
    if (displays[4]?.kind === "display") assert.equal(displays[4].display?.valueLatex, TEMPERATURE.latex);
    const visible = pageText(blocks);
    assert.equal(visible.includes("#"), false);
    assert.equal(visible.includes("-"), false);
    const closing = paragraphs[1];
    if (closing?.kind === "paragraph") {
      assert.equal(anchorAt(blocks, closing.caret), closing);
      assert.equal(CYLINDER_NOTE.slice(closing.caret, closing.caret + 15), "The temperature");
    }
  });

  test("dollars in a paragraph typeset, and a call keeps the operator form", () => {
    const source = "-- The derivative of $x^2$ is taken next.\n-- Then $diff(x^2, x)$ stays in the sentence.\n";
    const blocks = pageDocument(source, [], null);
    const paragraphs = blocks.filter((block) => block.kind === "paragraph");
    assert.equal(paragraphs.length, 2);
    const first = paragraphs[0];
    const second = paragraphs[1];
    if (first?.kind !== "paragraph" || second?.kind !== "paragraph") return;
    assert.deepEqual(
      first.parts.map((part) => part.kind),
      ["text", "math", "text"],
    );
    const math = first.parts[1];
    if (math.kind === "math") {
      assert.match(math.latex, /x\}\^\{/);
      assert.match(math.latex, /\{2\}/);
      assert.equal(math.valueLatex, null);
    }
    const call = second.parts.find((part) => part.kind === "math");
    if (call?.kind === "math") {
      assert.match(call.latex, /dfrac/);
      assert.equal(call.valueLatex, null);
    }
    assert.equal(pageText(blocks).includes("-"), false);
  });

  test("a constant value sits beside the expression, and a symbol does not repeat itself", () => {
    const source = "-- Twice $2 + 2$ and a square $x^2$.\n";
    const file = readDocument(source);
    const paragraph = file.blocks[0];
    assert.equal(paragraph.kind, "paragraph");
    if (paragraph.kind !== "paragraph") return;
    const sum = paragraph.math[0];
    const square = paragraph.math[1];
    const values = new Map<number, FreshValue>([
      [sum.span.start, { latex: "4", kind: "expression" }],
      [square.span.start, { latex: "x^{2}", kind: "expression" }],
    ]);
    const blocks = pageDocument(source, [], null, values);
    const painted = blocks[0];
    if (painted?.kind !== "paragraph") return;
    const maths = painted.parts.filter((part) => part.kind === "math");
    if (maths[0]?.kind === "math") assert.equal(maths[0].valueLatex, "4");
    if (maths[1]?.kind === "math") assert.equal(maths[1].valueLatex, null);
  });

  test("a selection inside the dollars lights that expression", () => {
    const source = "-- The square is $x^2$.\n";
    const file = readDocument(source);
    const paragraph = file.blocks[0];
    if (paragraph.kind !== "paragraph" || !paragraph.math[0].parsed) return;
    const node = paragraph.math[0].parsed.node;
    const inner = node.type === "binary" ? node.right.span : node.span;
    const blocks = pageDocument(source, [], inner);
    const painted = blocks[0];
    if (painted?.kind !== "paragraph") return;
    const math = painted.parts.find((part) => part.kind === "math");
    if (math?.kind === "math") assert.match(math.latex, /regne-hit/);
  });

  test("inline constants are evaluated in order, and a derivative is not", () => {
    const source = "n := 2\n-- Twice is $n + n$.\n-- The derivative $diff(x^2, x)$ stays a form.\n";
    const plan = evaluationPlan(readDocument(source).blocks);
    assert.deepEqual(
      plan.map((item) => item.role),
      ["statement", "inline"],
    );
    assert.equal(plan[1].source, "n + n");
  });

  test("an unparsed dollar pair stays as text", () => {
    const source = "-- Broken $2x$ stays visible.\n";
    const blocks = pageDocument(source, [], null);
    const paragraph = blocks[0];
    if (paragraph?.kind !== "paragraph") return;
    const text = paragraph.parts.map((part) => (part.kind === "text" ? part.text : "")).join("");
    assert.match(text, /\$2x\$/);
  });
});

describe("a constant beside an expression", () => {
  test("a quantity is shown and a letter-bearing result is not", () => {
    assert.equal(constantLatex("2", { latex: "2\\,\\mathrm{mol}", kind: "quantity" }), "2\\,\\mathrm{mol}");
    assert.equal(constantLatex("x^{2}", { latex: "x^{2}", kind: "expression" }), null);
    assert.equal(constantLatex("2 + 2", { latex: "4", kind: "expression" }), "4");
    assert.equal(constantLatex("4", { latex: "4", kind: "expression" }), null);
  });
});
