import { FreshValue } from "../../../language/displays";
import { Ir } from "../../../language/ir";

interface EvalPayload {
  success?: boolean;
  error?: string;
  results?: Array<{ latex?: string; kind?: string; message?: string; svg?: string }>;
}

/** Ask the engine for one value per statement. The file never receives these. */
export async function evaluateIr(statements: Ir[]): Promise<FreshValue[]> {
  const id = `ir-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const api = window.regneAPI || window.hypatiaAPI;
  let payload: EvalPayload;
  if (api?.casSympy?.evaluateIr) {
    payload = await api.casSympy.evaluateIr(id, statements);
  } else {
    const response = await fetch("/api/eval-ir", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, statements }),
    });
    if (!response.ok) {
      throw new Error("The engine is not running.");
    }
    payload = (await response.json()) as EvalPayload;
  }
  if (!payload?.success) {
    throw new Error(payload?.error || "The engine failed.");
  }
  return (payload.results ?? []).map((result) => ({
    latex: result.latex ?? "",
    kind: result.kind ?? "error",
    message: result.message,
    svg: result.svg,
  }));
}
