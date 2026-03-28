import { describe, it, expect, beforeEach } from "vitest";
import { useNavigationStore, type NavTarget } from "./navigation";

beforeEach(() => {
  useNavigationStore.setState({
    isNavigating: false,
    selectedTarget: null,
  });
});

const tabTarget: NavTarget = { type: "tab", tabId: "tab-1" };
const paneTarget: NavTarget = { type: "pane", paneId: "pane-1" };

describe("startNavigation", () => {
  it("sets isNavigating to true and stores the target", () => {
    useNavigationStore.getState().startNavigation(tabTarget);
    const state = useNavigationStore.getState();

    expect(state.isNavigating).toBe(true);
    expect(state.selectedTarget).toEqual(tabTarget);
  });
});

describe("setTarget", () => {
  it("updates the selected target without changing isNavigating", () => {
    useNavigationStore.getState().startNavigation(tabTarget);
    useNavigationStore.getState().setTarget(paneTarget);
    const state = useNavigationStore.getState();

    expect(state.isNavigating).toBe(true);
    expect(state.selectedTarget).toEqual(paneTarget);
  });
});

describe("confirm", () => {
  it("resets isNavigating and selectedTarget", () => {
    useNavigationStore.getState().startNavigation(tabTarget);
    useNavigationStore.getState().confirm();
    const state = useNavigationStore.getState();

    expect(state.isNavigating).toBe(false);
    expect(state.selectedTarget).toBeNull();
  });
});

describe("cancel", () => {
  it("resets isNavigating and selectedTarget", () => {
    useNavigationStore.getState().startNavigation(paneTarget);
    useNavigationStore.getState().cancel();
    const state = useNavigationStore.getState();

    expect(state.isNavigating).toBe(false);
    expect(state.selectedTarget).toBeNull();
  });
});

describe("full navigation round-trip", () => {
  it("start -> setTarget -> confirm clears state", () => {
    const store = useNavigationStore;
    store.getState().startNavigation(tabTarget);
    store.getState().setTarget(paneTarget);
    store.getState().confirm();

    expect(store.getState().isNavigating).toBe(false);
    expect(store.getState().selectedTarget).toBeNull();
  });

  it("start -> cancel clears state", () => {
    const store = useNavigationStore;
    store.getState().startNavigation(tabTarget);
    store.getState().cancel();

    expect(store.getState().isNavigating).toBe(false);
    expect(store.getState().selectedTarget).toBeNull();
  });
});
