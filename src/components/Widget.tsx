import { useCallback, useEffect, useRef, useState } from "react";
import { useCards, useSettings } from "../hooks/useIpc";
import characterIdle from "../assets/character-idle.png";
import characterCrying from "../assets/character-crying.png";
import characterEnter from "../assets/character-enter.png";
import characterT from "../assets/character-t.png";
import characterY from "../assets/character-y.png";
import characterER from "../assets/character-er.png";
import characterZXASDC from "../assets/character-zxasdc.png";
import characterSVG from "../assets/character-svg.png";
import characterControl from "../assets/character-control.png";
import characterSpace from "../assets/character-space.png";
import characterBNH from "../assets/character-bnh.png";
import characterJKLM from "../assets/character-jklm.png";
import characterTired from "../assets/character-tired.png";
import characterQW from "../assets/character-qw.png";
import characterIdle2 from "../assets/character-idle2.png";
import characterEat from "../assets/character-eat.png";

const LOCKED_SVG = `<svg width="16" height="16" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="22" width="36" height="22" rx="2" fill="#333" stroke="#333" stroke-width="4" stroke-linejoin="round"/><path d="M14 22V14C14 8.47715 18.4772 4 24 4C29.5228 4 34 8.47715 34 14V22" stroke="#333" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 30V36" stroke="#FFF" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const UNLOCKED_SVG = `<svg width="16" height="16" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="7" y="22.0476" width="34" height="22" rx="2" fill="#333" stroke="#333" stroke-width="4" stroke-linejoin="round"/><path d="M14 22V14.0047C13.9948 8.87022 17.9227 4.56718 23.0859 4.05117C28.249 3.53516 32.9673 6.97408 34 12.0059" stroke="#333" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 30V36" stroke="#FFF" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export function Widget() {
  const { cards, loading, refresh } = useCards(30);
  const { settings, updateSettings } = useSettings();
  const latestCard = cards[0];
  const dragRef = useRef({ dragging: false, sx: 0, sy: 0, wx: 0, wy: 0 });
  const [keystrokeBuf, setKeystrokeBuf] = useState("");
  const [tracking, setTracking] = useState(true);
  const [nudgeText, setNudgeText] = useState("");
  const [showCharMenu, setShowCharMenu] = useState(false);
  const [charState, setCharState] = useState<"idle" | "crying" | "enter" | "t" | "y" | "er" | "zxasdc" | "svg" | "control" | "space" | "bnh" | "jklm" | "tired" | "qw" | "idle2" | "eat">("idle");
  const cryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [enterKey, setEnterKey] = useState(0);
  const enterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tiredTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tiredAutoWakeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keystrokeCountRef = useRef(0);
  const idle2TimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const capsuleWidth = settings?.capsuleWidth ?? 220;
  const characterHeight = settings?.characterHeight ?? 90;
  const locked = settings?.widgetLocked ?? false;
  const maxChars = Math.max(6, Math.floor((capsuleWidth - 80) / 7.5));

  useEffect(() => {
    if (settings) setTracking(settings.trackingEnabled);
  }, [settings?.trackingEnabled]);

  useEffect(() => {
    window.mirro.setWidgetAppearance({ capsuleWidth, characterHeight });
  }, [capsuleWidth, characterHeight]);

  useEffect(() => {
    const unsub1 = window.mirro.onTrackingToggle((enabled: boolean) => {
      setTracking(enabled);
    });
    const unsub2 = window.mirro.onCardNew(() => refresh());
    const unsub3 = window.mirro.onKeystroke((char: string) => {
      setKeystrokeBuf(prev => {
        const display = char === "\b" ? " ⌫ " : char === "\n" ? " ⏎ " : char;
        const next = prev + display;
        return next.length > maxChars ? next.slice(-maxChars) : next;
      });
    });
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [refresh, maxChars]);

  useEffect(() => {
    const unsub = window.mirro.onNudge((msg: string) => {
      setNudgeText(msg);
      setTimeout(() => setNudgeText(""), 5000);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!showCharMenu) return;
    const onClick = () => setShowCharMenu(false);
    const timer = setTimeout(() => document.addEventListener("click", onClick), 0);
    return () => { clearTimeout(timer); document.removeEventListener("click", onClick); };
  }, [showCharMenu]);

  // Modifier key animations via separate channel
  useEffect(() => {
    const unsub = window.mirro.onKeystrokeAnim((anim: string) => {
      if (anim === "control") {
        setCharState("control");
        setEnterKey(k => k + 1);
        if (animTimerRef.current) clearTimeout(animTimerRef.current);
        animTimerRef.current = setTimeout(() => {
          setCharState("idle");
          animTimerRef.current = null;
        }, 249);
      } else if (anim === "space") {
        setCharState("space");
        setEnterKey(k => k + 1);
        if (animTimerRef.current) clearTimeout(animTimerRef.current);
        animTimerRef.current = setTimeout(() => {
          setCharState("idle");
          animTimerRef.current = null;
        }, 249);
      }
    });
    return unsub;
  }, []);

  // Backspace → crying, Enter → enter, T → t anim, Y → y anim
  useEffect(() => {
    const unsub = window.mirro.onKeystroke((char: string) => {
      console.log("[widget] keystroke:", JSON.stringify(char));
      // Any typing resets idle2 timer and wakes from idle2/eat
      if (idle2TimerRef.current) clearTimeout(idle2TimerRef.current);
      setCharState(prev => (prev === "idle2" || prev === "eat") ? "idle" : prev);
      // Schedule random idle animation: 10s~5min after last keystroke
      const scheduleIdle = () => {
        const delay = 10000 + Math.random() * 290000; // 10s to 5min
        idle2TimerRef.current = setTimeout(() => {
          if (keystrokeCountRef.current > 0) return; // still typing
          const idleAnims = ["idle2", "eat"] as const;
          const pick = idleAnims[Math.floor(Math.random() * idleAnims.length)];
          setCharState(prev => prev === "idle" ? pick : prev);
          setEnterKey(k => k + 1);
          const duration = pick === "idle2" ? 4300 : 4250;
          setTimeout(() => {
            setCharState("idle");
            scheduleIdle(); // schedule next one
          }, duration);
          idle2TimerRef.current = null;
        }, delay);
      };
      scheduleIdle();

      // Typing wakes up from tired
      if (tiredAutoWakeRef.current) {
        clearTimeout(tiredAutoWakeRef.current);
        tiredAutoWakeRef.current = null;
      }
      // Track keystrokes for tired detection
      keystrokeCountRef.current++;
      if (tiredTimerRef.current) clearTimeout(tiredTimerRef.current);
      tiredTimerRef.current = setTimeout(() => {
        if (keystrokeCountRef.current >= 30) {
          setCharState("tired");
          setEnterKey(k => k + 1);
          tiredAutoWakeRef.current = setTimeout(() => {
            setCharState("idle");
            tiredAutoWakeRef.current = null;
          }, 15000);
        }
        keystrokeCountRef.current = 0;
        tiredTimerRef.current = null;
      }, 3000);

      if (char === "\b") {
        setCharState(prev => {
          if (prev === "tired") return "crying";
          return prev === "crying" ? prev : "crying";
        });
        if (cryTimerRef.current) clearTimeout(cryTimerRef.current);
        cryTimerRef.current = setTimeout(() => {
          setCharState("idle");
          cryTimerRef.current = null;
        }, 2000);
      } else if (char === "\n") {
        setCharState("enter");
        setEnterKey(k => k + 1);
        if (enterTimerRef.current) clearTimeout(enterTimerRef.current);
        enterTimerRef.current = setTimeout(() => {
          setCharState("idle");
          enterTimerRef.current = null;
        }, 777);
      } else if (char === "q" || char === "Q" || char === "w" || char === "W") {
        setCharState("qw");
        setEnterKey(k => k + 1);
        if (animTimerRef.current) clearTimeout(animTimerRef.current);
        animTimerRef.current = setTimeout(() => {
          setCharState("idle");
          animTimerRef.current = null;
        }, 166);
      } else if (char === "t" || char === "T") {
        setCharState("t");
        setEnterKey(k => k + 1);
        if (animTimerRef.current) clearTimeout(animTimerRef.current);
        animTimerRef.current = setTimeout(() => {
          setCharState("idle");
          animTimerRef.current = null;
        }, 249);
      } else if (char === "y" || char === "Y") {
        setCharState("y");
        setEnterKey(k => k + 1);
        if (animTimerRef.current) clearTimeout(animTimerRef.current);
        animTimerRef.current = setTimeout(() => {
          setCharState("idle");
          animTimerRef.current = null;
        }, 332);
      } else if (char === "e" || char === "E" || char === "r" || char === "R") {
        setCharState("er");
        setEnterKey(k => k + 1);
        if (animTimerRef.current) clearTimeout(animTimerRef.current);
        animTimerRef.current = setTimeout(() => {
          setCharState("idle");
          animTimerRef.current = null;
        }, 249);
      } else if (char === "b" || char === "B" || char === "n" || char === "N" || char === "h" || char === "H") {
        setCharState("bnh");
        setEnterKey(k => k + 1);
        if (animTimerRef.current) clearTimeout(animTimerRef.current);
        animTimerRef.current = setTimeout(() => {
          setCharState("idle");
          animTimerRef.current = null;
        }, 249);
      } else if (char === "j" || char === "J" || char === "k" || char === "K" || char === "l" || char === "L" || char === "m" || char === "M" || char === "u" || char === "U" || char === "i" || char === "I" || char === "o" || char === "O" || char === "p" || char === "P") {
        setCharState("jklm");
        setEnterKey(k => k + 1);
        if (animTimerRef.current) clearTimeout(animTimerRef.current);
        animTimerRef.current = setTimeout(() => {
          setCharState("idle");
          animTimerRef.current = null;
        }, 249);
      } else if ("zxasdcf".includes(char.toLowerCase()) && char.length === 1 && /[zxasdcf]/i.test(char)) {
        setCharState("zxasdc");
        setEnterKey(k => k + 1);
        if (animTimerRef.current) clearTimeout(animTimerRef.current);
        animTimerRef.current = setTimeout(() => {
          setCharState("idle");
          animTimerRef.current = null;
        }, 200);
      } else if (char === "s" || char === "S" || char === "v" || char === "V" || char === "g" || char === "G") {
        setCharState("svg");
        setEnterKey(k => k + 1);
        if (animTimerRef.current) clearTimeout(animTimerRef.current);
        animTimerRef.current = setTimeout(() => {
          setCharState("idle");
          animTimerRef.current = null;
        }, 249);
      } else if (char.length === 1 && /[\d!@#$%^&*()\-_=+\[\]{};:'",.<>\/?\\`~|]/.test(char)) {
        const anims = ["t", "y", "bnh", "jklm", "zxasdc", "svg", "qw"] as const;
        const pick = anims[Math.floor(Math.random() * anims.length)];
        setCharState(pick);
        setEnterKey(k => k + 1);
        if (animTimerRef.current) clearTimeout(animTimerRef.current);
        const durations: Record<string, number> = { t: 249, y: 332, bnh: 249, jklm: 249, zxasdc: 200, svg: 249, qw: 166 };
        animTimerRef.current = setTimeout(() => {
          setCharState("idle");
          animTimerRef.current = null;
        }, durations[pick] ?? 249);
      }
    });
    return unsub;
  }, []);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    if (locked) return;
    const target = e.target as HTMLElement;
    if (target.tagName === "BUTTON") return;
    e.preventDefault();
    dragRef.current = { dragging: true, sx: e.screenX, sy: e.screenY, wx: 0, wy: 0 };
    window.mirro.getWindowPosition().then(([wx, wy]) => {
      dragRef.current.wx = wx;
      dragRef.current.wy = wy;
    });
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current.dragging) return;
      window.mirro.setWindowPosition(
        dragRef.current.wx + ev.screenX - dragRef.current.sx,
        dragRef.current.wy + ev.screenY - dragRef.current.sy
      );
    };
    const onUp = () => {
      dragRef.current.dragging = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      window.mirro.snapToBounds();
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [locked]);

  const toggleLock = useCallback(async () => {
    await updateSettings({ widgetLocked: !locked });
  }, [locked, updateSettings]);

  const openCard = useCallback(() => {
    if (locked) return;
    window.mirro.openCard();
  }, [locked]);

  const openSettings = useCallback(() => {
    setShowCharMenu(false);
    window.mirro.openSettings();
  }, []);

  const openChat = useCallback(() => {
    setShowCharMenu(false);
    window.mirro.openChat();
  }, []);

  const handleCharClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowCharMenu(prev => !prev);
  }, []);

  const lockIcon = locked ? LOCKED_SVG : UNLOCKED_SVG;
  const charSrc = charState === "crying" ? characterCrying
    : charState === "enter" ? characterEnter
    : charState === "t" ? characterT
    : charState === "y" ? characterY
    : charState === "er" ? characterER
    : charState === "zxasdc" ? characterZXASDC
    : charState === "svg" ? characterSVG
    : charState === "control" ? characterControl
    : charState === "space" ? characterSpace
    : charState === "bnh" ? characterBNH
    : charState === "jklm" ? characterJKLM
    : charState === "tired" ? characterTired
    : charState === "qw" ? characterQW
    : charState === "idle2" ? characterIdle2
    : charState === "eat" ? characterEat
    : characterIdle;

  // Preload all character images
  useEffect(() => {
    [characterIdle, characterCrying, characterEnter, characterT, characterY, characterER, characterZXASDC, characterSVG, characterControl, characterSpace, characterBNH, characterJKLM, characterTired, characterQW, characterIdle2, characterEat].forEach(src => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  // Force APNG restart on each animation trigger
  const charImgRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (enterKey > 0 && charImgRef.current && charState !== "idle") {
      const el = charImgRef.current;
      const target = el.src;
      el.src = "";
      el.src = target;
    }
  }, [enterKey]);

  return (
    <div
      className="widget-shell"
      onMouseDown={locked ? undefined : onDragStart}
      onDoubleClick={locked ? undefined : openCard}
    >
      <div className="widget__character-wrap">
        <img
          ref={charImgRef}
          className={`widget__character${charState === "crying" ? " widget__character--crying" : ""}`}
          src={charSrc}
          alt=""
          style={{
            height: `${characterHeight}px`,
            ...(charState === "idle" ? { filter: "brightness(0.945) saturate(1.1) hue-rotate(-7deg)", transform: "scale(0.96)" } : {}),
            ...(charState === "er" ? { transform: "scaleX(0.97) scaleY(1.03)", transformOrigin: "bottom" } : {}),
            ...(charState === "control" ? { transform: "scale(1.05) translateX(-5px)" } : {}),
            ...(charState === "bnh" ? { transform: "scaleX(0.97) scaleY(0.95) translateY(-1px)", transformOrigin: "top" } : {}),
            ...(charState === "qw" ? { filter: "brightness(1.05)", transform: "scaleY(1.015)", transformOrigin: "top" } : {}),
            ...(charState === "space" ? { transform: "scaleX(0.96) scaleY(0.945)", transformOrigin: "top" } : {}),
            ...(charState === "zxasdc" || charState === "svg" || charState === "jklm" ? { transform: "scale(0.97) translateY(-4px)", transformOrigin: "top" } : {}),
          }}
          draggable={false}
          onClick={handleCharClick}
        />
        {showCharMenu && (
          <div className="widget__char-menu">
            <button className="widget__char-btn widget__char-btn--chat" onClick={openChat}>
              <svg width="22" height="22" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M33 38H22V30H36V22H44V38H39L36 41L33 38Z" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M4 6H36V30H17L13 34L9 30H4V6Z" fill="currentColor" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M19 18H20" stroke="#FFF" strokeWidth="4" strokeLinecap="round"/>
                <path d="M26 18H27" stroke="#FFF" strokeWidth="4" strokeLinecap="round"/>
                <path d="M12 18H13" stroke="#FFF" strokeWidth="4" strokeLinecap="round"/>
              </svg>
            </button>
            <button className="widget__char-btn widget__char-btn--settings" onClick={openSettings}>
              <svg width="22" height="22" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M24 4L18 10H10V18L4 24L10 30V38H18L24 44L30 38H38V30L44 24L38 18V10H30L24 4Z" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" fill="currentColor"/>
                <path d="M24 30C27.3137 30 30 27.3137 30 24C30 20.6863 27.3137 18 24 18C20.6863 18 18 20.6863 18 24C18 27.3137 20.6863 30 24 30Z" fill="#FFF" stroke="#FFF" strokeWidth="4" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        )}
      </div>
      <div
        className={`widget widget--collapsed${locked ? " widget--locked" : ""}`}
        style={{
          fontSize: "13px",
          padding: "6px 14px",
          width: `${capsuleWidth}px`,
          cursor: locked ? "default" : "grab",
          gap: "6px",
        }}
      >
        {tracking ? (
          <svg className="widget__play-icon" width="14" height="14" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 24V11.8756L25.5 17.9378L36 24L25.5 30.0622L15 36.1244V24Z" fill="#4cd964" stroke="#4cd964" strokeWidth="4" strokeLinejoin="round"/>
          </svg>
        ) : (
          <svg className="widget__pause-icon" width="14" height="14" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M24 44C35.0457 44 44 35.0457 44 24C44 12.9543 35.0457 4 24 4C12.9543 4 4 12.9543 4 24C4 35.0457 12.9543 44 24 44Z" fill="#e05050" stroke="#e05050" strokeWidth="4" strokeLinejoin="round"/>
            <path d="M19 18V30" stroke="#FFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M29 18V30" stroke="#FFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
        {nudgeText ? (
          <span className="widget__nudge-text">{nudgeText}</span>
        ) : (
          <span className="widget__keystroke-text">
            {keystrokeBuf || " "}
          </span>
        )}
        <button
          className="widget__lock-btn"
          onClick={toggleLock}
          dangerouslySetInnerHTML={{ __html: lockIcon }}
        />
      </div>
    </div>
  );
}
