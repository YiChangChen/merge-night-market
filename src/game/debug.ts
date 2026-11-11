// 除錯面板用的規則函式（S1.8）。只在 development／preview 的除錯面板呼叫，一律透過 apply。
// 和一般規則一樣是純函式：不合法的輸入直接回傳原 state。
import { type ChainId, STALLS } from './content';
import { ensureGenerator } from './engine';
import { growActiveWave } from './queue';
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
/** 除錯面板可以設定的最高玩家等級 */
export const DEBUG_MAX_PLAYER_LEVEL = 99;

export function debugSetPlayerLevel(state: GameState, level: number): GameState {
  if (!Number.isInteger(level) || level < 1 || level > DEBUG_MAX_PLAYER_LEVEL) return state;
  return { ...state, level, xp: 0 };
}

/** 這一攤最低可以調到幾級：開局就開著的攤位沒有重開條件，關掉就回不來，所以最低 Lv1。 */
export function debugMinStallLevel(chain: ChainId): StallLevel {
  return STALLS[chain].reopenCoins === null ? 1 : 0;
}

/**
 * 人龍只剩最後一位客人，下一張訂單就會完售（S2.1 實機驗證用）。
 * 冷卻中不動作，避免繞過冷卻；完售獎勵仍然走 completeOrder 的正常流程。
 */
export function debugQueueLastCustomer(state: GameState): GameState {
  const queue = state.queue;
  if (queue.cooldownEndsAt !== null || queue.remaining <= 1) return state;
  return { ...state, queue: { ...queue, remaining: 1 } };
}

/**
 * 直接設定攤位等級；從鐵捲門調高時補上該鏈的產生器，訂單才不會出現做不出來的品項。
 * 和真的重開、升級一樣，人龍進行中時這一波跟著加長（調低不會變短）。
 */
export function debugSetStallLevel(state: GameState, chain: ChainId, level: StallLevel): GameState {
  if (![0, 1, 2, 3].includes(level) || level < debugMinStallLevel(chain)) return state;
  const next: GameState = {
    ...state,
    stalls: {
      ...state.stalls,
      [chain]: {
        ...state.stalls[chain],
        level,
        // 招牌菜只屬於 Lv3（FR13）：調低時清除，之後重新升級可以再選
        signatureDish: level === 3 ? state.stalls[chain].signatureDish : null,
      },
    },
  };
  return growActiveWave(level >= 1 ? ensureGenerator(next, chain) : next);
}
