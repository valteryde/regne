import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { lower, lowerStatement } from "../../src/language/lower";
import { parseStatement } from "../../src/language/parse";
import { find } from "./fixture";

function lowered(source: string) {
  return lowerStatement(parseStatement(source).node);
}

describe("lower", () => {
  test("a quantity, a product, and a conversion keep their shape", () => {
    const quantity = lowered("10 [bar]");
    assert.equal(quantity.kind, "quantity");
    if (quantity.kind !== "quantity") return;
    assert.equal(quantity.unit.kind, "unit");
    if (quantity.unit.kind === "unit") assert.equal(quantity.unit.name, "bar");

    const product = lowered("10 [bar] * 66 [L]");
    assert.equal(product.kind, "binary");
    if (product.kind === "binary") {
      assert.equal(product.op, "*");
      assert.equal(product.left.kind, "quantity");
      assert.equal(product.right.kind, "quantity");
    }

    const converted = lowered("(10 [bar] * 66 [L]) in [J]");
    assert.equal(converted.kind, "conversion");
    if (converted.kind === "conversion") assert.equal(converted.expr.kind, "binary");
  });

  test("parentheses disappear and a negative unit exponent is a number", () => {
    const grouped = lowered("(x + 1)");
    assert.equal(grouped.kind, "binary");
    const power = lowered("1 [s^-1]");
    assert.equal(power.kind, "quantity");
    if (power.kind !== "quantity") return;
    assert.equal(power.unit.kind, "unitPower");
    if (power.unit.kind === "unitPower") assert.equal(power.unit.exp, -1);
  });

  test("assignment, a function, an equation, and a plot domain lower", () => {
    const assigned = lowered("a := 10 + 5");
    assert.equal(assigned.kind, "assign");
    const fn = lowered("f(x) := x^2 + 1");
    assert.equal(fn.kind, "assign");
    if (fn.kind === "assign") assert.equal(fn.target.kind, "call");
    assert.equal(lowered("0 = x^2 + 2*x - 4").kind, "equation");
    const plot = lowered("plot(sin(x), x = -5..5)");
    assert.equal(plot.kind, "call");
    if (plot.kind !== "call") return;
    assert.equal(plot.args[1].kind, "equation");
    if (plot.args[1].kind === "equation") assert.equal(plot.args[1].right.kind, "range");
  });

  test("restart is a command only as a statement", () => {
    assert.equal(lowered("restart").kind, "restart");
    const parsed = parseStatement("restart");
    assert.equal(lower(parsed.node).kind, "symbol");
  });

  test("spans survive lowering", () => {
    const parsed = parseStatement("diff(x^2, x)");
    const power = find(parsed.node, (node) => node.type === "binary" && node.op === "^");
    const ir = lowered("diff(x^2, x)");
    assert.equal(ir.kind, "call");
    if (ir.kind !== "call") return;
    assert.equal(ir.args[0].kind, "binary");
    if (ir.args[0].kind === "binary") assert.deepEqual(ir.args[0].span, power.span);
  });
});
