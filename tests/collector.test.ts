import { describe, expect, it } from "vitest";
import { sanitizeWindowTitle, extractDomainsFromTitle, buildTimeRange } from "../electron/collector";

describe("sanitizeWindowTitle", () => {
  it("truncates to 50 characters", () => {
    const long = "a".repeat(80);
    expect(sanitizeWindowTitle(long).length).toBeLessThanOrEqual(50);
  });

  it("removes leading/trailing whitespace", () => {
    expect(sanitizeWindowTitle("  hello  ")).toBe("hello");
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeWindowTitle("")).toBe("");
  });
});

describe("extractDomainsFromTitle", () => {
  it("detects common browser patterns", () => {
    const result = extractDomainsFromTitle("Google Chrome");
    expect(result).toContain("google-chrome");
  });

  it("extracts domain from browser window titles", () => {
    const title = "GitHub - Issues - Google Chrome";
    const result = extractDomainsFromTitle(title);
    expect(result).toContain("github.com");
  });

  it("returns empty array for non-browser titles", () => {
    const result = extractDomainsFromTitle("VS Code - project");
    expect(result).toEqual([]);
  });
});

describe("buildTimeRange", () => {
  it("formats time range from a Date", () => {
    const d = new Date("2026-06-07T09:30:00Z");
    const range = buildTimeRange(d);
    expect(range).toMatch(/^\d{2}:\d{2}-\d{2}:\d{2}$/);
  });

  it("handles hour boundary correctly", () => {
    const d = new Date("2026-06-07T09:45:00Z");
    const range = buildTimeRange(d);
    expect(range).toBe("09:30-10:00");
  });
});
