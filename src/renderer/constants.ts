export const PREFIX = "nudge-";
export const DOUBLE_CLICK_MS = 480;
export const DOUBLE_CLICK_DIST_PX = 20;
export const SUPPRESS_MS = 650;
export const BRIDGE_POLL_INTERVAL = 200;
export const BRIDGE_POLL_MAX = 50;

export const AVATAR_SELECTORS = [
  ".avatar-span .avatar",
  ".avatar.message-container__avatar",
  "[class*=avatar i]",
  "[data-testid*=avatar i]",
];

export const TEMPORARY_CHAT_TYPES = new Set([
  99, 100, 101, 102, 103, 111, 117, 119,
]);

export const RECORD_SEARCH_KEYS = [
  "props",
  "setupState",
  "ctx",
  "proxy",
  "msgRecord",
  "message",
  "record",
  "msg",
];
