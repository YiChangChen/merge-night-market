// Story 5.1：卡牌星等與加成（FR28、FR34、ADR-05）。
import { cardBonus, cardStars, madeToNextStar } from '../cards';
import { BALANCE, BOARD_SIZE, type ChainId, type RecipeId } from '../content';
import { applyDrop } from '../drop';
import { createGame, type GameState, type Piece } from '../engine';
import type { InventionState } from '../types';
import { vipOrder } from '../vip';

const NOW = 1_000_000;

const made = (count: number): InventionState => ({
  discovered: count > 0,
  made: count,
  failures: 0,
  clueSeen: false,
});

/** 棋盤上放紅茶 L3 與鹽酥雞 L3（格 0、1），tea、fried 都 Lv2；tea-fried 已做過 count 份 */
function setup(count: number): GameState {
  const base = createGame(NOW, 1);
  const board = Array<Piece | null>(BOARD_SIZE).fill(null);
  board[0] = { id: 1, kind: 'item', chain: 'tea', level: 3 };
  board[1] = { id: 2, kind: 'item', chain: 'fried', level: 3 };
  const stalls = { ...base.stalls };
  for (const chain of ['tea', 'fried'] as ChainId[])
    stalls[chain] = { level: 2, signatureDish: null };
  return {
    ...base,
    board,
    stalls,
    nextId: 1000,
    pendingGenerators: [],
    inventions: count > 0 ? { 'tea-fried': made(count) } : {},
  };
}

describe('cardStars：門檻 1／3／6／10／15（FR34）', () => {
  it.each([
    [0, 0],
    [1, 1],
    [2, 1],
    [3, 2],
    [5, 2],
    [6, 3],
    [9, 3],
    [10, 4],
    [14, 4],
    [15, 5],
    [99, 5],
  ])('made %i → ★%i', (count, stars) => {
    expect(cardStars(count)).toBe(stars);
  });

  it('門檻與加成表放在 BALANCE', () => {
    expect(BALANCE.cardStarThresholds).toEqual([1, 3, 6, 10, 15]);
    expect(BALANCE.cardStarBonus).toEqual([0, 0, 0.1, 0.2, 0.35, 0.5]);
  });
});

describe('cardBonus：依星等 0／10／20／35／50%（FR28、FR34）', () => {
  it('沒有紀錄或還沒做出來 → 0', () => {
    expect(cardBonus({ inventions: {} }, 'tea-fried')).toBe(0);
    expect(cardBonus({ inventions: { 'tea-fried': made(0) } }, 'tea-fried')).toBe(0);
  });

  it.each([
    [1, 0],
    [2, 0],
    [3, 0.1],
    [6, 0.2],
    [10, 0.35],
    [15, 0.5],
  ])('made %i → +%f', (count, bonus) => {
    expect(cardBonus({ inventions: { 'tea-fried': made(count) } }, 'tea-fried')).toBe(bonus);
  });

  it('只看這道配方自己的製作次數', () => {
    const inventions = { 'tea-noodle': made(15) } as Partial<Record<RecipeId, InventionState>>;
    expect(cardBonus({ inventions }, 'tea-fried')).toBe(0);
  });
});

describe('貴客單金幣套用卡牌加成（FR28）', () => {
  it.each([
    [1, 132],
    [3, 145],
    [6, 158],
    [10, 178],
    [15, 198],
  ])('紅茶鹽酥雞套餐 made %i：132 × (1 + 加成) 四捨五入 = %i', (count, coins) => {
    expect(vipOrder(setup(count), 'tea-fried', 1).coins).toBe(coins);
  });

  // code review：連乘的浮點誤差讓 x.5 算成 x.4999…，四捨五入少 1 金幣
  it.each([
    ['tea-sweet', 3, 380],
    ['tea-sweet', 15, 518],
    ['noodle-sweet', 10, 932],
  ] as const)('%s（一攤 Lv2、一攤 Lv3）made %i：剛好 .5 時進位 = %i', (recipe, count, coins) => {
    const base = createGame(NOW, 1);
    const [a, b] =
      recipe === 'tea-sweet' ? (['tea', 'sweet'] as const) : (['noodle', 'sweet'] as const);
    const state = {
      ...base,
      stalls: {
        ...base.stalls,
        [a]: { level: 2 as const, signatureDish: null },
        [b]: { level: 3 as const, signatureDish: null },
      },
      inventions: { [recipe]: made(count) },
    };
    expect(vipOrder(state, recipe, 1).coins).toBe(coins);
  });
});

describe('升星事件 card_starred（FR34）', () => {
  const starEvents = (state: GameState) =>
    applyDrop(state, 0, 1, NOW).events.filter((event) => event.type === 'card_starred');

  it('第一次做出來（0→1，★1）不算升星，只有 dish_invented', () => {
    expect(applyDrop(setup(0), 0, 1, NOW).events).toEqual([
      { type: 'dish_invented', recipe: 'tea-fried', first: true },
    ]);
  });

  it.each([
    [1, null],
    [2, 2],
    [3, null],
    [5, 3],
    [9, 4],
    [13, null],
    [14, 5],
    [15, null],
  ])('made %i 再做一份 → %p', (count, stars) => {
    expect(starEvents(setup(count))).toEqual(
      stars === null ? [] : [{ type: 'card_starred', recipe: 'tea-fried', stars }]
    );
  });

  it('第一次發明不會同時升星：存檔是 discovered:false 但 made>0（code review）', () => {
    const state = setup(2);
    const odd = {
      ...state,
      inventions: { 'tea-fried': { discovered: false, made: 2, failures: 0, clueSeen: false } },
    };
    expect(applyDrop(odd, 0, 1, NOW).events).toEqual([
      { type: 'dish_invented', recipe: 'tea-fried', first: true },
    ]);
  });

  it('事件順序：dish_invented 先、card_starred 後', () => {
    expect(applyDrop(setup(2), 0, 1, NOW).events).toEqual([
      { type: 'dish_invented', recipe: 'tea-fried', first: false },
      { type: 'card_starred', recipe: 'tea-fried', stars: 2 },
    ]);
  });

  it('舊存檔（A4）：made 已經 20 的存檔，讀進來不補發，再做一份也不會發', () => {
    expect(cardStars(20)).toBe(5);
    expect(starEvents(setup(20))).toEqual([]);
  });

  it('星等不寫進 state（ADR-05）：發明紀錄只有 discovered／made／failures／clueSeen', () => {
    const next = applyDrop(setup(2), 0, 1, NOW);
    expect(Object.keys(next.inventions['tea-fried'] ?? {}).sort()).toEqual([
      'clueSeen',
      'discovered',
      'failures',
      'made',
    ]);
  });
});

describe('madeToNextStar：下一顆星還差幾份（S5.2）', () => {
  it.each([
    [0, 1],
    [1, 2],
    [2, 1],
    [3, 3],
    [9, 1],
    [10, 5],
    [14, 1],
    [15, null],
    [40, null],
  ])('made %i → %p', (count, remaining) => {
    expect(madeToNextStar(count)).toBe(remaining);
  });
});
