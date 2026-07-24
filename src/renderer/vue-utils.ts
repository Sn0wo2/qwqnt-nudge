import { RECORD_SEARCH_KEYS } from "./constants";
import type { MsgRecord } from "./types";

type VueElement = HTMLElement & { __vueParentComponent?: unknown };

export function getVueInstances(el: Element): unknown[] {
  const out: unknown[] = [];
  const seen = new Set<unknown>();
  const vueEl = el as VueElement;
  const arr = vueEl.__VUE__ ?? [];
  for (const i of Array.isArray(arr) ? arr : [arr])
    if (i && !seen.has(i)) {
      seen.add(i);
      out.push(i);
    }
  const pc = vueEl.__vueParentComponent;
  if (pc && !seen.has(pc)) out.push(pc);
  return out;
}

export function probeVueValue(el: Element, paths: string[]): unknown {
  for (const inst of getVueInstances(el))
    for (const p of paths) {
      try {
        const v = p
          .split(".")
          .reduce(
            (o: unknown, k: string) => (o as Record<string, unknown>)?.[k],
            inst,
          );
        if (v != null) return v;
      } catch {}
    }
  return undefined;
}

export function isMsgRecord(v: unknown): v is MsgRecord {
  const r = v as Record<string, unknown>;
  return Boolean(
    v &&
    typeof v === "object" &&
    typeof r.msgId === "string" &&
    typeof r.msgSeq === "string" &&
    Array.isArray(r.elements),
  );
}

export function deepFindRecord(
  val: unknown,
  depth = 0,
  seen = new WeakSet<object>(),
): MsgRecord | null {
  if (
    !val ||
    depth > 4 ||
    typeof val !== "object" ||
    seen.has(val) ||
    val instanceof Element ||
    val instanceof Uint8Array ||
    val instanceof Map
  )
    return null;
  seen.add(val);
  if (isMsgRecord(val)) return val;
  const r = val as Record<string, unknown>;
  for (const k of RECORD_SEARCH_KEYS) {
    try {
      const found = deepFindRecord(r[k], depth + 1, seen);
      if (found) return found;
    } catch {}
  }
  return null;
}

export function findMsgRecord(el: Element): MsgRecord | null {
  const container = el.closest(
    ".message.vue-component, .ml-item, .message, [id]",
  );
  const candidates: Element[] = [];
  for (
    let n: Element | null = el;
    n && n !== document.body;
    n = n.parentElement
  )
    candidates.push(n);
  if (container) {
    candidates.push(container);
    candidates.push(
      ...Array.from(container.querySelectorAll("*")).slice(0, 80),
    );
  }
  const directPaths = [
    "props.msgRecord",
    "ctx.msgRecord",
    "proxy.msgRecord",
    "props.message",
    "ctx.message",
    "proxy.message",
  ];
  for (const c of candidates) {
    const d = probeVueValue(c, directPaths);
    if (isMsgRecord(d)) return d;
    for (const inst of getVueInstances(c)) {
      const f = deepFindRecord(inst);
      if (f) return f;
    }
  }
  return null;
}
