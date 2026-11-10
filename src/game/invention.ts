// 老闆發明（E3）：配方判定、發明菜、失敗計數、阿嬤提示。S3.1 先提供發明菜的衍生值，
// resolveDrop／applyDrop 在 S3.2 加入。
import { BALANCE, RECIPES_BY_ID, type RecipeId } from './content';
import { baseCost } from './engine';

/** 發明菜賣出價 = 兩個材料的 baseCost 總和 × 1.5（GDD M4）；衍生值，不存檔。 */
export function dishSellPrice(recipe: RecipeId): number {
  const { a, b } = RECIPES_BY_ID[recipe];
  return Math.round((baseCost(a.level) + baseCost(b.level)) * BALANCE.dishSellMultiplier);
}
