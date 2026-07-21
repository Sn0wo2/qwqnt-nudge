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

export const SETTINGS_ITEMS = [
  {
    path: "autoPokeBack.enabled",
    name: "自动回戳",
    meta: "收到戳一戳时自动回复",
    type: "switch" as const,
  },
  {
    path: "autoPokeBack.groupEnabled",
    name: "群聊自动回戳",
    meta: "群聊中收到戳一戳时自动回复",
    type: "switch" as const,
  },
  {
    path: "autoPokeBack.cooldown",
    name: "冷却时间",
    meta: "最小回复间隔（毫秒）",
    type: "number" as const,
    min: 0,
    max: 60000,
    step: 1000,
  },
  {
    path: "autoPokeBack.maxConsecutive",
    name: "最大连续次数",
    meta: "防止无限互戳",
    type: "number" as const,
    min: 1,
    max: 50,
    step: 1,
  },
  {
    path: "doubleClickPoke.enabled",
    name: "双击头像戳一戳",
    meta: "替换默认行为（打开聊天）",
    type: "switch" as const,
  },
];
