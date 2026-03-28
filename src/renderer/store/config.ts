import { create } from "zustand";
import type { VaporConfig } from "../../shared/types";
import { vapor } from "../api/vapor";

export type { VaporConfig };

interface ConfigStore {
  config: VaporConfig | null;
  loadConfig: () => Promise<void>;
  saveConfig: (newConfig: VaporConfig) => Promise<VaporConfig>;
}

export const useConfigStore = create<ConfigStore>((set) => ({
  config: null,

  loadConfig: async () => {
    const config = await vapor.config.get();
    set({ config });
  },

  saveConfig: async (newConfig: VaporConfig) => {
    const config = await vapor.config.set(newConfig as unknown as Record<string, unknown>);
    set({ config });
    return config;
  },
}));
