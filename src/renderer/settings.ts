import { PREFIX } from "./constants";


export type NudgeDebugAPI = {
  getConfig: () => Promise<any>;
  setConfig: (c: Record<string, any>) => void;
  onConfigChange: (cb: (c: any) => void) => void;
  sendNudge: (chatType: number, peerUid: string, targetUin: string, groupUin?: string) => Promise<any>;
};

const BRIDGE_POLL_MAX = 50; // 50 * 200ms = 10s
let _bridgeResolve: ((api: NudgeDebugAPI) => void) | null = null;
let _bridgeReject: ((err: Error) => void) | null = null;

const _bridgePromise: Promise<NudgeDebugAPI> = new Promise((resolve, reject) => {
  _bridgeResolve = resolve;
  _bridgeReject = reject;
  let tries = 0;
  const poll = () => {
    tries++;
    const b = (window as any).nudgeDebug as NudgeDebugAPI | undefined;
    if (b) {
      resolve(b);
      return;
    }
    if (tries >= BRIDGE_POLL_MAX) {
      reject(new Error(`nudgeDebug bridge not available after ${BRIDGE_POLL_MAX} polls`));
      return;
    }
    setTimeout(poll, 200);
  };
  poll();
});

export { _bridgePromise, _bridgeResolve, _bridgeReject };

interface SettingsItem {
  path: string;
  name: string;
  meta: string;
  type: "switch" | "number";
  min?: number;
  max?: number;
  step?: number;
}

const ITEMS: SettingsItem[] = [
  { path: "autoPokeBack.enabled", name: "自动回戳", meta: "收到戳一戳时自动回复", type: "switch" },
  { path: "autoPokeBack.groupEnabled", name: "群聊自动回戳", meta: "群聊中收到戳一戳时自动回复", type: "switch" },
  { path: "autoPokeBack.cooldown", name: "冷却时间", meta: "最小回复间隔（ms）", type: "number", min: 0, max: 60000, step: 1000 },
  { path: "autoPokeBack.maxConsecutive", name: "最大连续次数", meta: "防止无限互戳", type: "number", min: 1, max: 50, step: 1 },
  { path: "doubleClickPoke.enabled", name: "双击头像戳一戳", meta: "替换默认打开聊天行为", type: "switch" },
];

export function injectStyles(): void {
  const style = document.createElement("style");
  style.textContent = `
.${PREFIX}settings{padding:8px 16px;color:var(--text01,#1f2329);font:14px/1.45 var(--font-family,"Microsoft YaHei UI",sans-serif)}
.${PREFIX}section{margin-bottom:16px}
.${PREFIX}section-title{font-size:14px;font-weight:600;margin-bottom:8px}
.${PREFIX}item{display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--divider,#e3e5e7)}
.${PREFIX}item:last-of-type{border-bottom:none}
.${PREFIX}item-main{flex:1}
.${PREFIX}item-name{font-size:14px}
.${PREFIX}item-meta{font-size:12px;color:var(--text02,#8a8e99);margin-top:2px}
.${PREFIX}switch{position:relative;width:44px;height:24px;flex-shrink:0;background:var(--divider,#d9d9d9);border-radius:12px;border:none;cursor:pointer;transition:.2s;padding:0}
.${PREFIX}switch[data-on="true"]{background:var(--brand_standard,#2f6bff)}
.${PREFIX}switch::after{content:"";position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:50%;background:#fff;transition:.2s}
.${PREFIX}switch[data-on="true"]::after{left:22px}
.${PREFIX}num{display:flex;align-items:center;gap:8px}
.${PREFIX}num input{width:80px;padding:4px 8px;border:1px solid var(--divider,#d9d9d9);border-radius:4px;background:var(--input_bg,#f5f5f5);color:var(--text01,#1f2329);text-align:center}
.${PREFIX}shake{animation:${PREFIX}shake .46s cubic-bezier(.36,.07,.19,.97)}
@keyframes ${PREFIX}shake{0%{transform:translateX(0)rotate(0deg)}14%{transform:translateX(-5px)rotate(-5deg)}28%{transform:translateX(5px)rotate(4deg)}42%{transform:translateX(-4px)rotate(-3deg)}58%{transform:translateX(4px)rotate(3deg)}72%{transform:translateX(-2px)rotate(-2deg)}86%{transform:translateX(2px)rotate(1deg)}100%{transform:translateX(0)rotate(0deg)}}`;
  document.head.appendChild(style);
}

function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((o, k) => o?.[k], obj);
}

function applyConfig(root: HTMLElement, config: any): void {
  root.querySelectorAll("[data-path]").forEach((el) => {
    const v = getNestedValue(config, el.getAttribute("data-path")!);
    const sw = el.querySelector(`.${PREFIX}switch`) as HTMLElement | null;
    if (sw) sw.dataset.on = String(Boolean(v));
    const inp = el.querySelector(`.${PREFIX}num input`) as HTMLInputElement | null;
    if (inp && v !== undefined) inp.value = String(v);
  });
}

export async function renderSettingsPanel(): Promise<void> {
  try {
    const api = await _bridgePromise;
    const view = await PluginSettings.renderer.registerPluginSettings({
      name: "qwqnt-nudge",
      qwqnt: { name: "Nudge" },
    });
    const root = document.createElement("div");
    root.className = `${PREFIX}settings`;
    root.innerHTML = `<div class="${PREFIX}section"><div class="${PREFIX}section-title">戳一戳</div>${ITEMS
      .map((item) => {
        const ctrl =
          item.type === "switch"
            ? `<button class="${PREFIX}switch"></button>`
            : `<div class="${PREFIX}num"><input type="number" min="${item.min}" max="${item.max}" step="${item.step}"></div>`;
        return `<div class="${PREFIX}item" data-path="${item.path}"><div class="${PREFIX}item-main"><div class="${PREFIX}item-name">${item.name}</div><div class="${PREFIX}item-meta">${item.meta}</div></div>${ctrl}</div>`;
      })
      .join("")}</div>`;
    view.appendChild(root);

    applyConfig(root, await api.getConfig());

    root.addEventListener("click", (ev) => {
      const item = (ev.target as HTMLElement).closest("[data-path]") as HTMLElement | null;
      if (!item) return;
      const sw = (ev.target as HTMLElement).closest(`.${PREFIX}switch`) as HTMLElement | null;
      if (!sw) return;
      const v = sw.dataset.on !== "true";
      sw.dataset.on = String(v);
      api.setConfig({ [item.dataset.path!]: v });
    });

    root.addEventListener("change", (ev) => {
      const inp = ev.target as HTMLInputElement;
      if (inp.tagName !== "INPUT") return;
      const item = inp.closest("[data-path]") as HTMLElement | null;
      if (!item) return;
      api.setConfig({ [item.dataset.path!]: Number(inp.value) });
    });

    api.onConfigChange((c) => applyConfig(root, c));
  } catch (e) {
    console.error("[Nudge] settings error", e);
  }
}
