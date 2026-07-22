import { ipcMain, webContents } from "electron";
import crypto from "crypto";

const PLUGIN_ID = "qwqnt-nudge";

const log = globalThis.Logs
  ? new globalThis.Logs(PLUGIN_ID)
  : (...args: unknown[]) => console.log(`[${PLUGIN_ID}]`, ...args);

interface AutoPokeBackConfig {
  enabled: boolean;
  groupEnabled: boolean;
  cooldown: number;
  maxConsecutive: number;
}
interface Config {
  autoPokeBack: AutoPokeBackConfig;
  doubleClickPoke: { enabled: boolean };
  listMode: string;
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

function setNested(target: Record<string, any>, key: string, value: any): void {
  if (!key.includes(".")) {
    if (value && typeof value === "object" && !Array.isArray(value))
      target[key] = { ...target[key], ...value };
    else target[key] = value;
    return;
  }
  const parts = key.split(".");
  let cur: Record<string, any> = target;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== "object" || cur[parts[i]] === null)
      cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

function migrateDotKeys<T extends Record<string, any>>(raw: T): T {
  for (const key of Object.keys(raw)) {
    if (!key.includes(".")) continue;
    setNested(raw, key, raw[key]);
    delete raw[key];
  }
  return raw;
}

const buildCmd = (name: string, payload: any) => ({
  cmdName: name,
  cmdType: "invoke",
  payload,
});

function parseNudgePoke(
  msg: any,
): { uid: string; uin: string; targetUin: string } | null {
  for (const el of msg?.elements ?? []) {
    const tip = el?.grayTipElement?.jsonGrayTipElement;
    if (String(tip?.busiId ?? "") !== "1061") continue;
    let uid = "";
    try {
      uid =
        (JSON.parse(tip?.jsonStr ?? "{}").items ?? []).find(
          (i: any) => i?.type === "qq",
        )?.uid ?? "";
    } catch {}
    const tp = tip?.xmlToJsonParam?.templParam;
    const get = (k: string) =>
      String((tp instanceof Map ? tp.get(k) : tp?.[k]) ?? "");
    return { uid, uin: get("uin_str1"), targetUin: get("uin_str2") };
  }
  return null;
}

function dispatchIpc(
  wcId: number,
  envelope: Record<string, any>,
  cmd: Record<string, any>,
): Promise<any> {
  const wc = webContents.fromId(wcId);
  if (!wc) return Promise.resolve({ error: "no webContents" });
  const callbackId = crypto.randomUUID();
  const mainChannel = "RM_IPCFROM_MAIN" + wcId;
  const rendererChannel = "RM_IPCFROM_RENDERER" + wcId;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (v: any) => {
      if (settled) return;
      settled = true;
      unsub();
      clearTimeout(timer);
      resolve(v);
    };
    const unsub = IpcInterceptor.interceptIpcSend((ch, ...a) => {
      if (ch !== mainChannel || a[0]?.callbackId !== callbackId)
        return { action: "pass" as const };
      finish(a[1]);
      return { action: "block" as const };
    });
    const timer = setTimeout(() => finish({ error: "timeout" }), 3000);
    const listeners = ipcMain.listeners(rendererChannel);
    if (!listeners.length) {
      finish({ error: "no listeners" });
      return;
    }
    const fakeEvent = {
      sender: wc as any,
      reply: (...a: any[]) => wc.send(rendererChannel, ...a),
    };
    for (const fn of listeners)
      try {
        fn(fakeEvent, { peerId: wcId, callbackId, ...envelope } as any, cmd);
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
): Promise<any> {
  return dispatchIpc(
    wcId,
    { type: "request", eventName: "ntApi" },
    buildCmd("nodeIKernelMsgService/sendNudge", [
      { peer: { chatType, peerUid, guildId: "" }, targetUin, chatUin },
      null,
    ]),
  );
}

export default {
  onLoad() {
    const stored = migrateDotKeys(
      PluginSettings.main.readConfig<Config & Record<string, any>>(
        PLUGIN_ID,
        DEFAULT_CONFIG,
      ),
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
    ipcMain.on("nudge:set-config", (_, patch: Record<string, any>) => {
      for (const [k, v] of Object.entries(patch))
        setNested(config as any, k, v);
      PluginSettings.main.writeConfig(PLUGIN_ID, config);
      broadcast();
    });
    ipcMain.handle(
      "nudge:send",
      async (e, { chatType, peerUid, targetUin }) => {
        const r = await sendNudge(
          (e.sender as any).id,
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
      IpcInterceptor.onIpcSend((ch, _e, cmd) => {
        if (cmd?.cmdName !== "nodeIKernelMsgListener/onRecvMsg") return;
        if (!config.autoPokeBack?.enabled) return;
        const wcId = Number(ch.replace("RM_IPCFROM_MAIN", ""));
        if (!wcId) return;

        for (const msg of cmd.payload?.msgList ?? []) {
          if (!selfUin && Number(msg.sendType) === 1 && msg.senderUin)
            selfUin = String(msg.senderUin);
          const isGroup = msg.chatType === 2;
          if (msg.msgType !== 5 || msg.subMsgType !== 12) continue;
          if (isGroup ? !config.autoPokeBack.groupEnabled : msg.chatType !== 1)
            continue;

          const poke = parseNudgePoke(msg);
          if (!poke?.uid || !poke.uin) continue;
          if (!isGroup && poke.uid !== msg.peerUid) continue;
          if (isGroup && (!poke.targetUin || poke.uin === poke.targetUin || !selfUin || poke.targetUin !== selfUin))
            continue;
          // Blacklist/whitelist filtering
          if (
            isGroup ?
              config.listMode === "blacklist" ? config.groupList.includes(msg.peerUid) : !config.groupList.includes(msg.peerUid) :
              config.listMode === "blacklist" ? config.userList.includes(poke.uin) : !config.userList.includes(poke.uin)
          )
            continue;
          if (
            isGroup &&
            lastSentNudge &&
            Date.now() - lastSentNudge.time < 5000 &&
            msg.peerUid === lastSentNudge.peerUid &&
            poke.targetUin === lastSentNudge.targetUin
          )
            continue;

          const { cooldown = 3000, maxConsecutive = 5 } = config.autoPokeBack;
          if (Date.now() - (lastNudgeTime.get(poke.uid) ?? 0) < cooldown)
            continue;
          if (Date.now() - lastConsecutiveReset > cooldown * 2)
            consecutiveCount = 0;
          if (consecutiveCount >= maxConsecutive) continue;
          consecutiveCount++;
          lastConsecutiveReset = Date.now();
          lastNudgeTime.set(poke.uid, Date.now());

          if (isGroup)
            lastSentNudge = {
              peerUid: msg.peerUid,
              targetUin: poke.uin,
              time: Date.now(),
            };
          void sendNudge(
            wcId,
            msg.chatType,
            msg.peerUid,
            poke.uin,
            isGroup ? msg.peerUid : poke.uin,
          );
        }
      });
    }, 1000);
  },
};
