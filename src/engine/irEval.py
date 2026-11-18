"""Evaluate the JSON IR produced by src/language/lower.ts."""

from __future__ import annotations

import io
import math
from typing import Any

import sympy
import pint

try:
    import kaxe
    KAXE_AVAILABLE = True
except ImportError:
    kaxe = None
    KAXE_AVAILABLE = False

UNITS_ERROR = "this operation does not take units yet."

UREG = pint.UnitRegistry()

CONSTANTS = {
    "pi": sympy.pi,
    "I": sympy.I,
    "oo": sympy.oo,
}

ELEMENTARY = {
    "sqrt": sympy.sqrt,
    "abs": sympy.Abs,
    "sin": sympy.sin,
    "cos": sympy.cos,
    "tan": sympy.tan,
    "exp": sympy.exp,
    "ln": sympy.log,
}


class IrError(Exception):
    def __init__(self, message: str, span: dict | None):
        super().__init__(message)
        self.message = message
        self.span = span


class Session:
    def __init__(self):
        self.values: dict[str, Any] = {}
        self.functions: dict[str, tuple] = {}

    def clear(self) -> None:
        self.values.clear()
        self.functions.clear()


class PlotValue:
    def __init__(self, svg: str):
        self.svg = svg


def evaluate_program(statements: list[dict]) -> list[dict]:
    session = Session()
    return [evaluate_statement(statement, session) for statement in statements]


def evaluate_statement(node: dict, session: Session) -> dict:
    try:
        return _statement(node, session)
    except IrError as err:
        return _error(err.message, err.span)
    except Exception as err:
        return _error(_clean(err), node.get("span"))


def _statement(node: dict, session: Session) -> dict:
    kind = node["kind"]
    if kind == "restart":
        session.clear()
        return _ok("expression", "", "")
    if kind == "show":
        return _ok("expression", "", "")
    if kind == "assign":
        return _assign(node, session)
    if kind == "equation":
        return _solve_equation(node, session)
    value = eval_expr(node, session)
    return format_value(value)


def eval_expr(node: dict, session: Session) -> Any:
    kind = node["kind"]
    if kind == "number":
        return _number(node["text"])
    if kind == "symbol":
        return _symbol(node["name"], session)
    if kind == "unary":
        value = eval_expr(node["expr"], session)
        if node["op"] == "+":
            return value
        return _negate(value, node["span"])
    if kind == "binary":
        return _binary(node, session)
    if kind == "group":
        return eval_expr(node["expr"], session)
    if kind == "quantity":
        magnitude = eval_expr(node["value"], session)
        if isinstance(magnitude, pint.Quantity):
            raise IrError("A value already has a unit.", node["span"])
        return UREG.Quantity(_magnitude(magnitude), _unit(node["unit"]))
    if kind == "conversion":
        value = eval_expr(node["expr"], session)
        if not isinstance(value, pint.Quantity):
            raise IrError("in converts a quantity.", node["span"])
        try:
            return value.to(_unit(node["unit"]))
        except Exception as err:
            raise IrError(_clean(err), node["span"]) from err
    if kind == "compare":
        return _compare(node, session)
    if kind == "equation":
        left = eval_expr(node["left"], session)
        right = eval_expr(node["right"], session)
        _reject_units(left, node)
        _reject_units(right, node)
        return sympy.Eq(left, right)
    if kind == "call":
        return _call(node, session)
    if kind == "list":
        return [eval_expr(item, session) for item in node["items"]]
    if kind == "tuple":
        return tuple(eval_expr(item, session) for item in node["items"])
    if kind == "range":
        raise IrError("A range is only valid in a plot domain.", node["span"])
    if kind in ("assign", "restart"):
        raise IrError(f"{kind} is only valid as a statement.", node["span"])
    raise IrError(f"Unknown expression {kind}.", node.get("span"))


def _assign(node: dict, session: Session) -> dict:
    target = node["target"]
    if target["kind"] == "symbol":
        value = eval_expr(node["value"], session)
        session.functions.pop(target["name"], None)
        session.values[target["name"]] = value
        return format_value(value)
    if target["kind"] == "call":
        params = []
        for arg in target["args"]:
            if arg["kind"] != "symbol":
                raise IrError("A function parameter must be a name.", arg["span"])
            params.append(arg["name"])
        saved = {name: session.values.pop(name, _MISSING) for name in params}
        try:
            body = eval_expr(node["value"], session)
        finally:
            for name, old in saved.items():
                if old is _MISSING:
                    session.values.pop(name, None)
                else:
                    session.values[name] = old
        symbols = tuple(sympy.Symbol(name) for name in params)
        if isinstance(body, pint.Quantity):
            session.functions[target["name"]] = ("quantity", params, body)
        else:
            session.functions[target["name"]] = ("lambda", params, sympy.Lambda(symbols, body))
        session.values.pop(target["name"], None)
        return format_value(body)
    raise IrError("The left side of := must be a name or a function of names.", target["span"])


def _solve_equation(node: dict, session: Session) -> dict:
    left = eval_expr(node["left"], session)
    right = eval_expr(node["right"], session)
    if isinstance(left, pint.Quantity) or isinstance(right, pint.Quantity):
        return _solve_quantity_equation(left, right, node)
    equation = sympy.Eq(left, right)
    free = sorted(equation.free_symbols, key=lambda symbol: symbol.name)
    if len(free) > 1:
        names = ", ".join(symbol.name for symbol in free)
        raise IrError(f"Name the unknown with solve. More than one unbound name: {names}.", node["span"])
    if len(free) == 0:
        return format_value(sympy.simplify(equation))
    return _solutions(sympy.solve(equation, free[0]))


def _solve_quantity_equation(left, right, node: dict) -> dict:
    """Solve T = P*V/(n*R) by isolating one name and labeling it with a base unit."""
    free = _free_symbols(left) | _free_symbols(right)
    if len(free) > 1:
        names = ", ".join(sorted(symbol.name for symbol in free))
        raise IrError(f"Name the unknown with solve. More than one unbound name: {names}.", node["span"])
    if len(free) == 0:
        return _compare_quantities(left, right, node)
    symbol = next(iter(free))
    try:
        coeff_left, const_left = _affine(left, symbol)
        coeff_right, const_right = _affine(right, symbol)
        coeff = _sub_term(coeff_left, coeff_right)
        const = _sub_term(const_right, const_left)
    except _NotLinear as err:
        raise IrError("This equation is not linear in the unknown.", node["span"]) from err
    except Exception as err:
        raise IrError(_clean(err), node["span"]) from err
    if _is_zero(coeff):
        raise IrError("This equation does not determine the unknown.", node["span"])
    try:
        value = _div(const, coeff)
    except Exception as err:
        raise IrError(_clean(err), node["span"]) from err
    if isinstance(value, pint.Quantity):
        try:
            value = value.to_base_units()
        except Exception as err:
            raise IrError(_clean(err), node["span"]) from err
    return format_value(value)


class _NotLinear(Exception):
    pass


def _free_symbols(value) -> set:
    if isinstance(value, pint.Quantity):
        magnitude = value.magnitude
        if isinstance(magnitude, sympy.Basic):
            return set(magnitude.free_symbols)
        return set()
    if isinstance(value, sympy.Basic):
        return set(value.free_symbols)
    return set()


def _affine(value, symbol):
    if isinstance(value, pint.Quantity):
        coeff, rest = _split_linear(_as_expr(value.magnitude), symbol)
        return (
            UREG.Quantity(_magnitude(coeff), value.units),
            UREG.Quantity(_magnitude(rest), value.units),
        )
    if isinstance(value, (int, float)) or (isinstance(value, sympy.Basic) and value.is_number and not value.free_symbols):
        return sympy.Integer(0), _as_expr(value)
    coeff, rest = _split_linear(_as_expr(value), symbol)
    return coeff, rest


def _split_linear(expr, symbol):
    expanded = sympy.expand(expr)
    coeff = expanded.coeff(symbol)
    rest = sympy.expand(expanded - coeff * symbol)
    if rest.free_symbols:
        raise _NotLinear()
    return coeff, rest


def _sub_term(left, right):
    if _is_zero(left):
        return _negate(right, None)
    if _is_zero(right):
        return left
    return left - right


def _is_zero(value) -> bool:
    if isinstance(value, pint.Quantity):
        magnitude = value.magnitude
        if isinstance(magnitude, sympy.Basic) and magnitude.free_symbols:
            return False
        try:
            return float(magnitude) == 0.0
        except Exception:
            return False
    if isinstance(value, sympy.Basic):
        return value == 0
    try:
        return float(value) == 0.0
    except Exception:
        return False


def _compare_quantities(left, right, node: dict) -> dict:
    try:
        if isinstance(left, pint.Quantity) and isinstance(right, pint.Quantity):
            left_base = left.to_base_units()
            right_base = right.to_base_units()
            scale = max(1.0, abs(float(left_base.magnitude)))
            equal = abs(float(left_base.magnitude) - float(right_base.magnitude)) <= 1e-9 * scale
            return format_value(equal)
        return format_value(False)
    except Exception as err:
        raise IrError(_clean(err), node["span"]) from err


def _call(node: dict, session: Session) -> Any:
    name = node["name"]
    if name in session.functions:
        args = [eval_expr(arg, session) for arg in node["args"]]
        return _call_user(session.functions[name], args, node["span"])
    if name == "diff":
        return _diff(node, session)
    if name == "integrate":
        return _integrate(node, session)
    if name == "solve":
        return _solve_call(node, session)
    if name in ("simplify", "factor", "expand"):
        return _unary_sympy(node, session, getattr(sympy, name))
    if name == "limit":
        return _limit(node, session)
    if name == "series":
        return _series(node, session)
    if name == "subs":
        return _subs(node, session)
    if name == "plot":
        return _plot(node, session)
    if name == "log":
        return _log(node, session)
    if name in ELEMENTARY:
        values = _values(node, session, reject=True)
        return ELEMENTARY[name](*values)
    values = _values(node, session, reject=True)
    return sympy.Function(name)(*values)


def _diff(node: dict, session: Session) -> Any:
    if len(node["args"]) not in (2, 3):
        raise IrError("diff expects an expression and a variable.", node["span"])
    expr = eval_expr(node["args"][0], session)
    var = eval_expr(node["args"][1], session)
    _reject_units(expr, node["args"][0])
    _reject_units(var, node["args"][1])
    if len(node["args"]) == 2:
        return sympy.diff(expr, var)
    order = eval_expr(node["args"][2], session)
    _reject_units(order, node["args"][2])
    return sympy.diff(expr, var, order)


def _integrate(node: dict, session: Session) -> Any:
    if len(node["args"]) != 2:
        raise IrError("integrate expects an expression and a variable.", node["span"])
    expr = eval_expr(node["args"][0], session)
    _reject_units(expr, node["args"][0])
    spec = node["args"][1]
    if spec["kind"] == "tuple":
        bounds = eval_expr(spec, session)
        for item, child in zip(bounds, spec["items"]):
            _reject_units(item, child)
        return sympy.integrate(expr, bounds)
    var = eval_expr(spec, session)
    _reject_units(var, spec)
    return sympy.integrate(expr, var)


def _solve_call(node: dict, session: Session) -> Any:
    if not node["args"]:
        raise IrError("solve expects an equation.", node["span"])
    target = node["args"][0]
    if target["kind"] == "equation":
        equation = eval_expr(target, session)
    else:
        value = eval_expr(target, session)
        _reject_units(value, target)
        equation = value
    if len(node["args"]) == 1:
        return _solution_list(sympy.solve(equation))
    var = eval_expr(node["args"][1], session)
    _reject_units(var, node["args"][1])
    return _solution_list(sympy.solve(equation, var))


def _unary_sympy(node: dict, session: Session, fn) -> Any:
    if len(node["args"]) != 1:
        raise IrError(f"{node['name']} expects one expression.", node["span"])
    value = eval_expr(node["args"][0], session)
    _reject_units(value, node["args"][0])
    return fn(value)


def _limit(node: dict, session: Session) -> Any:
    if len(node["args"]) < 3:
        raise IrError("limit expects an expression, a variable, and a point.", node["span"])
    values = _values(node, session, reject=True)
    return sympy.limit(*values)


def _series(node: dict, session: Session) -> Any:
    if len(node["args"]) < 2:
        raise IrError("series expects an expression and a variable.", node["span"])
    values = _values(node, session, reject=True)
    return sympy.series(*values)


def _subs(node: dict, session: Session) -> Any:
    if len(node["args"]) != 3:
        raise IrError("subs expects an expression, a variable, and a value.", node["span"])
    expr, old, new = _values(node, session, reject=True)
    return expr.subs(old, new)


def _log(node: dict, session: Session) -> Any:
    values = _values(node, session, reject=True)
    if len(values) == 1:
        return sympy.log(values[0], 10)
    if len(values) == 2:
        return sympy.log(values[0], values[1])
    raise IrError("log expects a value and an optional base.", node["span"])


def _plot(node: dict, session: Session) -> PlotValue:
    if not node["args"]:
        raise IrError("plot expects a function.", node["span"])
    if not KAXE_AVAILABLE:
        raise IrError("Kaxe plotting library is not installed.", node["span"])
    functions = []
    x_domain = None
    y_range = None
    plot_var = None
    for arg in node["args"]:
        if arg["kind"] == "equation":
            if arg["right"]["kind"] != "range":
                raise IrError("A plot domain is a range.", arg["span"])
            name = arg["left"]["name"] if arg["left"]["kind"] == "symbol" else "x"
            low = _real(eval_expr(arg["right"]["left"], session), arg["right"]["span"])
            high = _real(eval_expr(arg["right"]["right"], session), arg["right"]["span"])
            if name in ("y", "f"):
                y_range = (low, high)
            else:
                plot_var = sympy.Symbol(name)
                x_domain = (low, high)
        else:
            functions.append(eval_expr(arg, session))
    return PlotValue(_render_plot(functions, x_domain, y_range, plot_var, node["span"]))


def _render_plot(functions, x_domain, y_range, plot_var, span) -> str:
    callables = []
    labels = []
    for expr in functions:
        _reject_units(expr, {"span": span})
        if isinstance(expr, sympy.Lambda):
            body = expr.expr
            sym = expr.variables[0]
        else:
            body = expr
            free = sorted(getattr(body, "free_symbols", []), key=lambda item: item.name)
            sym = plot_var or (free[0] if free else sympy.Symbol("x"))
        fn = sympy.lambdify(sym, body, modules=["numpy", "math"])
        callables.append(_safe_plot(fn))
        labels.append(sympy.latex(body) if isinstance(body, sympy.Basic) else str(body))

    if x_domain and y_range:
        plt = kaxe.Plot([x_domain[0], x_domain[1], y_range[0], y_range[1]])
    else:
        plt = kaxe.Plot()
    plt.theme(kaxe.Themes.A4Small)
    for fn in callables:
        kwargs = {"domain": x_domain} if x_domain and not y_range else {}
        plt.add(kaxe.Function2D(fn, **kwargs))
    if len(labels) == 1:
        plt.title(f"${labels[0]}$")
    buf = io.BytesIO()
    plt.save(buf, format="svg")
    return buf.getvalue().decode("utf-8")


def _safe_plot(fn):
    def wrapper(x_val, fn=fn):
        try:
            res = fn(x_val)
            if hasattr(res, "item"):
                res = res.item()
            if isinstance(res, complex) or (isinstance(res, float) and not math.isfinite(res)):
                return None
            return float(res)
        except Exception:
            return None
    return wrapper


def _binary(node: dict, session: Session) -> Any:
    left = eval_expr(node["left"], session)
    right = eval_expr(node["right"], session)
    op = node["op"]
    try:
        if op == "+":
            return _add(left, right, 1)
        if op == "-":
            return _add(left, right, -1)
        if op == "*":
            return _mul(left, right)
        if op == "/":
            return _div(left, right)
        if op == "^":
            return _pow(left, right, node["span"])
    except IrError:
        raise
    except Exception as err:
        raise IrError(_clean(err), node["span"]) from err
    raise IrError(f"Unknown operator {op}.", node["span"])


def _add(left, right, sign: int):
    right = right if sign == 1 else _negate(right, None)
    if isinstance(left, pint.Quantity) or isinstance(right, pint.Quantity):
        return left + right
    return left + right


def _negate(value, span):
    if isinstance(value, pint.Quantity):
        try:
            return -value
        except Exception as err:
            raise IrError(_clean(err), span) from err
    return -value


def _mul(left, right):
    if isinstance(left, pint.Quantity) and isinstance(right, pint.Quantity):
        return left * right
    if isinstance(left, pint.Quantity):
        return _scale(left, right, "*")
    if isinstance(right, pint.Quantity):
        return _scale(right, left, "*")
    return left * right


def _div(left, right):
    if isinstance(left, pint.Quantity) and isinstance(right, pint.Quantity):
        return left / right
    if isinstance(left, pint.Quantity):
        return _scale(left, right, "/")
    if isinstance(right, pint.Quantity):
        magnitude = _as_expr(left) / _as_expr(right.magnitude)
        return UREG.Quantity(_magnitude(magnitude), 1 / right.units)
    return left / right


def _pow(left, right, span):
    if isinstance(right, pint.Quantity):
        raise IrError("An exponent cannot carry a unit.", span)
    if isinstance(left, pint.Quantity):
        exponent = _plain(right) if _is_number(right) else right
        return left ** exponent
    return left ** right


def _scale(quantity: pint.Quantity, factor, op: str) -> pint.Quantity:
    mag = _as_expr(quantity.magnitude)
    fac = _as_expr(factor)
    updated = mag * fac if op == "*" else mag / fac
    return UREG.Quantity(_magnitude(updated), quantity.units)


def _compare(node: dict, session: Session):
    left = eval_expr(node["left"], session)
    right = eval_expr(node["right"], session)
    op = node["op"]
    if isinstance(left, pint.Quantity) or isinstance(right, pint.Quantity):
        try:
            return { "<": left.__lt__, "<=": left.__le__, ">": left.__gt__, ">=": left.__ge__ }[op](right)
        except Exception as err:
            raise IrError(_clean(err), node["span"]) from err
    return { "<": sympy.Lt, "<=": sympy.Le, ">": sympy.Gt, ">=": sympy.Ge }[op](left, right)


def _symbol(name: str, session: Session):
    if name in session.values:
        return session.values[name]
    if name in session.functions:
        return session.functions[name][2]
    if name in CONSTANTS:
        return CONSTANTS[name]
    return sympy.Symbol(name)


def _call_user(fn, args, span):
    kind, params, body = fn
    if len(args) != len(params):
        raise IrError("Wrong number of arguments.", span)
    if kind == "lambda":
        return body(*[_as_expr(arg) for arg in args])
    # Quantity body: substitute symbols, then rebuild the quantity.
    mag = body.magnitude
    for name, arg in zip(params, args):
        mag = sympy.sympify(mag).subs(sympy.Symbol(name), _as_expr(arg))
    return UREG.Quantity(_magnitude(mag), body.units)


def _values(node: dict, session: Session, reject: bool) -> list:
    values = []
    for arg in node["args"]:
        value = eval_expr(arg, session)
        if reject:
            _reject_units(value, arg)
        values.append(value)
    return values


def _reject_units(value, node: dict) -> None:
    if isinstance(value, pint.Quantity) or _has_quantity(value):
        raise IrError(UNITS_ERROR, node["span"])


def _has_quantity(value) -> bool:
    if isinstance(value, pint.Quantity):
        return True
    if isinstance(value, (list, tuple)):
        return any(_has_quantity(item) for item in value)
    return False


def _unit(node: dict):
    kind = node["kind"]
    if kind == "unit":
        try:
            return UREG.Unit(node["name"])
        except Exception as err:
            raise IrError(_clean(err), node["span"]) from err
    if kind == "unitBinary":
        left = _unit(node["left"])
        right = _unit(node["right"])
        return left * right if node["op"] == "*" else left / right
    if kind == "unitPower":
        return _unit(node["base"]) ** node["exp"]
    raise IrError("Expected a unit.", node.get("span"))


def _number(text: str):
    if any(ch in text for ch in ".eE"):
        return sympy.Float(text)
    return sympy.Integer(text)


def _solution_list(solved) -> list:
    if isinstance(solved, list):
        return solved
    if isinstance(solved, tuple):
        return list(solved)
    return [solved]


def _solutions(values) -> dict:
    items = _solution_list(values)
    return {
        "kind": "equation",
        "latex": r"\left\{ " + ", ".join(_latex_item(item) for item in items) + r" \right\}",
        "text": str(items),
        "span": None,
    }


def _latex_item(item) -> str:
    if isinstance(item, sympy.Basic):
        return sympy.latex(item)
    if isinstance(item, dict):
        return ", ".join(f"{sympy.latex(key)} = {sympy.latex(val)}" for key, val in item.items())
    return str(item)


def _unit_latex(unit: pint.Unit) -> str:
    """Compact Pint symbols, with \\mathrm, \\cdot, and a slash."""
    compact = format(unit, "~").strip()
    if compact and all(ch.isalpha() or ch.isdigit() or ch in " */" for ch in compact):
        return _compact_unit_latex(compact)
    return format(unit, "~L")


def _compact_unit_latex(text: str) -> str:
    pieces = [piece.strip() for piece in text.split("/")]
    numerator = _product_latex(pieces[0])
    if len(pieces) == 1:
        return numerator
    denominators = [_product_latex(piece) for piece in pieces[1:]]
    if len(denominators) == 1:
        return f"{numerator}/{denominators[0]}"
    return numerator + "/(" + r" \cdot ".join(denominators) + ")"


def _product_latex(text: str) -> str:
    return r" \cdot ".join(_factor_latex(factor.strip()) for factor in text.split("*"))


def _factor_latex(token: str) -> str:
    if token == "1":
        return "1"
    if "**" in token:
        name, exponent = (part.strip() for part in token.split("**", 1))
        return rf"\mathrm{{{name}}}^{{{exponent}}}"
    return rf"\mathrm{{{token}}}"


def format_value(value) -> dict:
    if isinstance(value, PlotValue):
        return {"kind": "plot", "latex": "", "text": "", "span": None, "svg": value.svg}
    if isinstance(value, dict) and value.get("kind") == "equation" and "latex" in value:
        return {key: value[key] for key in ("kind", "latex", "text", "span")}
    if isinstance(value, pint.Quantity):
        if value.dimensionless:
            return format_value(_magnitude(value.magnitude))
        mag = _format_magnitude(value.magnitude)
        unit = _unit_latex(value.units)
        return {
            "kind": "quantity",
            "latex": f"{mag}\\,{unit}",
            "text": f"{_format_magnitude(value.magnitude)} {format(value.units, '~')}",
            "span": None,
        }
    if isinstance(value, (list, tuple)):
        return _solutions(list(value))
    if isinstance(value, sympy.Basic):
        return _ok("expression", sympy.latex(value), str(value))
    if isinstance(value, bool):
        text = "True" if value else "False"
        return _ok("expression", f"\\mathrm{{{text}}}", text)
    if isinstance(value, (int, float)):
        text = _format_magnitude(value)
        return _ok("expression", text, text)
    return _ok("expression", str(value), str(value))


def _ok(kind: str, latex: str, text: str) -> dict:
    return {"kind": kind, "latex": latex, "text": text, "span": None}


def _error(message: str, span) -> dict:
    return {"kind": "error", "latex": "", "text": message, "span": span, "message": message}


def _format_magnitude(value) -> str:
    if hasattr(value, "item") and not isinstance(value, sympy.Basic):
        try:
            value = value.item()
        except Exception:
            pass
    if isinstance(value, sympy.Integer):
        return str(int(value))
    if isinstance(value, sympy.Basic):
        if getattr(value, "is_number", False) and not value.free_symbols:
            return _format_magnitude(float(value))
        return sympy.latex(value)
    if isinstance(value, float) and math.isfinite(value):
        nearest = round(value)
        if abs(value - nearest) <= 1e-9 * max(1.0, abs(value)):
            return str(int(nearest))
        return format(value, ".6g")
    if isinstance(value, int):
        return str(value)
    return str(value)


def _magnitude(value):
    value = _as_expr(value)
    if isinstance(value, sympy.Integer):
        return int(value)
    if isinstance(value, sympy.Number) and not value.free_symbols and value.is_real:
        if value.is_integer:
            return int(value)
        return float(value)
    if isinstance(value, (int, float)):
        return value
    return value


def _as_expr(value):
    if isinstance(value, sympy.Basic):
        return value
    if isinstance(value, bool):
        return sympy.Integer(1 if value else 0)
    if isinstance(value, (int, float)):
        return sympy.sympify(value)
    return value


def _is_number(value) -> bool:
    if isinstance(value, bool):
        return False
    if isinstance(value, (int, float)):
        return True
    return isinstance(value, sympy.Number) and not value.free_symbols


def _plain(value):
    if isinstance(value, sympy.Integer):
        return int(value)
    if isinstance(value, sympy.Number):
        return float(value) if not value.is_integer else int(value)
    return value


def _real(value, span) -> float:
    _reject_units(value, {"span": span})
    number = complex(sympy.N(_as_expr(value)))
    if abs(number.imag) > 1e-9:
        raise IrError("A plot domain must be real.", span)
    return float(number.real)


def _clean(err: Exception) -> str:
    text = str(err).strip()
    for marker in (". See http", ". See https"):
        if marker in text:
            text = text.split(marker)[0] + "."
    return text


_MISSING = object()
