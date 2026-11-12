// 合成小提示（S6.4 實機回饋）：教學第 1、2 步之後，棋盤停著一段時間沒有變化，就讓一對可以合成的品項晃動。
// 只依賴 game；棋盤畫面用它決定哪兩格要晃。
import { useEffect, useState } from 'react';

import { findMergePair, type Piece } from '@/game/engine';
import { useGameStore } from '@/game/store';

/** 棋盤停著這麼久沒有變化，就提示可以合成的一對 */
export const IDLE_HINT_MS = 6000;

/**
 * 閒置的合成提示：active（棋盤在前景、沒有演出蓋住）而且教學已經走過合成與出餐（第 3 步起）時，
 * 棋盤停著 IDLE_HINT_MS 沒有變化，回傳第一對可以合成的格子；棋盤一有變化（新的參考）就回到 null 重新計時。
 * 教學第 1、2 步由手指層的「圈兩格」提示負責，這裡不重複。
 */
export function useIdleMergePair(active: boolean): readonly [number, number] | null {
  const board = useGameStore((store) => store.state?.board ?? null);
  const allowed = useGameStore((store) => (store.state?.meta.tutorialStep ?? 0) >= 2);
  const pair = board ? findMergePair(board) : null;
  const pairKey = pair ? `${pair[0]}-${pair[1]}` : null;
  // 記下「哪一個棋盤」停滿了 IDLE_HINT_MS；棋盤換成新的參考時自動失效，不必在 effect 裡同步重設
  const [idleBoard, setIdleBoard] = useState<(Piece | null)[] | null>(null);

  useEffect(() => {
    if (!active || !allowed || !pairKey || !board) return;
    const timer = setTimeout(() => setIdleBoard(board), IDLE_HINT_MS);
    return () => {
      clearTimeout(timer);
      // 被蓋住（active 變 false）或棋盤變了：重新計時，演出關掉後不會馬上晃（E6 code review）
      setIdleBoard(null);
    };
  }, [active, allowed, board, pairKey]);

  return active && allowed && pair && idleBoard === board ? pair : null;
}
