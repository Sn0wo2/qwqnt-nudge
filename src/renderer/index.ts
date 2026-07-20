const P = "nudge-";

(() => {
  const style = document.createElement("style");
  style.textContent = `
.${P}settings{padding:8px 16px;color:var(--text01,#1f2329);font:14px/1.45 var(--font-family,"Microsoft YaHei UI",sans-serif)}
.${P}section{margin-bottom:16px}
.${P}section-title{font-size:14px;font-weight:600;margin-bottom:8px}
.${P}item{display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--divider,#e3e5e7)}
.${P}item:last-of-type{border-bottom:none}
.${P}item-main{flex:1}
.${P}item-name{font-size:14px}
.${P}item-meta{font-size:12px;color:var(--text02,#8a8e99);margin-top:2px}
.${P}switch{position:relative;width:44px;height:24px;flex-shrink:0;background:var(--divider,#d9d9d9);border-radius:12px;border:none;cursor:pointer;transition:.2s;padding:0}
.${P}switch[data-on="true"]{background:var(--brand_standard,#2f6bff)}
.${P}switch::after{content:"";position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:50%;background:#fff;transition:.2s}
.${P}switch[data-on="true"]::after{left:22px}
.${P}num{display:flex;align-items:center;gap:8px}
.${P}num input{width:80px;padding:4px 8px;border:1px solid var(--divider,#d9d9d9);border-radius:4px;background:var(--input_bg,#f5f5f5);color:var(--text01,#1f2329);text-align:center}
.${P}shake{animation:${P}shake .46s cubic-bezier(.36,.07,.19,.97)}
@keyframes ${P}shake{0%{transform:translateX(0)rotate(0deg)}14%{transform:translateX(-5px)rotate(-5deg)}28%{transform:translateX(5px)rotate(4deg)}42%{transform:translateX(-4px)rotate(-3deg)}58%{transform:translateX(4px)rotate(3deg)}72%{transform:translateX(-2px)rotate(-2deg)}86%{transform:translateX(2px)rotate(1deg)}100%{transform:translateX(0)rotate(0deg)}}`;
  document.head.appendChild(style);

  const items = [
    {
      path: "autoPokeBack.enabled",
      name: "自动回戳",
      meta: "收到戳一戳时自动回复",
      type: "switch",
    },
    {
      path: "autoPokeBack.cooldown",
      name: "冷却时间",
      meta: "最小回复间隔（毫秒）",
      type: "number",
      min: 0,
      max: 60000,
      step: 1000,
    },
    {
      path: "autoPokeBack.maxConsecutive",
      name: "最大连续次数",
      meta: "防止无限互戳",
      type: "number",
      min: 1,
      max: 50,
      step: 1,
    },
    {
      path: "doubleClickPoke.enabled",
      name: "双击头像戳一戳",
      meta: "替换默认行为（打开聊天）",
      type: "switch",
    },
  ];

  const bridge: Promise<any> = new Promise((res) => {
    const poll = () =>
      (window as any).nudgeDebug
        ? res((window as any).nudgeDebug)
        : setTimeout(poll, 200);
    poll();
  });

  // ── Settings UI ──
  RendererEvents.onSettingsWindowCreated(async () => {
    try {
      const view = await PluginSettings.renderer.registerPluginSettings({
        name: "qwqnt-nudge",
        qwqnt: { name: "Nudge" },
      });
      const root = document.createElement("div");
      root.className = `${P}settings`;
      root.innerHTML = `<div class="${P}section"><div class="${P}section-title">戳一戳</div>${items
        .map((item) => {
          const ctrl =
            item.type === "switch"
              ? `<button class="${P}switch"></button>`
              : `<div class="${P}num"><input type="number" min="${item.min}" max="${item.max}" step="${item.step}"></div>`;
          return `<div class="${P}item" data-path="${item.path}"><div class="${P}item-main"><div class="${P}item-name">${item.name}</div><div class="${P}item-meta">${item.meta}</div></div>${ctrl}</div>`;
        })
        .join("")}</div>`;
      view.appendChild(root);

      const api = await bridge;
      const apply = (c: any) =>
        root.querySelectorAll("[data-path]").forEach((el) => {
          const v = el
            .getAttribute("data-path")!
            .split(".")
            .reduce((o, k) => o?.[k], c);
          const sw = el.querySelector(`.${P}switch`) as HTMLElement | null;
          if (sw) sw.dataset.on = String(Boolean(v));
          const inp = el.querySelector(
            `.${P}num input`,
          ) as HTMLInputElement | null;
          if (inp && v !== undefined) inp.value = String(v);
        });

      apply(await api.getConfig());
      root.addEventListener("click", (ev) => {
        const item = (ev.target as HTMLElement).closest(
          "[data-path]",
        ) as HTMLElement | null;
        if (!item) return;
        const sw = (ev.target as HTMLElement).closest(
          `.${P}switch`,
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
  });

  // ── Vue introspection utilities ──
  function getVue(el: Element): any[] {
    const out: any[] = [];
    const seen = new Set();
    for (const i of (el as any).__VUE__ ?? [])
      if (i && !seen.has(i)) {
        seen.add(i);
        out.push(i);
      }
    const pc = (el as any).__vueParentComponent;
    if (pc && !seen.has(pc)) out.push(pc);
    return out;
  }

  function findVal(el: Element, paths: string[]): any {
    for (const inst of getVue(el))
      for (const p of paths) {
        const v = p.split(".").reduce((o, k) => o?.[k], inst);
        if (v != null) return v;
      }
  }

  function isRecord(v: any): boolean {
    return Boolean(
      v &&
      typeof v === "object" &&
      v.msgId &&
      v.msgSeq &&
      Array.isArray(v.elements),
    );
  }

  function findRecordDeep(val: any, depth = 0, seen = new WeakSet()): any {
    if (
      !val ||
      depth > 4 ||
      typeof val !== "object" ||
      seen.has(val) ||
      val instanceof Element ||
      val instanceof Uint8Array ||
      val instanceof Map
    )
      return null;
    seen.add(val);
    if (isRecord(val)) return val;
    for (const k of [
      "props",
      "setupState",
      "ctx",
      "proxy",
      "msgRecord",
      "message",
      "record",
      "msg",
    ]) {
      const found = findRecordDeep(val[k], depth + 1, seen);
      if (found) return found;
    }
    return null;
  }

  function findRecord(el: Element): any {
    const container = el.closest(
      ".message.vue-component, .ml-item, .message, [id]",
    );
    const candidates: Element[] = [];
    for (
      let n: Element | null = el;
      n && n !== document.body;
      n = n.parentElement
    )
      candidates.push(n);
    if (container) {
      candidates.push(container);
      candidates.push(
        ...Array.from(container.querySelectorAll("*")).slice(0, 80),
      );
    }
    for (const c of candidates) {
      const d = findVal(c, [
        "props.msgRecord",
        "ctx.msgRecord",
        "proxy.msgRecord",
      ]);
      if (isRecord(d)) return d;
      for (const inst of getVue(c)) {
        const f = findRecordDeep(inst);
        if (f) return f;
      }
    }
    return null;
  }

  function getAvatar(ev: Event): Element | null {
    for (const el of ev.composedPath?.() ?? [ev.target]) {
      if (!(el instanceof Element)) continue;
      if (
        !el.matches?.(
          ".avatar-span .avatar, .avatar.message-container__avatar, [class*=avatar i], [data-testid*=avatar i]",
        )
      )
        continue;
      if (findRecord(el)) return el;
    }
    return null;
  }

  function getChatCtx(avatar: Element) {
    const record = findRecord(avatar);
    const aioEl =
      document.querySelector(".aio.vue-component") ??
      document.querySelector(".aio");
    const aioData = aioEl
      ? findVal(aioEl, [
          "proxy.commonAioStore.curAioData",
          "ctx.commonAioStore.curAioData",
        ])
      : null;
    const h = aioData?.header ?? {};
    const types = [
      aioData?.chatType,
      aioData?.type,
      aioData?.aioType,
      aioData?.peer?.chatType,
      aioData?.contact?.chatType,
      h.chatType,
      h.peer?.chatType,
      record?.chatType,
      record?.peer?.chatType,
    ]
      .map(Number)
      .filter((v) => v > 0);
    const tmp = [99, 100, 101, 102, 103, 111, 117, 119];
    return {
      record,
      aioData,
      chatType: types[0] ?? 0,
      isTemporary: types.some((t) => tmp.includes(t)),
    };
  }

  function buildPayload(ctx: ReturnType<typeof getChatCtx>): any {
    if (ctx.isTemporary) return null;
    const { record, aioData, chatType } = ctx;
    const puid =
      record?.peerUid ??
      record?.peer?.peerUid ??
      aioData?.peerUid ??
      aioData?.peer?.peerUid ??
      aioData?.header?.peerUid ??
      "";
    const puin =
      [
        record?.peerUin,
        record?.peer?.peerUin,
        record?.peerUid,
        aioData?.peerUin,
        aioData?.peer?.peerUin,
        aioData?.peerUid,
        aioData?.header?.uin,
        aioData?.header?.peerUin,
        aioData?.header?.uid,
        aioData?.header?.peerUid,
      ].find((v) => /^\d+$/.test(String(v))) ?? "";

    if (chatType === 2) {
      const guin = puin || puid;
      if (!guin) return null;
      const tuin = record?.senderUin ?? record?.sender?.uin;
      if (!tuin) return null;
      return {
        chatType: 2,
        groupUin: String(guin),
        peerUid: String(guin),
        targetUin: String(tuin),
      };
    }
    if (chatType === 1) {
      const tuin = record?.senderUin ?? record?.sender?.uin ?? puin;
      return tuin
        ? { chatType: 1, targetUin: String(tuin), groupUin: "", peerUid: puid }
        : null;
    }
    return null;
  }

  function sendPoke(payload: any, avatar: Element) {
    api
      ?.sendNudge(
        payload.chatType,
        payload.peerUid,
        payload.targetUin,
        payload.groupUin || undefined,
      )
      .then((r: any) => {
        if (r && r.result === 0) {
          avatar.classList.remove(`${P}shake`);
          void (avatar as any).offsetWidth;
          avatar.classList.add(`${P}shake`);
        }
      })
      .catch(() => {});
  }

  // ── Avatar double-click poke ──
  let enabled = false,
    api: any = null;
  let pending: {
    time: number;
    x: number;
    y: number;
    target: Element;
    payload: any;
  } | null = null;
  let suppressUntil = 0;

  bridge.then((b) => {
    api = b;
    b.getConfig().then((c: any) => {
      enabled = c?.doubleClickPoke?.enabled === true;
    });
    b.onConfigChange((c: any) => {
      enabled = c?.doubleClickPoke?.enabled === true;
    });
  });

  function stop(ev: Event) {
    ev.preventDefault();
    ev.stopPropagation();
    (ev as any).stopImmediatePropagation?.();
  }

  document.addEventListener(
    "pointerdown",
    (ev) => {
      if (!enabled || ev.button !== 0) {
        pending = null;
        return;
      }
      const avatar = getAvatar(ev);
      if (!avatar) {
        pending = null;
        return;
      }
      const ctx = getChatCtx(avatar);
      if (ctx.isTemporary) {
        stop(ev);
        suppressUntil = performance.now() + 650;
        pending = null;
        return;
      }
      const payload = buildPayload(ctx);
      if (!payload) {
        pending = null;
        return;
      }

      const now = performance.now();
      const prev = pending;
      if (
        prev &&
        prev.target === avatar &&
        now - prev.time <= 480 &&
        Math.hypot(ev.clientX - prev.x, ev.clientY - prev.y) <= 20
      ) {
        stop(ev);
        suppressUntil = now + 650;
        pending = null;
        sendPoke(prev.payload, avatar);
        return;
      }
      stop(ev);
      suppressUntil = now + 650;
      pending = {
        time: now,
        x: ev.clientX,
        y: ev.clientY,
        target: avatar,
        payload,
      };
      setTimeout(() => {
        if (pending?.time === now) pending = null;
      }, 500);
    },
    true,
  );

  document.addEventListener(
    "click",
    (ev) => {
      if (performance.now() <= suppressUntil) stop(ev);
    },
    true,
  );

  document.addEventListener(
    "dblclick",
    (ev) => {
      if (!enabled || ev.button !== 0) return;
      if (performance.now() <= suppressUntil) {
        stop(ev);
        return;
      }
      const avatar = getAvatar(ev);
      if (!avatar) return;
      const ctx = getChatCtx(avatar);
      if (ctx.isTemporary) {
        stop(ev);
        suppressUntil = performance.now() + 650;
        pending = null;
        return;
      }
      const payload = buildPayload(ctx);
      if (!payload) return;
      stop(ev);
      suppressUntil = performance.now() + 650;
      pending = null;
      sendPoke(payload, avatar);
    },
    true,
  );
})();
