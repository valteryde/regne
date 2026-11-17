/** Half-open UTF-16 offsets, the same indexes as a JavaScript string. */
export interface Span {
  start: number;
  end: number;
}

export type Node =
  | NumberNode
  | NameNode
  | CallNode
  | ListNode
  | TupleNode
  | UnitNode
  | QuantityNode
  | UnaryNode
  | BinaryNode
  | ConversionNode
  | CompareNode
  | AssignNode
  | EquationNode
  | GroupNode
  | RangeNode;

export interface NumberNode {
  type: "number";
  text: string;
  span: Span;
}

export interface NameNode {
  type: "name";
  text: string;
  span: Span;
}

export interface CallNode {
  type: "call";
  callee: NameNode;
  args: Node[];
  span: Span;
}

export interface ListNode {
  type: "list";
  items: Node[];
  span: Span;
}

export interface TupleNode {
  type: "tuple";
  items: Node[];
  span: Span;
}

export type UnitNode =
  | UnitNameNode
  | UnitBinaryNode
  | UnitPowerNode
  | UnitGroupNode;

export interface UnitNameNode {
  type: "unitName";
  text: string;
  span: Span;
}

export interface UnitBinaryNode {
  type: "unitBinary";
  op: "*" | "/";
  left: UnitNode;
  right: UnitNode;
  span: Span;
}

export interface UnitPowerNode {
  type: "unitPower";
  base: UnitNode;
  exponent: NumberNode;
  negative: boolean;
  span: Span;
}

export interface UnitGroupNode {
  type: "unitGroup";
  expr: UnitNode;
  span: Span;
}

export interface QuantityNode {
  type: "quantity";
  value: Node;
  unit: UnitNode;
  span: Span;
}

export interface UnaryNode {
  type: "unary";
  op: "+" | "-";
  expr: Node;
  span: Span;
}

export interface BinaryNode {
  type: "binary";
  op: "+" | "-" | "*" | "/" | "^";
  left: Node;
  right: Node;
  span: Span;
}

export interface ConversionNode {
  type: "conversion";
  expr: Node;
  unit: UnitNode;
  span: Span;
}

export interface CompareNode {
  type: "compare";
  op: "<" | "<=" | ">" | ">=";
  left: Node;
  right: Node;
  span: Span;
}

export interface AssignNode {
  type: "assign";
  target: NameNode | CallNode;
  value: Node;
  span: Span;
}

export interface EquationNode {
  type: "equation";
  left: Node;
  right: Node;
  span: Span;
}

export interface GroupNode {
  type: "group";
  expr: Node;
  span: Span;
}

export interface RangeNode {
  type: "range";
  left: Node;
  right: Node;
  span: Span;
}

export function children(node: Node): Node[] {
  switch (node.type) {
    case "number":
    case "name":
    case "unitName":
      return [];
    case "call":
      return [node.callee, ...node.args];
    case "list":
    case "tuple":
      return node.items;
    case "unitBinary":
    case "binary":
    case "compare":
    case "equation":
    case "range":
      return [node.left, node.right];
    case "unitPower":
      return [node.base, node.exponent];
    case "unitGroup":
      return [node.expr];
    case "quantity":
      return [node.value, node.unit];
    case "unary":
      return [node.expr];
    case "conversion":
      return [node.expr, node.unit];
    case "assign":
      return [node.target, node.value];
    case "group":
      return [node.expr];
    default: {
      const exhaustive: never = node;
      return exhaustive;
    }
  }
}

export function findNode(node: Node, pred: (node: Node) => boolean): Node | null {
  if (pred(node)) return node;
  for (const child of children(node)) {
    const found = findNode(child, pred);
    if (found) return found;
  }
  return null;
}
