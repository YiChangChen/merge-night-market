// 貴客單（S4.1、FR27、FR28）與線索單的產生（S4.2、FR29）；線索單的到期與請走在 orders.ts。
// engine 的 createOrder 在建立新訂單時先呼叫 rollVip；這裡不 import engine，避免互相依賴。
import { cardBonus } from './cards';
import { BALANCE, CHAIN_IDS, type ChainId, RECIPES, RECIPES_BY_ID, type RecipeId } from './content';
import { baseCost, stallCoinMultiplier } from './pricing';
import { nextRandom, randomInt } from './random';
import type { GameState, Order, StallState } from './types';

/** 貴客機率 = min(20% + 2% × (Σ攤位等級 − 2), 40%)；衍生值，不存檔。 */
export function vipChance(stalls: Record<ChainId, StallState>): number {
  const levels = CHAIN_IDS.reduce((sum, chain) => sum + stalls[chain].level, 0);
  return Math.min(
    BALANCE.vipBaseChance + BALANCE.vipChancePerStallLevel * (levels - 2),
    BALANCE.vipMaxChance
  );
}

/** 場上是否已經有貴客或線索單（同一時間最多 1 張，FR27）。 */
export function hasSpecialOrder(orders: readonly Order[]): boolean {
  return orders.some((order) => order.kind !== 'normal');
}

/** 這道菜的兩攤目前都 ≥ Lv2（做得出來）。 */
function canServe(state: Pick<GameState, 'stalls'>, recipe: RecipeId): boolean {
  const { a, b } = RECIPES_BY_ID[recipe];
  return state.stalls[a.chain].level >= 2 && state.stalls[b.chain].level >= 2;
}

/** 已發現的配方（依 RECIPES 順序）。 */
function discoveredRecipes(state: Pick<GameState, 'inventions'>): RecipeId[] {
  return RECIPES.filter((recipe) => state.inventions[recipe.id]?.discovered).map((r) => r.id);
}

/**
 * 一張指定某道發明菜的貴客單（FR28）。金幣在建立時鎖定（RC-3）：
 * 5 × 材料 baseCost 總和 × 兩攤加成平均 × 3 × (1 + 卡牌加成)；XP = 材料階數總和 × 2；
 * 體力和一般訂單同一個公式（材料成本 × 0.3，無條件進位）。
 */
export function vipOrder(
  state: Pick<GameState, 'stalls' | 'inventions'>,
  recipe: RecipeId,
  id: number
): Order {
  const { a, b } = RECIPES_BY_ID[recipe];
  const cost = baseCost(a.level) + baseCost(b.level);
  const multiplier =
    (stallCoinMultiplier(state.stalls[a.chain].level) +
      stallCoinMultiplier(state.stalls[b.chain].level)) /
    2;
  return {
    id,
    kind: 'vip',
    recipe,
    requirements: [],
    coins: Math.round(
      BALANCE.orderCoinsPerBase *
        cost *
        multiplier *
        BALANCE.vipCoinMultiplier *
        (1 + cardBonus(state, recipe))
    ),
    xp: (a.level + b.level) * BALANCE.vipXpPerLevel,
    energy: Math.ceil(cost * BALANCE.orderEnergyRefund),
  };
}

/** 線索候選：尚未發現、兩攤都 ≥ Lv2 的配方（依 RECIPES 順序）。 */
function clueCandidates(state: Pick<GameState, 'inventions' | 'stalls'>): RecipeId[] {
  return RECIPES.filter(
    (recipe) =>
      !state.inventions[recipe.id]?.discovered &&
      state.stalls[recipe.a.chain].level >= 2 &&
      state.stalls[recipe.b.chain].level >= 2
  ).map((recipe) => recipe.id);
}

/** 一張線索單（FR29）：只說一句台詞，不能完成、沒有獎勵，10 分鐘後離開。 */
export function clueOrder(recipe: RecipeId, id: number, now: number): Order {
  return {
    id,
    kind: 'clue',
    recipe,
    requirements: [],
    coins: 0,
    xp: 0,
    energy: 0,
    expiresAt: now + BALANCE.clueDurationMs,
  };
}

/**
 * 建立新訂單時先擲貴客（FR27）。已發現至少 1 道發明菜、場上沒有貴客或線索單時才擲，
 * 不符合時不消耗亂數（一般訂單的亂數序列不受影響）。
 * 貴客判定成立、而且還有線索候選時，再擲一次：一半改為線索單，並記下 clueSeen（S4.2）。
 * 回傳 [貴客／線索單或 null, 推進亂數後的 state]；訂單 id 是 nextId，由呼叫端遞增。
 */
export function rollVip<S extends GameState>(
  state: S,
  now: number,
  allowSpecial = true
): [Order | null, S] {
  const discovered = discoveredRecipes(state);
  if (!allowSpecial || discovered.length === 0 || hasSpecialOrder(state.orders)) {
    return [null, state];
  }
  const [roll, afterRoll] = nextRandom(state);
  if (roll >= vipChance(state.stalls)) return [null, afterRoll];

  // 貴客只指定現在做得出來的菜：已發現、而且兩攤目前都 ≥ Lv2（E4 code review，使用者決定）
  const servable = discovered.filter((id) => canServe(afterRoll, id));
  const candidates = clueCandidates(afterRoll);
  if (candidates.length > 0) {
    // 沒有做得出的貴客菜時直接給線索，不多擲一次
    const [clueRoll, afterClueRoll] = servable.length > 0 ? nextRandom(afterRoll) : [0, afterRoll];
    if (clueRoll < BALANCE.clueChance) {
      const [index, afterPick] = randomInt(afterClueRoll, candidates.length);
      const recipe = candidates[index];
      const seen = afterPick.inventions[recipe];
      const withSeen = {
        ...afterPick,
        inventions: {
          ...afterPick.inventions,
          [recipe]: {
            discovered: seen?.discovered ?? false,
            made: seen?.made ?? 0,
            failures: seen?.failures ?? 0,
            clueSeen: true,
          },
        },
      };
      return [clueOrder(recipe, withSeen.nextId, now), withSeen];
    }
    const [index, afterPick] = randomInt(afterClueRoll, servable.length);
    return [vipOrder(afterPick, servable[index], afterPick.nextId), afterPick];
  }
  if (servable.length === 0) return [null, afterRoll];
  const [index, afterPick] = randomInt(afterRoll, servable.length);
  return [vipOrder(afterPick, servable[index], afterPick.nextId), afterPick];
}
