import { Widget } from "./components/Widget";
import { Settings } from "./components/Settings";
import { CardWindow } from "./components/CardWindow";
import { ChatWindow } from "./components/ChatWindow";
import { ErrorBoundary } from "./components/ErrorBoundary";

export function App() {
  if (typeof window !== "undefined" && !window.mirro) {
    return (
      <div style={{
        padding: "20px",
        color: "#d44",
        background: "#fff",
        fontFamily: "system-ui, sans-serif",
        fontSize: "13px",
        borderRadius: "8px",
        margin: "20px"
      }}>
        <strong>Preload 未加载</strong>
        <p>window.mirro 不存在。请检查 preload 脚本是否正确配置。</p>
      </div>
    );
  }

  const hash = window.location.hash;

  return (
    <ErrorBoundary>
      {hash === "#settings" ? <Settings /> :
       hash === "#card" ? <CardWindow /> :
       hash === "#chat" ? <ChatWindow /> : (
        <main className="app-shell">
          <Widget />
        </main>
      )}
    </ErrorBoundary>
  );
}
