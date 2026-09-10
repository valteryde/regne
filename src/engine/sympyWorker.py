#!/usr/bin/env python3
"""
SymPy CAS Worker Daemon for Regne
Handles symbolic evaluations, calculus, equations, and LaTeX generation.
Communicates via newline-delimited JSON over stdin/stdout.
"""

import sys
import json
import re
import time
import traceback

try:
    import sympy
    from sympy import (
        Symbol, symbols, Integer, Float, Rational,
        diff, integrate, solve, factor, expand, simplify,
        sin, cos, tan, sec, csc, cot, asin, acos, atan,
        sinh, cosh, tanh, exp, log, ln, sqrt, pi, E, I, oo,
        latex, Eq, Matrix, limit, series, N, Lambda
    )
    from sympy.parsing.sympy_parser import (
        parse_expr,
        standard_transformations,
        implicit_multiplication_application,
        convert_xor,
    )
    SYMPY_AVAILABLE = True
except ImportError as err:
    SYMPY_AVAILABLE = False
    IMPORT_ERROR = str(err)


class SymPyWorker:
    def __init__(self):
        self.scope = {}
        self.user_functions = {}
        self.transformations = (
            standard_transformations
            + (implicit_multiplication_application, convert_xor)
        )
        self.reset()

    def reset(self):
        self.user_functions = {}
        self.scope = {
            'pi': pi,
            'Pi': pi,
            'e': E,
            'E': E,
            'I': I,
            'oo': oo,
            'diff': diff,
            'int': integrate,
            'integrate': integrate,
            'solve': solve,
            'factor': factor,
            'expand': expand,
            'simplify': simplify,
            'limit': limit,
            'series': series,
            'sin': sin,
            'cos': cos,
            'tan': tan,
            'sec': sec,
            'csc': csc,
            'cot': cot,
            'asin': asin,
            'acos': acos,
            'atan': atan,
            'sinh': sinh,
            'cosh': cosh,
            'tanh': tanh,
            'exp': exp,
            'log': log,
            'ln': ln,
            'sqrt': sqrt,
            'Matrix': Matrix,
            'Eq': Eq,
            'N': N,
            'Lambda': Lambda,
        }
        # Pre-seed standard algebraic symbols
        for char in 'abcdefghijklmnopqrstuvwxyzxyzXYZ':
            self.scope[char] = Symbol(char)

    def get_user_scope(self):
        builtins = {
            'pi', 'Pi', 'e', 'E', 'I', 'oo', 'diff', 'int', 'integrate', 'solve',
            'factor', 'expand', 'simplify', 'limit', 'series', 'sin', 'cos', 'tan',
            'sec', 'csc', 'cot', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh',
            'exp', 'log', 'ln', 'sqrt', 'Matrix', 'Eq', 'N', 'Lambda'
        }
        user_vars = {}
        # First include user-defined functions
        for fn_name, fn_info in self.user_functions.items():
            user_vars[fn_name] = {
                'name': f"{fn_name}({', '.join(fn_info['params'])})",
                'type': 'function',
                'valueLatex': latex(fn_info['body']) if isinstance(fn_info['body'], sympy.Basic) else str(fn_info['body']),
                'valueText': str(fn_info['body']),
            }
        for k, v in self.scope.items():
            if k in self.user_functions:
                continue
            if k.endswith('_prime') or k.endswith('_prime2') or k.endswith('_prime3'):
                continue
            if k not in builtins and not (len(k) == 1 and isinstance(v, Symbol) and v.name == k):
                user_vars[k] = {
                    'name': k,
                    'type': 'symbol',
                    'valueLatex': latex(v) if isinstance(v, sympy.Basic) else str(v),
                    'valueText': str(v),
                }
        return user_vars

    def preprocess_code(self, s: str) -> str:
        s = s.strip()
        if s.endswith(';'):
            s = s[:-1].strip()

        # Prime derivative notation: f'(x), f''(x), f'''(x) and LaTeX equivalents
        s = s.replace(r'^{\prime\prime\prime}', "'''")
        s = s.replace(r'^{\prime\prime}', "''")
        s = s.replace(r'^{\prime}', "'")
        s = re.sub(r'\^\{\s*(\'+)\s*\}', r'\1', s)
        s = re.sub(r'([a-zA-Z_][a-zA-Z0-9_]*)\'\'\'\s*\(([^)]*)\)', r'\1_prime3(\2)', s)
        s = re.sub(r'([a-zA-Z_][a-zA-Z0-9_]*)\'\'\s*\(([^)]*)\)', r'\1_prime2(\2)', s)
        s = re.sub(r'([a-zA-Z_][a-zA-Z0-9_]*)\'\s*\(([^)]*)\)', r'\1_prime(\2)', s)

        # LaTeX normalization from 2D MathLive
        s = s.replace(r'\left(', '(').replace(r'\right)', ')')
        s = s.replace(r'\left[', '[').replace(r'\right]', ']')
        s = s.replace(r'\left\{', '{').replace(r'\right\}', '}')
        s = s.replace(r'\left.', '').replace(r'\right.', '')
        s = s.replace(r'\,', ' ').replace(r'\;', ' ').replace(r'\:', ' ').replace(r'\ ', ' ')
        s = re.sub(r'\\(?:quad|qquad)\b', ' ', s)
        s = s.replace(r'\cdot', '*').replace(r'\times', '*')

        # Function arrows for mappings (e.g. x -> expr, x \to expr, x \mapsto expr)
        s = s.replace(r'\to', '->').replace(r'\rightarrow', '->').replace(r'\mapsto', '->')

        # Normalize assignment symbols
        s = re.sub(r'\\coloneq[q]?', ':=', s)
        s = s.replace(r'\colon=', ':=')

        # Remove LaTeX font/wrapper macros: \operatorname{name}, \mathrm{name}, \text{name}, etc.
        # Loop until stable to handle nested macros like \operatorname{\mathrm{solve}}
        _macro_re = re.compile(r'\\(?:operatorname|mathrm|text|mathit|mathbf)\{([a-zA-Z_][a-zA-Z0-9_]*)\}')
        while True:
            new_s = _macro_re.sub(r'\1', s)
            if new_s == s:
                break
            s = new_s

        # Derivatives: \frac{d}{dx} expr or \frac{d}{dx}(expr)
        while r'\frac{d}{d' in s:
            m = re.search(r'\\frac\{d\}\{d([a-zA-Z_][a-zA-Z0-9_]*)\}', s)
            if not m:
                break
            var = m.group(1)
            rest = s[m.end():].strip()
            if rest.startswith('('):
                depth = 0
                idx = -1
                for i, c in enumerate(rest):
                    if c == '(':
                        depth += 1
                    elif c == ')':
                        depth -= 1
                        if depth == 0:
                            idx = i
                            break
                if idx != -1:
                    inner_expr = rest[1:idx].strip()
                    s = s[:m.start()] + f'diff({inner_expr}, {var})' + rest[idx+1:]
                else:
                    s = s[:m.start()] + f'diff({rest}, {var})'
            else:
                fn_call_match = re.match(r'^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)', rest)
                if fn_call_match:
                    fn_expr = fn_call_match.group(0)
                    s = s[:m.start()] + f'diff({fn_expr}, {var})' + rest[fn_call_match.end():]
                else:
                    m_end = re.search(r'[\s+\-*/=]', rest)
                    if m_end:
                        expr = rest[:m_end.start()]
                        s = s[:m.start()] + f'diff({expr}, {var})' + rest[m_end.start():]
                    else:
                        s = s[:m.start()] + f'diff({rest}, {var})'

        # Integrals: \int expr dx
        s = re.sub(r'\\int\s*(.*?)\s*d([a-zA-Z_][a-zA-Z0-9_]*)', r'integrate(\1, \2)', s)

        # Fractions: \frac{a}{b} -> ((a)/(b))
        while r'\frac' in s:
            s = re.sub(r'\\frac\{([^{}]+)\}\{([^{}]+)\}', r'((\1)/(\2))', s)

        # Sqrt: \sqrt{a} -> sqrt(a)
        s = re.sub(r'\\sqrt\{([^{}]+)\}', r'sqrt(\1)', s)

        # Common LaTeX math functions
        for fn in ['sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'sinh', 'cosh', 'tanh', 'exp', 'ln', 'log', 'diff', 'integrate', 'solve', 'factor', 'expand', 'simplify']:
            s = re.sub(r'\\' + fn + r'\b', fn, s)

        for greek in ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'theta', 'lambda', 'mu', 'pi', 'rho', 'sigma', 'phi', 'omega']:
            s = s.replace('\\' + greek, greek)

        # Exponent braces: ^{...} -> ^(...)
        s = re.sub(r'\^\{([^{}]+)\}', r'^(\1)', s)

        return s

    def _split_top_level(self, s: str, sep: str = ',') -> list:
        parts = []
        current = []
        depth = 0
        for char in s:
            if char in '([{':
                depth += 1
                current.append(char)
            elif char in ')]}':
                depth -= 1
                current.append(char)
            elif char == sep and depth == 0:
                parts.append(''.join(current).strip())
                current = []
            else:
                current.append(char)
        if current:
            parts.append(''.join(current).strip())
        return parts

    def _parse_equation_or_expr(self, text: str):
        text = text.strip()
        if (text.startswith('[') and text.endswith(']')) or (text.startswith('{') and text.endswith('}')):
            inner_content = text[1:-1].strip()
            items = self._split_top_level(inner_content, ',')
            return [self._parse_equation_or_expr(it) for it in items]

        if '==' in text:
            parts = text.split('==', 1)
            lhs = self._parse_and_eval(parts[0].strip())
            rhs = self._parse_and_eval(parts[1].strip())
            return Eq(lhs, rhs)
        elif '=' in text and not re.search(r'[<>!]=', text):
            parts = text.split('=', 1)
            lhs = self._parse_and_eval(parts[0].strip())
            rhs = self._parse_and_eval(parts[1].strip())
            return Eq(lhs, rhs)
        else:
            return self._parse_and_eval(text)

    def _format_solve_result(self, val, target_vars=None):
        if isinstance(val, (list, tuple)):
            if not val:
                return r'\left\{ \right\}', '{}'

            # If list of dicts (standard from dict=True)
            if all(isinstance(item, dict) for item in val):
                latex_solutions = []
                text_solutions = []
                for d in val:
                    d_latex = [f'{latex(k)} = {latex(v)}' for k, v in d.items()]
                    d_text = [f'{k} = {v}' for k, v in d.items()]
                    latex_solutions.append(', \\; '.join(d_latex))
                    text_solutions.append(', '.join(d_text))
                return r'\left\{ ' + ', \\; '.join(latex_solutions) + r' \right\}', '{' + ', '.join(text_solutions) + '}'

            # List of items with a single target variable
            single_var = None
            if isinstance(target_vars, Symbol):
                single_var = target_vars
            elif isinstance(target_vars, (list, tuple)) and len(target_vars) == 1 and isinstance(target_vars[0], Symbol):
                single_var = target_vars[0]

            if single_var:
                latex_items = [f'{latex(single_var)} = {latex(item)}' for item in val]
                text_items = [f'{single_var} = {item}' for item in val]
                return r'\left\{ ' + ', \\; '.join(latex_items) + r' \right\}', '{' + ', '.join(text_items) + '}'

            latex_items = [latex(item) if isinstance(item, sympy.Basic) else str(item) for item in val]
            text_items = [str(item) for item in val]
            return r'\left\{ ' + ', \\; '.join(latex_items) + r' \right\}', '{' + ', '.join(text_items) + '}'

        elif isinstance(val, dict):
            latex_items = [f'{latex(k)} = {latex(v)}' for k, v in val.items()]
            text_items = [f'{k} = {v}' for k, v in val.items()]
            return r'\left\{ ' + ', \\; '.join(latex_items) + r' \right\}', '{' + ', '.join(text_items) + '}'

        return latex(val), str(val)

    def _handle_solve(self, code: str):
        # Extract content inside solve(...)
        m = re.match(r'^solve\s*\((.*)\)$', code, re.DOTALL)
        inner = m.group(1).strip() if m else code.strip()

        args = self._split_top_level(inner, ',')

        if len(args) >= 2:
            eq_target = self._parse_equation_or_expr(args[0])
            var_part = args[1].strip()
            if (var_part.startswith('[') and var_part.endswith(']')) or (var_part.startswith('{') and var_part.endswith('}')):
                var_items = self._split_top_level(var_part[1:-1].strip(), ',')
                vars_target = [self._parse_and_eval(v) for v in var_items]
            else:
                vars_target = self._parse_and_eval(var_part)

            try:
                val = solve(eq_target, vars_target, dict=True)
            except Exception:
                val = solve(eq_target, vars_target)
            return self._format_solve_result(val, vars_target)

        elif len(args) == 1:
            eq_target = self._parse_equation_or_expr(args[0])
            free_syms = None
            if hasattr(eq_target, 'free_symbols'):
                free_syms = list(eq_target.free_symbols)
            elif isinstance(eq_target, list):
                free_syms = list(set().union(*(e.free_symbols for e in eq_target if hasattr(e, 'free_symbols'))))

            try:
                val = solve(eq_target, dict=True)
            except Exception:
                val = solve(eq_target)
            return self._format_solve_result(val, free_syms)

        return r'\left\{ \right\}', '{}'

    def evaluate(self, raw_code: str):
        code = self.preprocess_code(raw_code)

        if not code:
            return {'resultLatex': '', 'resultText': '', 'resultType': 'void'}

        # Session restart
        if code in ('restart', 'clear'):
            self.reset()
            return {
                'resultLatex': r'\text{Session reset. All variables cleared.}',
                'resultText': 'Session reset. All variables cleared.',
                'resultType': 'text',
            }

        # Variable or Function Assignment: `var := expr`, `f(x) := expr`, or `f := x -> expr`
        if ':=' in code:
            parts = code.split(':=', 1)
            lhs = parts[0].strip()
            rhs = parts[1].strip()

            fn_match = re.match(r'^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)$', lhs)
            arrow_match = re.match(r'^(?:\(([^)]*)\)|([a-zA-Z_][a-zA-Z0-9_]*))\s*->\s*(.+)$', rhs)

            if fn_match:
                fn_name = fn_match.group(1)
                args_str = fn_match.group(2)
                body_code = rhs
                is_function = True
            elif arrow_match:
                fn_name = lhs
                args_str = arrow_match.group(1) if arrow_match.group(1) is not None else arrow_match.group(2)
                body_code = arrow_match.group(3).strip()
                is_function = True
            else:
                is_function = False

            if is_function:
                arg_names = [a.strip() for a in args_str.split(',') if a.strip()]
                arg_syms = tuple(Symbol(a) for a in arg_names)

                parse_scope = dict(self.scope)
                for a, sym in zip(arg_names, arg_syms):
                    parse_scope[a] = sym

                body_val = self._parse_and_eval(body_code, custom_scope=parse_scope)
                val = Lambda(arg_syms, body_val)

                self.scope[fn_name] = val
                self.user_functions[fn_name] = {
                    'params': arg_names,
                    'body': body_val,
                    'lambda': val,
                }

                # Precompute first 3 derivatives for single-variable functions to support f'(x), f''(x)
                if len(arg_syms) == 1:
                    try:
                        x_sym = arg_syms[0]
                        self.scope[f"{fn_name}_prime"] = Lambda(arg_syms, diff(body_val, x_sym))
                        self.scope[f"{fn_name}_prime2"] = Lambda(arg_syms, diff(body_val, x_sym, 2))
                        self.scope[f"{fn_name}_prime3"] = Lambda(arg_syms, diff(body_val, x_sym, 3))
                    except Exception:
                        pass

                assigned_var = {
                    'name': f"{fn_name}({', '.join(arg_names)})",
                    'type': 'function',
                    'valueLatex': latex(body_val) if isinstance(body_val, sympy.Basic) else str(body_val),
                    'valueText': str(body_val),
                }

                return {
                    'resultLatex': f"{fn_name}\\left({', '.join(arg_names)}\\right) := {assigned_var['valueLatex']}",
                    'resultText': f"{fn_name}({', '.join(arg_names)}) := {assigned_var['valueText']}",
                    'resultType': 'equation',
                    'assignedVariables': [assigned_var],
                }

            else:
                val = self._parse_and_eval(rhs)

                if lhs in self.user_functions:
                    del self.user_functions[lhs]
                    self.scope.pop(f"{lhs}_prime", None)
                    self.scope.pop(f"{lhs}_prime2", None)
                    self.scope.pop(f"{lhs}_prime3", None)

                self.scope[lhs] = val

                assigned_var = {
                    'name': lhs,
                    'type': 'symbol',
                    'valueLatex': latex(val) if isinstance(val, sympy.Basic) else str(val),
                    'valueText': str(val),
                }

                return {
                    'resultLatex': f"{lhs} := {assigned_var['valueLatex']}",
                    'resultText': f"{lhs} := {assigned_var['valueText']}",
                    'resultType': 'equation',
                    'assignedVariables': [assigned_var],
                }

        # Explicit solve(...)
        if re.match(r'^solve\s*\(', code):
            latex_res, text_res = self._handle_solve(code)
            return {
                'resultLatex': latex_res,
                'resultText': text_res,
                'resultType': 'equation',
            }

        # Standalone equation: `lhs = rhs` or `lhs == rhs` (not := assignment, not relational inequality)
        if ('=' in code or '==' in code) and not re.search(r'[<>!]=', code):
            latex_res, text_res = self._handle_solve(code)
            return {
                'resultLatex': latex_res,
                'resultText': text_res,
                'resultType': 'equation',
            }

        # Standard Expression Evaluation
        val = self._parse_and_eval(code)

        if isinstance(val, (list, tuple)):
            latex_items = [latex(item) if isinstance(item, sympy.Basic) else str(item) for item in val]
            text_items = [str(item) for item in val]
            return {
                'resultLatex': r'\left\{ ' + ', \\; '.join(latex_items) + r' \right\}',
                'resultText': '{' + ', '.join(text_items) + '}',
                'resultType': 'equation',
            }

        latex_out = latex(val) if isinstance(val, sympy.Basic) else str(val)

        # Add + C for indefinite integrals if not present
        if ('integrate(' in code or 'int(' in code) and ',' in code and not latex_out.endswith('+ C'):
            # Only add + C if it's an indefinite integral (not a tuple range)
            if not re.search(r'\(\s*[a-zA-Z_]\s*,\s*[^,]+\s*,\s*[^)]+\s*\)', code):
                latex_out = f"{latex_out} + C"

        return {
            'resultLatex': latex_out,
            'resultText': str(val),
            'resultType': 'expression',
        }

    def _parse_and_eval(self, expr_str: str, custom_scope=None):
        scope = self.scope if custom_scope is None else custom_scope
        return parse_expr(
            expr_str,
            local_dict=scope,
            transformations=self.transformations,
            evaluate=True,
        )


def main():
    if not SYMPY_AVAILABLE:
        print(json.dumps({
            "status": "error",
            "error": f"SymPy module not found: {IMPORT_ERROR}. Run: pip install sympy"
        }), flush=True)
    else:
        print(json.dumps({
            "status": "ready",
            "version": sympy.__version__,
            "description": f"SymPy {sympy.__version__} CAS Engine Active"
        }), flush=True)

    worker = SymPyWorker() if SYMPY_AVAILABLE else None

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            req = json.loads(line)
        except Exception as err:
            print(json.dumps({"success": False, "error": f"Invalid JSON: {err}"}), flush=True)
            continue

        req_id = req.get("id", "req")
        action = req.get("action", "eval")

        if action == "ping":
            if SYMPY_AVAILABLE:
                print(json.dumps({"id": req_id, "success": True, "version": sympy.__version__}), flush=True)
            else:
                print(json.dumps({"id": req_id, "success": False, "error": "SymPy not installed"}), flush=True)
            continue

        if not SYMPY_AVAILABLE:
            print(json.dumps({
                "id": req_id,
                "success": False,
                "error": "SymPy is not installed. Please run: pip install sympy"
            }), flush=True)
            continue

        if action == "reset":
            worker.reset()
            print(json.dumps({"id": req_id, "success": True}), flush=True)
            continue

        if action == "scope":
            print(json.dumps({"id": req_id, "success": True, "scope": worker.get_user_scope()}), flush=True)
            continue

        if action == "eval":
            code = req.get("code", "")
            start = time.perf_counter()
            try:
                eval_res = worker.evaluate(code)
                duration_ms = (time.perf_counter() - start) * 1000.0
                eval_res.update({
                    "id": req_id,
                    "success": True,
                    "executionTimeMs": duration_ms,
                })
                print(json.dumps(eval_res), flush=True)
            except Exception as err:
                duration_ms = (time.perf_counter() - start) * 1000.0
                print(json.dumps({
                    "id": req_id,
                    "success": False,
                    "resultType": "error",
                    "error": str(err),
                    "executionTimeMs": duration_ms,
                }), flush=True)


if __name__ == "__main__":
    main()
