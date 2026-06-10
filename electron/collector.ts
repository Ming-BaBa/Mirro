export function sanitizeWindowTitle(title: string): string {
  if (!title) return "";
  return title.trim().slice(0, 50);
}

const BROWSER_APPS = ["Google Chrome", "Chrome", "Safari", "Firefox", "Edge", "Arc", "Brave", "Opera"];

export function isBrowser(appName: string): boolean {
  return BROWSER_APPS.some(b => appName.toLowerCase().includes(b.toLowerCase()));
}

const KNOWN_SITES: Record<string, string> = {
  "github": "github.com",
  "gitlab": "gitlab.com",
  "bitbucket": "bitbucket.org",
  "stackoverflow": "stackoverflow.com",
  "youtube": "youtube.com",
  "twitter": "twitter.com",
  "x": "x.com",
  "facebook": "facebook.com",
  "instagram": "instagram.com",
  "reddit": "reddit.com",
  "linkedin": "linkedin.com",
  "gmail": "mail.google.com",
  "google docs": "docs.google.com",
  "google sheets": "sheets.google.com",
  "google slides": "slides.google.com",
  "google drive": "drive.google.com",
  "google calendar": "calendar.google.com",
  "google meet": "meet.google.com",
  "slack": "slack.com",
  "discord": "discord.com",
  "notion": "notion.so",
  "figma": "figma.com",
  "linear": "linear.app",
  "jira": "atlassian.net",
  "confluence": "atlassian.net",
  "canva": "canva.com",
  "zoom": "zoom.us",
  "spotify": "spotify.com",
  "netflix": "netflix.com",
  "amazon": "amazon.com",
  "chatgpt": "chat.openai.com",
  "claude": "claude.ai",
  "copilot": "github.com",
  "vercel": "vercel.com",
  "docker": "docker.com",
  "npm": "npmjs.com",
  "pypi": "pypi.org",
  "Stack Overflow": "stackoverflow.com",
};

export function extractDomainsFromTitle(title: string): string[] {
  const domains: string[] = [];

  // Add browser patterns
  for (const browser of BROWSER_APPS) {
    if (title.includes(browser)) {
      domains.push(browser.toLowerCase().replace(/\s/g, "-"));
    }
  }

  // Extract literal URL patterns
  const urlPattern = /\b(\w+\.(?:com|org|net|io|dev|app|co|cn|ai))\b/gi;
  const matches = title.matchAll(urlPattern);
  for (const m of matches) {
    domains.push(m[1].toLowerCase());
  }

  // Infer domain from site name in the title prefix (strip browser suffix first)
  let sitePart = title;
  for (const browser of BROWSER_APPS) {
    const idx = sitePart.lastIndexOf(browser);
    if (idx > 0) {
      sitePart = sitePart.slice(0, idx).trim().replace(/\s*[-–—]\s*$/, "");
      break;
    }
  }

  // Check for known site names in the title prefix
  const lowerSite = sitePart.toLowerCase();
  for (const [key, domain] of Object.entries(KNOWN_SITES)) {
    if (lowerSite.includes(key.toLowerCase())) {
      domains.push(domain);
    }
  }

  return [...new Set(domains)];
}

export function buildTimeRange(date: Date): string {
  const hour = date.getUTCHours();
  const minute = date.getUTCMinutes();
  const floorMin = Math.floor(minute / 30) * 30;
  const endMin = floorMin + 30;
  const endHour = endMin >= 60 ? hour + 1 : hour;
  const fm = (f: number) => String(f).padStart(2, "0");
  return `${fm(hour)}:${fm(floorMin)}-${fm(endHour >= 24 ? 0 : endHour)}:${fm(endMin >= 60 ? endMin - 60 : endMin)}`;
}

export type CollectorState = {
  currentApp: string;
  currentTitle: string;
  currentDomains: string[];
  inputChars: number;
  deleteCount: number;
  typedText: string;
  segmentStart: Date;
  lastActive: Date;
  trackingEnabled: boolean;
};

export function createCollectorState(): CollectorState {
  const now = new Date();
  return {
    currentApp: "",
    currentTitle: "",
    currentDomains: [],
    inputChars: 0,
    deleteCount: 0,
    typedText: "",
    segmentStart: now,
    lastActive: now,
    trackingEnabled: true
  };
}
