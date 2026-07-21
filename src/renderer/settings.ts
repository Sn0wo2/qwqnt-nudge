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
        let ctrl = "";
        if (item.type === "switch")
          ctrl = `<button class="${PREFIX}switch"></button>`;
        else if (item.type === "number")
          ctrl = `<div class="${PREFIX}num"><input type="number" min="${item.min}" max="${item.max}" step="${item.step}"></div>`;
        else if (item.type === "select" && "options" in item)
          ctrl = `<select class="${PREFIX}select">${item.options.map(o => `<option value="${o.value}">${o.label}</option>`).join("")}</select>`;
        else if (item.type === "text")
          ctrl = `<input type="text" class="${PREFIX}text" placeholder="${item.meta}">`;
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
        const num = el.querySelector<HTMLInputElement>(`.${PREFIX}num input`);
        if (num && v !== undefined) num.value = String(v);
        const sel = el.querySelector<HTMLSelectElement>(`.${PREFIX}select`);
        if (sel && v !== undefined) sel.value = String(v);
        const txt = el.querySelector<HTMLInputElement>(`.${PREFIX}text`);
        if (txt && v !== undefined) txt.value = Array.isArray(v) ? v.join(", ") : String(v);
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
      const target = ev.target as HTMLElement;
      const item = target.closest("[data-path]") as HTMLElement | null;
      if (!item) return;
      if (target.tagName === "SELECT") {
        api.setConfig({ [item.dataset.path!]: (target as HTMLSelectElement).value });
      } else if (
        target.tagName === "INPUT" &&
        (target as HTMLInputElement).type === "number"
      ) {
        api.setConfig({ [item.dataset.path!]: Number((target as HTMLInputElement).value) });
      } else if (
        target.tagName === "INPUT" &&
        (target as HTMLInputElement).type === "text"
      ) {
        const val = (target as HTMLInputElement).value;
        api.setConfig({
          [item.dataset.path!]: val.split(/[,\s]+/).filter(Boolean),
        });
      }
    });
    api.onConfigChange(apply);
  } catch (e) {
    console.error("[Nudge] settings error", e);
  }
}
