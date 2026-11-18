import { CallNode, Node, Span, children } from "./ast";

const FUNCTIONS: Record<string, string> = {
  sin: "\\sin",
  cos: "\\cos",
  tan: "\\tan",
  log: "\\log",
  ln: "\\ln",
  exp: "\\exp",
};

const CONSTANTS: Record<string, string> = {
  pi: "\\pi",
  I: "\\mathrm{i}",
  oo: "\\infty",
};

const COMPARE: Record<string, string> = {
  "<": "\\lt",
  "<=": "\\leq",
  ">": "\\gt",
  ">=": "\\geq",
};

interface Opts {
  decorate: boolean;
  hit: Node | null;
}

/**
 * `hit` is the span of one node, or null. It is not a raw caret.
 * Every node carries `htmlData`. Only the hit node carries `regne-hit`.
 */
export function toLatex(node: Node, hit: Span | null, decorate = true): string {
  const hitNode = hit ? nodeBySpan(node, hit) : null;
  return print(node, { decorate, hit: hitNode });
}

function nodeBySpan(node: Node, span: Span): Node | null {
  for (const child of children(node)) {
    const found = nodeBySpan(child, span);
    if (found) return found;
  }
  if (node.span.start === span.start && node.span.end === span.end) return node;
  return null;
}

function print(node: Node, opts: Opts): string {
  const force = node.type === "call" && opts.hit === node.callee && hidesCallee(node);
  return emit(node, body(node, opts), opts, force);
}

function emit(node: Node, text: string, opts: Opts, force = false): string {
  if (!opts.decorate) return text;
  const data = `\\htmlData{span=${node.span.start}:${node.span.end}}{${text}}`;
  if (force || opts.hit === node) return `\\htmlClass{regne-hit}{${data}}`;
  return data;
}

function body(node: Node, opts: Opts): string {
  switch (node.type) {
    case "number":
      return formatNumber(node.text);
    case "name":
      return CONSTANTS[node.text] ?? scripted(node.text);
    case "group":
      return `\\left(${print(node.expr, opts)}\\right)`;
    case "list":
      return `\\left[${node.items.map((item) => print(item, opts)).join(", ")}\\right]`;
    case "tuple":
      return `\\left(${node.items.map((item) => print(item, opts)).join(", ")}\\right)`;
    case "unary":
      return `${node.op}${print(node.expr, opts)}`;
    case "binary":
      return printBinary(node, opts);
    case "range":
      return `${print(node.left, opts)}..${print(node.right, opts)}`;
    case "compare":
      return `${print(node.left, opts)} ${COMPARE[node.op]} ${print(node.right, opts)}`;
    case "equation":
      return `${print(node.left, opts)} = ${print(node.right, opts)}`;
    case "assign":
      return `${print(node.target, opts)} := ${print(node.value, opts)}`;
    case "conversion":
      return `${print(node.expr, opts)}\\,\\mathrm{in}\\,${print(node.unit, opts)}`;
    case "quantity":
      return `${print(node.value, opts)}\\,${print(node.unit, opts)}`;
    case "call":
      return printCall(node, opts);
    case "unitName":
      return `\\mathrm{${escaped(node.text)}}`;
    case "unitBinary":
      if (node.op === "*") return `${print(node.left, opts)}\\cdot ${print(node.right, opts)}`;
      return `${print(node.left, opts)}/${print(node.right, opts)}`;
    case "unitPower": {
      const exp = print(node.exponent, opts);
      const shown = node.negative ? `-${exp}` : exp;
      return `${print(node.base, opts)}^{${shown}}`;
    }
    case "unitGroup":
      return `\\left(${print(node.expr, opts)}\\right)`;
    default: {
      const exhaustive: never = node;
      return exhaustive;
    }
  }
}

function printBinary(node: Extract<Node, { type: "binary" }>, opts: Opts): string {
  if (node.op === "^") {
    return `${print(node.left, opts)}^{${withoutGroupingParens(node.right, opts)}}`;
  }
  if (node.op === "/") {
    return `\\frac{${withoutGroupingParens(node.left, opts)}}{${withoutGroupingParens(node.right, opts)}}`;
  }
  const left = print(node.left, opts);
  const right = print(node.right, opts);
  if (node.op === "*") {
    const quantity = node.left.type === "quantity" || node.right.type === "quantity";
    const bothNumbers = node.left.type === "number" && node.right.type === "number";
    if (quantity || bothNumbers) return `${left}\\cdot ${right}`;
    return `${left}${right}`;
  }
  return `${left} ${node.op} ${right}`;
}

function printCall(node: CallNode, opts: Opts): string {
  const pretty = prettyCall(node, opts);
  if (pretty !== null) return pretty;
  const symbol = FUNCTIONS[node.callee.text] ?? `\\operatorname{${escaped(node.callee.text)}}`;
  const head = emit(node.callee, symbol, opts);
  const args = node.args.map((arg) => print(arg, opts)).join(", ");
  return `${head}\\left(${args}\\right)`;
}

function prettyCall(node: CallNode, opts: Opts): string | null {
  const name = node.callee.text;
  if (name === "diff" && (node.args.length === 2 || node.args.length === 3)) {
    const f = print(node.args[0], opts);
    const x = print(node.args[1], opts);
    if (node.args.length === 2) return `\\dfrac{d}{d${x}} ${f}`;
    const order = print(node.args[2], opts);
    const plain = print(node.args[2], { decorate: false, hit: null });
    return `\\dfrac{d^{${order}}}{d${x}^{${plain}}} ${f}`;
  }
  if (name === "integrate" && node.args.length === 2) {
    const f = print(node.args[0], opts);
    const second = node.args[1];
    if (second.type === "tuple" && second.items.length === 3) {
      const x = print(second.items[0], opts);
      const a = print(second.items[1], opts);
      const b = print(second.items[2], opts);
      const integral = emit(second, `\\int_{${a}}^{${b}}\\,d${x}`, opts);
      return `${integral} ${f}`;
    }
    return `\\int ${f}\\,d${print(second, opts)}`;
  }
  if (name === "sqrt" && node.args.length === 1) return `\\sqrt{${print(node.args[0], opts)}}`;
  if (name === "abs" && node.args.length === 1) {
    return `\\left\\lvert ${print(node.args[0], opts)}\\right\\rvert`;
  }
  if (name === "solve" && node.args.length >= 1) {
    const eqn = print(node.args[0], opts);
    if (node.args.length === 1) return eqn;
    const rest = node.args.slice(1).map((arg) => print(arg, opts)).join(", ");
    return `${eqn}\\,\\mathrm{for}\\,${rest}`;
  }
  return null;
}

function hidesCallee(node: CallNode): boolean {
  const name = node.callee.text;
  const count = node.args.length;
  if (name === "diff" && (count === 2 || count === 3)) return true;
  if (name === "integrate" && count === 2) return true;
  if ((name === "sqrt" || name === "abs") && count === 1) return true;
  if (name === "solve" && count >= 1) return true;
  return false;
}

function formatNumber(text: string): string {
  const match = /^(\d+(?:\.\d+)?)[eE]([+-]?\d+)$/.exec(text);
  if (!match) return text;
  const exp = match[2].replace(/^\+/, "");
  return `${match[1]}\\times 10^{${exp}}`;
}

/**
 * Parentheses around a whole exponent, numerator, or denominator only exist
 * so the source parser can see the group. The superscript and the fraction
 * bar already group those parts, so the parentheses are not drawn.
 */
function withoutGroupingParens(node: Node, opts: Opts): string {
  if (node.type !== "group") return print(node, opts);
  return emit(node, print(node.expr, opts), opts);
}

/** `V_gas` is \(V_{\mathrm{gas}}\) and `p_0` is \(p_0\). Further underscores nest. */
function scripted(text: string): string {
  const at = text.indexOf("_");
  if (at < 0) return text;
  if (at === 0) return escaped(text);
  const base = text.slice(0, at);
  const rest = text.slice(at + 1);
  if (rest.length === 0) return `${base}\\_`;
  return `${base}_{${subscript(rest)}}`;
}

function subscript(text: string): string {
  const at = text.indexOf("_");
  if (at < 0) return subscriptAtom(text);
  const head = text.slice(0, at);
  const tail = text.slice(at + 1);
  const body = head.length === 0 ? "" : subscriptAtom(head);
  if (tail.length === 0) return body;
  const nested = subscript(tail);
  if (body.length === 0) return nested;
  if (nested.length === 0) return body;
  return `${body}_{${nested}}`;
}

function subscriptAtom(text: string): string {
  if (/^\d+$/.test(text) || text.length === 1) return text;
  return `\\mathrm{${text}}`;
}

function escaped(text: string): string {
  return text.replaceAll("_", "\\_");
}
