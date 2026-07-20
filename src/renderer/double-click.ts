import { findMsgRecord, probeVueValue } from "./vue-probe";
import { SHAKE_CLASS } from "./constants";
import { _bridgePromise, NudgeDebugAPI } from "./settings";


interface ChatContext {
  record: any;
  aioData: any;
  chatType: number;
  isTemporary: boolean;
}

export interface PokePayload {
  chatType: number;
  peerUid: string;
  targetUin: string;
  groupUin: string;
}


const AIO_SELECTORS = [".aio.vue-component", ".aio"];

const AVATAR_SELECTORS = [
  ".avatar-span .avatar",
  ".avatar.message-container__avatar",
  '[class*=avatar i]',
  '[data-testid*=avatar i]',
];

const TEMPORARY_CHAT_TYPES: ReadonlySet<number> = new Set([
  99, 100, 101, 102, 103, 111, 117, 119,
]);

const peerUidAccessors = [
  (r: any, _a: any) => r?.peerUid,
  (r: any, _a: any) => r?.peer?.peerUid,
  (_r: any, a: any) => a?.peerUid,
  (_r: any, a: any) => a?.peer?.peerUid,
  (_r: any, a: any) => a?.header?.peerUid,
];

const peerUinAccessors = [
  (r: any, _a: any) => r?.peerUin,
  (r: any, _a: any) => r?.peer?.peerUin,
  (r: any, _a: any) => r?.peerUid,
  (_r: any, a: any) => a?.peerUin,
  (_r: any, a: any) => a?.peer?.peerUin,
  (_r: any, a: any) => a?.header?.uin,
  (_r: any, a: any) => a?.header?.peerUin,
  (_r: any, a: any) => a?.header?.uid,
  (_r: any, a: any) => a?.header?.peerUid,
];


function firstAccessor(fns: Array<(r: any, a: any) => any>, record: any, aioData: any): any {
  for (const fn of fns) {
    try {
      const v = fn(record, aioData);
      if (v != null) return v;
    } catch {
      // some accessors may throw on proxy objects
    }
  }
  return undefined;
}

function firstNumericAccessor(fns: Array<(r: any, a: any) => any>, record: any, aioData: any): string {
  for (const fn of fns) {
    try {
      const v = fn(record, aioData);
      if (v != null && /^\d+$/.test(String(v))) return String(v);
    } catch {
      // proxy object access may throw
    }
  }
  return "";
}



export function getAvatarFromEvent(ev: Event): Element | null {
  const path = ev.composedPath?.() ?? [ev.target];
  for (const el of path) {
    if (!(el instanceof Element)) continue;
    if (!AVATAR_SELECTORS.some((sel) => el.matches?.(sel))) continue;
    if (findMsgRecord(el)) return el;
  }
  return null;
}



export function getChatContext(avatar: Element): ChatContext {
  const record = findMsgRecord(avatar);
  const aioEl: Element | null =
    document.querySelector(AIO_SELECTORS[0]) ??
    document.querySelector(AIO_SELECTORS[1]);

  const aioData = aioEl
    ? probeVueValue(aioEl, [
        "proxy.commonAioStore.curAioData",
        "ctx.commonAioStore.curAioData",
      ])
    : null;

  const h = aioData?.header ?? {};
  const chatTypes = [
    aioData?.chatType, aioData?.type, aioData?.aioType,
    aioData?.peer?.chatType, aioData?.contact?.chatType,
    h.chatType, h.peer?.chatType,
    record?.chatType, record?.peer?.chatType,
  ]
    .map(Number)
    .filter((v: number) => v > 0);

  return {
    record,
    aioData,
    chatType: chatTypes[0] ?? 0,
    isTemporary: chatTypes.some((t: number) => TEMPORARY_CHAT_TYPES.has(t)),
  };
}

export function buildPokePayload(ctx: ChatContext): PokePayload | null {
  if (ctx.isTemporary) return null;

  const { record, aioData, chatType } = ctx;

  const puid = firstAccessor(peerUidAccessors, record, aioData) ?? "";
  const puin = firstNumericAccessor(peerUinAccessors, record, aioData);

  if (chatType === 2) {
    const guin = puin || puid;
    if (!guin) return null;
    let tuin: string | undefined;
    try { tuin = record?.senderUin ?? record?.sender?.uin; } catch {}
    if (!tuin) return null;
    return {
      chatType: 2,
      groupUin: String(guin),
      peerUid: String(guin),
      targetUin: String(tuin),
    };
  }

  if (chatType === 1) {
    let tuin: string | undefined;
    try { tuin = record?.senderUin ?? record?.sender?.uin ?? puin; } catch {}
    return tuin
      ? { chatType: 1, targetUin: String(tuin), groupUin: "", peerUid: puid }
      : null;
  }

  return null;
}



function sendPoke(payload: PokePayload, avatar: Element, api: NudgeDebugAPI): void {
  api
    .sendNudge(payload.chatType, payload.peerUid, payload.targetUin, payload.groupUin || undefined)
    .then((r: any) => {
      if (r && r.result === 0) {
        avatar.classList.remove(SHAKE_CLASS);
        void (avatar as any).offsetWidth; // force reflow to restart animation
        avatar.classList.add(SHAKE_CLASS);
      }
    })
    .catch((e: any) => console.error("[Nudge] sendPoke API error", e));
}



interface PendingClick {
  time: number;
  x: number;
  y: number;
  target: Element;
  payload: PokePayload;
}

const DOUBLE_CLICK_DELAY = 480; // ms between pointer downs to count as double-click
const DISTANCE_THRESHOLD = 20; // px
const SUPPRESS_DURATION = 650; // ms to suppress native click/dblclick after our handling

export async function initDoubleClickPoke(): Promise<void> {
  let enabled = false;
  let api: NudgeDebugAPI | null = null;
  let pending: PendingClick | null = null;
  let suppressUntil = 0;

  try {
    api = await _bridgePromise;
    const c = await api.getConfig();
    enabled = c?.doubleClickPoke?.enabled === true;

    api.onConfigChange((c: any) => {
      enabled = c?.doubleClickPoke?.enabled === true;
    });
  } catch (e) {
    console.error("[Nudge] double-click init: bridge not available", e);
    return;
  }

  function stopImmediate(ev: Event): void {
    ev.preventDefault();
    ev.stopPropagation();
    try { (ev as any).stopImmediatePropagation?.(); } catch {}
  }
  document.addEventListener(
    "pointerdown",
    (ev) => {
      if (!enabled || ev.button !== 0) {
        pending = null;
        return;
      }

      const avatar = getAvatarFromEvent(ev);
      if (!avatar) { pending = null; return; }

      const ctx = getChatContext(avatar);
      if (ctx.isTemporary) {
        stopImmediate(ev);
        suppressUntil = performance.now() + SUPPRESS_DURATION;
        pending = null;
        return;
      }

      const payload = buildPokePayload(ctx);
      if (!payload) { pending = null; return; }

      const now = performance.now();

      if (
        pending &&
        pending.target === avatar &&
        now - pending.time <= DOUBLE_CLICK_DELAY &&
        Math.hypot(ev.clientX - pending.x, ev.clientY - pending.y) <= DISTANCE_THRESHOLD
      ) {
        stopImmediate(ev);
        suppressUntil = now + SUPPRESS_DURATION;
        pending = null;
        sendPoke(payload, avatar, api!);
        return;
      }
      stopImmediate(ev);
      suppressUntil = now + SUPPRESS_DURATION;
      pending = { time: now, x: ev.clientX, y: ev.clientY, target: avatar, payload };

      setTimeout(() => {
        if (pending?.time === now) pending = null;
      }, DOUBLE_CLICK_DELAY + 20);
    },
    true,
  );
  
  document.addEventListener(
    "click",
    (ev) => {
      if (performance.now() <= suppressUntil) stopImmediate(ev);
    },
    true,
  );

  document.addEventListener(
    "dblclick",
    (ev) => {
      if (!enabled || ev.button !== 0) return;
      if (performance.now() <= suppressUntil) { stopImmediate(ev); return; }

      const avatar = getAvatarFromEvent(ev);
      if (!avatar) return;

      const ctx = getChatContext(avatar);
      if (ctx.isTemporary) { stopImmediate(ev); suppressUntil = performance.now() + SUPPRESS_DURATION; pending = null; return; }

      const payload = buildPokePayload(ctx);
      if (!payload) return;

      stopImmediate(ev);
      suppressUntil = performance.now() + SUPPRESS_DURATION;
      pending = null;
      sendPoke(payload, avatar, api!);
    },
    true,
  );
}
