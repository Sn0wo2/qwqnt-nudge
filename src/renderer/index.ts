export * from "./types";
export * from "./constants";
export * from "./bridge";
export * from "./vue-utils";
export * from "./poke-utils";
export * from "./settings";
export * from "./double-click";

import "./styles";
import { renderSettings } from "./settings";
import { initDoubleClickPoke } from "./double-click";

RendererEvents.onSettingsWindowCreated(renderSettings);
void initDoubleClickPoke();
