import type { NudgeAPI, PokePayload, ChatContext } from "./types";
import { PREFIX, AVATAR_SELECTORS, TEMPORARY_CHAT_TYPES } from "./constants";
import { findMsgRecord, probeVueValue } from "./vue-utils";
import { log } from "./log";
export function getAvatarFromEvent(ev: Event): Element | null {
  for (const el of ev.composedPath?.() ?? [ev.target]) {
    if (!(el instanceof Element)) continue;
    if (!AVATAR_SELECTORS.some((sel) => el.matches?.(sel))) continue;
    if (findMsgRecord(el)) return el;
  }
  return null;
}

export function getChatContext(avatar: Element): ChatContext {
  const record = findMsgRecord(avatar);
  const aioEl =
    document.querySelector(".aio.vue-component") ??
    document.querySelector(".aio");
  const aioData = aioEl
    ? probeVueValue(aioEl, [
        "proxy.commonAioStore.curAioData",
        "ctx.commonAioStore.curAioData",
      ])
    : null;
  const h = aioData?.header ?? {};
  const chatTypes = [
    aioData?.chatType,
    aioData?.type,
    aioData?.aioType,
    aioData?.peer?.chatType,
    aioData?.contact?.chatType,
    h.chatType,
    h.peer?.chatType,
    record?.chatType,
    record?.peer?.chatType,
  ]
    .map(Number)
    .filter((v) => v > 0);
  return {
    record,
    aioData,
    chatType: chatTypes[0] ?? 0,
    isTemporary: chatTypes.some((t) => TEMPORARY_CHAT_TYPES.has(t)),
  };
}

export function buildPokePayload(ctx: ChatContext): PokePayload | null {
  if (ctx.isTemporary) return null;
  const { record, aioData, chatType } = ctx;
  const puid =
    record?.peerUid ??
    record?.peer?.peerUid ??
    aioData?.peerUid ??
    aioData?.peer?.peerUid ??
    aioData?.header?.peerUid ??
    "";
  const puin = [
    record?.peerUin,
    record?.peer?.peerUin,
    record?.peerUid,
    aioData?.peerUin,
    aioData?.peer?.peerUin,
    aioData?.header?.uin,
    aioData?.header?.peerUin,
    aioData?.header?.uid,
    aioData?.header?.peerUid,
  ].find((v) => /^\d+$/.test(String(v)));

  if (chatType === 2) {
    const guin = String(puin || puid);
    if (!guin) return null;
    const tuin = record?.senderUin ?? record?.sender?.uin;
    if (!tuin) return null;
    return { chatType: 2, peerUid: guin, targetUin: String(tuin) };
  }
  if (chatType === 1) {
    const tuin = record?.senderUin ?? record?.sender?.uin ?? puin;
    return tuin
      ? { chatType: 1, peerUid: puid, targetUin: String(tuin) }
      : null;
  }
  return null;
}

export function resolvePokeTarget(ev: Event) {
  const avatar = getAvatarFromEvent(ev);
  if (!avatar) return null;
  const ctx = getChatContext(avatar);
  if (ctx.isTemporary) return "suppress" as const;
  const payload = buildPokePayload(ctx);
  return payload ? ({ avatar, payload } as const) : null;
}

export function sendPoke(
  payload: PokePayload,
  avatar: Element,
  api: NudgeAPI,
): void {
  api
    .sendNudge(payload.chatType, payload.peerUid, payload.targetUin)
    .then((r) => {
      if (r?.result === 0) {
        avatar.classList.remove(`${PREFIX}shake`);
        void (avatar as any).offsetWidth;
        avatar.classList.add(`${PREFIX}shake`);
      }
    })
    .catch((e: unknown) => log("sendPoke failed", e));
}

export function stopImmediate(ev: Event): void {
  ev.preventDefault();
  ev.stopPropagation();
  (ev as any).stopImmediatePropagation?.();
}
