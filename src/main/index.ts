import { ipcMain, webContents } from "electron";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const PLUGIN_NAME = "qwqnt-nudge";
const DEFAULT_CONFIG = {
  autoPokeBack: { enabled: true, cooldown: 3000, maxConsecutive: 5 },
  doubleClickPoke: { enabled: true },
};
let config: Record<string, any> = {};
let configPath = "";

function resolveConfigPath(): string {
  if (configPath) return configPath;
  const fp = (globalThis as any).qwqnt?.framework?.paths;
  const dir = fp?.configs
    ? path.join(fp.configs, PLUGIN_NAME)
    : path.join(__dirname, "..");
  fs.mkdirSync(dir, { recursive: true });
  configPath = path.join(dir, "config.json");
  return configPath;
}

function dispatchIpc(
  wcId: number,
  envelope: Record<string, any>,
  cmd: Record<string, any>,
): Promise<any> {
  const wc = webContents.fromId(wcId);
  if (!wc) return Promise.resolve({ error: "no webContents" });
  const cb = crypto.randomUUID();
  const mch = "RM_IPCFROM_MAIN" + wcId,
    rch = "RM_IPCFROM_RENDERER" + wcId;
  let r: (v: any) => void, rt: ReturnType<typeof setTimeout>;
  const unsub = IpcInterceptor.interceptIpcSend((ch, ...a) => {
    if (ch !== mch || a[0]?.callbackId !== cb)
      return { action: "pass" as const };
    clearTimeout(rt);
    unsub();
    r(a[1]);
    return { action: "block" as const };
  });
  const ls = ipcMain.listeners(rch);
  if (!ls.length) {
    unsub();
    return Promise.resolve({ error: "no listeners" });
  }
  const fe = { sender: wc as any, reply: (...a: any[]) => wc.send(rch, ...a) };
  for (const fn of ls)
    try {
      fn(fe, { peerId: wcId, callbackId: cb, ...envelope } as any, cmd);
    } catch {}
  return Promise.race([
    new Promise((r2) => {
      r = r2;
    }),
    new Promise((r2) => {
      rt = setTimeout(() => {
        unsub();
        r2({ error: "timeout" });
      }, 3000);
    }),
  ]);
}

const buildCmd = (n: string, p: any) => ({
  cmdName: n,
  cmdType: "invoke",
  payload: p,
});

function parseNudgePoke(msg: any): { uid: string; uin: string } | null {
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
    const uin = (tp instanceof Map ? tp.get("uin_str1") : tp?.uin_str1) ?? "";
    return { uid, uin: String(uin) };
  }
  return null;
}

async function sendNudge(
  wcId: number,
  ct: number,
  puid: string,
  tuin: string,
  guin?: string,
): Promise<any> {
  const uid = ct === 2 ? guin || puid : puid;
  const chatUin = ct === 2 ? guin || puid : tuin;
  return await dispatchIpc(
    wcId,
    { type: "request", eventName: "ntApi" },
    buildCmd("nodeIKernelMsgService/sendNudge", [
      {
        peer: { chatType: ct, peerUid: uid, guildId: "" },
        targetUin: tuin,
        chatUin,
      },
      null,
    ]),
  );
}

const lastNudgeTime = new Map<string, number>();
let consecutiveCount = 0,
  lastConsecutiveReset = 0;

export default {
  onLoad() {
    try {
      const p = resolveConfigPath();
      if (!fs.existsSync(p)) {
        config = { ...DEFAULT_CONFIG };
        fs.writeFileSync(p, JSON.stringify(config, null, 2), "utf8");
      } else {
        const raw: Record<string, any> = JSON.parse(fs.readFileSync(p, "utf8"));
        for (const k of Object.keys(raw)) {
          if (!k.includes(".")) continue;
          const parts = k.split(".");
          let cur = raw;
          for (let i = 0; i < parts.length - 1; i++) {
            if (!cur[parts[i]] || typeof cur[parts[i]] !== "object")
              cur[parts[i]] = {};
            cur = cur[parts[i]];
          }
          cur[parts[parts.length - 1]] = raw[k];
          delete raw[k];
        }
        config = { ...DEFAULT_CONFIG, ...raw };
        fs.writeFileSync(p, JSON.stringify(config, null, 2), "utf8");
      }
    } catch {}

    ipcMain.handle("nudge:get-config", () => ({ ...config }));
    ipcMain.on("nudge:set-config", (_, patch) => {
      for (const k of Object.keys(patch)) {
        if (k.includes(".")) {
          const parts = k.split(".");
          let cur = config;
          for (let i = 0; i < parts.length - 1; i++) {
            if (!cur[parts[i]] || typeof cur[parts[i]] !== "object")
              cur[parts[i]] = {};
            cur = cur[parts[i]];
          }
          cur[parts[parts.length - 1]] = patch[k];
        } else if (typeof patch[k] === "object" && !Array.isArray(patch[k])) {
          config[k] = { ...config[k], ...patch[k] };
        } else {
          config[k] = patch[k];
        }
      }
      try {
        fs.writeFileSync(
          resolveConfigPath(),
          JSON.stringify(config, null, 2),
          "utf8",
        );
      } catch {}
      for (const w of webContents.getAllWebContents())
        if (!w.isDestroyed()) w.send("nudge:config-changed", { ...config });
    });
    ipcMain.handle(
      "nudge:send",
      async (e, { chatType, peerUid, targetUin, groupUin }) => {
        const r = await sendNudge(
          (e.sender as any).id,
          chatType,
          peerUid,
          targetUin,
          groupUin,
        );
        return r.cmdData ?? r.error;
      },
    );

    const iv = setInterval(() => {
      if (!IpcInterceptor) return;
      clearInterval(iv);
      IpcInterceptor.onIpcSend((ch, _e, cmd) => {
        if (cmd?.cmdName !== "nodeIKernelMsgListener/onRecvMsg") return;
        if (!config.autoPokeBack?.enabled) return;
        const msgs = cmd.payload?.msgList ?? [];
        for (const msg of msgs) {
          if (msg.chatType !== 1 || msg.msgType !== 5 || msg.subMsgType !== 12)
            continue;
          const poke = parseNudgePoke(msg);
          if (!poke?.uid || poke.uid !== msg.peerUid) continue;
          const cool = config.autoPokeBack.cooldown ?? 3000;
          if (Date.now() - (lastNudgeTime.get(poke.uid) ?? 0) < cool) continue;
          lastNudgeTime.set(poke.uid, Date.now());
          if (Date.now() - lastConsecutiveReset > cool * 2)
            consecutiveCount = 0;
          if (consecutiveCount >= (config.autoPokeBack.maxConsecutive ?? 5))
            continue;
          consecutiveCount++;
          lastConsecutiveReset = Date.now();
          if (!poke.uin) continue;
          dispatchIpc(
            Number(ch.replace("RM_IPCFROM_MAIN", "")),
            { type: "request", eventName: "ntApi" },
            buildCmd("nodeIKernelMsgService/sendNudge", [
              {
                peer: { chatType: 1, peerUid: msg.peerUid, guildId: "" },
                targetUin: poke.uin,
                chatUin: poke.uin,
              },
              null,
            ]),
          );
        }
      });
    }, 1000);
  },
};
