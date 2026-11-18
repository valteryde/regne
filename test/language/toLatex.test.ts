import assert from "node:assert/strict";
import { describe, test } from "node:test";
import katex from "katex";
import { parseStatement } from "../../src/language/parse";
import { toLatex } from "../../src/language/toLatex";
import { STATEMENTS, find, textOf } from "./fixture";

function renders(latex: string): string {
  return katex.renderToString(latex, {
    displayMode: true,
    throwOnError: true,
    strict: false,
    trust: true,
    output: "html",
  });
}

function count(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

function bracesBalanced(text: string): boolean {
  let depth = 0;
  for (const ch of text) {
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    if (depth < 0) return false;
  }
  return depth === 0;
}

function hitBody(latex: string): string {
  const marker = "\\htmlClass{regne-hit}";
  const at = latex.indexOf(marker);
  assert.notEqual(at, -1);
  return readGroup(latex, at + marker.length);
}

function readGroup(text: string, open: number): string {
  assert.equal(text[open], "{");
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return text.slice(open + 1, i);
    }
  }
  throw new Error("unbalanced latex");
}

describe("toLatex", () => {
  test("every worked example is balanced and KaTeX can draw it", () => {
    for (const source of STATEMENTS) {
      const latex = toLatex(parseStatement(source).node, null);
      assert.equal(bracesBalanced(latex), true, source);
      assert.equal(latex.includes("regne-hit"), false, source);
      assert.equal(renders(latex).includes("data-span"), true, source);
    }
  });

  test("diff prints a derivative and a hit on x^2 wraps only that power", () => {
    const parsed = parseStatement("diff(x^2, x)");
    const power = find(parsed.node, (node) => node.type === "binary" && node.op === "^");
    const latex = toLatex(parsed.node, power.span);
    assert.equal(count(latex, "regne-hit"), 1);
    assert.match(latex, /\\dfrac\{d\}/);
    const body = hitBody(latex);
    assert.equal(body.includes("\\dfrac"), false);
    assert.match(body, new RegExp(`span=${power.span.start}:${power.span.end}`));
    assert.equal(textOf(parsed, power), "x^2");

    const html = renders(latex);
    assert.match(html, /regne-hit/);
    assert.match(html, new RegExp(`data-span="${power.span.start}:${power.span.end}"`));
    assert.equal(count(html, "regne-hit"), 1);
  });

  test("a missing hit still carries spans and no highlight", () => {
    const latex = toLatex(parseStatement("diff(x^2, x)").node, null);
    assert.equal(latex.includes("regne-hit"), false);
    assert.match(latex, /\\htmlData\{span=/);
    const html = renders(latex);
    assert.equal(html.includes("regne-hit"), false);
    assert.match(html, /data-span=/);
  });

  test("a span that is not a node does not invent a hit", () => {
    const latex = toLatex(parseStatement("a + b").node, { start: 1, end: 2 });
    assert.equal(latex.includes("regne-hit"), false);
  });

  test("the nth derivative shows the order once as a span", () => {
    const parsed = parseStatement("diff(x^2, x, 2)");
    if (parsed.node.type !== "call") return;
    const order = parsed.node.args[2];
    const latex = toLatex(parsed.node, order.span);
    assert.equal(count(latex, "regne-hit"), 1);
    assert.equal(count(latex, `span=${order.span.start}:${order.span.end}`), 1);
    assert.match(latex, /\\dfrac\{d\^\{/);
    renders(latex);
  });

  test("selecting the name diff highlights the whole derivative", () => {
    const parsed = parseStatement("diff(x^2, x)");
    if (parsed.node.type !== "call") return;
    const latex = toLatex(parsed.node, parsed.node.callee.span);
    assert.match(
      latex,
      new RegExp(
        `^\\\\htmlClass\\{regne-hit\\}\\{\\\\htmlData\\{span=${parsed.node.span.start}:${parsed.node.span.end}\\}`,
      ),
    );
    assert.equal(count(latex, "regne-hit"), 1);
  });

  test("the cylinder equation puts P*V in the numerator and a hit stays there", () => {
    const parsed = parseStatement("T = P*V / (n*R)");
    const latex = toLatex(parsed.node, null);
    assert.match(latex, /\\frac\{/);
    assert.equal(latex.includes("\\cdot"), false);
    const product = find(parsed.node, (node) => node.type === "binary" && node.op === "*");
    assert.equal(textOf(parsed, product), "P*V");
    const body = hitBody(toLatex(parsed.node, product.span));
    assert.equal(body.includes("\\frac"), false);
    assert.match(body, /P/);
    assert.match(body, /V/);
    renders(toLatex(parsed.node, product.span));
  });

  test("a product of names is juxtaposition and a product of numbers keeps a dot", () => {
    const names = toLatex(parseStatement("2*x").node, null);
    assert.equal(names.includes("\\cdot"), false);
    assert.match(names, /2/);
    const numbers = toLatex(parseStatement("10*5").node, null);
    assert.match(numbers, /\\cdot/);
    renders(names);
    renders(numbers);
  });

  test("quantities use a dot, and a compound unit uses cdot and a slash", () => {
    const product = toLatex(parseStatement("10 [bar] * 66 [L]").node, null);
    assert.match(product, /\\cdot/);
    assert.match(product, /\\mathrm\{bar\}/);
    renders(product);

    const gas = toLatex(parseStatement("R := 8.314 [J/(mol*K)]").node, null);
    assert.match(gas, /\\mathrm\{J\}/);
    assert.match(gas, /\\cdot/);
    assert.match(gas, /\\mathrm\{mol\}/);
    assert.equal(gas.includes("["), false);
    renders(gas);
  });

  test("the pretty forms from section 4.4", () => {
    assert.match(toLatex(parseStatement("integrate(x^2, x)").node, null), /\\int /);
    const definite = toLatex(parseStatement("integrate(x^2, (x, 0, 1))").node, null);
    assert.match(definite, /\\int_/);
    renders(definite);

    assert.match(toLatex(parseStatement("sqrt(x)").node, null), /\\sqrt\{/);
    assert.match(toLatex(parseStatement("abs(x)").node, null), /\\lvert/);
    const solved = toLatex(parseStatement("solve(0 = x^2 + 2*x - 4, x)").node, null);
    assert.match(solved, / = /);
    assert.match(solved, /\\mathrm\{for\}/);
    renders(solved);

    assert.match(toLatex(parseStatement("sin(x)").node, null), /\\sin/);
    assert.match(toLatex(parseStatement("factor(x)").node, null), /\\operatorname\{factor\}/);
    const constants = toLatex(parseStatement("pi + E + I + oo").node, null, false);
    assert.match(constants, /\\pi/);
    assert.match(constants, /\\infty/);
    assert.equal(constants.includes("\\mathrm{e}"), false);
    assert.match(constants, / E /);
    assert.match(toLatex(parseStatement("1e-3").node, null), /\\times 10\^\{-3\}/);
    assert.equal(toLatex(parseStatement("a_1").node, null, false), "a_{1}");
  });

  test("a name with an underscore is a subscript, and E stays E", () => {
    assert.equal(toLatex(parseStatement("p_0").node, null, false), "p_{0}");
    assert.equal(toLatex(parseStatement("V_gas").node, null, false), "V_{\\mathrm{gas}}");
    assert.equal(toLatex(parseStatement("x_i_j").node, null, false), "x_{i_{j}}");
    assert.equal(toLatex(parseStatement("V_").node, null, false), "V\\_");
    assert.equal(toLatex(parseStatement("E").node, null, false), "E");
    renders(toLatex(parseStatement("V_gas").node, null));
  });

  test("grouping parentheses drop out of an exponent and both sides of a fraction", () => {
    const energy =
      "E = p_0 * V_0^n * (V_gas^(1-n) - V_0^(1-n)) / (n-1)";
    const plain = toLatex(parseStatement(energy).node, null, false);
    assert.equal(
      plain,
      "E = \\frac{p_{0}V_{0}^{n}\\left(V_{\\mathrm{gas}}^{1 - n} - V_{0}^{1 - n}\\right)}{n - 1}",
    );
    assert.equal(plain.includes("\\mathrm{e}"), false);
    assert.equal(plain.includes("\\_"), false);
    renders(toLatex(parseStatement(energy).node, null));

    const parsed = parseStatement("V_0^(1-n)");
    const group = find(parsed.node, (node) => node.type === "group");
    const hit = toLatex(parsed.node, group.span);
    assert.match(hit, /regne-hit/);
    assert.match(hit, new RegExp(`span=${group.span.start}:${group.span.end}`));
    assert.equal(toLatex(parsed.node, null, false), "V_{0}^{1 - n}");

    const fraction = toLatex(parseStatement("(a+b)/(c+d)").node, null, false);
    assert.equal(fraction, "\\frac{a + b}{c + d}");
    const factor = toLatex(parseStatement("(a+b)*c").node, null, false);
    assert.match(factor, /\\left\(a \+ b\\right\)/);
    renders(toLatex(parseStatement(energy + ";").node, null));
  });

  test("a hit on the integrate bounds wraps the integral and not the integrand", () => {
    const parsed = parseStatement("integrate(x^2, (x, 0, 1))");
    if (parsed.node.type !== "call") return;
    const tuple = parsed.node.args[1];
    const integrand = parsed.node.args[0];
    const body = hitBody(toLatex(parsed.node, tuple.span));
    assert.match(body, /\\int_/);
    assert.equal(body.includes(`span=${integrand.span.start}:${integrand.span.end}`), false);
    renders(toLatex(parsed.node, tuple.span));
  });

  test("assignment, comparison, and conversion print their operators", () => {
    assert.match(toLatex(parseStatement("n := 2 [mol]").node, null), / := /);
    assert.match(toLatex(parseStatement("a <= b").node, null), /\\leq/);
    const converted = toLatex(parseStatement("(10 [bar] * 66 [L]) in [J]").node, null);
    assert.match(converted, /\\mathrm\{in\}/);
    assert.match(converted, /\\mathrm\{J\}/);
    renders(converted);
  });
});
