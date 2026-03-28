import { Hero } from "@/components/Hero";
import { Features } from "@/components/Features";
import { FeatureDetail } from "@/components/FeatureDetail";
import { TechStack } from "@/components/TechStack";
import { Download } from "@/components/Download";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <main className="min-h-screen relative">
      <div id="hero-section">
        <Hero />
      </div>

      <div id="features-section">
        <Features />
      </div>

      {/* Frosted glass overlay that fades in after features - Desktop */}
      <div
        className="absolute left-0 right-0 pointer-events-none hidden lg:block"
        style={{
          top: 'calc(100vh + 1100px)',
          bottom: 0,
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 200px)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 200px)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.45)',
          }}
        />
      </div>

      {/* Tablet blur overlay */}
      <div
        className="absolute left-0 right-0 pointer-events-none hidden md:block lg:hidden"
        style={{
          top: 'calc(100vh + 1600px)',
          bottom: 0,
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 200px)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 200px)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.45)',
          }}
        />
      </div>

      {/* Mobile blur overlay - starts lowest */}
      <div
        className="absolute left-0 right-0 pointer-events-none md:hidden"
        style={{
          top: 'calc(100vh + 1900px)',
          bottom: 0,
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 200px)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 200px)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.45)',
          }}
        />
      </div>

      <div className="relative z-10">
      <FeatureDetail
        title="Split panes"
        description="Cmd+D splits horizontal, Cmd+Shift+D splits vertical. You can stack three SSH sessions next to a log tail, or put an editor pane beside two shells — whatever makes sense for what you're doing. Drag the borders to resize."
        imageSide="left"
        imageAlt="Split panes demonstration"
        imageKey="split-panes-hq"
      />

      <FeatureDetail
        title="Tabs name themselves"
        description="Open a terminal in a git repo and the tab shows the repo name. SSH somewhere, it shows the remote directory with the hostname as a green badge. Docker containers get a blue badge. Double-click any tab to override with your own name."
        imageSide="right"
        imageAlt="Smart tab naming with context detection"
        imageKey="ssh-hq"
      />

      <FeatureDetail
        title="Quick connect"
        description="Right-click the + button and pick a host from your SSH config or a running Docker container. The new tab locks to that connection — every pane you split auto-connects there. A lock icon on the badge tells you at a glance which tabs are pinned."
        imageSide="left"
        imageAlt="Host selection dropdown with SSH and Docker hosts"
        imageKey="host-dropdown-hq"
      />

      <FeatureDetail
        title="Monaco editor"
        description="Click a file in the sidebar and it opens in an editor pane next to your shell. Or type 'vpr <file>' to open it from the command line. It's the same engine as VS Code — syntax highlighting, file tabs, unsaved-change indicator. Cmd+S writes to disk."
        imageSide="right"
        imageAlt="Built-in Monaco editor"
        imageKey="file-editor-hq"
      />

      <FeatureDetail
        title="File tree"
        description="Cmd+B opens it. Finds your git root automatically and starts there. Pin a folder if you want. File changes on disk show up without refreshing, and node_modules and .git are hidden by default."
        imageSide="left"
        imageAlt="File sidebar with git root detection"
        imageKey="file-explorer-hq"
      />

      <TechStack />

      <Download />

      <Footer />
      </div>
    </main>
  );
}
