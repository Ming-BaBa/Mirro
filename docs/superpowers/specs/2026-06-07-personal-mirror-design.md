# Personal Mirror Design Spec

Date: 2026-06-07

## Goal

A local-first desktop app that silently tracks computer activity (window switches, input stats, browsing domains) and generates a daily "character card" — a growing self-portrait built from digital traces. The system and the user discover who the user is, together.

Not a productivity tool. Not a surveillance tool. A mirror.

## Scope

### Desktop-Only (v1)

Track computer activity only. No mobile, no cloud, no accounts.

### What Gets Tracked

| Dimension | Collected | NOT Collected |
|-----------|-----------|---------------|
| Window activity | Foreground app name, window title (first 50 chars), duration | Screenshots, window content |
| Input stats | Characters typed, characters deleted, enter key count, typing rhythm | Actual keystroke content |
| Browsing | Domain, page title, dwell time | Full URL, page content, form input |
| Time segments | Hour-by-hour activity buckets | — |

### Explicitly Excluded

- No clipboard content (only "copy happened" boolean)
- No keystroke content
- No full URLs
- No screenshots, no camera, no microphone
- No network sync, no accounts, no cloud
- No mobile companion app

### Future Iteration

Data model reserves an import interface for future mobile data ingestion. The portrait will eventually be complete.

## The Growing Portrait

### Core Mechanism

The system maintains a "User Portrait" JSON that grows over time. Every day, after generating the daily card, the AI has permission to update this portrait.

```
Day 1:  { basicRhythm: "night owl", coreTools: ["VS Code", "Chrome"] }
Day 7:  { basicRhythm: "night owl, peak before noon", coreTools: [...], 
          patterns: "fragments after 2h continuous work" }
Day 30: { full rhythm curve, tool preferences, procrastination triggers,
          peak windows, recurring themes, self-consistency score }
```

### Three Relationship Stages

The portrait's completeness determines AI's tone and authority:

| Stage | Portrait State | Tone | Permission |
|-------|---------------|------|------------|
| Observer (Day 1-7) | Fragments | Statement, no judgment | "You spent 6h in Chrome yesterday" |
| Familiar (Day 8-21) | Clear outline | Comparative, references history | "You said last week you'd cut down on Twitter, yesterday you spent 3h there" |
| Intimate (Day 22+) | Precise | Push, gives suggestions | "Based on what I know, 2pm is your most vulnerable hour. Consider..." |

Stage transitions are automatic based on data volume + behavioral consistency. AI can recommend regression if confidence drops.

The user can pause progression, freeze the portrait, or delete dimensions at any time.

## Daily Character Card

### Card Structure

Each card has fixed sections:

1. **Role Name** — AI-given code name (5-12 characters, e.g., "四处张望的猫")
2. **Behavior Sketch** — 200-400 words, naturalist tone. AI decides length based on how much happened yesterday
3. **New Puzzle Piece** — "我们今天对自己多了解了一点：..." (mutual discovery framing)
4. **Stage-Appropriate Feedback** — Statement / Comparison / Suggestion, depending on stage
5. **Confidence** — 0-1 score. Below 0.5, card displays "今天的数据比较模糊"

### Delivery

- **Morning Report** (required): Fixed-time push every morning, like checking yesterday's weather
- **Random Nudge** (optional, user-toggleable): Occasional afternoon check-in. Frequency: occasional / rare / off

## AI Pipeline

### System Prompt (Fixed)

```
你是一个数字自然学家。你在观察一个人类在电脑前的数字痕迹。
你的任务不是监控，而是理解。
你的语气像写田野观察日记——好奇、准确、不评判。
你永远不恭维、不说废话、不假装了解你不知道的东西。
你的知识来源仅限于提供给你的行为数据，你不推测数据之外的事。
当你不确定时，你直接说"这部分数据不足以判断"。

你不是在观察一个已知的对象。用户自己对"自己是什么样的人"也只有碎片。
你和他一起发现。你发现的部分用"我们"来表述。
```

### Daily Card Generation (Triggered Once Per Day)

**Input:** Yesterday's behavior summary + current portrait JSON + current stage

**Behavior Summary Format (compressed from raw logs):**
```
Time Range  | Primary App  | Input(chars) | Delete Rate | Browsing Domains
08:30-09:00 | WeChat       | 320          | 8%          | -
09:00-11:30 | VS Code      | 2100         | 22%         | stackoverflow.com(3)
11:30-12:00 | Chrome       | 80           | 5%          | twitter.com, bilibili.com
...
```

**Output:** Structured JSON with `roleName`, `sketch`, `newPuzzle`, `feedback`, `confidence`

### Portrait Update (Same LLM Call, Follows Card Generation)

AI receives the card it just generated + current portrait, decides whether to update:

```json
{
  "additions": [{"dimension": "afternoon self-control", "observation": "delete rate spikes after 4pm"}],
  "modifications": [{"dimension": "peak hours", "updatedTo": "9-11am (confirmed 3 consecutive days)"}],
  "removals": ["previous 'low morning efficiency' — not supported by recent week"],
  "stageRecommendation": "stay" | "advance" | "regress"
}
```

Portrait dimensions are NOT predefined. AI decides what dimensions to add and what outdated judgments to remove. This is how the puzzle "grows itself."

### Stage Transition Logic

- `confidence` below 0.4 for 3 consecutive days → AI recommends regression
- Portrait received no new dimensions for 7 days → AI flags "my understanding of you seems to have stalled"
- Manual stage freeze/lock available in settings

## Data Privacy & User Control

### Storage

- All data stored locally: `~/Documents/PersonalMirror/`
- One SQLite file for raw logs + portrait + card history
- One Markdown folder for human-readable card archive

### What The User Can Do

| Action | How |
|--------|-----|
| Pause/resume tracking | Tray menu toggle |
| Preview today's collected data | Settings panel |
| Delete any day's data | Card detail page, deletes both card + raw logs |
| Remove any portrait dimension | Portrait panel, click to remove |
| Full wipe | Settings panel, back to new user state |
| Export/import portrait | JSON export, reserves future cross-device import interface |

### Privacy Red Lines

- No clipboard content stored (only copy-event boolean)
- No keystroke content stored (only character count, delete rate, typing rhythm)
- Browsing: domain only, no full URL, no page content
- Window: app name + first 50 chars of title (strip potentially sensitive file paths)
- LLM API calls: only send behavior summary + portrait, never raw logs

## UI

Two surfaces only.

### Desktop Widget (Daily Use)

- Transparent, always-on-top capsule on desktop (default: top-right, draggable)
- Collapsed state: shows today's role name in a semi-transparent pill
- Hover: brightens, signals interactivity
- Double-click: expands to full card view with scroll, history navigation, settings button

### Settings Panel (Occasional Use)

Opened from widget's settings button or tray menu:

- **API Config**: LLM API key, model selection, connection test
- **Tracking Config**: On/off, ignored apps/domains list
- **Delivery Config**: Morning report time, random nudge toggle + frequency
- **Data Management**: Preview today's collection, view portrait, export/wipe/delete

### Design Principles

- Zero presence when not needed
- Direct information when needed
- No animations, no complex interactions, no onboarding wizard

## Tech Architecture

```
┌─────────────────────────────────────┐
│          Electron Shell              │
│  ┌──────────┐  ┌─────────────────┐  │
│  │ Background │  │  Card Viewer    │  │
│  │ Collector  │  │  (transparent   │  │
│  │ (silent)   │  │   widget)       │  │
│  └─────┬──────┘  └────────┬────────┘  │
│        │                  │           │
│  ┌─────┴──────────────────┴────────┐  │
│  │     Local Storage (SQLite)       │  │
│  │  - behavior logs                 │  │
│  │  - user portrait JSON            │  │
│  │  - card history                  │  │
│  │  - settings                      │  │
│  └──────────────┬───────────────────┘  │
│                 │                      │
│  ┌──────────────┴───────────────────┐  │
│  │     AI Scheduler (cron task)     │  │
│  │  Read yesterday's data at dawn   │  │
│  │  → Call LLM API                  │  │
│  │  → Generate card → Update portrait│  │
│  │  → Save to disk                  │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────┘
```

| Module | Responsibility | Tech |
|--------|---------------|------|
| Background Collector | Monitor window switches, count input, record browsing domains | Electron main process + macOS accessibility API |
| Local Storage | Raw behavior logs, user portrait JSON, card history, settings | better-sqlite3 (sync, serverless) |
| AI Scheduler | Daily trigger, construct prompt, call LLM, parse result | node-cron + user-provided API key |
| Card Viewer | Transparent desktop widget, browse history, toggle nudge | React + transparent BrowserWindow |

## Acceptance Criteria

- [ ] App launches and begins silent tracking
- [ ] Tracking covers: foreground app, window title, input stats (chars typed/deleted), browsing domains
- [ ] No keystroke content, no clipboard content, no full URLs are ever stored
- [ ] Tray menu allows pause/resume of tracking
- [ ] Every morning at user-set time, a character card is generated via LLM API
- [ ] Card includes: role name, behavior sketch, new puzzle piece, stage-appropriate feedback, confidence score
- [ ] User portrait JSON grows over time — AI adds, modifies, and removes dimensions
- [ ] Relationship stage auto-advances/regresses based on portrait completeness and confidence
- [ ] Desktop widget shows collapsed role name, expands to full card on double-click
- [ ] Widget can navigate through card history
- [ ] Settings panel: configure API key, model, tracking exclusions, delivery time, nudge toggle
- [ ] User can preview today's collected data, delete any day, remove portrait dimensions, full wipe
- [ ] Random nudge is toggleable and respects frequency setting
- [ ] All data stays local, no network calls except LLM API
- [ ] Export function produces JSON that future mobile import can consume
