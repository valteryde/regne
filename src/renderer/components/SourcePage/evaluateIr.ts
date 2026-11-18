import { FreshValue } from "../../../language/displays";
import { Ir } from "../../../language/ir";

/** Plot SVGs stay here so a cache hit does not cross the process boundary again. */
const DIGEST_LIMIT = 128;

interface WireResult {
  digest?: string;
  cached?: boolean;
  latex?: string;
  kind?: string;
  message?: string;
  svg?: string;
}

interface EvalPayload {
  success?: boolean;
  error?: string;
  results?: WireResult[];
}

class MissingDigest extends Error {
  constructor() {
    super("The engine returned a result that is no longer cached.");
    this.name = "MissingDigest";
  }
}

/** Ask the engine for one value per statement. The file never receives these. */
export async function evaluateIr(
  statements: Ir[],
  cache: Map<string, FreshValue>,
): Promise<FreshValue[]> {
  const payload = await request(statements, [...cache.keys()]);
  try {
    return takeValues(payload, cache);
  } catch (err) {
    if (!(err instanceof MissingDigest)) throw err;
    return takeValues(await request(statements, []), cache);
  }
}

async function request(statements: Ir[], known: string[]): Promise<WireResult[]> {
  const id = `ir-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const api = window.regneAPI || window.hypatiaAPI;
  let payload: EvalPayload;
  if (api?.casSympy?.evaluateIr) {
    payload = await api.casSympy.evaluateIr(id, statements, known);
  } else {
    const response = await fetch("/api/eval-ir", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, statements, known }),
    });
    if (!response.ok) {
      throw new Error("The engine is not running.");
    }
    payload = (await response.json()) as EvalPayload;
  }
  if (!payload?.success) {
    throw new Error(payload?.error || "The engine failed.");
  }
  return payload.results ?? [];
}

/** Reuse a stored value when the worker sends only its digest. */
export function takeValues(results: WireResult[], cache: Map<string, FreshValue>): FreshValue[] {
  return results.map((result) => {
    const digest = result.digest;
    if (result.cached) {
      if (!digest) throw new MissingDigest();
      const hit = cache.get(digest);
      if (!hit) throw new MissingDigest();
      hold(cache, digest, hit);
      return hit;
    }
    const value: FreshValue = {
      latex: result.latex ?? "",
      kind: result.kind ?? "error",
      message: result.message,
      svg: result.svg,
    };
    if (digest) hold(cache, digest, value);
    return value;
  });
}

function hold(cache: Map<string, FreshValue>, digest: string, value: FreshValue) {
  if (cache.has(digest)) cache.delete(digest);
  cache.set(digest, value);
  while (cache.size > DIGEST_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}
