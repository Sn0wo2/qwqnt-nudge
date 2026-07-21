import type { PendingClick } from "./types";
import type { NudgeAPI } from "./types";
import {
  DOUBLE_CLICK_MS,
  DOUBLE_CLICK_DIST_PX,
  SUPPRESS_MS,
} from "./constants";
import { waitForBridge } from "./bridge";
import { resolvePokeTarget, sendPoke, stopImmediate } from "./poke-utils";

export async function initDoubleClickPoke(): Promise<void> {
  let enabled = false;
  let api: NudgeAPI;
  let pending: PendingClick | null = null;
  let suppressUntil = 0;
  try {
    api = await waitForBridge();
    const c = await api.getConfig();
    enabled = c?.doubleClickPoke?.enabled === true;
    api.onConfigChange((c) => {
      enabled = c?.doubleClickPoke?.enabled === true;
    });
  } catch (e) {
    console.error("[Nudge] double-click init failed", e);
    return;
  }

  const armSuppress = () => {
    suppressUntil = performance.now() + SUPPRESS_MS;
  };

  document.addEventListener(
    "pointerdown",
    (ev) => {
      if (!enabled || ev.button !== 0) {
        pending = null;
        return;
      }
      const target = resolvePokeTarget(ev);
      if (target === null) {
        pending = null;
        return;
      }
      if (target === "suppress") {
        stopImmediate(ev);
        armSuppress();
        pending = null;
        return;
      }
      const { avatar, payload } = target;
      const now = performance.now();
      const prev = pending;
      if (
        prev &&
        prev.target === avatar &&
        now - prev.time <= DOUBLE_CLICK_MS &&
        Math.hypot(ev.clientX - prev.x, ev.clientY - prev.y) <=
          DOUBLE_CLICK_DIST_PX
      ) {
        stopImmediate(ev);
        armSuppress();
        pending = null;
        sendPoke(prev.payload, avatar, api);
        return;
      }
      stopImmediate(ev);
      armSuppress();
      pending = {
        time: now,
        x: ev.clientX,
        y: ev.clientY,
        target: avatar,
        payload,
      };
      setTimeout(() => {
        if (pending?.time === now) pending = null;
      }, DOUBLE_CLICK_MS + 20);
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
      if (performance.now() <= suppressUntil) {
        stopImmediate(ev);
        return;
      }
      const target = resolvePokeTarget(ev);
      if (target === null) return;
      if (target === "suppress") {
        stopImmediate(ev);
        armSuppress();
        pending = null;
        return;
      }
      stopImmediate(ev);
      armSuppress();
      pending = null;
      sendPoke(target.payload, target.avatar, api);
    },
    true,
  );
}
