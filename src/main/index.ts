import { ipcMain, webContents } from "electron";
import crypto from "crypto";

const PLUGIN_ID = "qwqnt-nudge";

const log = globalThis.Logs
  ? new globalThis.Logs(PLUGIN_ID)
  : (...args: unknown[]) => console.log(`[${PLUGIN_ID}]`, ...args);

type ListMode = "blacklist" | "whitelist";

interface AutoPokeBackConfig {
  enabled: boolean;
  groupEnabled: boolean;
  cooldown: number;
  maxConsecutive: number;
}
interface Config extends Record<string, unknown> {
  autoPokeBack: AutoPokeBackConfig;
  doubleClickPoke: { enabled: boolean };
  listMode: ListMode;
  groupList: string[];
  userList: string[];
}
const DEFAULT_CONFIG: Config = {
  autoPokeBack: {
    enabled: true,
    groupEnabled: false,
    cooldown: 3000,
    maxConsecutive: 5,
  },
  doubleClickPoke: { enabled: true },
  listMode: "blacklist",
  groupList: [],
  userList: [],
};

type ConfigRecord = Record<string, unknown>;

interface PokeJsonItem {
  type?: string;
  uid?: string;
}

interface GrayTipElement {
  grayTipElement?: {
    jsonGrayTipElement?: {
      busiId?: string | number;
      jsonStr?: string;
      xmlToJsonParam?: {
        templParam?: Map<string, string> | Record<string, string>;
      };
    };
  };
}

interface ReceivedMessage {
  sendType?: number;
  senderUin?: string | number;
  chatType?: number;
  msgType?: number;
  subMsgType?: number;
  peerUid?: string;
  peerUin?: string | number;
  elements?: Array<GrayTipElement & Record<string, unknown>>;
}

interface IpcCommand {
  cmdName?: string;
  cmdType?: string;
  payload?: unknown;
}

interface RecvMsgCommand {
  cmdName?: string;
  payload?: {
    msgList?: ReceivedMessage[];
  };
}

interface IpcResult {
  cmdData?: unknown;
  error?: string;
}

interface IpcEnvelope {
  type: string;
  eventName: string;
}

interface ParsedPoke {
  uid: string;
  uin: string;
  targetUin: string;
}

type IpcListener = (event: unknown, envelope: unknown, cmd: unknown) => void;

function setNested(target: ConfigRecord, key: string, value: unknown): void {
  if (!key.includes(".")) {
    if (value && typeof value === "object" && !Array.isArray(value))
      target[key] = {
        ...(target[key] as Record<string, unknown>),
        ...(value as Record<string, unknown>),
      };
    else target[key] = value;
    return;
  }
  const parts = key.split(".");
  let cur: ConfigRecord = target;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== "object" || cur[parts[i]] === null)
      cur[parts[i]] = {};
    cur = cur[parts[i]] as ConfigRecord;
  }
  cur[parts[parts.length - 1]] = value;
}

function migrateDotKeys<T extends ConfigRecord>(raw: T): T {
  for (const key of Object.keys(raw)) {
    if (!key.includes(".")) continue;
    setNested(raw, key, raw[key]);
    delete raw[key];
  }
  return raw;
}

const buildCmd = (name: string, payload: unknown) => ({
  cmdName: name,
  cmdType: "invoke",
  payload,
});

function normalizeUin(value: unknown): string {
  const s = String(value ?? "").trim();
  return /^\d+$/.test(s) && s !== "0" ? s : "";
}

function parseNudgePoke(msg: ReceivedMessage): ParsedPoke | null {
  for (const el of msg?.elements ?? []) {
    const tip = el?.grayTipElement?.jsonGrayTipElement;
    if (String(tip?.busiId ?? "") !== "1061") continue;
    let uid = "";
    try {
      const items = (JSON.parse(tip?.jsonStr ?? "{}").items ?? []) as PokeJsonItem[];
      const users = items.filter((i) => i?.uid);
      uid = String(users[0]?.uid ?? "");
    } catch {}
    const tp = tip?.xmlToJsonParam?.templParam;
    const get = (k: string) =>
      normalizeUin(tp instanceof Map ? tp.get(k) : tp?.[k]);
    return { uid, uin: get("uin_str1"), targetUin: get("uin_str2") };
  }
  return null;
}

function dispatchIpc(
  wcId: number,
  envelope: IpcEnvelope,
  cmd: IpcCommand,
): Promise<IpcResult> {
  const wc = webContents.fromId(wcId);
  if (!wc) return Promise.resolve({ error: "no webContents" });
  const callbackId = crypto.randomUUID();
  const mainChannel = "RM_IPCFROM_MAIN" + wcId;
  const rendererChannel = "RM_IPCFROM_RENDERER" + wcId;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (v: IpcResult) => {
      if (settled) return;
      settled = true;
      unsub();
      clearTimeout(timer);
      resolve(v);
    };
    const unsub = IpcInterceptor.interceptIpcSend(
      (ch: string, ...a: unknown[]) => {
        const first = a[0] as { callbackId?: string } | undefined;
        if (ch !== mainChannel || first?.callbackId !== callbackId)
          return { action: "pass" as const };
        finish(a[1] as IpcResult);
        return { action: "block" as const };
      },
    );
    const timer = setTimeout(() => finish({ error: "timeout" }), 3000);
    const listeners = ipcMain.listeners(rendererChannel) as IpcListener[];
    if (!listeners.length) {
      finish({ error: "no listeners" });
      return;
    }
    const fakeEvent = {
      sender: wc,
      reply: (...a: unknown[]) => wc.send(rendererChannel, ...a),
    };
    for (const fn of listeners)
      try {
        fn(fakeEvent, { peerId: wcId, callbackId, ...envelope }, cmd);
      } catch (err) {
        log("listener error:", err);
      }
  });
}

function sendNudge(
  wcId: number,
  chatType: number,
  peerUid: string,
  targetUin: string,
  chatUin: string,
): Promise<IpcResult> {
  return dispatchIpc(
    wcId,
    { type: "request", eventName: "ntApi" },
    buildCmd("nodeIKernelMsgService/sendNudge", [
      { peer: { chatType, peerUid, guildId: "" }, targetUin, chatUin },
      null,
    ]),
  );
}

function findUin(obj: unknown, depth = 0): string {
  if (!obj || typeof obj !== "object" || depth > 5) return "";
  const o = obj as Record<string, unknown>;
  for (const k of ["uin", "selfUin", "accountUin"]) {
    const v = o[k];
    if (typeof v === "string" && v) return v;
    if (typeof v === "number" && v) return String(v);
  }
  for (const v of Object.values(o)) {
    const found = findUin(v, depth + 1);
    if (found) return found;
  }
  return "";
}

function fetchSelfUin(wcId: number): Promise<string> {
  return dispatchIpc(
    wcId,
    { type: "request", eventName: "GlobalDataApi" },
    buildCmd("fetchAuthData", []),
  )
    .then((r) => {
      if (r?.error) {
        log("fetchSelfUin error:", r.error);
        return "";
      }
      const uin = findUin(r?.cmdData ?? r);
      log("fetchSelfUin result:", uin || "(empty)");
      return uin;
    })
    .catch((e) => {
      log("fetchSelfUin failed:", e);
      return "";
    });
}

export default {
  onLoad() {
    const stored = migrateDotKeys(
      PluginSettings.main.readConfig<Config>(PLUGIN_ID, DEFAULT_CONFIG),
    );
    let config: Config = {
      autoPokeBack: { ...DEFAULT_CONFIG.autoPokeBack, ...stored.autoPokeBack },
      doubleClickPoke: {
        ...DEFAULT_CONFIG.doubleClickPoke,
        ...stored.doubleClickPoke,
      },
      listMode: stored.listMode ?? DEFAULT_CONFIG.listMode,
      groupList: stored.groupList ?? DEFAULT_CONFIG.groupList,
      userList: stored.userList ?? DEFAULT_CONFIG.userList,
    };
    PluginSettings.main.writeConfig(PLUGIN_ID, config);

    const broadcast = () =>
      webContents.getAllWebContents().forEach((w) => {
        if (!w.isDestroyed()) w.send("nudge:config-changed", { ...config });
      });

    ipcMain.handle("nudge:get-config", () => ({ ...config }));
    ipcMain.on("nudge:set-config", (_, patch: ConfigRecord) => {
      for (const [k, v] of Object.entries(patch)) setNested(config, k, v);
      PluginSettings.main.writeConfig(PLUGIN_ID, config);
      broadcast();
    });
    ipcMain.handle(
      "nudge:send",
      async (
        e,
        { chatType, peerUid, targetUin }: {
          chatType: number;
          peerUid: string;
          targetUin: string;
        },
      ) => {
        const r = await sendNudge(
          e.sender.id,
          chatType,
          peerUid,
          targetUin,
          chatType === 2 ? peerUid : targetUin,
        );
        return r.cmdData ?? r.error;
      },
    );

    const lastNudgeTime = new Map<string, number>();
    let consecutiveCount = 0;
    let lastConsecutiveReset = 0;
    let selfUin = "";
    let lastSentNudge: {
      peerUid: string;
      targetUin: string;
      time: number;
    } | null = null;

    const ready = setInterval(() => {
      if (!IpcInterceptor) return;
      clearInterval(ready);
      if (!selfUin) {
        const wc = webContents.getAllWebContents()[0];
        if (wc) void fetchSelfUin(wc.id).then((uin) => { if (uin) selfUin = uin; });
      }
      IpcInterceptor.onIpcSend((ch: string, _e: unknown, cmd: RecvMsgCommand) => {
        if (cmd?.cmdName !== "nodeIKernelMsgListener/onRecvMsg") return;
        if (!config.autoPokeBack?.enabled) return;
        const wcId = Number(ch.replace("RM_IPCFROM_MAIN", ""));
        if (!wcId) return;
        if (!selfUin) void fetchSelfUin(wcId).then((uin) => { if (uin) selfUin = uin; });
        const msgList = cmd.payload?.msgList ?? [];
        for (const msg of msgList) {
          if (!selfUin && Number(msg.sendType) === 1 && msg.senderUin)
            selfUin = String(msg.senderUin);
          const poke = parseNudgePoke(msg);
          if (!poke) continue;
          const chatType = msg.chatType;
          const peerUid = msg.peerUid;
          if (!chatType || !peerUid) continue;
          const isGroup = chatType === 2;
          if (isGroup ? !config.autoPokeBack.groupEnabled : chatType !== 1)
            continue;

          if (!poke.uin || !poke.targetUin) continue;
          if (!isGroup && poke.uin !== poke.targetUin) {
            const peerUin = msg.peerUin ? String(msg.peerUin) : "";
            if (peerUin && poke.uin === peerUin && !selfUin) {
              selfUin = poke.targetUin;
              log("selfUin inferred from private poke:", selfUin);
            }
          }
          if (poke.uin === poke.targetUin) continue;
          if (selfUin && poke.uin === selfUin) continue;
          if (selfUin && poke.targetUin !== selfUin) continue;
          log("poke matched, chatType:", chatType, "initiator:", poke.uin, "target:", poke.targetUin, "selfUin:", selfUin);
          if (
            isGroup ?
              config.listMode === "blacklist" ? config.groupList.includes(peerUid) : !config.groupList.includes(peerUid) :
              config.listMode === "blacklist" ? config.userList.includes(poke.uin) : !config.userList.includes(poke.uin)
          )
            continue;
          if (
            isGroup &&
            lastSentNudge &&
            Date.now() - lastSentNudge.time < 5000 &&
            peerUid === lastSentNudge.peerUid &&
            poke.targetUin === lastSentNudge.targetUin
          )
            continue;

          const { cooldown = 3000, maxConsecutive = 5 } = config.autoPokeBack;
          if (Date.now() - (lastNudgeTime.get(poke.uin) ?? 0) < cooldown)
            continue;
          if (Date.now() - lastConsecutiveReset > cooldown * 2)
            consecutiveCount = 0;
          if (consecutiveCount >= maxConsecutive) continue;
          consecutiveCount++;
          lastConsecutiveReset = Date.now();
          lastNudgeTime.set(poke.uin, Date.now());

          if (isGroup)
            lastSentNudge = {
              peerUid: peerUid,
              targetUin: poke.uin,
              time: Date.now(),
            };
          const chatUin = isGroup ? (msg.peerUin ? String(msg.peerUin) : peerUid) : poke.uin;
          void sendNudge(
            wcId,
            chatType,
            peerUid,
            poke.uin,
            chatUin,
          ).then((r) => {
            if (r?.error) log("sendNudge failed:", r.error);
          });
        }
      });
    }, 1000);
  },
};
