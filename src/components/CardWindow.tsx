import { useState } from "react";
import { CardView } from "./CardView";
import { useCards } from "../hooks/useIpc";

export function CardWindow() {
  const { cards, loading } = useCards(30);
  const [cardIndex, setCardIndex] = useState(0);

  const handleClose = () => {
    window.close();
  };

  return (
    <div className="card-window">
      <div className="card-window__titlebar">
        <span className="card-window__title">Mirro</span>
        <button className="card-window__close" onClick={handleClose}>✕</button>
      </div>

      {loading || cards.length === 0 ? (
        <p className="card-window__empty">{loading ? "加载中..." : "暂无卡片"}</p>
      ) : (
        <>
          <CardView
            card={cards[cardIndex]}
            onPrev={cardIndex < cards.length - 1 ? () => setCardIndex(i => i + 1) : undefined}
            onNext={cardIndex > 0 ? () => setCardIndex(i => i - 1) : undefined}
            hasPrev={cardIndex < cards.length - 1}
            hasNext={cardIndex > 0}
          />
          <div className="card-window__counter">
            {cardIndex + 1} / {cards.length}
          </div>
        </>
      )}
    </div>
  );
}
