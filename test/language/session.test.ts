import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { CYLINDER_NOTE, readDocument } from "../../src/language/document";
import { FreshValue } from "../../src/language/displays";
import { pageDocument } from "../../src/language/page";
import {
  RECOMPUTE_PAUSE_MS,
  cacheKey,
  cachedValues,
  createPause,
  brokenLineNumbers,
  lineNumberAt,
  paint,
  runnableStatements,
  storeValues,
} from "../../src/language/session";

const TEMPERATURE: FreshValue = { latex: "3969.21\\,\\mathrm{K}", kind: "quantity" };

function fiveValues(): FreshValue[] {
  return [
    { latex: "2\\,\\mathrm{mol}", kind: "quantity" },
    { latex: "10\\,\\mathrm{bar}", kind: "quantity" },
    { latex: "66\\,\\mathrm{l}", kind: "quantity" },
    { latex: "8.314\\,\\mathrm{J}/(\\mathrm{mol}\\cdot\\mathrm{K})", kind: "quantity" },
    TEMPERATURE,
  ];
}

describe("the page", () => {
  test("the cylinder note is five displays, and a bare line is never prose", () => {
    const rows = pageDocument(CYLINDER_NOTE, paint(CYLINDER_NOTE, fiveValues(), []), null);
    const displays = rows.filter((row) => row.kind === "display");
    assert.equal(displays.length, 5);
    assert.equal(displays[4].display?.valueLatex, TEMPERATURE.latex);
    const bare = pageDocument("2 + 2\n", [], null);
    assert.deepEqual(bare.map((row) => row.kind), ["display"]);
  });

  test("a broken last line keeps the previous temperature", () => {
    const good = paint(CYLINDER_NOTE, fiveValues(), []);
    const broken = CYLINDER_NOTE.replace("T = P*V / (n*R)", "T = P*V / (");
    const next = paint(broken, fiveValues().slice(0, 4), good);
    const temperature = next[next.length - 1];
    assert.equal(temperature.stale, true);
    assert.equal(temperature.valueLatex, TEMPERATURE.latex);
    assert.ok(temperature.error);
    assert.equal(lineNumberAt(broken, temperature.start) > 1, true);
    assert.deepEqual(brokenLineNumbers(broken, next), [lineNumberAt(broken, temperature.start)]);
  });

  test("changing 66 changes the cache key of the temperature and not the pressure", () => {
    const before = runnableStatements(readDocument(CYLINDER_NOTE).blocks).map((item) => item.source);
    const after = runnableStatements(readDocument(CYLINDER_NOTE.replace("66", "70")).blocks).map((item) => item.source);
    assert.equal(cacheKey(before, 1), cacheKey(after, 1));
    assert.notEqual(cacheKey(before, 4), cacheKey(after, 4));
  });
});

describe("the result cache", () => {
  test("a repeated prefix is reused and is not written into the file", () => {
    const sources = ["n := 2 [mol]", "T = P*V / (n*R)"];
    const cache = new Map<string, FreshValue>();
    assert.equal(cachedValues(sources, cache), null);
    storeValues(sources, [fiveValues()[0], TEMPERATURE], cache);
    assert.deepEqual(cachedValues(sources, cache), [fiveValues()[0], TEMPERATURE]);
    assert.equal(cachedValues(["n := 2 [mol]", "T = P*V / (n*R) + 1"], cache), null);
    assert.equal(JSON.stringify(sources).includes("valueLatex"), false);
  });
});

describe("the pause before a recompute", () => {
  test("typing resets a 300 ms wait", () => {
    const waits: number[] = [];
    let cleared = 0;
    let ran = 0;
    const pause = createPause(
      RECOMPUTE_PAUSE_MS,
      (run, ms) => {
        waits.push(ms);
        return run;
      },
      () => {
        cleared += 1;
      },
    );
    pause.push(() => {
      ran += 1;
    });
    pause.push(() => {
      ran += 1;
    });
    assert.deepEqual(waits, [300, 300]);
    assert.equal(cleared, 1);
    assert.equal(ran, 0);
    const scheduled = waits.length;
    assert.equal(scheduled, 2);
  });

  test("a file offset lands on the source line that contains it", () => {
    const source = "n := 1\nT = n\n";
    const second = source.indexOf("T");
    assert.equal(lineNumberAt(source, second), 2);
    assert.equal(lineNumberAt(source, 0), 1);
  });
});
