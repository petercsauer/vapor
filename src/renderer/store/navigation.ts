import { create } from "zustand";

export type NavTarget =
  | { type: "tab"; tabId: string }
  | { type: "pane"; paneId: string };

interface NavigationStore {
  isNavigating: boolean;
  selectedTarget: NavTarget | null;
  startNavigation: (target: NavTarget) => void;
  setTarget: (target: NavTarget) => void;
  confirm: () => void;
  cancel: () => void;
}

export const useNavigationStore = create<NavigationStore>((set) => ({
  isNavigating: false,
  selectedTarget: null,
  startNavigation: (target) =>
    set({ isNavigating: true, selectedTarget: target }),
  setTarget: (target) => set({ selectedTarget: target }),
  confirm: () => set({ isNavigating: false, selectedTarget: null }),
  cancel: () => set({ isNavigating: false, selectedTarget: null }),
}));
