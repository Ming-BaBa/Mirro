import { useState, useRef, useEffect, useCallback } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const MAX_CONTEXT = 20;

export function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.mirro.loadChatHistory().then(saved => {
      if (saved && saved.length > 0) {
        setMessages(saved.map(m => ({ role: m.role as "user" | "assistant", content: m.content })));
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const context = next.slice(-MAX_CONTEXT);
      const reply = await window.mirro.sendChatMessage(context);
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: `喵...出了点问题：${String(err)}` }]);
    } finally {
      setLoading(false);
    }
  }, [input, messages, loading]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }, [send]);

  return (
    <div className="chat-window">
      <div className="chat-window__titlebar">
        <span className="chat-window__title">和 Mirro 聊天</span>
        <button className="chat-window__close" onClick={() => window.close()}>✕</button>
      </div>
      <div className="chat-window__messages" ref={listRef}>
        {messages.length === 0 && (
          <div className="chat-window__empty">点击输入框和 Mirro 说说话吧~ 喵</div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`chat-window__bubble chat-window__bubble--${msg.role}`}>
            {msg.content}
          </div>
        ))}
        {loading && (
          <div className="chat-window__bubble chat-window__bubble--assistant chat-window__bubble--typing">
            <span className="chat-window__dot" />
            <span className="chat-window__dot" />
            <span className="chat-window__dot" />
          </div>
        )}
      </div>
      <div className="chat-window__input-bar">
        <input
          className="chat-window__input"
          placeholder="说点什么..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={loading}
        />
        <button className="chat-window__send" onClick={send} disabled={loading || !input.trim()}>
          发送
        </button>
      </div>
    </div>
  );
}
