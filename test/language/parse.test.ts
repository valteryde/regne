import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { BinaryNode, CallNode } from "../../src/language/ast";
import { ParseError, parseStatement } from "../../src/language/parse";
import { CYLINDER, find, findAll, textOf } from "./fixture";

function errorOf(source: string): ParseError {
  try {
    parseStatement(source);
  } catch (error) {
    assert.ok(error instanceof ParseError);
    return error;
  }
  assert.fail(`expected a parse error for ${JSON.stringify(source)}`);
}

describe("statements from the spec", () => {
  test("the cylinder math lines parse", () => {
    const n = parseStatement("n := 2 [mol]").node;
    assert.equal(n.type, "assign");
    if (n.type !== "assign") return;
    assert.equal(n.target.type, "name");
    assert.equal(n.value.type, "quantity");

    const t = parseStatement("T = P*V / (n*R)").node;
    assert.equal(t.type, "equation");
  });

  test("section 4.1 examples parse", () => {
    assert.equal(parseStatement("diff(x^2, x)").node.type, "call");
    assert.equal(parseStatement("0 = x^2 + 2*x - 4").node.type, "equation");
    assert.equal(parseStatement("a := 10 + 5").node.type, "assign");
    const fn = parseStatement("f(x) := x^2 + 1").node;
    assert.equal(fn.type, "assign");
    if (fn.type !== "assign") return;
    assert.equal(fn.target.type, "call");
    assert.equal(parseStatement("10 [bar] * 66 [L]").node.type, "binary");
  });

  test("section 4.4 calls parse", () => {
    const diff = parseStatement("diff(x^2, x, 2)").node;
    assert.equal(diff.type, "call");
    if (diff.type !== "call") return;
    assert.equal(diff.args.length, 3);

    const definite = parseStatement("integrate(x^2, (x, 0, 1))").node;
    assert.equal(definite.type, "call");
    if (definite.type !== "call") return;
    assert.equal(definite.args[1].type, "tuple");

    assert.equal(parseStatement("sqrt(x)").node.type, "call");
    assert.equal(parseStatement("abs(x)").node.type, "call");
    const solved = parseStatement("solve(0 = x^2 + 2*x - 4, x)").node;
    assert.equal(solved.type, "call");
    if (solved.type !== "call") return;
    assert.equal(solved.args[0].type, "equation");
  });
});

describe("quantities and lists", () => {
  test("10 [bar] is a quantity and the span includes the brackets", () => {
    const parsed = parseStatement("10 [bar]");
    const node = parsed.node;
    assert.equal(node.type, "quantity");
    assert.equal(textOf(parsed, node), "10 [bar]");
    if (node.type !== "quantity") return;
    assert.equal(node.value.type, "number");
    assert.equal(textOf(parsed, node.value), "10");
    assert.equal(node.unit.type, "unitName");
    assert.equal(node.unit.text, "bar");
    assert.equal(textOf(parsed, node.unit), "[bar]");
  });

  test("10[bar] is the same quantity without the space", () => {
    const parsed = parseStatement("10[bar]");
    assert.equal(parsed.node.type, "quantity");
    assert.equal(textOf(parsed, parsed.node), "10[bar]");
  });

  test("[1, 2] is a list and [bar] is a list of one name", () => {
    const list = parseStatement("[1, 2]");
    assert.equal(list.node.type, "list");
    if (list.node.type !== "list") return;
    assert.deepEqual(list.node.items.map((item) => textOf(list, item)), ["1", "2"]);
    assert.equal(textOf(list, list.node), "[1, 2]");

    const name = parseStatement("[bar]");
    assert.equal(name.node.type, "list");
    if (name.node.type !== "list") return;
    assert.equal(name.node.items[0].type, "name");
  });

  test("a compound unit keeps the brackets on the unit and not on the names", () => {
    const parsed = parseStatement("R := 8.314 [J/(mol*K)]");
    const qty = find(parsed.node, (node) => node.type === "quantity");
    assert.equal(textOf(parsed, qty), "8.314 [J/(mol*K)]");
    if (qty.type !== "quantity") return;
    assert.equal(qty.unit.type, "unitBinary");
    if (qty.unit.type !== "unitBinary") return;
    assert.equal(qty.unit.op, "/");
    assert.equal(textOf(parsed, qty.unit), "[J/(mol*K)]");
    assert.equal(qty.unit.left.type, "unitName");
    if (qty.unit.left.type === "unitName") assert.equal(textOf(parsed, qty.unit.left), "J");
    assert.equal(qty.unit.right.type, "unitGroup");
  });

  test("kg*m/s^2 associates to the left and the exponent is an integer", () => {
    const parsed = parseStatement("10 [kg*m/s^2]");
    const unit = find(parsed.node, (node) => node.type === "unitBinary" && node.op === "/");
    if (unit.type !== "unitBinary") return;
    assert.equal(unit.left.type, "unitBinary");
    assert.equal(unit.right.type, "unitPower");
    if (unit.right.type !== "unitPower") return;
    assert.equal(unit.right.exponent.text, "2");
    assert.equal(unit.right.negative, false);
  });

  test("a negative unit exponent keeps the minus on the power", () => {
    const parsed = parseStatement("1 [s^-1]");
    const power = find(parsed.node, (node) => node.type === "unitPower");
    if (power.type !== "unitPower") return;
    assert.equal(power.negative, true);
    assert.equal(textOf(parsed, power.exponent), "1");
    assert.equal(parsed.source[power.exponent.span.start - 1], "-");
  });

  test("conversion binds looser than multiplication", () => {
    const parsed = parseStatement("(10 [bar] * 66 [L]) in [J]");
    assert.equal(parsed.node.type, "conversion");
    const bare = parseStatement("10 [bar] * 66 [L] in [J]");
    assert.equal(bare.node.type, "conversion");
    if (bare.node.type !== "conversion") return;
    assert.equal(bare.node.expr.type, "binary");
  });
});

describe("spans", () => {
  test("a node covers its own text and not the surrounding spaces", () => {
    const parsed = parseStatement("  x + 1  ");
    assert.equal(textOf(parsed, parsed.node), "x + 1");
    const name = find(parsed.node, (node) => node.type === "name");
    assert.equal(textOf(parsed, name), "x");
  });

  test("the spec's span examples cover the whole node", () => {
    const quantity = parseStatement("10 [bar]");
    assert.equal(textOf(quantity, quantity.node), "10 [bar]");

    const mul = parseStatement("10 [bar] * 66 [L]");
    assert.equal(textOf(mul, mul.node), "10 [bar] * 66 [L]");
    assert.deepEqual(
      findAll(mul.node, (node) => node.type === "quantity").map((node) => textOf(mul, node)),
      ["10 [bar]", "66 [L]"],
    );

    const power = parseStatement("diff(x^2, x)");
    const squared = find(power.node, (node) => node.type === "binary" && node.op === "^");
    assert.equal(textOf(power, squared), "x^2");
    assert.equal(textOf(power, power.node), "diff(x^2, x)");

    const equation = parseStatement("0 = x^2 + 2*x - 4");
    assert.equal(textOf(equation, equation.node), "0 = x^2 + 2*x - 4");
  });

  test("a base offset shifts every span and leaves the source slice alone", () => {
    const parsed = parseStatement("x + 1", 20);
    assert.equal(parsed.node.span.start, 20);
    assert.equal(textOf(parsed, find(parsed.node, (node) => node.type === "name")), "x");
    assert.equal(parsed.comments.length, 0);
  });

  test("a trailing comment is recorded and is not part of the expression", () => {
    const parsed = parseStatement("a + b // note");
    assert.equal(parsed.comments.length, 1);
    assert.equal(parsed.source.slice(parsed.comments[0].start, parsed.comments[0].end), "// note");
    assert.equal(textOf(parsed, parsed.node), "a + b");
  });

  test("a backslash continues a statement and the span still covers the break", () => {
    const source = "a + \\\n b";
    const parsed = parseStatement(source);
    assert.equal(parsed.node.type, "binary");
    assert.equal(textOf(parsed, parsed.node), source);
  });

  test("a comment between a continuation and the next term is skipped", () => {
    const parsed = parseStatement("a + \\\n// kept\nb");
    assert.equal(parsed.node.type, "binary");
    assert.equal(parsed.comments.length, 1);
    assert.equal(textOf(parsed, parsed.node), "a + \\\n// kept\nb");
  });
});

describe("precedence", () => {
  test("-2^2 is (-2)^2 and a^b^c associates to the right", () => {
    const neg = parseStatement("-2^2").node;
    assert.equal(neg.type, "binary");
    if (neg.type !== "binary") return;
    assert.equal(neg.op, "^");
    assert.equal(neg.left.type, "unary");

    const tower = parseStatement("a^b^c").node;
    assert.equal(tower.type, "binary");
    if (tower.type !== "binary") return;
    assert.equal(tower.right.type, "binary");
    if (tower.right.type === "binary") assert.equal(tower.right.op, "^");
  });

  test("2^-3 puts the minus on the exponent", () => {
    const node = parseStatement("2^-3").node;
    assert.equal(node.type, "binary");
    if (node.type !== "binary") return;
    assert.equal(node.right.type, "unary");
  });

  test("* and / associate to the left and + is looser", () => {
    const div = parseStatement("a/b/c").node as BinaryNode;
    assert.equal(div.op, "/");
    assert.equal(div.left.type, "binary");

    const mixed = parseStatement("a/b*c").node as BinaryNode;
    assert.equal(mixed.op, "*");
    assert.equal((mixed.left as BinaryNode).op, "/");

    const sum = parseStatement("2*3+4").node as BinaryNode;
    assert.equal(sum.op, "+");
    assert.equal(sum.left.type, "binary");
  });

  test("a polynomial is a sum of a power and a product", () => {
    const node = parseStatement("x^2 + 2*x - 4").node as BinaryNode;
    assert.equal(node.op, "-");
    assert.equal(node.left.type, "binary");
    if (node.left.type === "binary") assert.equal(node.left.op, "+");
  });

  test("-5..5 is a range from negative five", () => {
    const node = parseStatement("-5..5").node;
    assert.equal(node.type, "range");
    if (node.type !== "range") return;
    assert.equal(node.left.type, "unary");
    assert.equal(node.right.type, "number");
  });

  test("a comparison does not chain and in sits outside it", () => {
    const node = parseStatement("a < b in [m]").node;
    assert.equal(node.type, "conversion");
    if (node.type !== "conversion") return;
    assert.equal(node.expr.type, "compare");
    assert.equal(errorOf("a < b < c").message.includes("Unexpected"), true);
  });
});

describe("calls, assignments, and equations", () => {
  test(":= is one token and = is an equation", () => {
    const assigned = parseStatement("a:=10+5").node;
    assert.equal(assigned.type, "assign");
    const equation = parseStatement("f(x) = x").node;
    assert.equal(equation.type, "equation");
    if (equation.type !== "equation") return;
    assert.equal(equation.left.type, "call");
  });

  test("a function of names can be assigned and a sum cannot", () => {
    const fn = parseStatement("f(x, y) := x + y").node;
    assert.equal(fn.type, "assign");
    if (fn.type !== "assign") return;
    assert.equal(fn.target.type, "call");

    const bad = errorOf("f(x + 1) := 1");
    assert.match(bad.message, /left side of :=/);
    assert.equal(bad.span.start, 0);
  });

  test("solve and plot can hold an equation, and the plot domain is a range", () => {
    const solved = parseStatement("solve(x^2 - 5 = 0, x)").node as CallNode;
    assert.equal(solved.args[0].type, "equation");
    assert.equal(solved.args[1].type, "name");

    const plot = parseStatement("plot(sin(x), x = -5..5)").node as CallNode;
    assert.equal(plot.callee.text, "plot");
    assert.equal(plot.args[0].type, "call");
    assert.equal(plot.args[1].type, "equation");
    if (plot.args[1].type !== "equation") return;
    assert.equal(plot.args[1].right.type, "range");
  });

  test("restart is only a name", () => {
    const node = parseStatement("restart").node;
    assert.equal(node.type, "name");
    if (node.type === "name") assert.equal(node.text, "restart");
  });

  test("numbers keep their exponent text", () => {
    const parsed = parseStatement("1e-3 + 1E+3");
    const numbers = findAll(parsed.node, (node) => node.type === "number");
    assert.deepEqual(
      numbers.map((node) => (node.type === "number" ? node.text : "")),
      ["1e-3", "1E+3"],
    );
  });

  test("a name may contain digits and underscores", () => {
    const node = parseStatement("a_1").node;
    assert.equal(node.type, "name");
    if (node.type === "name") assert.equal(node.text, "a_1");
  });

  test("parentheses group, and a comma makes a tuple", () => {
    const group = parseStatement("(a+b)*c").node as BinaryNode;
    assert.equal(group.left.type, "group");
    const tuple = parseStatement("(x, 0, 1)").node;
    assert.equal(tuple.type, "tuple");
    if (tuple.type === "tuple") assert.equal(tuple.items.length, 3);
  });

  test("every cylinder statement and the worked examples parse", () => {
    for (const source of CYLINDER) {
      assert.doesNotThrow(() => parseStatement(source), source);
    }
  });
});

describe("errors", () => {
  test("2x is a juxtaposition error whose span is the whole mistake", () => {
    const error = errorOf("2x");
    assert.match(error.message, /Juxtaposition/);
    assert.deepEqual(error.span, { start: 0, end: 2 });

    const spaced = errorOf("  2 x");
    assert.equal("  2 x".slice(spaced.span.start, spaced.span.end), "2 x");
  });

  test("# is not a comment", () => {
    const error = errorOf("# heading");
    assert.match(error.message, /Unexpected character/);
    assert.deepEqual(error.span, { start: 0, end: 1 });
  });

  test("a comment line and an empty line are not statements", () => {
    assert.match(errorOf("// note").message, /Enter a statement/);
    assert.match(errorOf("   ").message, /Enter a statement/);
    assert.equal(errorOf("// note").comments.length, 1);
  });

  test("== is not an operator", () => {
    assert.match(errorOf("a == b").message, /Unexpected =/);
  });

  test("assignment does not accept an equation as its value", () => {
    assert.match(errorOf("a := y = 1").message, /Unexpected =/);
  });

  test("a unit rejects a comma, a float exponent, and an empty pair of brackets", () => {
    assert.match(errorOf("10 [m, s]").message, /Expected ]/);
    assert.match(errorOf("1 [s^2.5]").message, /integers/);
    assert.match(errorOf("1 []").message, /unit needs a name/);
  });

  test("empty lists and empty parentheses are rejected", () => {
    assert.match(errorOf("[]").message, /list needs an item/);
    assert.match(errorOf("()").message, /Expected an expression/);
    assert.match(errorOf("[1,]").message, /Expected an expression/);
  });

  test("a broken exponent and a dangling backslash point at the problem", () => {
    const exp = errorOf("1e-");
    assert.match(exp.message, /exponent/);
    assert.equal("1e-".slice(exp.span.start, exp.span.end), "1e-");
    assert.match(errorOf("a + \\").message, /continues a statement/);
  });

  test("in without a bracket says so", () => {
    assert.match(errorOf("10 in").message, /in needs a unit/);
  });
});
