/// <reference types="vite/client" />
/// <reference types="@qwqnt/types/renderer" />

export {};

declare global {
  var Logs:
    | (new (moduleName: string) => (...args: unknown[]) => void)
    | undefined;
}
