import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Paint, paintLine, statementContinues } from "../../src/language/highlight";

function chunks(line: string, continued = false): string[] {
  const paints = paintLine(line, continued);
  return paints.map((paint, index) => {
    const end = paints[index + 1]?.start ?? line.length;
    return `${paint.tone}:${line.slice(paint.start, end)}`;
  });
}

function toneOf(line: string, name: string): Paint["tone"] | undefined {
  const at = line.indexOf(name);
  return paintLine(line).filter((paint) => paint.start <= at).at(-1)?.tone;
}

describe("statement color", () => {
  test("core names and calls are functions", () => {
    assert.equal(toneOf("diff(sin(x), x)", "diff"), "function");
    assert.equal(toneOf("diff(sin(x), x)", "sin"), "function");
    assert.equal(toneOf("diff(sin(x), x)", "x"), "variable");
    assert.equal(toneOf("f(x) := x^2", "f"), "function");
    assert.equal(toneOf("pi", "pi"), "function");
    assert.equal(toneOf("restart", "restart"), "function");
    assert.deepEqual(chunks("diff(sin(x), x)"), [
      "function:diff",
      "operator:(",
      "function:sin",
      "operator:(",
      "variable:x",
      "operator:)",
      "operator:, ",
      "variable:x",
      "operator:)",
    ]);
  });

  test("numbers, assignment, and units are distinct from names", () => {
    assert.deepEqual(chunks("n := 2 [mol]"), [
      "variable:n ",
      "operator::= ",
      "number:2 ",
      "operator:[",
      "unit:mol",
      "operator:]",
    ]);
    assert.deepEqual(chunks("8.314"), ["number:8.314"]);
    assert.deepEqual(chunks("1e-3"), ["number:1e-3"]);
    assert.deepEqual(chunks("1e"), ["number:1", "variable:e"]);
    assert.equal(toneOf("x in [J/(mol*K)]", "in"), "operator");
    assert.equal(toneOf("x in [J/(mol*K)]", "mol"), "unit");
    assert.equal(toneOf("[1, sin]", "sin"), "function");
    assert.equal(toneOf("1 [sin]", "sin"), "unit");
  });

  test("a heading, a paragraph, and a comment stay line colors", () => {
    assert.deepEqual(chunks("# Charge in a cylinder"), ["heading:# Charge in a cylinder"]);
    assert.deepEqual(chunks("-- The holdup is fixed."), ["marker:-- ", "prose:The holdup is fixed."]);
    assert.deepEqual(chunks("// a note"), ["comment:// a note"]);
    assert.deepEqual(chunks("-- The derivative of $x^2$ is next."), [
      "marker:-- ",
      "prose:The derivative of ",
      "operator:$",
      "variable:x",
      "operator:^",
      "number:2",
      "operator:$",
      "prose: is next.",
    ]);
    assert.equal(toneOf("-- The derivative of $diff(x^2, x)$ is next.", "diff"), "function");
  });

  test("a trailing backslash keeps the next line a statement", () => {
    assert.equal(statementContinues("T = P*V / \\"), true);
    assert.equal(statementContinues("-- prose \\"), false);
    assert.equal(statementContinues("# Title \\"), false);
    assert.equal(statementContinues("// note \\"), false);
    assert.equal(statementContinues("-- still \\", true), true);
    assert.deepEqual(chunks("-- still", true), ["operator:-", "operator:- ", "variable:still"]);
  });
});
