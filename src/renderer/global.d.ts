import type { VaporAPI } from "../preload";

declare global {
  interface Window {
    vapor: VaporAPI;
    __vprOpenFile?: (
      filePath: string,
      direction: "horizontal" | "vertical",
    ) => Promise<void>;
  }
}
