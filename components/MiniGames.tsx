"use client";

import { useState } from "react";
import { SnakeGame } from "./SnakeGame";

type GameId = "snake" | "tetris" | "2048" | "breakout" | "flappy";

interface GameMeta {
  id: GameId;
  name: string;
  available: boolean;
}

const GAMES: GameMeta[] = [
  { id: "snake", name: "贪吃蛇", available: true },
  { id: "tetris", name: "俄罗斯方块", available: false },
  { id: "2048", name: "2048", available: false },
  { id: "breakout", name: "打砖块", available: false },
  { id: "flappy", name: "Flappy Bird", available: false },
];

export function MiniGames() {
  const [active, setActive] = useState<GameId>("snake");
  const current = GAMES.find((g) => g.id === active);

  return (
    <section className="gs-mini-games" id="mini-games" aria-label="小游戏">
      <div className="gs-mini-games-inner">
        <div className="gs-section-head">
          <h2 className="gs-section-title">小游戏</h2>
          <span className="gs-mini-games-hint">
            {current?.available ? "键盘 ↑ ↓ ← → / WASD · 移动端滑动屏幕" : "更多游戏陆续上线"}
          </span>
        </div>

        <div className="gs-game-tabs" role="tablist">
          {GAMES.map((g) => (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={active === g.id}
              disabled={!g.available}
              className={`gs-game-tab${active === g.id ? " active" : ""}${!g.available ? " disabled" : ""}`}
              onClick={() => g.available && setActive(g.id)}
            >
              <span>{g.name}</span>
              {!g.available && <em className="gs-tab-soon">即将上线</em>}
            </button>
          ))}
        </div>

        <div className="gs-game-panel" role="tabpanel">
          {active === "snake" && <SnakeGame />}
          {active !== "snake" && (
            <div className="gs-game-empty">
              <p>🚧 {current?.name} 正在开发中</p>
              <p className="gs-game-empty-hint">先去玩贪吃蛇吧 →</p>
              <button
                type="button"
                className="gs-game-btn"
                onClick={() => setActive("snake")}
              >
                返回贪吃蛇
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
