import { describe, expect, it } from "vitest";
import { parseJSONFromLLMResponse } from "../electron/llm";

describe("parseJSONFromLLMResponse", () => {
  it("parses clean JSON", () => {
    const result = parseJSONFromLLMResponse('{"roleName": "test", "confidence": 0.8}');
    expect(result).toEqual({ roleName: "test", confidence: 0.8 });
  });

  it("strips markdown code fences", () => {
    const result = parseJSONFromLLMResponse('```json\n{"roleName": "test"}\n```');
    expect(result).toEqual({ roleName: "test" });
  });

  it("handles text before and after JSON", () => {
    const result = parseJSONFromLLMResponse('Here: {"roleName": "test", "confidence": 0.5} Done.');
    expect(result).toEqual({ roleName: "test", confidence: 0.5 });
  });

  it("throws on non-JSON input", () => {
    expect(() => parseJSONFromLLMResponse("no json here")).toThrow();
  });
});
