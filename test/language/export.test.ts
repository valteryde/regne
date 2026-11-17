import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { CYLINDER_NOTE } from "../../src/language/document";
import { exportLatex } from "../../src/language/export";

describe("LaTeX export", () => {
  test("the cylinder note compiles without highlight wrappers or markers", () => {
    const tex = exportLatex(CYLINDER_NOTE);
    assert.match(tex, /\\documentclass\{article\}/);
    assert.match(tex, /\\usepackage\{amsmath\}/);
    assert.match(tex, /\\begin\{document\}/);
    assert.match(tex, /\\end\{document\}/);
    assert.match(tex, /\\section\{Charge in a cylinder\}/);
    assert.match(tex, /The holdup is fixed\. Pressure and volume are measured\./);
    assert.match(tex, /The temperature follows from the ideal gas law\./);
    assert.match(tex, /\\mathrm\{mol\}/);
    assert.equal(tex.includes("\\frac{PV}{"), true);
    assert.equal(tex.includes("htmlClass"), false);
    assert.equal(tex.includes("htmlData"), false);
    assert.equal(tex.includes("regne-hit"), false);
    assert.equal(tex.includes("\n# "), false);
    assert.equal(tex.includes("\n- "), false);
  });

  test("a paragraph inlines its expression, and a derivative keeps the operator", () => {
    const tex = exportLatex("- The square $x^2$ and $diff(x^2, x)$.\n## Next\n");
    assert.match(tex, /The square \$x\^\{2\}\$/);
    assert.match(tex, /\\dfrac\{d\}\{dx\}/);
    assert.match(tex, /\\subsection\{Next\}/);
    assert.equal(tex.includes("htmlData"), false);
  });

  test("a title with a special character is escaped", () => {
    const tex = exportLatex("# Cost & delay\n");
    assert.match(tex, /\\section\{Cost \\& delay\}/);
  });
});
