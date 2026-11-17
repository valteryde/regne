import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { CYLINDER_NOTE, readDocument } from "../../src/language/document";
import { lowerStatement } from "../../src/language/lower";
import { parseStatement } from "../../src/language/parse";
import { toLatex } from "../../src/language/toLatex";
import { find } from "./fixture";

interface Value {
  kind: string;
  latex: string;
  text: string;
  span: { start: number; end: number } | null;
  message?: string;
  svg?: string;
}

function python(): string {
  const venv = path.resolve(process.cwd(), ".venv/bin/python3");
  return fs.existsSync(venv) ? venv : "python3";
}

function evaluate(sources: string[]): Value[] {
  const statements = sources.map((source) => lowerStatement(parseStatement(source).node));
  const proc = spawnSync(python(), ["-c", SCRIPT], {
    input: JSON.stringify(statements),
    encoding: "utf8",
    cwd: process.cwd(),
  });
  assert.equal(proc.status, 0, proc.stderr);
  return JSON.parse(proc.stdout) as Value[];
}

const SCRIPT = `
import json, sys
sys.path.insert(0, "src/engine")
from irEval import evaluate_program
json.dump(evaluate_program(json.load(sys.stdin)), sys.stdout)
`;

describe("the worker eval-ir action", () => {
  test("a lowered statement comes back as a value", () => {
    const statements = [lowerStatement(parseStatement("a := 10 + 5").node)];
    const proc = spawnSync(python(), ["-u", "src/engine/sympyWorker.py"], {
      input: JSON.stringify({ id: "ir1", action: "eval-ir", statements }) + "\n",
      encoding: "utf8",
      timeout: 20000,
    });
    assert.equal(proc.status, 0, proc.stderr);
    const lines = proc.stdout.trim().split("\n").map((line) => JSON.parse(line));
    const reply = lines.find((line) => line.id === "ir1");
    assert.equal(reply.success, true);
    assert.equal(reply.results[0].latex, "15");
  });
});

describe("lowered statements evaluated by the worker", () => {
  test("the value of a derivative is not the input LaTeX", () => {
    const parsed = parseStatement("diff(x^2, x)");
    const input = toLatex(parsed.node, null);
    assert.match(input, /\\dfrac/);
    const [value] = evaluate(["diff(x^2, x)"]);
    assert.equal(value.kind, "expression");
    assert.equal(value.latex.includes("dfrac"), false);
    assert.match(value.latex, /2/);
    assert.match(value.latex, /x/);
  });

  test("assignment carries into the next statement", () => {
    const [first, second] = evaluate(["a := 10 + 5", "a + 1"]);
    assert.equal(first.latex, "15");
    assert.equal(second.latex, "16");
  });

  test("a quadratic reports its solution set", () => {
    const [value] = evaluate(["0 = x^2 + 2*x - 4"]);
    assert.equal(value.kind, "equation");
    assert.match(value.latex, /\\sqrt/);
  });

  test("a product of quantities and a conversion", () => {
    const [product] = evaluate(["10 [bar] * 66 [L]"]);
    assert.equal(product.kind, "quantity");
    assert.match(product.latex, /660/);
    assert.match(product.latex, /\\mathrm\{bar\}/);
    assert.match(product.latex, /\\cdot/);

    const [joules] = evaluate(["(10 [bar] * 66 [L]) in [J]"]);
    assert.equal(joules.kind, "quantity");
    assert.match(joules.latex, /66000/);
    assert.match(joules.latex, /\\mathrm\{J\}/);
  });

  test("the cylinder note solves a temperature", () => {
    const sources = readDocument(CYLINDER_NOTE).blocks.flatMap((block) =>
      block.kind === "statement" && block.parsed ? [block.source] : [],
    );
    assert.equal(sources.length, 5);
    const values = evaluate(sources);
    const temperature = values[4];
    assert.equal(temperature.kind, "quantity");
    assert.match(temperature.latex, /3969/);
    assert.match(temperature.latex, /\\mathrm\{K\}/);
  });

  test("diff of a quantity fails on that quantity's span", () => {
    const parsed = parseStatement("diff(10 [m], x)");
    const quantity = find(parsed.node, (node) => node.type === "quantity");
    const [value] = evaluate(["diff(10 [m], x)"]);
    assert.equal(value.kind, "error");
    assert.equal(value.message, "this operation does not take units yet.");
    assert.deepEqual(value.span, quantity.span);
  });
});
