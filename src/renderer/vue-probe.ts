export interface MsgRecord {
  msgId: string;
  msgSeq: string;
  elements: any[];
  [key: string]: any;
}


export function isMsgRecord(v: unknown): v is MsgRecord {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.msgId === "string" &&
    typeof o.msgSeq === "string" &&
    Array.isArray(o.elements)
  );
}


export function probeVueInstances(el: Element): any[] {
  const instances: any[] = [];
  const seen = new Set<any>();

  const arr = (el as any).__VUE__ ?? [];
  for (const i of Array.isArray(arr) ? arr : [arr]) {
    if (i && !seen.has(i)) { seen.add(i); instances.push(i); }
  }
  const pc = (el as any).__vueParentComponent;
  if (pc && !seen.has(pc)) instances.push(pc);

  return instances;
}


export function probeVueValue(el: Element, paths: string[]): any {
  for (const inst of probeVueInstances(el)) {
    for (const p of paths) {
      try {
        const v = p.split(".").reduce((o: any, k: string) => o?.[k], inst);
        if (v != null) return v;
      } catch {
        // path traversal may throw on some Vue proxy objects
      }
    }
  }
  return undefined;
}


export function deepFindMsgRecord(
  val: unknown,
  depth = 0,
  seen = new WeakSet<object>(),
): MsgRecord | null {
  if (
    val === null ||
    val === undefined ||
    depth > 5 ||
    typeof val !== "object" ||
    seen.has(val) ||
    val instanceof Element ||
    val instanceof Uint8Array ||
    val instanceof Map ||
    val instanceof Set
  )
    return null;
  seen.add(val);
  if (isMsgRecord(val)) return val;

  const searchKeys = [
    "props", "setupState", "ctx", "proxy",
    "msgRecord", "message", "record", "msg",
  ];
  for (const key of searchKeys) {
    try {
      const found = deepFindMsgRecord((val as any)[key], depth + 1, seen);
      if (found) return found;
    } catch {
      // some Vue proxy properties throw on access
    }
  }
  return null;
}

export function findMsgRecord(el: Element): MsgRecord | null {
  const container = el.closest(
    ".message.vue-component, .ml-item, .message, [id]",
  );
  const candidates: Element[] = [];

  for (let n: Element | null = el; n && n !== document.body; n = n.parentElement) {
    candidates.push(n);
  }
  if (container) {
    candidates.push(container);
    const siblings = Array.from(container.querySelectorAll("*")).slice(0, 60);
    candidates.push(...siblings);
  }

  const directPaths = [
    "props.msgRecord",
    "ctx.msgRecord",
    "proxy.msgRecord",
  ];

  for (const c of candidates) {
    const d = probeVueValue(c, directPaths);
    if (isMsgRecord(d)) return d;

    for (const inst of probeVueInstances(c)) {
      const f = deepFindMsgRecord(inst);
      if (f) return f;
    }
  }
  return null;
}
