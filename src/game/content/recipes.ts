// 遊戲內容：10 道配方與發明菜（FR26、FR30）。文字依 docs/content.md 第 2、3 節定稿（S1.0）；
// 圖示是 art-manifest E3 批次（#32–#41，2026-11-11 定稿）。
import type { ChainId } from './chains';

/** 配方的一個材料：某條鏈的某一階品項 */
export type Ingredient = { chain: ChainId; level: number };

export type RecipeDef = {
  /** `材料 A 鏈-材料 B 鏈`，也是發明菜圖示與卡面的檔名 */
  id: string;
  a: Ingredient;
  b: Ingredient;
  /** 發明菜名稱 */
  name: string;
  /** 線索單上的台詞（E4） */
  clue: string;
  /** 負責發明這道菜的老闆（攤位）；首次發明演出由他登場（S3.4） */
  owner: ChainId;
  /** 發明菜圖示（require 回傳的素材 id） */
  art: number;
};

export const RECIPES = [
  {
    id: 'tea-fried',
    a: { chain: 'tea', level: 3 },
    b: { chain: 'fried', level: 3 },
    name: '紅茶鹽酥雞套餐',
    clue: '好想來杯紅茶，配一包鹹酥的……',
    owner: 'tea',
    art: require('../../../assets/images/dishes/tea-fried.webp'),
  },
  {
    id: 'tea-noodle',
    a: { chain: 'tea', level: 4 },
    b: { chain: 'noodle', level: 4 },
    name: '茶香蚵仔麵線',
    clue: '🍃 這碗麵線湯裡，怎麼飄著一股奶香跟茶香……',
    owner: 'noodle',
    art: require('../../../assets/images/dishes/tea-noodle.webp'),
  },
  {
    id: 'fried-noodle',
    a: { chain: 'fried', level: 4 },
    b: { chain: 'noodle', level: 3 },
    name: '雞排麵線',
    clue: '我想要一碗麵線，上面蓋一整片酥脆的那種！',
    owner: 'fried',
    art: require('../../../assets/images/dishes/fried-noodle.webp'),
  },
  {
    id: 'tea-dumpling',
    a: { chain: 'tea', level: 4 },
    b: { chain: 'dumpling', level: 4 },
    name: '奶茶煎餃',
    clue: '煎得脆脆的餃子，配一杯奶茶剛剛好吧？',
    owner: 'dumpling',
    art: require('../../../assets/images/dishes/tea-dumpling.webp'),
  },
  {
    id: 'fried-dumpling',
    a: { chain: 'fried', level: 5 },
    b: { chain: 'dumpling', level: 4 },
    name: '炸煎雙拼',
    clue: '炸的也想吃、煎的也想吃，可以裝在同一盤嗎？',
    owner: 'fried',
    art: require('../../../assets/images/dishes/fried-dumpling.webp'),
  },
  {
    id: 'noodle-dumpling',
    a: { chain: 'noodle', level: 5 },
    b: { chain: 'dumpling', level: 5 },
    name: '麵線小籠湯',
    clue: '🍃 濃濃的大腸湯頭裡，泡著一咬就爆汁的小東西……',
    owner: 'noodle',
    art: require('../../../assets/images/dishes/noodle-dumpling.webp'),
  },
  {
    id: 'tea-sweet',
    a: { chain: 'tea', level: 5 },
    b: { chain: 'sweet', level: 3 },
    name: '珍奶雞蛋糕',
    clue: '🍃 QQ 的珍珠，配上剛出爐的蛋香……',
    owner: 'tea',
    art: require('../../../assets/images/dishes/tea-sweet.webp'),
  },
  {
    id: 'fried-sweet',
    a: { chain: 'fried', level: 3 },
    b: { chain: 'sweet', level: 2 },
    name: '甜鹹地瓜雞',
    clue: '🍃 怎麼有一股甜甜鹹鹹的香味……',
    owner: 'sweet',
    art: require('../../../assets/images/dishes/fried-sweet.webp'),
  },
  {
    id: 'noodle-sweet',
    a: { chain: 'noodle', level: 6 },
    b: { chain: 'sweet', level: 4 },
    name: '夜市甜鹹雙拼',
    clue: '🍃 吃完一大碗鹹的，嘴裡好想來一口酸酸甜甜的脆糖。',
    owner: 'sweet',
    art: require('../../../assets/images/dishes/noodle-sweet.webp'),
  },
  {
    id: 'dumpling-sweet',
    a: { chain: 'dumpling', level: 6 },
    b: { chain: 'sweet', level: 5 },
    name: '冰火小籠塔',
    clue: '一口熱呼呼的蒸籠點心，一口冰涼的芒果……冰與火！',
    owner: 'dumpling',
    art: require('../../../assets/images/dishes/dumpling-sweet.webp'),
  },
] as const satisfies readonly RecipeDef[];

export type RecipeId = (typeof RECIPES)[number]['id'];

export const RECIPE_IDS: readonly RecipeId[] = RECIPES.map((recipe) => recipe.id);

export const RECIPES_BY_ID = Object.fromEntries(
  RECIPES.map((recipe) => [recipe.id, recipe])
) as Record<RecipeId, RecipeDef>;
