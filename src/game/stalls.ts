// 攤位規則：重開（S1.9）、升級到 Lv2（S1.10）。Lv3 升級（需要發明菜）在 S3.5 加入。
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

export type UpgradeCheck = {
  targetLevel: 2 | 3;
  coins: number;
  coinsMet: boolean;
  /** Lv3 需要 1 份含該鏈的發明菜（FR12），E3 才開放 */
  needsDish: boolean;
  ok: boolean;
};

/** 已開攤位的下一級條件（UX-DR3）；鐵捲門（要先重開）與 Lv3（最高級）回傳 null。 */
export function upgradeCheck(
  state: Pick<GameState, 'coins' | 'stalls'>,
  chain: ChainId
): UpgradeCheck | null {
  const level = state.stalls[chain].level;
  if (level !== 1 && level !== 2) return null;
  const targetLevel = (level + 1) as 2 | 3;
  const coins = STALLS[chain].upgradeCoins[targetLevel];
  const coinsMet = state.coins >= coins;
  const needsDish = targetLevel === 3;
  // TODO(S3.5): Lv3 改成檢查棋盤上是否有含該鏈的發明菜，並由玩家選擇招牌菜
  return { targetLevel, coins, coinsMet, needsDish, ok: coinsMet && !needsDish };
}

/**
 * 升級攤位到 Lv2（FR12、FR14）：扣金幣、攤位 +1 級，送出 stall_upgraded。
 * 新訂單的金幣加成由 orderCoins 依攤位等級自動計算（FR15）。條件不足時回傳原 state。
 * Lv3（需要發明菜與招牌菜選擇）在 S3.5 擴充成 upgradeStall(state, stall, now, recipe)。
 */
// now 目前沒有用到；S2.1 的人龍會在這裡讓進行中的這一波立刻加長（growActiveWave）
export function upgradeStall(state: GameState, chain: ChainId, _now: number): GameState {
  const check = upgradeCheck(state, chain);
  if (!check?.ok) return state;
  return {
    ...state,
    coins: state.coins - check.coins,
    stalls: { ...state.stalls, [chain]: { ...state.stalls[chain], level: check.targetLevel } },
    events: [...state.events, { type: 'stall_upgraded', stall: chain, level: check.targetLevel }],
  };
}
