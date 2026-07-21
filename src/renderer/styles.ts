import { PREFIX } from "./constants";

(() => {
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
.${PREFIX}select{width:100px;padding:4px 8px;border:1px solid var(--divider,#d9d9d9);border-radius:4px;background:var(--input_bg,#f5f5f5);color:var(--text01,#1f2329);font-size:13px}
.${PREFIX}text{width:120px;padding:4px 8px;border:1px solid var(--divider,#d9d9d9);border-radius:4px;background:var(--input_bg,#f5f5f5);color:var(--text01,#1f2329);font-size:13px}
.${PREFIX}shake{animation:${PREFIX}shake .46s cubic-bezier(.36,.07,.19,.97)}
@keyframes ${PREFIX}shake{0%{transform:translateX(0)rotate(0deg)}14%{transform:translateX(-5px)rotate(-5deg)}28%{transform:translateX(5px)rotate(4deg)}42%{transform:translateX(-4px)rotate(-3deg)}58%{transform:translateX(4px)rotate(3deg)}72%{transform:translateX(-2px)rotate(-2deg)}86%{transform:translateX(2px)rotate(1deg)}100%{transform:translateX(0)rotate(0deg)}}`;
  document.head.appendChild(style);
})();
