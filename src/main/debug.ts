import { appendFileSync, mkdirSync } from "fs";
import { join } from "path";

const LOG_FILE = (() => {
  const dir = (globalThis as any).qwqnt?.framework?.paths?.data
    ? join((globalThis as any).qwqnt.framework.paths.data, "qwqnt-nudge")
    : join(__dirname, "..");
  mkdirSync(dir, { recursive: true });
  return join(dir, "debug.log");
})();

export function debugLog(...args: any[]): void {
  try {
    const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
    const line = `[${ts}] ${args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ")}\n`;
    appendFileSync(LOG_FILE, line, "utf8");
  } catch (e) {
    console.error("[Nudge] debugLog write failed", e);
  }
}
