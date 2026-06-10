// @vitest-environment node

import { describe, expect, it } from "vitest";
import { sanitizeText, sanitizeSegments } from "../electron/sanitizer";

describe("sanitizeText", () => {
  it("returns empty for empty input", () => {
    expect(sanitizeText("", "VS Code")).toBe("");
  });

  it("preserves normal Chinese text", () => {
    const result = sanitizeText("今天讨论了项目进度和下周的排期安排", "微信");
    expect(result).toContain("今天讨论了项目进度");
  });

  it("tags with app context", () => {
    const result = sanitizeText("搜索了番茄钟 app 推荐", "Chrome");
    expect(result).toMatch(/^\[Chrome\]/);
  });

  it("removes OpenAI API keys", () => {
    const result = sanitizeText("key is sk-abc123def456ghi789jkl012mno345", "Terminal");
    expect(result).not.toContain("sk-abc123");
    expect(result).toContain("[REDACTED]");
  });

  it("removes password patterns", () => {
    const result = sanitizeText("password=MyS3cretP@ss!", "Terminal");
    expect(result).not.toContain("MyS3cretP@ss");
  });

  it("removes sensitive URL parameters", () => {
    const result = sanitizeText("fetching from api?token=abc123&user=me", "Chrome");
    expect(result).not.toContain("token=abc123");
  });

  it("removes file paths", () => {
    const result = sanitizeText("opening /Users/ming/.ssh/id_rsa", "Terminal");
    expect(result).not.toContain("/Users/ming/.ssh");
    expect(result).toContain("[PATH]");
  });

  it("filters high-symbol-ratio code noise", () => {
    const result = sanitizeText("() => { && || ?? ?. :: => [] {} ++ -- !== === }", "VS Code");
    expect(result).toBe("");
  });

  it("keeps mixed content with code and text", () => {
    const result = sanitizeText("搜索了 react hook 用法\nconst x = () => {};\n发现 useReducer 更适合", "Chrome");
    expect(result).toContain("搜索了 react hook 用法");
  });
});

describe("sanitizeSegments", () => {
  it("combines multiple segments", () => {
    const segments = [
      { typedText: "写了一个表单验证组件", primaryApp: "VS Code" },
      { typedText: "搜索了 zod schema 用法", primaryApp: "Chrome" },
    ];
    const result = sanitizeSegments(segments);
    expect(result).toContain("[VS Code]");
    expect(result).toContain("[Chrome]");
  });

  it("skips empty segments", () => {
    const segments = [
      { typedText: "", primaryApp: "VS Code" },
      { typedText: "聊天内容", primaryApp: "微信" },
    ];
    const result = sanitizeSegments(segments);
    expect(result).not.toContain("[VS Code]");
    expect(result).toContain("[微信]");
  });
});
