import { Node, Span, UnitNode } from "./ast";
import { Ir, UnitIr } from "./ir";

/** The JSON the worker evaluates. Parentheses are gone; their children keep their own spans. */
export function lower(node: Node): Ir {
  return lowerNode(node);
}

export function lowerStatement(node: Node, displayOnly = false): Ir {
  if (displayOnly) return { kind: "show", span: copy(node.span) };
  if (node.type === "name" && node.text === "restart") {
    return { kind: "restart", span: copy(node.span) };
  }
  return lowerNode(node);
}

function lowerNode(node: Node): Ir {
  switch (node.type) {
    case "number":
      return { kind: "number", text: node.text, span: copy(node.span) };
    case "name":
      return { kind: "symbol", name: node.text, span: copy(node.span) };
    case "call":
      return {
        kind: "call",
        name: node.callee.text,
        args: node.args.map(lowerNode),
        span: copy(node.span),
      };
    case "list":
      return { kind: "list", items: node.items.map(lowerNode), span: copy(node.span) };
    case "tuple":
      return { kind: "tuple", items: node.items.map(lowerNode), span: copy(node.span) };
    case "unary":
      return { kind: "unary", op: node.op, expr: lowerNode(node.expr), span: copy(node.span) };
    case "binary":
      return {
        kind: "binary",
        op: node.op,
        left: lowerNode(node.left),
        right: lowerNode(node.right),
        span: copy(node.span),
      };
    case "quantity":
      return {
        kind: "quantity",
        value: lowerNode(node.value),
        unit: lowerUnit(node.unit),
        span: copy(node.span),
      };
    case "conversion":
      return {
        kind: "conversion",
        expr: lowerNode(node.expr),
        unit: lowerUnit(node.unit),
        span: copy(node.span),
      };
    case "compare":
      return {
        kind: "compare",
        op: node.op,
        left: lowerNode(node.left),
        right: lowerNode(node.right),
        span: copy(node.span),
      };
    case "equation":
      return {
        kind: "equation",
        left: lowerNode(node.left),
        right: lowerNode(node.right),
        span: copy(node.span),
      };
    case "assign":
      return {
        kind: "assign",
        target: lowerNode(node.target),
        value: lowerNode(node.value),
        span: copy(node.span),
      };
    case "range":
      return {
        kind: "range",
        left: lowerNode(node.left),
        right: lowerNode(node.right),
        span: copy(node.span),
      };
    case "group":
      return lowerNode(node.expr);
    case "unitName":
    case "unitBinary":
    case "unitPower":
    case "unitGroup":
      throw new Error("A unit cannot be a statement.");
    default: {
      const exhaustive: never = node;
      return exhaustive;
    }
  }
}

function lowerUnit(node: UnitNode): UnitIr {
  switch (node.type) {
    case "unitName":
      return { kind: "unit", name: node.text, span: copy(node.span) };
    case "unitBinary":
      return {
        kind: "unitBinary",
        op: node.op,
        left: lowerUnit(node.left),
        right: lowerUnit(node.right),
        span: copy(node.span),
      };
    case "unitPower": {
      const magnitude = Number(node.exponent.text);
      return {
        kind: "unitPower",
        base: lowerUnit(node.base),
        exp: node.negative ? -magnitude : magnitude,
        span: copy(node.span),
      };
    }
    case "unitGroup":
      return lowerUnit(node.expr);
    default: {
      const exhaustive: never = node;
      return exhaustive;
    }
  }
}

function copy(span: Span): Span {
  return { start: span.start, end: span.end };
}
