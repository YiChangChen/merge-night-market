// Story 3.2：拖放解析（NP-1）。判定順序 move → merge → stack → invent → reject → swap。
import { BOARD_SIZE, type ChainId, RECIPES, type RecipeId } from '../content';
import { applyDrop, resolveDrop } from '../drop';
import { createGame, type GameState, type Piece } from '../engine';
import type { StallLevel } from '../types';

const NOW = 1_000_000;

const item = (id: number, chain: ChainId, level: number): Piece => ({
  id,
  kind: 'item',
  chain,
  level,
});
const dish = (id: number, recipe: RecipeId, count: 1 | 2 | 3): Piece => ({
  id,
  kind: 'dish',
  recipe,
  count,
});
const generator = (id: number, chain: ChainId): Piece => ({ id, kind: 'generator', chain });

/** 空棋盤，只放指定的格子；tea、fried 預設 Lv2（可以發明紅茶鹽酥雞套餐） */
function setup(
  cells: Record<number, Piece>,
  levels: Partial<Record<ChainId, StallLevel>> = { tea: 2, fried: 2 }
): GameState {
  const base = createGame(NOW, 1);
  const board = Array<Piece | null>(BOARD_SIZE).fill(null);
  for (const [cell, piece] of Object.entries(cells)) board[Number(cell)] = piece;
  const stalls = { ...base.stalls };
  for (const [chain, level] of Object.entries(levels) as [ChainId, StallLevel][]) {
    stalls[chain] = { level, signatureDish: null };
  }
  return { ...base, board, stalls, nextId: 1000, pendingGenerators: [] };
}

describe('resolveDrop：6 種判定（NP-1）', () => {
  it('1 move：目標是空格', () => {
    expect(resolveDrop(setup({ 0: item(1, 'tea', 3) }), 0, 5)).toEqual({ kind: 'move' });
  });

  it('2 merge：同鏈同階', () => {
    const state = setup({ 0: item(1, 'tea', 2), 1: item(2, 'tea', 2) });
    expect(resolveDrop(state, 0, 1)).toEqual({ kind: 'merge', chain: 'tea', level: 3 });
  });

  it('3 stack：同一道發明菜，目標未滿 3 份', () => {
    const state = setup({ 0: dish(1, 'tea-fried', 1), 1: dish(2, 'tea-fried', 1) });
    expect(resolveDrop(state, 0, 1)).toEqual({ kind: 'stack', moved: 1 });
  });

  it('4 invent：材料符合配方，兩攤都 ≥ Lv2', () => {
    const state = setup({ 0: item(1, 'tea', 3), 1: item(2, 'fried', 3) });
    expect(resolveDrop(state, 0, 1)).toEqual({ kind: 'invent', recipe: 'tea-fried' });
  });

  it('5 reject：兩個都是可發明配方的材料，但湊不成同一道', () => {
    // tea、fried、noodle 都 Lv2：可發明的是 tea-fried、tea-noodle、fried-noodle。
    // 鮮奶茶 L4 是 tea-noodle 的材料、鹽酥雞 L3 是 tea-fried 的材料，但兩者湊不成同一道
    const state = setup(
      { 0: item(1, 'tea', 4), 1: item(2, 'fried', 3) },
      {
        tea: 2,
        fried: 2,
        noodle: 2,
      }
    );
    expect(resolveDrop(state, 0, 1)).toEqual({
      kind: 'reject',
      affected: ['tea-fried', 'tea-noodle'],
    });
  });

  it('6 swap：其他情況（不是任何可發明配方的材料）', () => {
    const state = setup({ 0: item(1, 'tea', 1), 1: item(2, 'fried', 2) });
    expect(resolveDrop(state, 0, 1)).toEqual({ kind: 'swap' });
  });

  it('不合法的拖放回傳 null：同一格、超出棋盤、來源是空格', () => {
    const state = setup({ 0: item(1, 'tea', 3) });
    expect(resolveDrop(state, 0, 0)).toBeNull();
    expect(resolveDrop(state, 0, BOARD_SIZE)).toBeNull();
    expect(resolveDrop(state, 0, -1)).toBeNull();
    expect(resolveDrop(state, 3, 0)).toBeNull();
  });
});

describe('resolveDrop：邊界', () => {
  it('反方向拖曳也能發明（材料比對不分順序）', () => {
    const state = setup({ 0: item(1, 'fried', 3), 1: item(2, 'tea', 3) });
    expect(resolveDrop(state, 0, 1)).toEqual({ kind: 'invent', recipe: 'tea-fried' });
  });

  it('一攤 Lv1、一攤 Lv2：材料正確也走 swap', () => {
    const state = setup({ 0: item(1, 'tea', 3), 1: item(2, 'fried', 3) }, { tea: 2, fried: 1 });
    expect(resolveDrop(state, 0, 1)).toEqual({ kind: 'swap' });
  });

  it('產生器碰到任何棋子都走 swap；移到空格是 move', () => {
    const state = setup({ 0: generator(1, 'tea'), 1: item(2, 'tea', 3), 2: generator(3, 'fried') });
    expect(resolveDrop(state, 0, 1)).toEqual({ kind: 'swap' });
    expect(resolveDrop(state, 1, 0)).toEqual({ kind: 'swap' });
    expect(resolveDrop(state, 0, 2)).toEqual({ kind: 'swap' });
    expect(resolveDrop(state, 0, 9)).toEqual({ kind: 'move' });
  });

  it('同一道發明菜 2 + 2：目標疊到 3，來源剩 1', () => {
    const state = setup({ 0: dish(1, 'tea-fried', 2), 1: dish(2, 'tea-fried', 2) });
    expect(resolveDrop(state, 0, 1)).toEqual({ kind: 'stack', moved: 1 });
  });

  it('同一道發明菜，目標已經 3 份：swap', () => {
    const state = setup({ 0: dish(1, 'tea-fried', 1), 1: dish(2, 'tea-fried', 3) });
    expect(resolveDrop(state, 0, 1)).toEqual({ kind: 'swap' });
  });

  it('不同發明菜互拖、發明菜拖到品項：swap', () => {
    const state = setup({
      0: dish(1, 'tea-fried', 1),
      1: dish(2, 'fried-sweet', 1),
      2: item(3, 'tea', 3),
    });
    expect(resolveDrop(state, 0, 1)).toEqual({ kind: 'swap' });
    expect(resolveDrop(state, 0, 2)).toEqual({ kind: 'swap' });
    expect(resolveDrop(state, 2, 0)).toEqual({ kind: 'swap' });
  });

  it('同鏈的兩個品項不會走 reject（不同階）：swap', () => {
    // 紅茶 L3 是 tea-fried 的材料、鮮奶茶 L4 是 tea-noodle 的材料，但同一條鏈不算發明失敗
    const state = setup(
      { 0: item(1, 'tea', 3), 1: item(2, 'tea', 4) },
      {
        tea: 2,
        fried: 2,
        noodle: 2,
      }
    );
    expect(resolveDrop(state, 0, 1)).toEqual({ kind: 'swap' });
  });

  it('reject 的 affected 不含已發現的配方；全部發現過時仍然 reject，affected 為空', () => {
    const base = setup(
      { 0: item(1, 'tea', 4), 1: item(2, 'fried', 3) },
      {
        tea: 2,
        fried: 2,
        noodle: 2,
      }
    );
    const found = { discovered: true, made: 1, failures: 0, clueSeen: false };
    const oneFound = { ...base, inventions: { 'tea-fried': found } };
    expect(resolveDrop(oneFound, 0, 1)).toEqual({ kind: 'reject', affected: ['tea-noodle'] });

    const allFound = { ...base, inventions: { 'tea-fried': found, 'tea-noodle': found } };
    expect(resolveDrop(allFound, 0, 1)).toEqual({ kind: 'reject', affected: [] });
  });
});

describe('applyDrop', () => {
  it('invent：消耗兩個材料，在目標格產生發明菜，第一次 first = true', () => {
    const state = setup({ 0: item(1, 'tea', 3), 1: item(2, 'fried', 3) });
    const next = applyDrop(state, 0, 1, NOW);

    expect(next.board[0]).toBeNull();
    expect(next.board[1]).toEqual({ id: 1000, kind: 'dish', recipe: 'tea-fried', count: 1 });
    expect(next.nextId).toBe(1001);
    expect(next.inventions['tea-fried']).toEqual({
      discovered: true,
      made: 1,
      failures: 0,
      clueSeen: false,
    });
    expect(next.events).toEqual([{ type: 'dish_invented', recipe: 'tea-fried', first: true }]);
  });

  it('已發現的配方再做一次：made + 1，first = false，保留失敗次數與線索紀錄', () => {
    const state = {
      ...setup({ 0: item(1, 'fried', 3), 1: item(2, 'tea', 3) }),
      inventions: { 'tea-fried': { discovered: true, made: 2, failures: 4, clueSeen: true } },
    };
    const next = applyDrop(state, 0, 1, NOW);

    expect(next.inventions['tea-fried']).toEqual({
      discovered: true,
      made: 3,
      failures: 4,
      clueSeen: true,
    });
    expect(next.events).toEqual([{ type: 'dish_invented', recipe: 'tea-fried', first: false }]);
  });

  it('invent 騰出空格時，待放的產生器會放上棋盤', () => {
    const state = {
      ...setup({ 0: item(1, 'tea', 3), 1: item(2, 'fried', 3) }),
      pendingGenerators: ['noodle' as const],
    };
    const next = applyDrop(state, 0, 1, NOW);

    expect(next.pendingGenerators).toEqual([]);
    expect(next.board.some((p) => p?.kind === 'generator' && p.chain === 'noodle')).toBe(true);
  });

  it('reject：state 完全不變，只送出 invent_rejected', () => {
    const state = setup(
      { 0: item(1, 'tea', 4), 1: item(2, 'fried', 3) },
      {
        tea: 2,
        fried: 2,
        noodle: 2,
      }
    );
    const next = applyDrop(state, 0, 1, NOW);

    expect({ ...next, events: [] }).toEqual(state);
    expect(next.events).toEqual([
      { type: 'invent_rejected', recipes: ['tea-fried', 'tea-noodle'] },
    ]);
  });

  it('stack 2 + 2：目標 3 份並保留原 id，來源剩 1 份', () => {
    const state = setup({ 0: dish(1, 'tea-fried', 2), 1: dish(2, 'tea-fried', 2) });
    const next = applyDrop(state, 0, 1, NOW);

    expect(next.board[1]).toEqual(dish(2, 'tea-fried', 3));
    expect(next.board[0]).toEqual(dish(1, 'tea-fried', 1));
    expect(next.events).toEqual([]);
  });

  it('stack 1 + 1：來源清空', () => {
    const state = setup({ 0: dish(1, 'tea-fried', 1), 1: dish(2, 'tea-fried', 1) });
    const next = applyDrop(state, 0, 1, NOW);

    expect(next.board[1]).toEqual(dish(2, 'tea-fried', 2));
    expect(next.board[0]).toBeNull();
  });

  it('merge：產生新 id 的高一階品項，送出 item_merged', () => {
    const state = setup({ 0: item(1, 'tea', 2), 1: item(2, 'tea', 2) });
    const next = applyDrop(state, 0, 1, NOW);

    expect(next.board[0]).toBeNull();
    expect(next.board[1]).toEqual(item(1000, 'tea', 3));
    expect(next.events).toEqual([{ type: 'item_merged', chain: 'tea', level: 3 }]);
  });

  it('move 與 swap 不送出事件', () => {
    const moved = applyDrop(setup({ 0: dish(1, 'tea-fried', 1) }), 0, 5, NOW);
    expect(moved.board[5]).toEqual(dish(1, 'tea-fried', 1));
    expect(moved.events).toEqual([]);

    const swapped = applyDrop(setup({ 0: item(1, 'tea', 1), 1: item(2, 'fried', 2) }), 0, 1, NOW);
    expect(swapped.board[0]).toEqual(item(2, 'fried', 2));
    expect(swapped.board[1]).toEqual(item(1, 'tea', 1));
    expect(swapped.events).toEqual([]);
  });

  it('不合法的拖放回傳同一個 state', () => {
    const state = setup({ 0: item(1, 'tea', 3) });
    expect(applyDrop(state, 0, 0, NOW)).toBe(state);
    expect(applyDrop(state, 4, 0, NOW)).toBe(state);
  });
});

describe('Epic 3 完成定義：10 道配方都能觸發', () => {
  it.each(RECIPES.map((recipe) => [recipe.id, recipe] as const))('%s', (_id, recipe) => {
    const state = setup(
      {
        0: item(1, recipe.a.chain, recipe.a.level),
        1: item(2, recipe.b.chain, recipe.b.level),
      },
      { [recipe.a.chain]: 2, [recipe.b.chain]: 2 }
    );
    const next = applyDrop(state, 0, 1, NOW);

    expect(next.board[1]).toEqual({ id: 1000, kind: 'dish', recipe: recipe.id, count: 1 });
    expect(next.events).toEqual([{ type: 'dish_invented', recipe: recipe.id, first: true }]);
  });
});
