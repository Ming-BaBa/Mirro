// uiohook-napi on macOS returns Linux evdev keycodes (not USB HID)
// Mapping: evdev keycode → US-keyboard character

const NORMAL_MAP: Record<number, string> = {
  // Top letter row
  16: "q", 17: "w", 18: "e", 19: "r", 20: "t", 21: "y", 22: "u", 23: "i", 24: "o", 25: "p",
  // Home row
  30: "a", 31: "s", 32: "d", 33: "f", 34: "g", 35: "h", 36: "j", 37: "k", 38: "l",
  // Bottom row
  44: "z", 45: "x", 46: "c", 47: "v", 48: "b", 49: "n", 50: "m",
  // Numbers
  2: "1", 3: "2", 4: "3", 5: "4", 6: "5", 7: "6", 8: "7", 9: "8", 10: "9", 11: "0",
  // Symbols
  12: "-", 13: "=",
  26: "[", 27: "]",
  39: ";", 40: "'",
  41: "`",
  43: "\\",
  51: ",", 52: ".", 53: "/",
  // Space
  57: " ",
};

const SHIFT_MAP: Record<number, string> = {
  // Numbers → symbols
  2: "!", 3: "@", 4: "#", 5: "$", 6: "%", 7: "^", 8: "&", 9: "*", 10: "(", 11: ")",
  // Symbol shifts
  12: "_", 13: "+",
  26: "{", 27: "}",
  39: ":", 40: "\"",
  41: "~",
  43: "|",
  51: "<", 52: ">", 53: "?",
};

export function keycodeToChar(keycode: number, shift: boolean): string | null {
  if (shift && SHIFT_MAP[keycode]) return SHIFT_MAP[keycode];
  if (NORMAL_MAP[keycode]) {
    const ch = NORMAL_MAP[keycode];
    return shift ? ch.toUpperCase() : ch;
  }
  return null;
}
