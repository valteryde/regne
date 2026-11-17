import { Span } from "./ast";

export type Ir =
  | NumberIr
  | SymbolIr
  | CallIr
  | ListIr
  | TupleIr
  | UnaryIr
  | BinaryIr
  | QuantityIr
  | ConversionIr
  | CompareIr
  | EquationIr
  | AssignIr
  | RangeIr
  | RestartIr;

export interface NumberIr {
  kind: "number";
  text: string;
  span: Span;
}

export interface SymbolIr {
  kind: "symbol";
  name: string;
  span: Span;
}

export interface CallIr {
  kind: "call";
  name: string;
  args: Ir[];
  span: Span;
}

export interface ListIr {
  kind: "list";
  items: Ir[];
  span: Span;
}

export interface TupleIr {
  kind: "tuple";
  items: Ir[];
  span: Span;
}

export interface UnaryIr {
  kind: "unary";
  op: "+" | "-";
  expr: Ir;
  span: Span;
}

export interface BinaryIr {
  kind: "binary";
  op: "+" | "-" | "*" | "/" | "^";
  left: Ir;
  right: Ir;
  span: Span;
}

export interface QuantityIr {
  kind: "quantity";
  value: Ir;
  unit: UnitIr;
  span: Span;
}

export interface ConversionIr {
  kind: "conversion";
  expr: Ir;
  unit: UnitIr;
  span: Span;
}

export interface CompareIr {
  kind: "compare";
  op: "<" | "<=" | ">" | ">=";
  left: Ir;
  right: Ir;
  span: Span;
}

export interface EquationIr {
  kind: "equation";
  left: Ir;
  right: Ir;
  span: Span;
}

export interface AssignIr {
  kind: "assign";
  target: Ir;
  value: Ir;
  span: Span;
}

export interface RangeIr {
  kind: "range";
  left: Ir;
  right: Ir;
  span: Span;
}

export interface RestartIr {
  kind: "restart";
  span: Span;
}

export type UnitIr = UnitNameIr | UnitBinaryIr | UnitPowerIr;

export interface UnitNameIr {
  kind: "unit";
  name: string;
  span: Span;
}

export interface UnitBinaryIr {
  kind: "unitBinary";
  op: "*" | "/";
  left: UnitIr;
  right: UnitIr;
  span: Span;
}

export interface UnitPowerIr {
  kind: "unitPower";
  base: UnitIr;
  exp: number;
  span: Span;
}
