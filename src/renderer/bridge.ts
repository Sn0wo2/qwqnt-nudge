import type { NudgeAPI } from "./types";
import { BRIDGE_POLL_INTERVAL, BRIDGE_POLL_MAX } from "./constants";

export function waitForBridge(): Promise<NudgeAPI> {
  return new Promise((resolve, reject) => {
    let tries = 0;
    const poll = () => {
      const b = (window as any).nudgeDebug as NudgeAPI | undefined;
      if (b) return resolve(b);
      if (++tries > BRIDGE_POLL_MAX)
        return reject(new Error("nudgeDebug bridge not available"));
      setTimeout(poll, BRIDGE_POLL_INTERVAL);
    };
    poll();
  });
}
