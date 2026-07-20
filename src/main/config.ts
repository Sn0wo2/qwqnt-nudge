export interface Config {
  autoPokeBack: { enabled: boolean; groupEnabled: boolean; cooldown: number; maxConsecutive: number };
  doubleClickPoke: { enabled: boolean };
}

export const DEFAULT_CONFIG: Config = {
  autoPokeBack: { enabled: true, groupEnabled: false, cooldown: 3000, maxConsecutive: 5 },
  doubleClickPoke: { enabled: true },
};

export function loadConfig(): Config {
  return PluginSettings.main.readConfig("qwqnt-nudge", DEFAULT_CONFIG);
}

export function saveConfig(next: Config | Record<string, any>): boolean {
  return PluginSettings.main.writeConfig("qwqnt-nudge", next);
}
