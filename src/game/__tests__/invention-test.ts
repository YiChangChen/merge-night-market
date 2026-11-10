// Story 3.1 起：配方判定與發明菜的規則（invention.ts）。
import { RECIPE_IDS, type RecipeId } from '../content';
import { dishSellPrice } from '../invention';

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
