// Local rule-based sanitizer for typedText before sending to external LLM.
// No external API calls. All processing is pure string matching.

const TOKEN_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/g,           // OpenAI
  /ghp_[a-zA-Z0-9]{36}/g,           // GitHub
  /xox[bpras]-[a-zA-Z0-9-]{10,}/g,  // Slack
  /AKIA[A-Z0-9]{16}/g,              // AWS
  /AIza[A-Za-z0-9_-]{35}/g,         // Google API
  /[a-f0-9]{32,}/gi,                // Long hex (API keys, hashes)
  /[A-Za-z0-9+/=]{40,}/g,           // Base64 blobs
];

const PASSWORD_PATTERNS = [
  /(?:password|passwd|pwd|secret|token|api_?key|access_?key|private_?key)\s*[:=]\s*\S+/gi,
  /(?:Bearer|Basic|Authorization)\s+\S+/gi,
];

const URL_PARAM_PATTERN = /[?&](?:token|key|secret|password|api_key|access_token|session|auth)=[^&\s]+/gi;

const PATH_PATTERNS = [
  /(?:\/Users|\/home|C:\\Users)\/[^\s]+/g,
  /(?:\/tmp|\/var|\/etc)\/[^\s]*/g,
];

function isHighSymbolRatio(text: string, threshold = 0.6): boolean {
  if (text.length < 10) return false;
  const symbols = text.replace(/[a-zA-Z0-9\s一-鿿]/g, "").length;
  return symbols / text.length > threshold;
}

export function sanitizeText(raw: string, appName: string): string {
  if (!raw || raw.trim().length === 0) return "";

  let cleaned = raw;

  // Remove tokens/API keys
  for (const pattern of TOKEN_PATTERNS) {
    cleaned = cleaned.replace(pattern, "[REDACTED]");
  }

  // Remove password patterns
  for (const pattern of PASSWORD_PATTERNS) {
    cleaned = cleaned.replace(pattern, "[REDACTED]");
  }

  // Remove sensitive URL parameters
  cleaned = cleaned.replace(URL_PARAM_PATTERN, "");

  // Remove file paths
  for (const pattern of PATH_PATTERNS) {
    cleaned = cleaned.replace(pattern, "[PATH]");
  }

  // Split into lines, filter code noise, keep semantic content
  const lines = cleaned.split("\n");
  const kept: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    if (isHighSymbolRatio(trimmed)) continue;
    if (trimmed.length < 2) continue;
    kept.push(trimmed);
  }

  const result = kept.join(" ").replace(/\s+/g, " ").trim();

  if (result.length === 0) return "";

  // Tag with app context
  return `[${appName}] ${result}`;
}

export function sanitizeSegments(
  segments: { typedText?: string; primaryApp: string }[]
): string {
  const parts: string[] = [];

  for (const seg of segments) {
    if (!seg.typedText || seg.typedText.trim().length === 0) continue;
    const sanitized = sanitizeText(seg.typedText, seg.primaryApp);
    if (sanitized) parts.push(sanitized);
  }

  return parts.join("\n");
}
