// Story 3.1 起：配方判定與發明菜的規則（invention.ts）。
import { RECIPE_IDS, type RecipeId } from '../content';
import { createGame } from '../engine';
import { dishSellPrice, hintRecipe, recordRejection } from '../invention';

describe('dishSellPrice（GDD：兩個材料的 baseCost 總和 × 1.5）', () => {
  const expected: Record<RecipeId, number> = {
    'tea-fried': 12, // 紅茶 L3（4）＋鹽酥雞 L3（4）
    'tea-noodle': 24, // 鮮奶茶 L4（8）＋蚵仔麵線 L4（8）
    'fried-noodle': 18, // 大雞排 L4（8）＋麵線 L3（4）
    'tea-dumpling': 24, // 鮮奶茶 L4（8）＋煎餃 L4（8）
    'fried-dumpling': 36, // 炸物拼盤 L5（16）＋煎餃 L4（8）
    'noodle-dumpling': 48, // 大腸麵線 L5（16）＋小籠包 L5（16）
    'tea-sweet': 30, // 珍珠奶茶 L5（16）＋雞蛋糕 L3（4）
    'fried-sweet': 9, // 鹽酥雞 L3（4）＋地瓜球 L2（2）
    'noodle-sweet': 60, // 總匯麵線 L6（32）＋糖葫蘆 L4（8）
    'dumpling-sweet': 72, // 蒸籠拼盤 L6（32）＋芒果冰 L5（16）
  };

  it.each(RECIPE_IDS)('%s', (recipe) => {
    expect(dishSellPrice(recipe)).toBe(expected[recipe]);
  });
});

// —— Story 4.4：阿嬤保底提示（NP-3、FR31、FR32）——

describe('recordRejection', () => {
  const NOW = 1_000_000;
  const base = () => createGame(NOW, 1);

  it('一次失敗讓 affected 裡每一道配方 +1；沒有紀錄時建立一筆', () => {
    const next = recordRejection(base(), ['tea-fried', 'tea-noodle']);
    expect(next.inventions['tea-fried']).toEqual({
      discovered: false,
      made: 0,
      failures: 1,
      clueSeen: false,
    });
    expect(next.inventions['tea-noodle']?.failures).toBe(1);
    expect(next.events).toEqual([]);
  });

  it('保留既有的線索紀錄', () => {
    const state = {
      ...base(),
      inventions: {
        'tea-noodle': { discovered: false, made: 0, failures: 2, clueSeen: true },
      },
    };
    expect(recordRejection(state, ['tea-noodle']).inventions['tea-noodle']).toEqual({
      discovered: false,
      made: 0,
      failures: 3,
      clueSeen: true,
    });
  });

  it('第 5 次：加入 hintedRecipes 並送出 hint_shown；之後不會再提示', () => {
    let state = base();
    for (let i = 0; i < 4; i++) state = recordRejection(state, ['tea-fried']);
    expect(state.events).toEqual([]);

    state = recordRejection(state, ['tea-fried']);
    expect(state.meta.hintedRecipes).toEqual(['tea-fried']);
    expect(state.events).toEqual([{ type: 'hint_shown', recipe: 'tea-fried' }]);

    const later = recordRejection({ ...state, events: [] }, ['tea-fried']);
    expect(later.inventions['tea-fried']?.failures).toBe(6);
    expect(later.meta.hintedRecipes).toEqual(['tea-fried']);
    expect(later.events).toEqual([]);
  });

  it('同一次失敗可以讓兩道配方同時到 5 次，各提示一次', () => {
    const four = { discovered: false, made: 0, failures: 4, clueSeen: false };
    const state = { ...base(), inventions: { 'tea-fried': four, 'tea-noodle': four } };
    const next = recordRejection(state, ['tea-fried', 'tea-noodle']);
    expect(next.meta.hintedRecipes).toEqual(['tea-fried', 'tea-noodle']);
    expect(next.events).toEqual([
      { type: 'hint_shown', recipe: 'tea-fried' },
      { type: 'hint_shown', recipe: 'tea-noodle' },
    ]);
  });

  it('已發現的配方不計數', () => {
    const found = { discovered: true, made: 1, failures: 0, clueSeen: false };
    const state = { ...base(), inventions: { 'tea-fried': found } };
    const next = recordRejection(state, ['tea-fried']);
    expect(next.inventions['tea-fried']).toEqual(found);
  });
});

describe('hintRecipe（教學提示與保底提示共用）', () => {
  it('加入 hintedRecipes、送出 hint_shown；已提示過時回傳原 state', () => {
    const state = createGame(1_000_000, 1);
    const once = hintRecipe(state, 'tea-fried');
    expect(once.meta.hintedRecipes).toEqual(['tea-fried']);
    expect(once.events).toEqual([{ type: 'hint_shown', recipe: 'tea-fried' }]);
    expect(hintRecipe(once, 'tea-fried')).toBe(once);
  });
});
