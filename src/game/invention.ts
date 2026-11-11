// 老闆發明（E3）：配方判定、發明菜、失敗計數、阿嬤提示。
// 拖放的判定順序在 drop.ts（NP-1）；這裡放配方相關的純函式與發明菜工廠。
import {
  BALANCE,
  type ChainId,
  type Ingredient,
  type Recipe,
  RECIPES,
  RECIPES_BY_ID,
  type RecipeId,
} from './content';
import { baseCost } from './engine';
import type { DishPiece, GameState, ItemPiece, StallState } from './types';

/** 發明菜賣出價 = 兩個材料的 baseCost 總和 × 1.5（GDD M4）；衍生值，不存檔。 */
export function dishSellPrice(recipe: RecipeId): number {
  const { a, b } = RECIPES_BY_ID[recipe];
  return Math.round((baseCost(a.level) + baseCost(b.level)) * BALANCE.dishSellMultiplier);
}

const matches = (ingredient: Ingredient, piece: ItemPiece) =>
  ingredient.chain === piece.chain && ingredient.level === piece.level;

/** 兩個品項湊得成哪一道配方（不分拖曳方向）。 */
export function findRecipe(a: ItemPiece, b: ItemPiece): Recipe | undefined {
  return RECIPES.find(
    (r) => (matches(r.a, a) && matches(r.b, b)) || (matches(r.a, b) && matches(r.b, a))
  );
}

/** 這道配方的兩個攤位都已達 Lv2，才能發明（FR22）。 */
export function canInvent(recipe: Recipe, stalls: Record<ChainId, StallState>): boolean {
  return stalls[recipe.a.chain].level >= 2 && stalls[recipe.b.chain].level >= 2;
}

/** 目前可以發明的配方（兩攤皆 ≥ Lv2），依 RECIPES 的順序。 */
export function inventableRecipes(stalls: Record<ChainId, StallState>): Recipe[] {
  return RECIPES.filter((recipe) => canInvent(recipe, stalls));
}

/** 這個品項是不是這道配方的材料。 */
export function isIngredientOf(recipe: Recipe, piece: ItemPiece): boolean {
  return matches(recipe.a, piece) || matches(recipe.b, piece);
}

/** 發明菜工廠（Entity Patterns）：回傳 [piece, nextState]，並遞增 nextId。 */
export function createDish(state: GameState, recipe: RecipeId): [DishPiece, GameState] {
  return [
    { id: state.nextId, kind: 'dish', recipe, count: 1 },
    { ...state, nextId: state.nextId + 1 },
  ];
}

/** 這道菜做出來一次：made + 1，第一次時 discovered = true；回傳是否為第一次。 */
export function recordInvention(state: GameState, recipe: RecipeId): [boolean, GameState] {
  const previous = state.inventions[recipe];
  const first = !previous?.discovered;
  return [
    first,
    {
      ...state,
      inventions: {
        ...state.inventions,
        [recipe]: {
          discovered: true,
          made: (previous?.made ?? 0) + 1,
          failures: previous?.failures ?? 0,
          clueSeen: previous?.clueSeen ?? false,
        },
      },
    },
  ];
}
