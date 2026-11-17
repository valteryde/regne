import { Node, children } from "../../src/language/ast";
import { Parsed } from "../../src/language/parse";

export function textOf(parsed: Parsed, node: Node): string {
  return parsed.source.slice(node.span.start - parsed.base, node.span.end - parsed.base);
}

export function find(node: Node, pred: (node: Node) => boolean): Node {
  const found = findOr(node, pred);
  if (!found) throw new Error("node not found");
  return found;
}

export function findOr(node: Node, pred: (node: Node) => boolean): Node | null {
  if (pred(node)) return node;
  for (const child of children(node)) {
    const found = findOr(child, pred);
    if (found) return found;
  }
  return null;
}

export function findAll(node: Node, pred: (node: Node) => boolean): Node[] {
  const out: Node[] = [];
  const walk = (current: Node) => {
    if (pred(current)) out.push(current);
    for (const child of children(current)) walk(child);
  };
  walk(node);
  return out;
}

export const CYLINDER = [
  "n := 2 [mol]",
  "P := 10 [bar]",
  "V := 66 [L]",
  "R := 8.314 [J/(mol*K)]",
  "T = P*V / (n*R)",
];

export const STATEMENTS = [
  "diff(x^2, x)",
  "0 = x^2 + 2*x - 4",
  "a := 10 + 5",
  "f(x) := x^2 + 1",
  "10 [bar] * 66 [L]",
  "diff(x^2, x, 2)",
  "integrate(x^2, x)",
  "integrate(x^2, (x, 0, 1))",
  "sqrt(x)",
  "abs(x)",
  "solve(0 = x^2 + 2*x - 4, x)",
  "(10 [bar] * 66 [L]) in [J]",
  "plot(sin(x), x = -5..5)",
  ...CYLINDER,
];
