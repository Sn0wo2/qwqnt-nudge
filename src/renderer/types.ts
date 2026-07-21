export interface PokePayload {
  chatType: number;
  peerUid: string;
  targetUin: string;
}

export interface NudgeAPI {
  getConfig: () => Promise<any>;
  setConfig: (patch: Record<string, any>) => void;
  onConfigChange: (cb: (c: any) => void) => void;
  sendNudge: (
    chatType: number,
    peerUid: string,
    targetUin: string,
  ) => Promise<{ result?: number; [k: string]: any }>;
}

export interface PendingClick {
  time: number;
  x: number;
  y: number;
  target: Element;
  payload: PokePayload;
}

export interface ChatContext {
  record: any;
  aioData: any;
  chatType: number;
  isTemporary: boolean;
}

export type PokeTarget =
  | { avatar: Element; payload: PokePayload }
  | "suppress"
  | null;
