import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TabChrome } from "./TabChrome";

describe("TabChrome", () => {
  const defaultProps = {
    isActive: false,
    onClick: vi.fn(),
    onClose: vi.fn(),
  };

  it("renders children content", () => {
    render(
      <TabChrome {...defaultProps}>
        <span>Test Title</span>
      </TabChrome>,
    );
    expect(screen.getByText("Test Title")).toBeDefined();
  });

  it("fires onClick when container is clicked", () => {
    const onClick = vi.fn();
    render(
      <TabChrome {...defaultProps} onClick={onClick}>
        <span>Tab</span>
      </TabChrome>,
    );
    fireEvent.click(screen.getByText("Tab"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("fires onClose when close button is clicked without triggering onClick", () => {
    const onClick = vi.fn();
    const onClose = vi.fn();
    render(
      <TabChrome {...defaultProps} onClick={onClick} onClose={onClose}>
        <span>Tab</span>
      </TabChrome>,
    );
    const closeBtn = screen.getByText("\u00d7");
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("fires onDoubleClick when container is double-clicked", () => {
    const onDoubleClick = vi.fn();
    render(
      <TabChrome {...defaultProps} onDoubleClick={onDoubleClick}>
        <span>Tab</span>
      </TabChrome>,
    );
    fireEvent.doubleClick(screen.getByText("Tab"));
    expect(onDoubleClick).toHaveBeenCalledTimes(1);
  });

  it("close button is visible when isActive", () => {
    render(
      <TabChrome {...defaultProps} isActive={true}>
        <span>Active Tab</span>
      </TabChrome>,
    );
    const closeBtn = screen.getByText("\u00d7");
    expect(closeBtn.style.opacity).toBe("1");
  });

  it("close button is hidden when inactive and not hovered", () => {
    render(
      <TabChrome {...defaultProps} isActive={false}>
        <span>Idle Tab</span>
      </TabChrome>,
    );
    const closeBtn = screen.getByText("\u00d7");
    expect(closeBtn.style.opacity).toBe("0");
  });

  it("close button becomes visible on hover", () => {
    render(
      <TabChrome {...defaultProps} isActive={false}>
        <span>Hoverable</span>
      </TabChrome>,
    );
    const container = screen.getByText("Hoverable").closest("div")!;
    fireEvent.mouseEnter(container);
    const closeBtn = screen.getByText("\u00d7");
    expect(closeBtn.style.opacity).toBe("1");
  });

  it("hideClose prop forces close button hidden even when active", () => {
    render(
      <TabChrome {...defaultProps} isActive={true} hideClose={true}>
        <span>Editing</span>
      </TabChrome>,
    );
    const closeBtn = screen.getByText("\u00d7");
    expect(closeBtn.style.opacity).toBe("0");
  });

  it("highlighted prop applies accent background", () => {
    render(
      <TabChrome {...defaultProps} highlighted={true}>
        <span>Nav Selected</span>
      </TabChrome>,
    );
    const container = screen.getByText("Nav Selected").closest("div")!;
    expect(container.style.background).toBe("var(--accent-bg)");
  });

  it("active tab gets primary text color and strong background", () => {
    render(
      <TabChrome {...defaultProps} isActive={true}>
        <span>Active</span>
      </TabChrome>,
    );
    const container = screen.getByText("Active").closest("div")!;
    expect(container.style.color).toBe("var(--text-primary)");
    expect(container.style.background).toBe("var(--bg-strong)");
  });
});
