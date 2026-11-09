// 除錯面板用的規則函式（S1.8）。只在 development／preview 的除錯面板呼叫，一律透過 apply。
// 和一般規則一樣是純函式：不合法的輸入直接回傳原 state。
import type { ChainId } from './content';
import { ensureGenerator } from './engine';
import type { GameState, StallLevel } from './types';

const isAmount = (value: number) => Number.isFinite(value) && value > 0;

export function debugAddCoins(state: GameState, amount: number): GameState {
  return isAmount(amount) ? { ...state, coins: state.coins + amount } : state;
}

/** 和獎勵一樣可以超過體力上限。 */
export function debugAddEnergy(state: GameState, amount: number): GameState {
  return isAmount(amount) ? { ...state, energy: state.energy + amount } : state;
}

/** 直接設定玩家等級，XP 歸零；不發升級獎勵，也不放產生器（產生器只跟著攤位走，RC-1）。 */
export function debugSetPlayerLevel(state: GameState, level: number): GameState {
  if (!Number.isInteger(level) || level < 1) return state;
  return { ...state, level, xp: 0 };
}

/** 直接設定攤位等級；從鐵捲門調高時補上該鏈的產生器，訂單才不會出現做不出來的品項。 */
export function debugSetStallLevel(state: GameState, chain: ChainId, level: StallLevel): GameState {
  if (![0, 1, 2, 3].includes(level)) return state;
  const next: GameState = {
    ...state,
    stalls: { ...state.stalls, [chain]: { ...state.stalls[chain], level } },
  };
  return level >= 1 ? ensureGenerator(next, chain) : next;
}
