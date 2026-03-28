import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PaneErrorBoundary, AppErrorBoundary } from "./ErrorBoundary";

function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("Test render error");
  return <div>Healthy content</div>;
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {
    // Suppress console.error in tests
  });
});

describe("PaneErrorBoundary", () => {
  it("renders children when no error", () => {
    render(
      <PaneErrorBoundary>
        <div>Child content</div>
      </PaneErrorBoundary>,
    );
    expect(screen.getByText("Child content")).toBeDefined();
  });

  it("shows fallback UI when child throws", () => {
    render(
      <PaneErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </PaneErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong")).toBeDefined();
    expect(screen.getByText("Test render error")).toBeDefined();
  });

  it("shows retry button in fallback", () => {
    render(
      <PaneErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </PaneErrorBoundary>,
    );
    expect(screen.getByText("Retry")).toBeDefined();
  });

  it("retry button resets the error boundary", () => {
    let shouldThrow = true;
    function Toggleable() {
      if (shouldThrow) throw new Error("Transient error");
      return <div>Recovered</div>;
    }

    render(
      <PaneErrorBoundary>
        <Toggleable />
      </PaneErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong")).toBeDefined();

    shouldThrow = false;
    fireEvent.click(screen.getByText("Retry"));
    expect(screen.getByText("Recovered")).toBeDefined();
  });
});

describe("AppErrorBoundary", () => {
  it("renders children when no error", () => {
    render(
      <AppErrorBoundary>
        <div>App content</div>
      </AppErrorBoundary>,
    );
    expect(screen.getByText("App content")).toBeDefined();
  });

  it("catches render errors and shows fallback", () => {
    render(
      <AppErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </AppErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong")).toBeDefined();
    expect(screen.getByText("Test render error")).toBeDefined();
  });
});
