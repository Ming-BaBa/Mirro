import { useState, useEffect, useRef } from "react";
import { useSettings, useTodaySummary } from "../hooks/useIpc";
import { PortraitView } from "./PortraitView";
import type { AppSettings } from "../../shared/types";
import characterIdle from "../assets/character-idle.png";

const TABS = [
  { id: "portrait", label: "画像", icon: <svg width="16" height="16" viewBox="0 0 48 48" fill="none"><path d="M24 44C29.9601 44 26.3359 35.136 30 31C33.1264 27.4709 44 29.0856 44 24C44 12.9543 35.0457 4 24 4C12.9543 4 4 12.9543 4 24C4 35.0457 12.9543 44 24 44Z" fill="currentColor"/><circle cx="28" cy="14" r="3" fill="#FFF"/><circle cx="16" cy="18" r="3" fill="#FFF"/><circle cx="17" cy="31" r="3" fill="#FFF"/></svg> },
  { id: "today", label: "今日", icon: <svg width="16" height="16" viewBox="0 0 48 48" fill="none"><path d="M5 19H43V40C43 41.1046 42.1046 42 41 42H7C5.89543 42 5 41.1046 5 40V19Z" fill="currentColor"/><path d="M5 9C5 7.89543 5.89543 7 7 7H41C42.1046 7 43 7.89543 43 9V19H5V9Z" stroke="currentColor" strokeWidth="4" strokeLinejoin="round"/><path d="M16 4V12" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/><path d="M32 4V12" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/><path d="M28 34H34" stroke="#FFF" strokeWidth="4" strokeLinecap="round"/><path d="M14 34H20" stroke="#FFF" strokeWidth="4" strokeLinecap="round"/><path d="M28 26H34" stroke="#FFF" strokeWidth="4" strokeLinecap="round"/><path d="M14 26H20" stroke="#FFF" strokeWidth="4" strokeLinecap="round"/></svg> },
  { id: "appearance", label: "外观", icon: <svg width="16" height="16" viewBox="0 0 48 48" fill="none"><path d="M22.1579 37C22.1579 37 21.2572 28.9255 18 25C14.956 21.3315 6 19 6 19L6 14H42L42 19C42 19 33.044 21.3315 30 25C26.7428 28.9254 25.8421 37 25.8421 37H22.1579Z" fill="currentColor"/></svg> },
  { id: "character", label: "角色", icon: <svg width="16" height="16" viewBox="0 0 48 48" fill="none"><path d="M24 44C33.9411 44 42 35.9411 42 26C42 16.0589 33.9411 8 24 8C14.0589 8 6 16.0589 6 26C6 35.9411 14.0589 44 24 44Z" fill="currentColor"/><path d="M24 8C23.75 7 22 4 18 4" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/><path d="M24 8C24.0833 7 24.6 4.8 26 4" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/><path d="M31 33C31 33 29 37 24 37C19 37 17 33 17 33" stroke="#FFF" strokeWidth="4" strokeLinecap="round"/><path d="M31 33C31 33 32.5 29 30 29C27.5 29 27 36 27 36" stroke="#FFF" strokeWidth="4" strokeLinecap="round"/><path d="M33 21H29" stroke="#FFF" strokeWidth="4" strokeLinecap="round"/><path d="M17 19V23" stroke="#FFF" strokeWidth="4" strokeLinecap="round"/><path d="M4 24V28" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/><path d="M44 24V28" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/></svg> },
  { id: "push", label: "推送", icon: <svg width="16" height="16" viewBox="0 0 48 48" fill="none"><path d="M43 5L29.7 43L22.1 25.9L5 18.3L43 5Z" stroke="currentColor" strokeWidth="4" strokeLinejoin="round"/><path d="M43.0001 5L22.1001 25.9" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/></svg> },
  { id: "api", label: "API", icon: <svg width="16" height="16" viewBox="0 0 48 48" fill="none"><path d="M37 22.0001L34 25.0001L23 14.0001L26 11.0001C27.5 9.50002 33 7.00005 37 11.0001C41 15.0001 38.5 20.5 37 22.0001Z" fill="currentColor"/><path d="M42 6L37 11" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/><path d="M11 25.9999L14 22.9999L25 33.9999L22 36.9999C20.5 38.5 15 41 11 36.9999C7 32.9999 9.5 27.5 11 25.9999Z" fill="currentColor"/><path d="M23 32L27 28" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/><path d="M6 42L11 37" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/><path d="M16 25L20 21" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/></svg> },
];

const MODEL_SUGGESTIONS: Record<string, string[]> = {
  anthropic: ["claude-haiku-4-5-20251001", "claude-sonnet-4-6", "claude-opus-4-7"],
  openai: ["gpt-4o-mini", "gpt-4o", "gpt-4.1"],
  deepseek: ["deepseek-v4-pro", "deepseek-v4-flash"],
  glm: ["glm-4.7", "glm-4.6", "GLM-5.1"],
  kimi: ["kimi-k2.6", "kimi-k2.5"],
  doubao: ["doubao-seed-1-6-flash", "doubao-1-5-pro-32k"],
  apimart: ["deepseek-v4-pro", "deepseek-v4-flash", "claude-sonnet-4-6", "gpt-4o"],
};

const IMAGE_MODEL_OPTIONS = [
  { value: "gemini-3-pro-image-preview", label: "Nano Banana 2 (Gemini 3 Pro Image)" },
];

const PERSONALITY_TRAITS = [
  "温柔", "高冷", "调皮", "傲娇", "呆萌", "话痨", "安静",
  "暖心", "毒舌", "元气", "慵懒", "好奇心强", "护短",
  "记仇", "大方", "害羞", "吃货", "爱撒娇", "独立",
  "乐观", "悲观", "理性", "感性", "中二", "佛系"
];

const PROVIDER_DEFAULTS: Record<string, string> = {
  anthropic: "claude-haiku-4-5-20251001",
  openai: "gpt-4o-mini",
  deepseek: "deepseek-v4-pro",
  glm: "glm-4.7",
  kimi: "kimi-k2.6",
  doubao: "doubao-seed-1-6-flash",
  apimart: "deepseek-v4-pro",
};

export function Settings() {
  const { settings, updateSettings, error } = useSettings();
  const todaySummary = useTodaySummary();
  const [localSettings, setLocalSettings] = useState<AppSettings | null>(null);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "ok" | "fail">("idle");
  const [testError, setTestError] = useState("");
  const [saveMsg, setSaveMsg] = useState("");
  const [imageExpanded, setImageExpanded] = useState(false);
  const [imgTestStatus, setImgTestStatus] = useState<"idle" | "testing" | "ok" | "fail">("idle");
  const [imgTestError, setImgTestError] = useState("");
  const [imgSaveMsg, setImgSaveMsg] = useState("");
  const [generating, setGenerating] = useState(false);
  const cancelledRef = useRef(false);
  const [genProgress, setGenProgress] = useState<{ percent: number; label: string } | null>(null);
  const [proposals, setProposals] = useState<{ action: string; dimension: string; detail: string }[]>([]);
  const [activeTab, setActiveTab] = useState("portrait");

  useEffect(() => {
    if (settings) setLocalSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (localSettings && localSettings.llmProvider !== "openai") {
      setImageExpanded(true);
    }
  }, [localSettings?.llmProvider]);

  useEffect(() => {
    const unsub = window.mirro.onGenerationProgress((phase) => {
      setGenProgress(phase);
    });
    return unsub;
  }, []);

  if (error) return <div className="settings-panel"><p style={{ color: "#d44" }}>加载失败: {error}</p></div>;
  if (!localSettings) return <div className="settings-panel"><p style={{ color: "#888" }}>加载中...</p></div>;

  const handleSave = async (partial: Partial<AppSettings>) => {
    setLocalSettings(prev => ({ ...prev!, ...partial }));
    await updateSettings(partial);
  };

  const handleWipe = async () => {
    const confirmed = confirm("确定要清空所有数据吗？此操作不可恢复。");
    if (confirmed) {
      await window.mirro.wipeAll();
      window.location.reload();
    }
  };

  const handleExport = async () => {
    const json = await window.mirro.exportPortrait();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mirro-export-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveApiKey = async () => {
    await handleSave({ apiKey: localSettings.apiKey, model: localSettings.model });
    setSaveMsg("保存成功");
    setTimeout(() => setSaveMsg(""), 2000);
  };

  const handleTestConnection = async () => {
    setTestStatus("testing");
    setTestError("");
    setSaveMsg("");
    try {
      await handleSave({ apiKey: localSettings.apiKey, model: localSettings.model });
      setSaveMsg("已自动保存");
      const result = await window.mirro.testApiConnection();
      if (result.ok) {
        setTestStatus("ok");
      } else {
        setTestStatus("fail");
        setTestError(result.error || "未知错误");
      }
    } catch (e) {
      setTestStatus("fail");
      setTestError(String(e));
    }
  };

  const handleSaveImageKey = async () => {
    await handleSave({ imageApiKey: localSettings.imageApiKey, imageModel: localSettings.imageModel });
    setImgSaveMsg("保存成功");
    setTimeout(() => setImgSaveMsg(""), 2000);
  };

  const handleTestImageConnection = async () => {
    setImgTestStatus("testing");
    setImgTestError("");
    setImgSaveMsg("");
    try {
      await handleSave({ imageApiKey: localSettings.imageApiKey, imageModel: localSettings.imageModel });
      setImgSaveMsg("已自动保存");
      const result = await window.mirro.testImageConnection();
      if (result.ok) {
        setImgTestStatus("ok");
      } else {
        setImgTestStatus("fail");
        setImgTestError(result.error || "未知错误");
      }
    } catch (e) {
      setImgTestStatus("fail");
      setImgTestError(String(e));
    }
  };

  const handleGenerateNow = async () => {
    setGenerating(true);
    setGenProgress({ percent: 0, label: "准备中…" });
    cancelledRef.current = false;
    setProposals([]);
    try {
      const result = await window.mirro.generateCardNow();
      if (cancelledRef.current || !result) return;
      setGenProgress({ percent: 100, label: "完成" });
      setTimeout(() => setGenProgress(null), 600);
      alert(`角色卡已生成: ${result.card.roleName}\n\n请查看桌面胶囊挂件（双击展开）`);
      if (result.proposals?.length > 0) {
        setProposals(result.proposals);
      }
    } catch (e) {
      if (cancelledRef.current) return;
      setGenProgress(null);
      alert(`生成失败: ${String(e)}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleCancelGenerate = async () => {
    cancelledRef.current = true;
    await window.mirro.cancelGenerate();
    setGenerating(false);
    setGenProgress(null);
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="settings-shell">
      <nav className="settings-nav">
        <div className="settings-nav__brand">Mirro</div>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`settings-nav__item${activeTab === t.id ? " settings-nav__item--active" : ""}`}
            onClick={() => setActiveTab(t.id)}
          >
            <span className="settings-nav__icon">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
      <main className="settings-body">
        <div className="settings-body__inner">
        {/* ── 画像 ── */}
        {activeTab === "portrait" && (
          <>
            <PortraitView />
            {proposals.length > 0 && (
              <div className="settings-section">
                <h3>待确认画像更新</h3>
                <ul className="proposal-list">
                  {proposals.map((p, i) => (
                    <li key={i} className="proposal-item">
                      <span className="proposal-item__action">
                        {p.action === "add" ? "＋新增" : p.action === "modify" ? "✎修改" : "✕删除"}
                      </span>
                      <span className="proposal-item__dim">{p.dimension}</span>
                      {p.detail && <span className="proposal-item__detail">{p.detail}</span>}
                      <div className="proposal-item__btns">
                        <button className="proposal-accept" onClick={async () => {
                          await window.mirro.applyPortraitProposal(p);
                          setProposals(prev => prev.filter((_, j) => j !== i));
                        }}>接受</button>
                        <button className="proposal-reject" onClick={() => {
                          setProposals(prev => prev.filter((_, j) => j !== i));
                        }}>拒绝</button>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="settings-actions" style={{ marginTop: 8 }}>
                  <button onClick={async () => {
                    for (const p of proposals) await window.mirro.applyPortraitProposal(p);
                    setProposals([]);
                  }}>全部接受</button>
                  <button className="settings-danger" onClick={() => setProposals([])}>全部拒绝</button>
                </div>
              </div>
            )}
            <div className="settings-actions">
              <button onClick={handleExport}>导出画像</button>
              <button className="settings-danger" onClick={handleWipe}>清空全部数据</button>
            </div>
          </>
        )}

        {/* ── 今日 ── */}
        {activeTab === "today" && (
          <>
            <div className="settings-section">
              <h3>今日采集</h3>
              {todaySummary ? (
                <p style={{ fontSize: "12px" }}>
                  已输入 {todaySummary.totalInputChars} 字，
                  删字率 {Math.round(todaySummary.totalDeleteRate * 100)}%，
                  活跃应用：{todaySummary.uniqueApps.join("、") || "无"}
                </p>
              ) : (
                <p style={{ fontSize: "12px", color: "#888" }}>今日暂无采集数据</p>
              )}
              <div className="settings-field" style={{ marginTop: 8 }}>
                <label>
                  <input
                    type="checkbox"
                    checked={localSettings.trackingEnabled}
                    onChange={e => handleSave({ trackingEnabled: e.target.checked })}
                  />
                  启用采集
                </label>
              </div>
            </div>
            <div className="settings-section">
              <h3>生成卡片</h3>
              {genProgress && generating && (
                <div className="gen-progress">
                  <div className="gen-progress__bar-wrap">
                    <div className="gen-progress__bar" style={{ width: `${genProgress.percent}%` }} />
                  </div>
                  <div className="gen-progress__info">
                    <span className="gen-progress__spinner" />
                    <span className="gen-progress__label">{genProgress.label}</span>
                    <span className="gen-progress__pct">{genProgress.percent}%</span>
                    <button className="gen-progress__cancel" onClick={handleCancelGenerate}>取消</button>
                  </div>
                </div>
              )}
              <div className="settings-actions">
                {!generating && <button onClick={handleGenerateNow}>立即生成卡片</button>}
                <button
                  className="settings-danger"
                  onClick={async () => {
                    if (confirm("确定清空今日数据？")) {
                      await window.mirro.deleteDay(today);
                      window.location.reload();
                    }
                  }}
                >清空今日数据</button>
              </div>
            </div>
            <div className="settings-section">
              <h3>归档输出</h3>
              <div className="settings-field">
                <label>卡片自动归档目录</label>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <input
                    value={localSettings.archiveDir || "未设置"}
                    readOnly
                    style={{ flex: 1, color: localSettings.archiveDir ? "#2b2f38" : "#999" }}
                  />
                  <button onClick={async () => {
                    const dir = await window.mirro.pickDirectory();
                    if (dir) handleSave({ archiveDir: dir });
                  }} style={{ whiteSpace: "nowrap" }}>选择</button>
                  {localSettings.archiveDir && (
                    <button onClick={() => handleSave({ archiveDir: "" })} style={{ whiteSpace: "nowrap", borderColor: "#d44", color: "#d44" }}>清除</button>
                  )}
                </div>
                <span style={{ fontSize: "11px", color: "#888" }}>每次生成卡片后自动导出 Markdown 到该目录</span>
              </div>
            </div>
          </>
        )}

        {/* ── 外观 ── */}
        {activeTab === "appearance" && (
          <>
            <div className="settings-section">
              <h3>大小设置 <span style={{ color: "#d44", fontSize: "11px", fontWeight: 400 }}>调整后锁定再解锁可预览效果</span></h3>
              <div className="settings-field">
                <label>胶囊宽度 ({localSettings.capsuleWidth}px)</label>
                <input
                  type="range"
                  min={120} max={500} step={10}
                  value={localSettings.capsuleWidth}
                  onChange={e => {
                    const v = Number(e.target.value);
                    setLocalSettings(prev => ({ ...prev!, capsuleWidth: v }));
                    handleSave({ capsuleWidth: v });
                  }}
                />
              </div>
              <div className="settings-field">
                <label>角色大小 ({localSettings.characterHeight}px)</label>
                <input
                  type="range"
                  min={40} max={200} step={5}
                  value={localSettings.characterHeight}
                  onChange={e => {
                    const v = Number(e.target.value);
                    setLocalSettings(prev => ({ ...prev!, characterHeight: v }));
                    handleSave({ characterHeight: v });
                  }}
                />
              </div>
            </div>
            <div className="settings-section">
              <h3>皮肤设置</h3>
              <div className="skin-grid">
                <div className="skin-card skin-card--active">
                  <img src={characterIdle} alt="小猫" className="skin-card__img" />
                  <span className="skin-card__name">小猫</span>
                </div>
                <div className="skin-card skin-card--locked">
                  <span className="skin-card__question">?</span>
                  <span className="skin-card__name">敬请期待</span>
                </div>
                <div className="skin-card skin-card--locked">
                  <span className="skin-card__question">?</span>
                  <span className="skin-card__name">敬请期待</span>
                </div>
                <div className="skin-card skin-card--locked">
                  <span className="skin-card__question">?</span>
                  <span className="skin-card__name">敬请期待</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── 角色 ── */}
        {activeTab === "character" && (
          <div className="settings-section">
            <h3>角色性格</h3>
            <p style={{ fontSize: "12px", color: "#999", marginBottom: 12 }}>
              选择你想要的宠物性格，点击添加到框架中
            </p>
            <div className="personality-frame">
              <div className="personality-frame__label">已选性格</div>
              <div className="personality-frame__slots">
                {localSettings.personalityTraits.length === 0 && (
                  <span style={{ fontSize: 12, color: "#bbb" }}>点击下方标签添加性格...</span>
                )}
                {localSettings.personalityTraits.map(trait => (
                  <button
                    key={trait}
                    className="personality-tag personality-tag--active"
                    onClick={() => {
                      const next = localSettings.personalityTraits.filter(t => t !== trait);
                      handleSave({ personalityTraits: next });
                    }}
                  >
                    {trait} ×
                  </button>
                ))}
              </div>
            </div>
            <div className="personality-pool">
              {PERSONALITY_TRAITS.map(trait => {
                const selected = localSettings.personalityTraits.includes(trait);
                return (
                  <button
                    key={trait}
                    className={`personality-tag${selected ? " personality-tag--selected" : ""}`}
                    disabled={selected}
                    onClick={() => {
                      if (!selected) {
                        handleSave({ personalityTraits: [...localSettings.personalityTraits, trait] });
                      }
                    }}
                  >
                    {trait}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 推送 ── */}
        {activeTab === "push" && (
          <div className="settings-section">
            <h3>推送设置</h3>
            <div className="settings-field">
              <label>早餐日报时间</label>
              <input
                type="time"
                value={localSettings.morningReportTime}
                onChange={e => setLocalSettings(prev => ({ ...prev!, morningReportTime: e.target.value }))}
                onBlur={e => handleSave({ morningReportTime: e.target.value })}
              />
            </div>
            <div className="settings-field">
              <label>
                <input
                  type="checkbox"
                  checked={localSettings.randomNudgeEnabled}
                  onChange={e => handleSave({ randomNudgeEnabled: e.target.checked })}
                />
                开启随机轻推
              </label>
            </div>
            {localSettings.randomNudgeEnabled && (
              <div className="settings-field">
                <label>频率</label>
                <select
                  value={localSettings.randomNudgeFrequency}
                  onChange={e => handleSave({ randomNudgeFrequency: e.target.value as "occasional" | "rare" })}
                >
                  <option value="rare">很少</option>
                  <option value="occasional">偶尔</option>
                </select>
              </div>
            )}
          </div>
        )}

        {/* ── API ── */}
        {activeTab === "api" && (
          <>
            <div className="settings-section">
              <h3>API 配置</h3>
              <div className="settings-field">
                <label>LLM Provider</label>
                <select
                  value={localSettings.llmProvider}
                  onChange={e => {
                    const provider = e.target.value as typeof localSettings.llmProvider;
                    handleSave({ llmProvider: provider, model: PROVIDER_DEFAULTS[provider] });
                  }}
                >
                  <option value="anthropic">Anthropic</option>
                  <option value="openai">OpenAI</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="glm">智谱 GLM</option>
                  <option value="kimi">Kimi (月之暗面)</option>
                  <option value="doubao">豆包 (火山引擎)</option>
                  <option value="apimart">Apimart</option>
                </select>
              </div>
              <div className="settings-field">
                <label>Model</label>
                <input
                  value={localSettings.model}
                  onChange={e => setLocalSettings(prev => ({ ...prev!, model: e.target.value }))}
                  onBlur={e => handleSave({ model: e.target.value })}
                  list="model-suggestions"
                />
                <datalist id="model-suggestions">
                  {(MODEL_SUGGESTIONS[localSettings.llmProvider] || []).map(m => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>
              <div className="settings-field">
                <label>API Key</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="password"
                    value={localSettings.apiKey}
                    onChange={e => setLocalSettings(prev => ({ ...prev!, apiKey: e.target.value }))}
                    style={{ flex: 1 }}
                  />
                  <button onClick={handleSaveApiKey} style={{ whiteSpace: "nowrap" }}>保存</button>
                  {saveMsg && <span style={{ fontSize: "12px", color: "#2a8", alignSelf: "center" }}>{saveMsg}</span>}
                  <button onClick={handleTestConnection} disabled={testStatus === "testing"} style={{ whiteSpace: "nowrap" }}>
                    {testStatus === "testing" ? "测试中..." : "测试"}
                  </button>
                </div>
                {testStatus === "ok" && <span style={{ fontSize: "12px", color: "#2a8" }}>连接成功</span>}
                {testStatus === "fail" && <span style={{ fontSize: "12px", color: "#d44" }}>连接失败: {testError}</span>}
              </div>
            </div>
            <div className="settings-section">
              <h3
                style={{ cursor: "pointer", userSelect: "none" }}
                onClick={() => setImageExpanded(v => !v)}
              >
                {imageExpanded ? "▼" : "▶"} 图像生成 {!imageExpanded && localSettings.llmProvider !== "openai" && "(需要单独配置)"}
              </h3>
              {imageExpanded && (
                <>
                  <div className="settings-field">
                    <label>Image API Key</label>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <input
                        type="password"
                        value={localSettings.imageApiKey}
                        onChange={e => setLocalSettings(prev => ({ ...prev!, imageApiKey: e.target.value }))}
                        placeholder="Apimart API Key"
                        style={{ flex: 1 }}
                      />
                      <button onClick={handleSaveImageKey} style={{ whiteSpace: "nowrap" }}>保存</button>
                      {imgSaveMsg && <span style={{ fontSize: "12px", color: "#2a8", alignSelf: "center" }}>{imgSaveMsg}</span>}
                      <button onClick={handleTestImageConnection} disabled={imgTestStatus === "testing"} style={{ whiteSpace: "nowrap" }}>
                        {imgTestStatus === "testing" ? "测试中..." : "测试"}
                      </button>
                    </div>
                    {imgTestStatus === "ok" && <span style={{ fontSize: "12px", color: "#2a8" }}>连接成功</span>}
                    {imgTestStatus === "fail" && <span style={{ fontSize: "12px", color: "#d44" }}>连接失败: {imgTestError}</span>}
                  </div>
                  <div className="settings-field">
                    <label>Image Model</label>
                    <select
                      value={localSettings.imageModel}
                      onChange={e => handleSave({ imageModel: e.target.value })}
                    >
                      {IMAGE_MODEL_OPTIONS.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
      </main>
    </div>
  );
}
