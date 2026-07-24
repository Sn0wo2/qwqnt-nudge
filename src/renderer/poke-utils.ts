import type { NudgeAPI, PokePayload, ChatContext, AioData } from "./types";
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
  const aioData = (
    aioEl
      ? probeVueValue(aioEl, [
          "proxy.commonAioStore.curAioData",
          "ctx.commonAioStore.curAioData",
        ])
      : null
  ) as AioData | null;

  const selfUin = String(
    aioEl
      ? (probeVueValue(aioEl, [
          "proxy.selfUin",
          "ctx.selfUin",
          "proxy.authData.uin",
          "ctx.authData.uin",
          "proxy.commonAioStore.authData.uin",
          "ctx.commonAioStore.authData.uin",
        ]) ?? "")
      : "",
  );

  const h = aioData?.header ?? {};
  const chatTypes = [
    aioData?.chatType,
    aioData?.type,
    aioData?.aioType,
    aioData?.peer?.chatType,
    aioData?.contact?.chatType,
    h.chatType,
    h.type,
    h.peer?.chatType,
    h.contact?.chatType,
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
    selfUin: /^\d+$/.test(selfUin) ? selfUin : "",
  };
}

export function buildPokePayload(ctx: ChatContext): PokePayload | null {
  if (ctx.isTemporary) return null;
  const { record, aioData, chatType, selfUin } = ctx;
  const puid =
    record?.peerUid ??
    record?.peer?.peerUid ??
    aioData?.peerUid ??
    aioData?.peer?.peerUid ??
    aioData?.header?.peerUid ??
    aioData?.header?.uid ??
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

  const senderUin = String(record?.senderUin ?? record?.sender?.uin ?? "");

  if (chatType === 2) {
    const guin = String(puin || puid);
    const groupTuin =
      senderUin && senderUin !== "0"
        ? senderUin
        : Number(record?.sendType) === 1 && selfUin
          ? selfUin
          : "";
    if (!guin || !groupTuin) return null;
    return { chatType: 2, peerUid: guin, targetUin: groupTuin };
  }
  if (chatType === 1) {
    const tuin =
      senderUin && senderUin !== "0" ? senderUin : String(puin ?? "");
    if (!tuin) return null;
    return { chatType: 1, peerUid: puid, targetUin: tuin };
  }
  return null;
}

export function resolvePokeTarget(ev: Event) {
  const avatar = getAvatarFromEvent(ev);
  if (!avatar) {
    log("resolvePokeTarget: no avatar found");
    return null;
  }
  const ctx = getChatContext(avatar);
  log(
    "resolvePokeTarget: chatType=",
    ctx.chatType,
    "isTemporary=",
    ctx.isTemporary,
    "record=",
    !!ctx.record,
    "selfUin=",
    ctx.selfUin || "(empty)",
  );
  if (ctx.isTemporary) {
    log("resolvePokeTarget: temporary chat, suppressing");
    return "suppress" as const;
  }
  const payload = buildPokePayload(ctx);
  if (!payload) {
    log("resolvePokeTarget: buildPokePayload returned null");
    return null;
  }
  log("resolvePokeTarget: payload built", JSON.stringify(payload));
  return { avatar, payload } as const;
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
        void (avatar as HTMLElement).offsetWidth;
        avatar.classList.add(`${PREFIX}shake`);
      }
    })
    .catch((e: unknown) => log("sendPoke failed", e));
}

export function stopImmediate(ev: Event): void {
  ev.preventDefault();
  ev.stopPropagation();
  ev.stopImmediatePropagation();
}
