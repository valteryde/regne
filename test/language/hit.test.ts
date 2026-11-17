import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { hitNode } from "../../src/language/hit";
import { parseStatement } from "../../src/language/parse";
import { find, textOf } from "./fixture";

describe("hitNode", () => {
  test("a caret on a glyph hits the smallest node, and the end hits the last glyph", () => {
    const parsed = parseStatement("a+b");
    assert.equal(hitNode(parsed, { start: 0, end: 0 })?.type, "name");
    assert.equal(textOf(parsed, hitNode(parsed, { start: 0, end: 0 })!), "a");
    assert.equal(hitNode(parsed, { start: 1, end: 1 })?.type, "binary");
    assert.equal(textOf(parsed, hitNode(parsed, { start: 3, end: 3 })!), "b");
  });

  test("a caret in spaces hits nothing, even though the parent span covers them", () => {
    const parsed = parseStatement("a + b");
    assert.equal(hitNode(parsed, { start: 1, end: 1 }), null);
    assert.equal(hitNode(parsed, { start: 1, end: 2 }), null);
    assert.equal(hitNode(parsed, { start: 2, end: 2 })?.type, "binary");
    const whole = hitNode(parsed, { start: 0, end: parsed.source.length });
    assert.equal(whole?.type, "binary");
  });

  test("a trailing space at the end of the statement hits nothing", () => {
    const parsed = parseStatement("a + b ");
    assert.equal(hitNode(parsed, { start: parsed.source.length, end: parsed.source.length }), null);
  });

  test("a selection of two siblings uses their parent", () => {
    const parsed = parseStatement("a+b");
    const parent = hitNode(parsed, { start: 0, end: 3 });
    assert.equal(parent?.type, "binary");
    const left = hitNode(parsed, { start: 0, end: 1 });
    assert.equal(left?.type, "name");
    assert.equal(textOf(parsed, left!), "a");
    const throughOp = hitNode(parsed, { start: 0, end: 2 });
    assert.equal(throughOp?.type, "binary");
  });

  test("a selection inside a comment hits nothing", () => {
    const parsed = parseStatement("a + b // note");
    const comment = parsed.comments[0];
    assert.equal(hitNode(parsed, { start: comment.start + 3, end: comment.start + 7 }), null);
    assert.equal(hitNode(parsed, comment), null);
    assert.equal(hitNode(parsed, { start: 0, end: 1 })?.type, "name");
  });

  test("a caret on a parenthesis hits the group, and a caret on the inside hits the child", () => {
    const parsed = parseStatement("(a+b)");
    assert.equal(hitNode(parsed, { start: 0, end: 0 })?.type, "group");
    assert.equal(textOf(parsed, hitNode(parsed, { start: 1, end: 1 })!), "a");
  });

  test("a caret on a unit bracket hits the unit, and the space before it hits nothing", () => {
    const parsed = parseStatement("10 [bar]");
    const bracket = parsed.source.indexOf("[");
    assert.equal(hitNode(parsed, { start: bracket, end: bracket })?.type, "unitName");
    const space = parsed.source.indexOf(" ");
    assert.equal(hitNode(parsed, { start: space, end: space }), null);
  });

  test("a caret on a comma in a tuple hits the tuple", () => {
    const parsed = parseStatement("(x, 0, 1)");
    const comma = parsed.source.indexOf(",");
    assert.equal(hitNode(parsed, { start: comma, end: comma })?.type, "tuple");
  });

  test("selecting x^2 inside a derivative hits the power", () => {
    const parsed = parseStatement("diff(x^2, x)");
    const power = find(parsed.node, (node) => node.type === "binary" && node.op === "^");
    assert.equal(hitNode(parsed, power.span), power);
    const call = hitNode(parsed, parsed.node.span);
    assert.equal(call?.type, "call");
  });

  test("offsets follow the base of a statement inside a file", () => {
    const parsed = parseStatement("x + 1", 20);
    assert.equal(hitNode(parsed, { start: 20, end: 21 })?.type, "name");
    assert.equal(hitNode(parsed, { start: 21, end: 21 }), null);
  });

  test("a selection that runs from code into a comment hits nothing", () => {
    const parsed = parseStatement("a + b // note");
    assert.equal(hitNode(parsed, { start: 0, end: parsed.source.length }), null);
  });
});
