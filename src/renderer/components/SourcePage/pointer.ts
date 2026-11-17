import { PointerTarget, SpanHost, spanFromHost } from "../../../language/selection";

/** Where a page event landed: an input span, the value, or neither. */
export function readPointer(target: EventTarget | null): PointerTarget {
  const element = target instanceof Element ? target : null;
  const display = element?.closest("[data-regne-kind='display']") ?? null;
  const startRaw = display?.getAttribute("data-regne-start");
  const statementStart = startRaw == null ? null : Number(startRaw);
  const inInput = !!element?.closest(".regne-input");
  const inValue =
    !!display && !inInput && !!element?.closest("[data-regne-value], [data-regne-plot], [data-regne-error]");
  return {
    span: inInput ? spanFromHost(element as SpanHost | null) : null,
    statementStart: statementStart != null && Number.isFinite(statementStart) ? statementStart : null,
    inValue,
  };
}
