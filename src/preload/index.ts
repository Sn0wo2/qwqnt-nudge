import { contextBridge, ipcRenderer } from "electron";

interface NudgeConfig {
  autoPokeBack: {
    enabled: boolean;
    groupEnabled: boolean;
    cooldown: number;
    maxConsecutive: number;
  };
  doubleClickPoke: { enabled: boolean };
  listMode: "blacklist" | "whitelist";
  groupList: string[];
  userList: string[];
}

interface NudgeSendResult {
  result?: number;
}


const api = {
  getConfig: (): Promise<NudgeConfig> => ipcRenderer.invoke("nudge:get-config"),
  setConfig: (patch: Record<string, unknown>): void =>
    ipcRenderer.send("nudge:set-config", patch),
  onConfigChange: (cb: (c: NudgeConfig) => void): void => {
    ipcRenderer.on("nudge:config-changed", (_e, c) => cb(c));
  },
  sendNudge: (
    chatType: number,
    peerUid: string,
    targetUin: string,
  ): Promise<NudgeSendResult> =>
    ipcRenderer.invoke("nudge:send", { chatType, peerUid, targetUin }),
};

contextBridge.exposeInMainWorld("nudgeDebug", api);
