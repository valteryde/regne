"""Run ward on the IR tests.

Ward 0.68 reads a private textwrap name that Python 3.14 removed. Restore it
before ward imports, then run the engine tests.
"""

import ast
import re
import sys
import textwrap

if not hasattr(textwrap, "_leading_whitespace_re"):
    textwrap._leading_whitespace_re = re.compile(r"(^[ \t]*)(?:[^ \t\n])", re.MULTILINE)

if not hasattr(ast, "Str"):
    ast.Str = lambda value: ast.Constant(value=value)

from ward.__main__ import run

sys.argv = ["ward", "test", "-p", "test/engine", "--progress-style", "none"]
run()
