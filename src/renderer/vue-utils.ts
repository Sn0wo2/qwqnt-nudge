import { RECORD_SEARCH_KEYS } from "./constants";

export function getVueInstances(el: Element): any[] {
  const out: any[] = [];
  const seen = new Set<any>();
  const arr = (el as any).__VUE__ ?? [];
  for (const i of Array.isArray(arr) ? arr : [arr])
    if (i && !seen.has(i)) {
      seen.add(i);
      out.push(i);
    }
  const pc = (el as any).__vueParentComponent;
  if (pc && !seen.has(pc)) out.push(pc);
  return out;
}

export function probeVueValue(el: Element, paths: string[]): any {
  for (const inst of getVueInstances(el))
    for (const p of paths) {
      try {
        const v = p.split(".").reduce((o: any, k: string) => o?.[k], inst);
        if (v != null) return v;
      } catch {}
    }
}

export function isMsgRecord(v: unknown): boolean {
  return Boolean(
    v &&
    typeof v === "object" &&
    typeof (v as any).msgId === "string" &&
    typeof (v as any).msgSeq === "string" &&
    Array.isArray((v as any).elements),
  );
}

export function deepFindRecord(
  val: unknown,
  depth = 0,
  seen = new WeakSet<object>(),
): any {
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
  for (const k of RECORD_SEARCH_KEYS) {
    try {
      const found = deepFindRecord((val as any)[k], depth + 1, seen);
      if (found) return found;
    } catch {}
  }
  return null;
}

export function findMsgRecord(el: Element): any {
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
  const directPaths = ["props.msgRecord", "ctx.msgRecord", "proxy.msgRecord"];
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
