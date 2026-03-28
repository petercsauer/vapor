// @vitest-environment node
import { describe, it, expect } from "vitest";
import { shellEscape } from "./ssh-shell-executor";

describe("shellEscape", () => {
  it("wraps string in single quotes", () => {
    expect(shellEscape("hello")).toBe("'hello'");
  });

  it("escapes embedded single quotes", () => {
    expect(shellEscape("it's")).toBe("'it'\\''s'");
  });

  it("handles special characters that could be dangerous", () => {
    expect(shellEscape("$HOME")).toBe("'$HOME'");
    expect(shellEscape("`whoami`")).toBe("'`whoami`'");
    expect(shellEscape("$(echo test)")).toBe("'$(echo test)'");
    expect(shellEscape("; rm -rf /")).toBe("'; rm -rf /'");
  });

  it("handles newlines", () => {
    expect(shellEscape("line1\nline2")).toBe("'line1\nline2'");
  });

  it("handles backslashes", () => {
    expect(shellEscape("path\\to\\file")).toBe("'path\\to\\file'");
  });

  it("handles empty string", () => {
    expect(shellEscape("")).toBe("''");
  });

  it("handles unicode characters", () => {
    expect(shellEscape("hello 世界")).toBe("'hello 世界'");
  });

  it("escapes single quotes correctly", () => {
    // Single quotes are the only character that needs special handling
    const result = shellEscape("it's");
    // Should wrap in quotes and escape the embedded quote
    expect(result.startsWith("'")).toBe(true);
    expect(result.endsWith("'")).toBe(true);
    expect(result).toContain("\\'");
  });
});
