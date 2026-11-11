// 攤位規則：重開（S1.9）、升級到 Lv2（S1.10）、升級到 Lv3 與招牌菜（S3.5）。
import { CHAINS, type ChainId, RECIPES, type RecipeId, STALLS } from './content';
import { consumeDish, ensureGenerator } from './engine';
import { growActiveWave } from './queue';
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
// now 目前沒有用到；簽名統一成 (state, ..., now)
export function reopenStall(state: GameState, chain: ChainId, _now: number): GameState {
  const check = reopenCheck(state, chain);
  if (!check?.ok) return state;
  const opened: GameState = {
    ...state,
    coins: state.coins - check.coins,
    stalls: { ...state.stalls, [chain]: { ...state.stalls[chain], level: 1 } },
  };
  // 人龍進行中時，這一波立刻加長（FR18）
  const withGenerator = growActiveWave(ensureGenerator(opened, chain));
  return {
    ...withGenerator,
    events: [...withGenerator.events, { type: 'stall_reopened', stall: chain, level: 1 }],
  };
}

export type UpgradeCheck = {
  targetLevel: 2 | 3;
  coins: number;
  coinsMet: boolean;
  /** Lv3 需要 1 份含該鏈的發明菜（FR12） */
  needsDish: boolean;
  /** 棋盤上含這一攤食材的發明菜（不重複，依配方順序）；玩家從中選一道當招牌菜（RC-7） */
  candidates: RecipeId[];
  ok: boolean;
};

/** 棋盤上含這條鏈食材的發明菜（不重複，依 RECIPES 的順序）。 */
export function signatureCandidates(state: Pick<GameState, 'board'>, chain: ChainId): RecipeId[] {
  const onBoard = new Set(
    state.board.flatMap((piece) => (piece?.kind === 'dish' ? [piece.recipe] : []))
  );
  return RECIPES.filter(
    (recipe) => onBoard.has(recipe.id) && (recipe.a.chain === chain || recipe.b.chain === chain)
  ).map((recipe) => recipe.id);
}

/** 已開攤位的下一級條件（UX-DR3）；鐵捲門（要先重開）與 Lv3（最高級）回傳 null。 */
export function upgradeCheck(
  state: Pick<GameState, 'coins' | 'stalls' | 'board'>,
  chain: ChainId
): UpgradeCheck | null {
  const level = state.stalls[chain].level;
  if (level !== 1 && level !== 2) return null;
  const targetLevel = (level + 1) as 2 | 3;
  const coins = STALLS[chain].upgradeCoins[targetLevel];
  const coinsMet = state.coins >= coins;
  const needsDish = targetLevel === 3;
  const candidates = needsDish ? signatureCandidates(state, chain) : [];
  return {
    targetLevel,
    coins,
    coinsMet,
    needsDish,
    candidates,
    ok: coinsMet && (!needsDish || candidates.length > 0),
  };
}

/**
 * 升級攤位（FR12、FR14）：扣金幣、攤位 +1 級，送出 stall_upgraded。
 * - Lv1 → Lv2：只要金幣。
 * - Lv2 → Lv3：另外要指定一道棋盤上含這一攤食材的發明菜（recipe），扣 1 份，並成為招牌菜（FR13、RC-7、RC-8）。
 *   招牌菜只在這裡設定一次；Lv3 沒有下一級，所以確定後不能更換。
 * 新訂單的金幣加成由 orderCoins 依攤位等級自動計算（FR15）。條件不足時回傳原 state。
 */
export function upgradeStall(
  state: GameState,
  chain: ChainId,
  _now: number,
  recipe?: RecipeId
): GameState {
  const check = upgradeCheck(state, chain);
  if (!check?.ok) return state;
  if (check.needsDish && (recipe === undefined || !check.candidates.includes(recipe))) return state;

  let next: GameState = { ...state, coins: state.coins - check.coins };
  if (check.needsDish && recipe !== undefined) next = consumeDish(next, recipe);
  // 人龍進行中時，這一波立刻加長（FR18）
  next = growActiveWave({
    ...next,
    stalls: {
      ...next.stalls,
      [chain]: {
        // 展開原本的欄位，之後新增的攤位欄位才不會在升級時被丟掉
        ...next.stalls[chain],
        level: check.targetLevel,
        signatureDish: check.needsDish ? (recipe ?? null) : next.stalls[chain].signatureDish,
      },
    },
  });
  return {
    ...next,
    events: [...next.events, { type: 'stall_upgraded', stall: chain, level: check.targetLevel }],
  };
}
