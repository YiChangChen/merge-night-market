// 攤位規則：重開（S1.9）。升級（S1.10、S3.5）之後加在這裡。
import { CHAINS, type ChainId, STALLS } from './content';
import { ensureGenerator } from './engine';
import type { GameState } from './types';

export type ReopenCheck = {
  /** 需要的玩家等級（沿用 CHAINS[c].unlockLevel，RC-1） */
  playerLevel: number;
  coins: number;
  levelMet: boolean;
  coinsMet: boolean;
  ok: boolean;
};

/** 鐵捲門攤位的重開條件與目前是否達成（UX-DR3）；已經開著或開局就開著的攤位回傳 null。 */
export function reopenCheck(
  state: Pick<GameState, 'level' | 'coins' | 'stalls'>,
  chain: ChainId
): ReopenCheck | null {
  const coins = STALLS[chain].reopenCoins;
  if (coins === null || state.stalls[chain].level !== 0) return null;
  const playerLevel = CHAINS[chain].unlockLevel;
  const levelMet = state.level >= playerLevel;
  const coinsMet = state.coins >= coins;
  return { playerLevel, coins, levelMet, coinsMet, ok: levelMet && coinsMet };
}

/**
 * 重開攤位（FR10、RC-1）：扣金幣、攤位設為 Lv1、把該鏈的產生器放上棋盤（棋盤滿時進待放佇列），
 * 並送出 stall_reopened。條件不足或已經開著時回傳原 state。
 */
// now 目前沒有用到；S2.1 的人龍會在這裡讓進行中的這一波立刻加長（growActiveWave）
export function reopenStall(state: GameState, chain: ChainId, _now: number): GameState {
  const check = reopenCheck(state, chain);
  if (!check?.ok) return state;
  const opened: GameState = {
    ...state,
    coins: state.coins - check.coins,
    stalls: { ...state.stalls, [chain]: { ...state.stalls[chain], level: 1 } },
  };
  const withGenerator = ensureGenerator(opened, chain);
  return {
    ...withGenerator,
    events: [...withGenerator.events, { type: 'stall_reopened', stall: chain, level: 1 }],
  };
}
