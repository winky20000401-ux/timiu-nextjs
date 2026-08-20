"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const GRID = 20;
const CELL = 18;
const BOARD = GRID * CELL;

type Point = { x: number; y: number };

export function SnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const snakeRef = useRef<Point[]>([{ x: 10, y: 10 }]);
  const dirRef = useRef<Point>({ x: 1, y: 0 });
  const foodRef = useRef<Point>({ x: 5, y: 5 });
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);

  const placeFood = useCallback(() => {
    while (true) {
      const x = Math.floor(Math.random() * GRID);
      const y = Math.floor(Math.random() * GRID);
      if (!snakeRef.current.some((p) => p.x === x && p.y === y)) {
        foodRef.current = { x, y };
        return;
      }
    }
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#0e0e10";
    ctx.fillRect(0, 0, BOARD, BOARD);
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (let i = 1; i < GRID; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL, 0);
      ctx.lineTo(i * CELL, BOARD);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * CELL);
      ctx.lineTo(BOARD, i * CELL);
      ctx.stroke();
    }
    ctx.fillStyle = "#3ad29f";
    ctx.beginPath();
    ctx.arc(
      foodRef.current.x * CELL + CELL / 2,
      foodRef.current.y * CELL + CELL / 2,
      CELL / 2 - 2,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.fillStyle = "rgba(58, 210, 159, 0.25)";
    ctx.beginPath();
    ctx.arc(
      foodRef.current.x * CELL + CELL / 2,
      foodRef.current.y * CELL + CELL / 2,
      CELL / 2 + 2,
      0,
      Math.PI * 2
    );
    ctx.fill();
    snakeRef.current.forEach((p, i) => {
      ctx.fillStyle = i === 0 ? "#3ad29f" : "#e5e5e5";
      ctx.fillRect(p.x * CELL + 1, p.y * CELL + 1, CELL - 2, CELL - 2);
    });
  }, []);

  const reset = useCallback(() => {
    snakeRef.current = [{ x: 10, y: 10 }];
    dirRef.current = { x: 1, y: 0 };
    placeFood();
    setScore(0);
    setGameOver(false);
    setRunning(true);
    setStarted(true);
  }, [placeFood]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    if (!running) return;
    const handler = (e: KeyboardEvent) => {
      const d = dirRef.current;
      if ((e.key === "ArrowUp" || e.key === "w") && d.y === 0) dirRef.current = { x: 0, y: -1 };
      else if ((e.key === "ArrowDown" || e.key === "s") && d.y === 0) dirRef.current = { x: 0, y: 1 };
      else if ((e.key === "ArrowLeft" || e.key === "a") && d.x === 0) dirRef.current = { x: -1, y: 0 };
      else if ((e.key === "ArrowRight" || e.key === "d") && d.x === 0) dirRef.current = { x: 1, y: 0 };
      if (e.key.startsWith("Arrow")) e.preventDefault();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [running]);

  useEffect(() => {
    if (!running) return;
    let startX = 0;
    let startY = 0;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
    };
    const onEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      const d = dirRef.current;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 20 && d.x === 0) dirRef.current = { x: 1, y: 0 };
        else if (dx < -20 && d.x === 0) dirRef.current = { x: -1, y: 0 };
      } else {
        if (dy > 20 && d.y === 0) dirRef.current = { x: 0, y: 1 };
        else if (dy < -20 && d.y === 0) dirRef.current = { x: 0, y: -1 };
      }
    };
    canvas.addEventListener("touchstart", onStart, { passive: true });
    canvas.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      canvas.removeEventListener("touchstart", onStart);
      canvas.removeEventListener("touchend", onEnd);
    };
  }, [running]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const snake = snakeRef.current;
      const dir = dirRef.current;
      const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
      if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) {
        setGameOver(true);
        setRunning(false);
        setHighScore((s) => Math.max(s, score));
        return;
      }
      if (snake.some((p) => p.x === head.x && p.y === head.y)) {
        setGameOver(true);
        setRunning(false);
        setHighScore((s) => Math.max(s, score));
        return;
      }
      const newSnake = [head, ...snake];
      if (head.x === foodRef.current.x && head.y === foodRef.current.y) {
        setScore((s) => s + 1);
        placeFood();
      } else {
        newSnake.pop();
      }
      snakeRef.current = newSnake;
      draw();
    }, 110);
    return () => clearInterval(id);
  }, [running, score, draw, placeFood]);

  return (
    <div className="gs-game-layout">
      <div className="gs-game-board">
        <canvas
          ref={canvasRef}
          width={BOARD}
          height={BOARD}
          className="gs-canvas"
          aria-label="贪吃蛇游戏画布"
        />
        {!running && (
          <div className="gs-game-overlay">
            <div className="gs-overlay-card">
              {gameOver ? (
                <>
                  <p className="gs-overlay-title">游戏结束</p>
                  <p className="gs-overlay-score">本局得分 {score}</p>
                  <p className="gs-overlay-high">最高分 {Math.max(highScore, score)}</p>
                </>
              ) : (
                <p className="gs-overlay-title">{started ? "已暂停" : "贪吃蛇"}</p>
              )}
              <button onClick={reset} className="gs-game-btn" type="button">
                {gameOver ? "再来一局" : started ? "继续" : "开始游戏"}
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="gs-game-info">
        <div className="gs-score-card">
          <span>当前得分</span>
          <strong>{score}</strong>
        </div>
        <div className="gs-score-card">
          <span>最高分</span>
          <strong>{highScore}</strong>
        </div>
        <p className="gs-game-tip">
          用方向键或 WASD 控制蛇头转向，吃到青色食物加 1 分。撞墙或撞到自己游戏结束。最高分会自动记录在本机。
        </p>
      </div>
    </div>
  );
}
