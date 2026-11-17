import {
  AssignNode,
  CallNode,
  EquationNode,
  GroupNode,
  ListNode,
  NameNode,
  Node,
  NumberNode,
  Span,
  TupleNode,
  UnitNode,
} from "./ast";

export interface Parsed {
  node: Node;
  comments: Span[];
  source: string;
  base: number;
}

export class ParseError extends Error {
  readonly span: Span;
  readonly comments: Span[];

  constructor(message: string, span: Span, comments: Span[] = []) {
    super(message);
    this.name = "ParseError";
    this.span = span;
    this.comments = comments;
  }
}

type Token = {
  kind: "number" | "name" | "punct" | "eof";
  text: string;
  start: number;
  end: number;
};

export function parseStatement(source: string, base = 0): Parsed {
  const { tokens, comments } = lex(source, base);
  const node = new Parser(tokens, comments).parseStatement();
  return { node, comments, source, base };
}

function lex(source: string, base: number): { tokens: Token[]; comments: Span[] } {
  const tokens: Token[] = [];
  const comments: Span[] = [];
  const n = source.length;
  let i = 0;

  const fail = (message: string, start: number, end: number): never => {
    throw new ParseError(message, { start: base + start, end: base + end }, comments.slice());
  };

  while (i < n) {
    const ch = source[i];
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\f" || ch === "\v") {
      i++;
      continue;
    }
    if (ch === "\\") {
      let j = i + 1;
      while (j < n && (source[j] === " " || source[j] === "\t")) j++;
      if (j < n && (source[j] === "\n" || source[j] === "\r")) {
        if (source[j] === "\r" && source[j + 1] === "\n") j++;
        i = j + 1;
        continue;
      }
      fail("A \\ continues a statement onto the next line.", i, i + 1);
    }
    if (ch === "/" && source[i + 1] === "/") {
      const start = i;
      i += 2;
      while (i < n && source[i] !== "\n" && source[i] !== "\r") i++;
      comments.push({ start: base + start, end: base + i });
      continue;
    }
    if (isDigit(ch)) {
      tokens.push(scanNumber(source, base, i, fail));
      i = tokens[tokens.length - 1].end - base;
      continue;
    }
    if (isLetter(ch)) {
      const start = i;
      i++;
      while (i < n && (isLetter(source[i]) || isDigit(source[i]) || source[i] === "_")) i++;
      tokens.push({ kind: "name", text: source.slice(start, i), start: base + start, end: base + i });
      continue;
    }
    const two = source.slice(i, i + 2);
    if (two === ":=" || two === "<=" || two === ">=" || two === "..") {
      tokens.push({ kind: "punct", text: two, start: base + i, end: base + i + 2 });
      i += 2;
      continue;
    }
    if ("+-*/^()<>=[],".includes(ch)) {
      tokens.push({ kind: "punct", text: ch, start: base + i, end: base + i + 1 });
      i++;
      continue;
    }
    fail(`Unexpected character ${JSON.stringify(ch)}.`, i, i + 1);
  }

  tokens.push({ kind: "eof", text: "", start: base + n, end: base + n });
  return { tokens, comments };
}

function scanNumber(
  source: string,
  base: number,
  start: number,
  fail: (message: string, start: number, end: number) => never,
): Token {
  let i = start;
  while (i < source.length && isDigit(source[i])) i++;
  if (source[i] === "." && isDigit(source[i + 1] ?? "")) {
    i++;
    while (i < source.length && isDigit(source[i])) i++;
  }
  if (source[i] === "e" || source[i] === "E") {
    const mark = i;
    let j = i + 1;
    if (source[j] === "+" || source[j] === "-") j++;
    if (isDigit(source[j] ?? "")) {
      i = j;
      while (i < source.length && isDigit(source[i])) i++;
    } else if (source[mark + 1] === "+" || source[mark + 1] === "-") {
      fail("The exponent needs digits.", start, mark + 2);
    }
  }
  return { kind: "number", text: source.slice(start, i), start: base + start, end: base + i };
}

class Parser {
  private at = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly comments: Span[],
  ) {}

  private get cur(): Token {
    return this.tokens[this.at];
  }

  private get next(): Token {
    return this.tokens[this.at + 1] ?? this.cur;
  }

  parseStatement(): Node {
    if (this.cur.kind === "eof") {
      throw this.fail("Enter a statement.", this.cur);
    }
    const left = this.parseEquation();
    if (this.eat(":=")) {
      const target = asLValue(left);
      if (!target) {
        throw this.fail("The left side of := must be a name or a function of names.", left.span);
      }
      const value = this.parseExpression();
      this.end();
      return {
        type: "assign",
        target,
        value,
        span: { start: left.span.start, end: value.span.end },
      } satisfies AssignNode;
    }
    this.end();
    return left;
  }

  private parseEquation(): Node {
    const left = this.parseExpression();
    if (!this.eat("=")) return left;
    const right = this.parseExpression();
    return {
      type: "equation",
      left,
      right,
      span: { start: left.span.start, end: right.span.end },
    } satisfies EquationNode;
  }

  private parseExpression(): Node {
    return this.parseConversion();
  }

  private parseConversion(): Node {
    const left = this.parseComparison();
    if (this.cur.kind === "name" && this.cur.text === "in" && this.next.text === "[") {
      this.at++;
      const unit = this.parseUnitBracket();
      return {
        type: "conversion",
        expr: left,
        unit,
        span: { start: left.span.start, end: unit.span.end },
      };
    }
    return left;
  }

  private parseComparison(): Node {
    const left = this.parseRange();
    const op = this.cur.text;
    if (op === "<" || op === "<=" || op === ">" || op === ">=") {
      this.at++;
      const right = this.parseRange();
      return {
        type: "compare",
        op,
        left,
        right,
        span: { start: left.span.start, end: right.span.end },
      };
    }
    return left;
  }

  private parseRange(): Node {
    const left = this.parseSum();
    if (!this.eat("..")) return left;
    const right = this.parseSum();
    return {
      type: "range",
      left,
      right,
      span: { start: left.span.start, end: right.span.end },
    };
  }

  private parseSum(): Node {
    let left = this.parseProduct();
    while (this.cur.text === "+" || this.cur.text === "-") {
      const op = this.cur.text as "+" | "-";
      this.at++;
      const right = this.parseProduct();
      left = { type: "binary", op, left, right, span: between(left, right) };
    }
    return left;
  }

  private parseProduct(): Node {
    let left = this.parsePower();
    while (this.cur.text === "*" || this.cur.text === "/") {
      const op = this.cur.text as "*" | "/";
      this.at++;
      const right = this.parsePower();
      left = { type: "binary", op, left, right, span: between(left, right) };
    }
    return left;
  }

  private parsePower(): Node {
    const left = this.parseUnaryAtom();
    if (!this.eat("^")) return left;
    const right = this.parsePower();
    return { type: "binary", op: "^", left, right, span: between(left, right) };
  }

  private parseUnaryAtom(): Node {
    if (this.cur.text === "+" || this.cur.text === "-") {
      const tok = this.cur;
      const op = tok.text as "+" | "-";
      this.at++;
      const expr = this.parseUnaryAtom();
      return { type: "unary", op, expr, span: { start: tok.start, end: expr.span.end } };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Node {
    let node = this.parsePrimary();
    if (this.cur.text === "[") {
      const unit = this.parseUnitBracket();
      node = { type: "quantity", value: node, unit, span: between(node, unit) };
    }
    this.rejectJuxtaposition(node);
    return node;
  }

  private parsePrimary(): Node {
    const tok = this.cur;
    if (tok.kind === "number") {
      this.at++;
      return { type: "number", text: tok.text, span: { start: tok.start, end: tok.end } };
    }
    if (tok.kind === "name") {
      this.at++;
      const name: NameNode = { type: "name", text: tok.text, span: { start: tok.start, end: tok.end } };
      if (this.cur.text === "(") return this.parseCall(name);
      return name;
    }
    if (tok.text === "(") return this.parseGroup();
    if (tok.text === "[") return this.parseList();
    throw this.fail(
      tok.kind === "eof" ? "Unexpected end of statement." : `Unexpected ${tok.text}.`,
      tok,
    );
  }

  private parseCall(callee: NameNode): CallNode {
    this.expect("(");
    const args: Node[] = [];
    if (this.cur.text !== ")") {
      args.push(this.parseEquation());
      while (this.eat(",")) args.push(this.parseEquation());
    }
    const close = this.expect(")");
    return { type: "call", callee, args, span: { start: callee.span.start, end: close.end } };
  }

  private parseGroup(): GroupNode | TupleNode {
    const open = this.expect("(");
    if (this.cur.text === ")") {
      throw this.fail("Expected an expression.", this.cur);
    }
    const first = this.parseEquation();
    if (this.cur.text === ",") {
      const items = [first];
      while (this.eat(",")) {
        const after = this.tokens[this.at];
        if (after.text === ")") throw this.fail("Expected an expression.", after);
        items.push(this.parseEquation());
      }
      const close = this.expect(")");
      return { type: "tuple", items, span: { start: open.start, end: close.end } };
    }
    const close = this.expect(")");
    return { type: "group", expr: first, span: { start: open.start, end: close.end } };
  }

  private parseList(): ListNode {
    const open = this.expect("[");
    if (this.cur.text === "]") {
      throw this.fail("A list needs an item.", this.cur);
    }
    const items = [this.parseEquation()];
    while (this.eat(",")) {
      if (this.cur.text === "]") throw this.fail("Expected an expression.", this.cur);
      items.push(this.parseEquation());
    }
    const close = this.expect("]");
    return { type: "list", items, span: { start: open.start, end: close.end } };
  }

  private parseUnitBracket(): UnitNode {
    const open = this.expect("[");
    if (this.cur.text === "]") throw this.fail("A unit needs a name.", this.cur);
    const expr = this.parseUnitExpr();
    const close = this.expect("]");
    return { ...expr, span: { start: open.start, end: close.end } };
  }

  private parseUnitExpr(): UnitNode {
    let left = this.parseUnitPower();
    while (this.cur.text === "*" || this.cur.text === "/") {
      const op = this.cur.text as "*" | "/";
      this.at++;
      const right = this.parseUnitPower();
      left = { type: "unitBinary", op, left, right, span: between(left, right) };
    }
    return left;
  }

  private parseUnitPower(): UnitNode {
    const base = this.parseUnitAtom();
    if (!this.eat("^")) return base;
    let negative = false;
    if (this.eat("-")) negative = true;
    else this.eat("+");
    if (this.cur.kind !== "number" || !/^\d+$/.test(this.cur.text)) {
      throw this.fail("Unit exponents are integers.", this.cur);
    }
    const num = this.cur;
    this.at++;
    const exponent: NumberNode = {
      type: "number",
      text: num.text,
      span: { start: num.start, end: num.end },
    };
    return {
      type: "unitPower",
      base,
      exponent,
      negative,
      span: { start: base.span.start, end: num.end },
    };
  }

  private parseUnitAtom(): UnitNode {
    if (this.cur.kind === "name") {
      const tok = this.cur;
      this.at++;
      return { type: "unitName", text: tok.text, span: { start: tok.start, end: tok.end } };
    }
    if (this.cur.text === "(") {
      const open = this.expect("(");
      const expr = this.parseUnitExpr();
      const close = this.expect(")");
      return { type: "unitGroup", expr, span: { start: open.start, end: close.end } };
    }
    throw this.fail("Expected a unit name.", this.cur);
  }

  private rejectJuxtaposition(left: Node): void {
    const tok = this.cur;
    if (tok.kind === "eof") return;
    if (tok.kind === "name" && tok.text === "in") {
      if (this.next.text === "[") return;
      throw this.fail("in needs a unit in brackets.", tok);
    }
    if (tok.kind === "number" || tok.kind === "name" || tok.text === "(" || tok.text === "[") {
      throw this.fail("Write an operator between these. Juxtaposition is not multiplication.", {
        start: left.span.start,
        end: tok.end,
      });
    }
  }

  private end(): void {
    if (this.cur.kind !== "eof") throw this.fail(`Unexpected ${this.cur.text}.`, this.cur);
  }

  private eat(text: string): Token | null {
    if (this.cur.kind === "eof" || this.cur.text !== text) return null;
    const tok = this.cur;
    this.at++;
    return tok;
  }

  private expect(text: string): Token {
    const found = this.eat(text);
    if (found) return found;
    const what = this.cur.kind === "eof" ? "the end" : this.cur.text;
    throw this.fail(`Expected ${text} and found ${what}.`, this.cur);
  }

  private fail(message: string, span: Span | Token): ParseError {
    return new ParseError(message, { start: span.start, end: span.end }, this.comments.slice());
  }
}

function asLValue(node: Node): NameNode | CallNode | null {
  if (node.type === "name") return node;
  if (node.type === "call" && node.args.length >= 1 && node.args.every((arg) => arg.type === "name")) {
    return node;
  }
  return null;
}

function between(left: { span: Span }, right: { span: Span }): Span {
  return { start: left.span.start, end: right.span.end };
}

function isDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

function isLetter(ch: string): boolean {
  return (ch >= "A" && ch <= "Z") || (ch >= "a" && ch <= "z");
}
