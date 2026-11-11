// 玩家等級與 XP（S6.1 從 engine.ts 移出）：daily.ts 的完售加倍也要結算升級，放在這裡才不會和 engine 互相 import。
import { BALANCE } from './content';
import type { GameState } from './types';

export function xpToNextLevel(level: number): number {
  return 10 + 5 * (level - 1);
}

/** XP 足夠就連續升級，每升一級 +levelUpEnergy 體力（可以超過上限）。 */
export function applyLevelUps(state: GameState): GameState {
  let next = state;
  while (next.xp >= xpToNextLevel(next.level)) {
    const level = next.level + 1;
    next = {
      ...next,
      xp: next.xp - xpToNextLevel(next.level),
      level,
      energy: next.energy + BALANCE.levelUpEnergy,
    };
    // 產生器不再隨玩家等級出現，只在攤位重開時放上棋盤（RC-1、FR11，見 S1.9 reopenStall）
  }
  return next;
}
