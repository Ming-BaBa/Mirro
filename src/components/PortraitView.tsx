import { usePortrait } from "../hooks/useIpc";

export function PortraitView() {
  const { portrait, refresh } = usePortrait();

  if (!portrait) return <p style={{ fontSize: "12px", color: "#888" }}>加载中...</p>;

  const handleRemove = async (dimension: string) => {
    await window.mirro.removePortraitDimension(dimension);
    refresh();
  };

  return (
    <div className="settings-section">
      <h3>用户画像 ({portrait.dimensions.length} 个维度) — 阶段：{portrait.stage}</h3>
      {portrait.dimensions.length === 0 ? (
        <p style={{ fontSize: "12px", color: "#888" }}>尚未积累足够的画像维度。数据越多，画像越清晰。</p>
      ) : (
        <ul className="portrait-dim-list">
          {portrait.dimensions.map(d => (
            <li key={d.dimension} className="portrait-dim-item">
              <span><strong>{d.dimension}</strong>: {d.observation}</span>
              <button onClick={() => handleRemove(d.dimension)}>×</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
