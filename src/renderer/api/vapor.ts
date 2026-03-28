import type { VaporAPI } from "../../preload";

let api: VaporAPI = (typeof window !== "undefined" ? window.vapor : undefined) as VaporAPI;

export const vapor = new Proxy({} as VaporAPI, {
  get: (_target, prop) => (api as any)[prop],
});

export function setVaporAPI(mock: VaporAPI) {
  api = mock;
}
