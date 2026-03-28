import { ErrorBoundary as ReactErrorBoundary } from "react-error-boundary";

function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        width: "100%",
        gap: 12,
        padding: 24,
        background: "var(--bg-surface)",
        backdropFilter: "blur(20px)",
        color: "var(--text-secondary)",
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--danger, #FF3B30)" }}>
        Something went wrong
      </span>
      <span
        style={{
          fontSize: 11,
          color: "var(--text-dim)",
          maxWidth: 320,
          textAlign: "center",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {error.message}
      </span>
      <button onClick={resetErrorBoundary} className="btn-secondary" style={{ padding: "4px 12px", fontSize: 11 }}>
        Retry
      </button>
    </div>
  );
}

export function PaneErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ReactErrorBoundary FallbackComponent={ErrorFallback}>
      {children}
    </ReactErrorBoundary>
  );
}

export function AppErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ReactErrorBoundary FallbackComponent={ErrorFallback}>
      {children}
    </ReactErrorBoundary>
  );
}
