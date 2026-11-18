import sys
from pathlib import Path

import sympy
from ward import test

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src" / "engine"))
from irEval import (
    UNITS_ERROR,
    Memo,
    Session,
    _compact_unit_latex,
    evaluate_incremental,
    evaluate_program,
    evaluate_statement,
    read_names,
    wire_results,
)

S = {"start": 0, "end": 1}


def num(text: str) -> dict:
    return {"kind": "number", "text": text, "span": dict(S)}


def sym(name: str, span=None) -> dict:
    return {"kind": "symbol", "name": name, "span": span or dict(S)}


def binary(op: str, left: dict, right: dict) -> dict:
    return {"kind": "binary", "op": op, "left": left, "right": right, "span": dict(S)}


def qty(text: str, unit: str, span=None) -> dict:
    return {
        "kind": "quantity",
        "value": num(text),
        "unit": {"kind": "unit", "name": unit, "span": span or dict(S)},
        "span": span or dict(S),
    }


def call(name: str, args: list, span=None) -> dict:
    return {"kind": "call", "name": name, "args": args, "span": span or dict(S)}


@test("10 bar times 66 L is 660 bar liters")
def _():
    result = evaluate_statement(binary("*", qty("10", "bar"), qty("66", "L")), Session())
    assert result["kind"] == "quantity"
    assert "660" in result["latex"]
    assert r"\mathrm{bar}" in result["latex"]
    assert r"\cdot" in result["latex"]
    assert r"\mathrm{l}" in result["latex"]
    assert r"\frac" not in result["latex"]


@test("a product of bar and liter converts to joules")
def _():
    statement = {
        "kind": "conversion",
        "expr": binary("*", qty("10", "bar"), qty("66", "L")),
        "unit": {"kind": "unit", "name": "J", "span": dict(S)},
        "span": dict(S),
    }
    result = evaluate_statement(statement, Session())
    assert result["kind"] == "quantity"
    assert "66000" in result["latex"]
    assert r"\mathrm{J}" in result["latex"]


@test("an assignment binds a number for the next statement")
def _():
    results = evaluate_program([
        {"kind": "assign", "target": sym("a"), "value": binary("+", num("10"), num("5")), "span": dict(S)},
        binary("+", sym("a"), num("1")),
    ])
    assert results[0]["kind"] == "expression"
    assert results[0]["latex"] == "15"
    assert results[1]["latex"] == "16"


@test("a bound quantity keeps its unit")
def _():
    results = evaluate_program([
        {"kind": "assign", "target": sym("P"), "value": qty("10", "bar"), "span": dict(S)},
        binary("*", sym("P"), num("2")),
    ])
    assert results[1]["kind"] == "quantity"
    assert "20" in results[1]["latex"]
    assert r"\mathrm{bar}" in results[1]["latex"]


@test("an indefinite integral is the antiderivative")
def _():
    result = evaluate_statement(call("integrate", [binary("^", sym("x"), num("2")), sym("x")]), Session())
    x = sympy.Symbol("x")
    assert result["latex"] == sympy.latex(sympy.integrate(x**2, x))


@test("a definite integral uses the bounds tuple")
def _():
    bounds = {"kind": "tuple", "items": [sym("x"), num("0"), num("1")], "span": dict(S)}
    result = evaluate_statement(call("integrate", [binary("^", sym("x"), num("2")), bounds]), Session())
    assert result["kind"] == "expression"
    assert result["text"] == "1/3"


@test("diff of x squared is 2x")
def _():
    statement = call("diff", [binary("^", sym("x"), num("2")), sym("x")])
    result = evaluate_statement(statement, Session())
    x = sympy.Symbol("x")
    assert result["kind"] == "expression"
    assert result["latex"] == sympy.latex(2 * x)


@test("a quadratic equation solves for its one unbound name")
def _():
    right = binary("-", binary("+", binary("^", sym("x"), num("2")), binary("*", num("2"), sym("x"))), num("4"))
    statement = {"kind": "equation", "left": num("0"), "right": right, "span": dict(S)}
    result = evaluate_statement(statement, Session())
    x = sympy.Symbol("x")
    expected = sympy.solve(sympy.Eq(0, x**2 + 2 * x - 4), x)
    assert result["kind"] == "equation"
    assert result["text"] == str(expected)


@test("two unbound names ask for solve")
def _():
    statement = {"kind": "equation", "left": binary("+", sym("x"), sym("y")), "right": num("1"), "span": dict(S)}
    result = evaluate_statement(statement, Session())
    assert result["kind"] == "error"
    assert "solve" in result["message"]


@test("a function binding is called on the next line")
def _():
    definition = {
        "kind": "assign",
        "target": call("f", [sym("x")]),
        "value": binary("+", binary("^", sym("x"), num("2")), num("1")),
        "span": dict(S),
    }
    results = evaluate_program([definition, call("f", [num("3")])])
    assert results[1]["latex"] == "10"


@test("E is a name and a shown line does not change the session")
def _():
    assert evaluate_statement(sym("E"), Session())["latex"] == "E"
    results = evaluate_program([
        {"kind": "assign", "target": sym("a"), "value": num("4"), "span": dict(S)},
        {"kind": "show", "span": dict(S)},
        sym("a"),
        sym("E"),
    ])
    assert results[1]["kind"] == "expression"
    assert results[1]["latex"] == ""
    assert results[2]["latex"] == "4"
    assert results[3]["latex"] == "E"


@test("restart forgets the bindings above it")
def _():
    results = evaluate_program([
        {"kind": "assign", "target": sym("a"), "value": num("4"), "span": dict(S)},
        {"kind": "restart", "span": dict(S)},
        sym("a"),
    ])
    assert results[2]["text"] == "a"


@test("diff of a quantity is refused and keeps the quantity span")
def _():
    quantity = qty("10", "m", {"start": 5, "end": 11})
    result = evaluate_statement(call("diff", [quantity, sym("x")]), Session())
    assert result["kind"] == "error"
    assert result["message"] == UNITS_ERROR
    assert result["span"] == {"start": 5, "end": 11}


@test("simplify of a quantity is refused")
def _():
    result = evaluate_statement(call("simplify", [qty("10", "bar")]), Session())
    assert result["message"] == UNITS_ERROR


@test("adding celsius temperatures reports Pint's error")
def _():
    result = evaluate_statement(binary("+", qty("10", "degC"), qty("5", "degC")), Session())
    assert result["kind"] == "error"
    assert "offset" in result["message"].lower()


@test("celsius converts to kelvin")
def _():
    statement = {
        "kind": "conversion",
        "expr": qty("20", "degC"),
        "unit": {"kind": "unit", "name": "K", "span": dict(S)},
        "span": dict(S),
    }
    result = evaluate_statement(statement, Session())
    assert result["kind"] == "quantity"
    assert "293.15" in result["latex"]
    assert r"\mathrm{K}" in result["latex"]


def _unit_binary(op: str, left: dict, right: dict) -> dict:
    return {"kind": "unitBinary", "op": op, "left": left, "right": right, "span": dict(S)}


def _unit(name: str) -> dict:
    return {"kind": "unit", "name": name, "span": dict(S)}


def _unit_power(name: str, exp: int) -> dict:
    return {"kind": "unitPower", "base": _unit(name), "exp": exp, "span": dict(S)}


@test("an equation of quantities solves the temperature in kelvin")
def _():
    gas_constant = {
        "kind": "quantity",
        "value": num("8.314"),
        "unit": _unit_binary(
            "/",
            _unit("J"),
            _unit_binary("*", _unit("mol"), _unit("K")),
        ),
        "span": dict(S),
    }
    results = evaluate_program([
        {"kind": "assign", "target": sym("n"), "value": qty("2", "mol"), "span": dict(S)},
        {"kind": "assign", "target": sym("P"), "value": qty("10", "bar"), "span": dict(S)},
        {"kind": "assign", "target": sym("V"), "value": qty("66", "L"), "span": dict(S)},
        {"kind": "assign", "target": sym("R"), "value": gas_constant, "span": dict(S)},
        {
            "kind": "equation",
            "left": sym("T"),
            "right": binary("/", binary("*", sym("P"), sym("V")), binary("*", sym("n"), sym("R"))),
            "span": dict(S),
        },
    ])
    solved = results[-1]
    assert solved["kind"] == "quantity"
    assert "3969.21" in solved["latex"]
    assert r"\mathrm{K}" in solved["latex"]
    assert r"\frac" not in solved["latex"]
    gas = results[3]
    assert r"\mathrm{J}/(\mathrm{K} \cdot \mathrm{mol})" in gas["latex"] or r"\mathrm{J}/(\mathrm{mol} \cdot \mathrm{K})" in gas["latex"]


@test("plot of sine over a domain returns an svg")
def _():
    domain = {
        "kind": "equation",
        "left": sym("x"),
        "right": {
            "kind": "range",
            "left": {"kind": "unary", "op": "-", "expr": num("5"), "span": dict(S)},
            "right": num("5"),
            "span": dict(S),
        },
        "span": dict(S),
    }
    result = evaluate_statement(call("plot", [call("sin", [sym("x")]), domain]), Session())
    assert result["kind"] == "plot"
    assert "<svg" in result["svg"]


@test("a tiny powered quantity uses a power of ten and a superscript")
def _():
    unit = _unit_binary("/", _unit_binary("*", _unit("m"), _unit_power("s", 2)), _unit("kg"))
    statement = {"kind": "quantity", "value": num("6.6e-7"), "unit": unit, "span": dict(S)}
    result = evaluate_statement(statement, Session())
    assert result["kind"] == "quantity"
    assert r"6.6\times 10^{-7}" in result["latex"]
    assert r"\mathrm{s}^{2}" in result["latex"]
    assert r"\mathrm{m}" in result["latex"]
    assert r"\mathrm{kg}" in result["latex"]
    assert r"\mathrm{2}" not in result["latex"]
    assert "6.6e-07" in result["text"]
    assert "\\times" not in result["text"]


@test("a negative unit exponent stays a superscript")
def _():
    statement = {"kind": "quantity", "value": num("1"), "unit": _unit_power("s", -2), "span": dict(S)}
    result = evaluate_statement(statement, Session())
    assert result["kind"] == "quantity"
    assert r"\mathrm{s}^{2}" in result["latex"]
    assert r"\mathrm{2}" not in result["latex"]
    assert _compact_unit_latex("s ** -2") == r"\mathrm{s}^{-2}"


def assign(name: str, value: dict) -> dict:
    return {"kind": "assign", "target": sym(name), "value": value, "span": dict(S)}


def fn_plus_a() -> dict:
    return {
        "kind": "assign",
        "target": call("f", [sym("x")]),
        "value": binary("+", sym("x"), sym("a")),
        "span": dict(S),
    }


def sine_plot(body: dict) -> dict:
    domain = {
        "kind": "equation",
        "left": sym("x"),
        "right": {
            "kind": "range",
            "left": {"kind": "unary", "op": "-", "expr": num("5"), "span": dict(S)},
            "right": num("5"),
            "span": dict(S),
        },
        "span": dict(S),
    }
    return call("plot", [body, domain])


def run(statements, memo):
    trace = []
    evaluated = evaluate_incremental(statements, memo, trace)
    return trace, evaluated


@test("an unrelated edit reruns the assignment and leaves the plot")
def _():
    memo = Memo()
    program = [
        assign("a", num("1")),
        binary("+", sym("b"), num("1")),
        sine_plot(call("sin", [sym("x")])),
    ]
    first, _ = run(program, memo)
    assert first == [0, 1, 2]
    second, _ = run([assign("a", num("2")), program[1], program[2]], memo)
    assert second == [0]


@test("a plot reruns when it reads the edited name")
def _():
    memo = Memo()
    program = [assign("a", num("1")), sine_plot(call("sin", [sym("a")]))]
    run(program, memo)
    second, _ = run([assign("a", num("2")), program[1]], memo)
    assert second == [0, 1]


@test("a function reruns when a name above its definition changes")
def _():
    memo = Memo()
    program = [assign("a", num("1")), fn_plus_a(), call("f", [num("1")])]
    _, first = run(program, memo)
    assert first.results[2]["latex"] == "2"
    trace, second = run([assign("a", num("2")), program[1], program[2]], memo)
    assert trace == [0, 1, 2]
    assert second.results[2]["latex"] == "3"


@test("a function does not rerun when its captured name is assigned below it")
def _():
    memo = Memo()
    program = [fn_plus_a(), assign("a", num("1")), call("f", [num("1")])]
    _, first = run(program, memo)
    assert "a" in first.results[2]["latex"]
    trace, second = run([program[0], assign("a", num("2")), program[2]], memo)
    assert trace == [1]
    assert second.results[2]["latex"] == first.results[2]["latex"]


@test("editing above restart leaves the cleared session's statement")
def _():
    memo = Memo()
    below = binary("+", sym("a"), num("1"))
    program = [assign("a", num("1")), {"kind": "restart", "span": dict(S)}, below]
    _, first = run(program, memo)
    trace, second = run([assign("a", num("2")), program[1], below], memo)
    assert 2 not in trace
    assert second.results[2]["latex"] == first.results[2]["latex"]
    assert "a" in second.results[2]["latex"]


@test("the same math with different spans runs once")
def _():
    def plus(span):
        number = {"kind": "number", "text": "1", "span": span}
        return {"kind": "binary", "op": "+", "left": number, "right": dict(number), "span": span}

    memo = Memo()
    first_trace, first = run([plus({"start": 0, "end": 1})], memo)
    second_trace, second = run([plus({"start": 9, "end": 12})], memo)
    assert first_trace == [0]
    assert second_trace == []
    assert second.results[0]["latex"] == first.results[0]["latex"]


@test("a value binding of sin does not rerun a sin call")
def _():
    memo = Memo()
    call_sin = call("sin", [num("1")])
    run([assign("sin", num("5")), call_sin], memo)
    trace, _ = run([assign("sin", num("6")), call_sin], memo)
    assert trace == [0]


@test("a one-shot program does not keep bindings from the previous one")
def _():
    evaluate_program([assign("a", num("1"))])
    result = evaluate_program([sym("a")])
    assert result[0]["text"] == "a"


@test("the memo drops the oldest result past its limit")
def _():
    memo = Memo(limit=2)
    one = [assign("a", num("1"))]
    two = [assign("a", num("2"))]
    three = [assign("a", num("3"))]
    run(one, memo)
    run(two, memo)
    run(three, memo)
    kept, _ = run(two, memo)
    assert kept == []
    trace, _ = run(one, memo)
    assert trace == [0]


@test("a known digest is omitted and an unknown one is sent in full")
def _():
    memo = Memo()
    _, evaluated = run([binary("+", num("1"), num("1"))], memo)
    digest = evaluated.digests[0]
    plain = wire_results(evaluated.results, evaluated.digests, None)
    assert "digest" not in plain[0]
    assert plain[0]["latex"] == "2"
    full = wire_results(evaluated.results, evaluated.digests, [])
    assert full[0]["digest"] == digest
    assert full[0]["latex"] == "2"
    hidden = wire_results(evaluated.results, evaluated.digests, [digest])
    assert hidden == [{"digest": digest, "cached": True}]


@test("a plot domain name is not a read and a function body skips its parameters")
def _():
    domain = {
        "kind": "equation",
        "left": sym("x"),
        "right": {"kind": "range", "left": sym("a"), "right": num("1"), "span": dict(S)},
        "span": dict(S),
    }
    plotted = call("plot", [call("sin", [sym("t")]), domain])
    assert read_names(plotted, Session()) == {"plot", "sin", "t", "a"}
    assert read_names(fn_plus_a(), Session()) == {"a"}
