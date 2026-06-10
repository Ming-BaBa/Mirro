import { Component } from "react";

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: "20px",
          color: "#d44",
          background: "#fff",
          borderRadius: "8px",
          fontFamily: "system-ui, sans-serif",
          fontSize: "13px"
        }}>
          <strong>启动失败</strong>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: "11px" }}>{this.state.error.message}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
