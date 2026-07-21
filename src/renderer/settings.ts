import { PREFIX, SETTINGS_ITEMS } from "./constants";
import { waitForBridge } from "./bridge";

export async function renderSettings(): Promise<void> {
  try {
    const api = await waitForBridge();
    const view = await PluginSettings.renderer.registerPluginSettings({
      name: "qwqnt-nudge",
      qwqnt: { name: "Nudge" },
    });
    const root = document.createElement("div");
    root.className = `${PREFIX}settings`;
    root.innerHTML = `<div class="${PREFIX}section"><div class="${PREFIX}section-title">戳一戳</div>${SETTINGS_ITEMS.map(
      (item) => {
        const ctrl =
          item.type === "switch"
            ? `<button class="${PREFIX}switch"></button>`
            : `<div class="${PREFIX}num"><input type="number" min="${item.min}" max="${item.max}" step="${item.step}"></div>`;
        return `<div class="${PREFIX}item" data-path="${item.path}"><div class="${PREFIX}item-main"><div class="${PREFIX}item-name">${item.name}</div><div class="${PREFIX}item-meta">${item.meta}</div></div>${ctrl}</div>`;
      },
    ).join("")}</div>`;
    view.appendChild(root);

    const apply = (c: any) =>
      root.querySelectorAll<HTMLElement>("[data-path]").forEach((el) => {
        const v = el
          .getAttribute("data-path")!
          .split(".")
          .reduce((o: any, k) => o?.[k], c);
        const sw = el.querySelector<HTMLElement>(`.${PREFIX}switch`);
        if (sw) sw.dataset.on = String(Boolean(v));
        const inp = el.querySelector<HTMLInputElement>(`.${PREFIX}num input`);
        if (inp && v !== undefined) inp.value = String(v);
      });

    apply(await api.getConfig());
    root.addEventListener("click", (ev) => {
      const item = (ev.target as HTMLElement).closest(
        "[data-path]",
      ) as HTMLElement | null;
      if (!item) return;
      const sw = (ev.target as HTMLElement).closest(
        `.${PREFIX}switch`,
      ) as HTMLElement | null;
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
    api.onConfigChange(apply);
  } catch (e) {
    console.error("[Nudge] settings error", e);
  }
}
