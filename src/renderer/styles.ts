import { PREFIX } from "./constants";

(() => {
  const style = document.createElement("style");
  style.textContent = `
.${PREFIX}input{width:120px;padding:4px 8px;border:1px solid var(--border_dark);border-radius:4px;background:transparent;color:var(--text_primary);font-size:13px}
.${PREFIX}list-input{width:180px}
.${PREFIX}shake{animation:${PREFIX}shake .46s cubic-bezier(.36,.07,.19,.97)}
@keyframes ${PREFIX}shake{0%{transform:translateX(0)rotate(0deg)}14%{transform:translateX(-5px)rotate(-5deg)}28%{transform:translateX(5px)rotate(4deg)}42%{transform:translateX(-4px)rotate(-3deg)}58%{transform:translateX(4px)rotate(3deg)}72%{transform:translateX(-2px)rotate(-2deg)}86%{transform:translateX(2px)rotate(1deg)}100%{transform:translateX(0)rotate(0deg)}}`;
  document.head.appendChild(style);
})();
