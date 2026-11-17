import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { CYLINDER_NOTE, readDocument } from "../../src/language/document";
import { paint } from "../../src/language/session";
import {
  paintSelection,
  selectionFromPointer,
  spanAttribute,
  spanFromHost,
  stepSelection,
  unionSpan,
} from "../../src/language/selection";
import { hitNode } from "../../src/language/hit";
import { find } from "./fixture";

const TEMPERATURE = "3969\\,\\mathrm{K}";

function equation() {
  const block = readDocument(CYLINDER_NOTE).blocks.find(
    (item) => item.kind === "statement" && item.source.startsWith("T ="),
  );
  if (!block || block.kind !== "statement" || !block.parsed) throw new Error("missing equation");
  return block;
}

function productOf(block: ReturnType<typeof equation>) {
  return find(block.parsed!.node, (node) => node.type === "binary" && node.op === "*");
}

describe("selecting a term", () => {
  test("selecting P*V lights only that product, and the temperature stays unlit", () => {
    const block = equation();
    const product = productOf(block);
    const displays = paint(CYLINDER_NOTE, [
      { latex: "2", kind: "quantity" },
      { latex: "10", kind: "quantity" },
      { latex: "66", kind: "quantity" },
      { latex: "8", kind: "quantity" },
      { latex: TEMPERATURE, kind: "quantity" },
    ], []);
    const next = paintSelection(CYLINDER_NOTE, displays, product.span);
    const drawn = next.find((display) => display.source.startsWith("T ="));
    assert.ok(drawn);
    assert.equal(drawn.valueLatex, TEMPERATURE);
    assert.equal(drawn.valueLatex.includes("regne-hit"), false);
    assert.equal(drawn.inputLatex.includes("regne-hit"), true);
    assert.equal(drawn.inputLatex.match(/regne-hit/g)?.length, 1);
    assert.equal(next[0], displays[0]);
    assert.equal(next[1], displays[1]);
  });

  test("a caret in a space clears the highlight", () => {
    const block = equation();
    const product = productOf(block);
    const displays = paintSelection(
      CYLINDER_NOTE,
      paint(CYLINDER_NOTE, [{ latex: TEMPERATURE, kind: "quantity" }], []),
      product.span,
    );
    const space = CYLINDER_NOTE.indexOf(" / ");
    const cleared = paintSelection(CYLINDER_NOTE, displays, { start: space, end: space });
    const drawn = cleared.find((display) => display.source.startsWith("T ="));
    assert.equal(drawn?.inputLatex.includes("regne-hit"), false);
  });

  test("Alt+Up from P*V selects the whole right-hand side, and Alt+Down returns to the product", () => {
    const block = equation();
    const product = productOf(block);
    const parent = stepSelection(CYLINDER_NOTE, product.span, "parent");
    assert.ok(parent);
    assert.equal(CYLINDER_NOTE.slice(parent.start, parent.end), "P*V / (n*R)");
    const child = stepSelection(CYLINDER_NOTE, parent, "child");
    assert.deepEqual(child, product.span);
  });

  test("the union of P and V is the product", () => {
    const block = equation();
    const product = productOf(block);
    const names = [find(product, (node) => node.type === "name" && node.text === "P"), find(product, (node) => node.type === "name" && node.text === "V")];
    const union = unionSpan(names.map((node) => node.span));
    assert.ok(union);
    assert.equal(hitNode(block.parsed!, union), product);
  });
});

describe("a click on the page", () => {
  test("the innermost data-span is the selection, and a value click selects the statement", () => {
    assert.deepEqual(spanAttribute("12:18"), { start: 12, end: 18 });
    assert.equal(spanAttribute("nope"), null);
    const outer = { getAttribute: () => "0:20", parentElement: null };
    const inner = { getAttribute: () => "4:7", parentElement: outer };
    assert.deepEqual(spanFromHost(inner), { start: 4, end: 7 });

    const block = equation();
    const selected = selectionFromPointer(CYLINDER_NOTE, {
      span: null,
      statementStart: block.span.start,
      inValue: true,
    });
    assert.deepEqual(selected, block.span);
    assert.equal(CYLINDER_NOTE.slice(selected!.start, selected!.end), "T = P*V / (n*R)");
  });
});
