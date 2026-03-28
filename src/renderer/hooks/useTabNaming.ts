import { useEffect } from "react";
import { useTabPaneStore } from "../store/tabs";
import { collectSessionIds, findNode } from "../store/panes";
import { vapor } from "../api/vapor";

export function useTabNaming() {
  useEffect(() => {
    let namingInterval: ReturnType<typeof setInterval> | null = null;
    let namingDebounce: ReturnType<typeof setTimeout> | null = null;
    let namingRunning = false;

    const gitRootCache = new Map<string, { result: string | null; ts: number }>();
    const GIT_CACHE_TTL = 10000;

    async function resolveGitRoot(cwd: string): Promise<string | null> {
      const cached = gitRootCache.get(cwd);
      if (cached && Date.now() - cached.ts < GIT_CACHE_TTL) return cached.result;
      const result = await vapor.fs.gitRoot(cwd);
      gitRootCache.set(cwd, { result, ts: Date.now() });
      return result;
    }

    async function updateTabNames() {
      if (namingRunning) return;
      if ((window as any).screenshotMode?.active) return;
      namingRunning = true;
      try {
        const { tabs, setTabTitle, setTabSSHHost, setTabContainerName, setPaneCwd, setPaneGitRoot, setPaneRemoteCwd } = useTabPaneStore.getState();
        for (const tab of tabs) {
          const focusedNode = findNode(tab.paneRoot, tab.focusedPaneId);
          const sessionId = focusedNode?.type === "terminal"
            ? focusedNode.sessionId
            : collectSessionIds(tab.paneRoot)[0];
          if (!sessionId) continue;
          const ctx = await vapor.pty.getContext(sessionId);
          if (!ctx) continue;

          setPaneCwd(sessionId, ctx.cwd);
          if (ctx.remoteCwd) {
            setPaneRemoteCwd(sessionId, ctx.remoteCwd);
          }

          const gitRoot = await resolveGitRoot(ctx.cwd);
          if (gitRoot) setPaneGitRoot(sessionId, gitRoot);

          const { pinnedHosts } = useTabPaneStore.getState();
          if (!pinnedHosts[tab.id]) {
            let sshHost = "";
            if (ctx.remoteHost) {
              sshHost = ctx.remoteHost;
            } else if (ctx.processName === "ssh") {
              const m = ctx.command.match(/ssh\s+.*?(?:\S+@)?(\S+)$/);
              if (m) sshHost = m[1];
            }
            setTabSSHHost(tab.id, sshHost);
            setTabContainerName(tab.id, ctx.containerName || "");
          }

          if (tab.hasCustomTitle) continue;
          const name = await vapor.tabNamer.suggest(ctx);
          if (name) setTabTitle(tab.id, name);
        }
      } finally {
        namingRunning = false;
      }
    }

    function debouncedUpdateTabNames() {
      if (namingDebounce) clearTimeout(namingDebounce);
      namingDebounce = setTimeout(updateTabNames, 300);
    }

    vapor.tabNamer.available().then((ok) => {
      if (!ok) return;
      namingInterval = setInterval(updateTabNames, 5000);
    });

    const cleanupOutput = vapor.pty.onOutput(debouncedUpdateTabNames);

    const cleanupStateUpdated = vapor.pty.onStateUpdated((state) => {
      const { setSessionState } = useTabPaneStore.getState();
      setSessionState(state.sessionId, state);
    });

    return () => {
      cleanupOutput();
      cleanupStateUpdated();
      if (namingInterval) clearInterval(namingInterval);
      if (namingDebounce) clearTimeout(namingDebounce);
    };
  }, []);
}
