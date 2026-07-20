import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("nudgeDebug", {
  getConfig: (): Promise<any> => ipcRenderer.invoke("nudge:get-config"),
  setConfig: (c: any): void => ipcRenderer.send("nudge:set-config", c),
  onConfigChange: (cb: (c: any) => void): void => {
    ipcRenderer.on("nudge:config-changed", (_e, c) => cb(c));
  },
  sendNudge: (
    chatType: number,
    peerUid: string,
    targetUin: string,
    groupUin?: string,
  ): Promise<any> =>
    ipcRenderer.invoke("nudge:send", {
      chatType,
      peerUid,
      targetUin,
      groupUin,
    }),
});
