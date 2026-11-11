// 發明菜卡牌（E5）：星等推算與加成。E4 先提供介面，貴客單的金幣公式會呼叫它。
import type { RecipeId } from './content';
import type { GameState } from './types';

/** 卡牌加成（貴客單金幣 × (1 + 加成)，FR28）。E5 接上星等之前一律為 0。 */
export function cardBonus(_state: Pick<GameState, 'inventions'>, _recipe: RecipeId): number {
  return 0;
}
