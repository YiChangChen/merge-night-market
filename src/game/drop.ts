// 拖放解析（NP-1）：一次拖放只會產生 6 種結果之一，判定只在這裡做。
// UI 落子一律呼叫 applyDrop（RC-4），再依事件播放動畫；動畫、阿嬤保底和埋點看到的結果才會一致。
import { cardStars } from './cards';
import { BOARD_SIZE, type ChainId, type RecipeId } from './content';
import { canMerge, flushPendingGenerators, movePiece } from './engine';
import type { GameEvent } from './events';
import {
  canInvent,
  createDish,
  findRecipe,
  inventableRecipes,
  isIngredientOf,
  recordInvention,
  recordRejection,
} from './invention';
import type { DishPiece, GameState, ItemPiece, Piece } from './types';

/** 同一格最多疊幾份發明菜（FR23） */
export const MAX_DISH_STACK = 3;

export type DropResult =
  | { kind: 'move' }
  | { kind: 'swap' }
  | { kind: 'merge'; chain: ChainId; level: number }
  | { kind: 'stack'; moved: number }
  | { kind: 'invent'; recipe: RecipeId }
  | { kind: 'reject'; affected: RecipeId[] };

const isItem = (piece: Piece): piece is ItemPiece => piece.kind === 'item';
const isDish = (piece: Piece): piece is DishPiece => piece.kind === 'dish';

/**
 * 判定把 from 的棋子拖到 to 會發生什麼（純函式，不改 state）。不合法的拖放回傳 null。
 * 順序：move → merge → stack → invent → reject → swap，先命中的優先。產生器碰到棋子一律 swap。
 */
export function resolveDrop(state: GameState, from: number, to: number): DropResult | null {
  if (from === to || to < 0 || to >= BOARD_SIZE || from < 0 || from >= BOARD_SIZE) return null;
  const source = state.board[from];
  if (!source) return null;
  const target = state.board[to];

  // 1 move
  if (!target) return { kind: 'move' };

  // 2 merge
  if (canMerge(source, target) && isItem(target)) {
    return { kind: 'merge', chain: target.chain, level: target.level + 1 };
  }

  // 3 stack：同一道發明菜，目標未滿
  if (
    isDish(source) &&
    isDish(target) &&
    source.recipe === target.recipe &&
    target.count < MAX_DISH_STACK
  ) {
    return { kind: 'stack', moved: Math.min(source.count, MAX_DISH_STACK - target.count) };
  }

  // 4–5 只看不同鏈的兩個品項：同鏈不算發明（同階已經是 merge，其餘交換位置）
  if (isItem(source) && isItem(target) && source.chain !== target.chain) {
    // 4 invent
    const recipe = findRecipe(source, target);
    if (recipe && canInvent(recipe, state.stalls)) return { kind: 'invent', recipe: recipe.id };

    // 5 reject：兩個都是「可發明配方」的材料，但湊不成同一道
    const inventable = inventableRecipes(state.stalls);
    const sourceIsIngredient = inventable.some((r) => isIngredientOf(r, source));
    const targetIsIngredient = inventable.some((r) => isIngredientOf(r, target));
    if (sourceIsIngredient && targetIsIngredient) {
      // 交給阿嬤保底（NP-3）：尚未發現、而且材料包含其中一個品項的配方
      const affected = inventable
        .filter((r) => !state.inventions[r.id]?.discovered)
        .filter((r) => isIngredientOf(r, source) || isIngredientOf(r, target))
        .map((r) => r.id);
      // 相關配方都發現過時，彈回沒有意義，還會讓這兩個品項永遠無法互換位置：改走 swap
      // （E3 code review 2026-11-11，使用者決定）
      if (affected.length > 0) return { kind: 'reject', affected };
    }
  }

  // 6 swap
  return { kind: 'swap' };
}

/** 依 resolveDrop 的結果套用變更並送出事件（UI 落子的唯一入口，RC-4）。 */
export function applyDrop(state: GameState, from: number, to: number, _now: number): GameState {
  const result = resolveDrop(state, from, to);
  if (!result) return state;

  switch (result.kind) {
    case 'move':
    case 'swap':
      return movePiece(state, from, to);

    case 'merge': {
      const next = movePiece(state, from, to);
      return {
        ...next,
        events: [...next.events, { type: 'item_merged', chain: result.chain, level: result.level }],
      };
    }

    case 'stack': {
      const source = state.board[from] as DishPiece;
      const target = state.board[to] as DishPiece;
      const board = [...state.board];
      const remaining = source.count - result.moved;
      // 目標保留原本的 id（Entity Patterns：疊加不產生新 id）
      board[to] = { ...target, count: (target.count + result.moved) as DishPiece['count'] };
      board[from] = remaining > 0 ? { ...source, count: remaining as DishPiece['count'] } : null;
      return flushPendingGenerators({ ...state, board });
    }

    case 'invent': {
      const [dish, withDish] = createDish(state, result.recipe);
      const [first, recorded] = recordInvention(withDish, result.recipe);
      const board = [...recorded.board];
      board[from] = null;
      board[to] = dish;
      const next = flushPendingGenerators({ ...recorded, board });
      // 升星（FR34）：made 每次 +1，最多跨一個門檻；0→1 是取得 ★1，由 dish_invented 代表。
      // 第一次發明一律不算升星（存檔就算是 discovered:false 但 made>0 也一樣；E5 code review）
      const before = cardStars(state.inventions[result.recipe]?.made ?? 0);
      const after = cardStars(recorded.inventions[result.recipe]?.made ?? 0);
      const starred: GameEvent[] =
        !first && before >= 1 && after > before
          ? [{ type: 'card_starred', recipe: result.recipe, stars: after }]
          : [];
      return {
        ...next,
        events: [
          ...next.events,
          { type: 'dish_invented', recipe: result.recipe, first },
          ...starred,
        ],
      };
    }

    case 'reject':
      // 不消耗任何東西，只播放彈回（S3.3）；受影響的配方累計失敗次數，第 5 次阿嬤說出答案（S4.4）
      return recordRejection(
        {
          ...state,
          events: [...state.events, { type: 'invent_rejected', recipes: result.affected }],
        },
        result.affected
      );
  }
}
