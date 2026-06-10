import type { CharacterCard } from "../../shared/types";

type CardViewProps = {
  card: CharacterCard;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
};

export function CardView({ card, onPrev, onNext, hasPrev, hasNext }: CardViewProps) {
  return (
    <div className="card-view">
      <div className="card-view__header">
        <h2 className="card-view__role-name">{card.roleName}</h2>
        <span className="card-view__date">{card.date}</span>
      </div>

      <p className="card-view__sketch">{card.sketch}</p>

      {card.imageBase64 && (
        <div className="card-view__image">
          <img src={`data:image/png;base64,${card.imageBase64}`} alt={card.roleName} />
        </div>
      )}

      <div className="card-view__puzzle">
        <span className="card-view__puzzle-label">🧩</span>
        <p>{card.newPuzzle}</p>
      </div>

      <div className="card-view__feedback">
        <p>{card.feedback}</p>
      </div>

      {card.confidence < 0.5 && (
        <p className="card-view__low-confidence">今天的数据比较模糊</p>
      )}

      <div className="card-view__nav">
        <button disabled={!hasPrev} onClick={onPrev}>← 前一天</button>
        <button disabled={!hasNext} onClick={onNext}>后一天 →</button>
      </div>
    </div>
  );
}
