// 發明菜卡牌（E5）：星等推算與加成。星等是由 made 推算的衍生值，不寫入存檔（ADR-05）。
import { BALANCE, type RecipeId } from './content';
import type { GameState } from './types';

/** 卡牌星等（FR34）：達到門檻 1／3／6／10／15 份依序為 ★1–★5；made = 0 回傳 0（還沒取得）。 */
export function cardStars(made: number): number {
  return BALANCE.cardStarThresholds.filter((threshold) => made >= threshold).length;
}

/** 卡牌加成（貴客單金幣 × (1 + 加成)，FR28）：依星等 0／0／10／20／35／50%。 */
export function cardBonus(state: Pick<GameState, 'inventions'>, recipe: RecipeId): number {
  return BALANCE.cardStarBonus[cardStars(state.inventions[recipe]?.made ?? 0)];
}

/** 還差幾份升到下一顆星（收藏冊詳情，S5.2）；已經 ★5 回傳 null。 */
export function madeToNextStar(made: number): number | null {
  const next = BALANCE.cardStarThresholds.find((threshold) => made < threshold);
  return next === undefined ? null : next - made;
}
