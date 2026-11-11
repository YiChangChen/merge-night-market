// Story 4.1：貴客單（FR27、FR28、RC-8）。
import { BALANCE, BOARD_SIZE, type ChainId, type RecipeId } from '../content';
import { completeOrder, createGame, type GameState, type Order, type Piece } from '../engine';
import { isValidSaveV2, serializeSave } from '../save';
import type { InventionState, StallLevel } from '../types';
import { needsTick, syncAll } from '../time';
import { dismissOrder, syncOrders } from '../orders';
import { hasSpecialOrder, rollVip, vipChance, vipOrder } from '../vip';

const NOW = 1_000_000;
const FOUND: InventionState = { discovered: true, made: 1, failures: 0, clueSeen: false };

function setup(
  options: {
    levels?: Partial<Record<ChainId, StallLevel>>;
    found?: RecipeId[];
    orders?: Order[];
    cells?: Record<number, Piece>;
    seed?: number;
  } = {}
): GameState {
  const base = createGame(NOW, options.seed ?? 1);
  const stalls = { ...base.stalls };
  for (const [chain, level] of Object.entries(options.levels ?? { tea: 2, fried: 2 }) as [
    ChainId,
    StallLevel,
  ][]) {
    stalls[chain] = { level, signatureDish: null };
  }
  const board = Array<Piece | null>(BOARD_SIZE).fill(null);
  for (const [cell, piece] of Object.entries(options.cells ?? {})) board[Number(cell)] = piece;
  return {
    ...base,
    stalls,
    board,
    nextId: 1000,
    inventions: Object.fromEntries((options.found ?? []).map((id) => [id, FOUND])),
    orders: options.orders ?? [],
  };
}

const normal = (id: number): Order => ({
  id,
  kind: 'normal',
  requirements: [{ chain: 'tea', level: 2 }],
  coins: 10,
  xp: 2,
  energy: 1,
});

describe('vipChance（FR27）', () => {
  it('20% + 2% × (Σ攤位等級 − 2)，上限 40%', () => {
    const lv = (levels: Partial<Record<ChainId, StallLevel>>) => setup({ levels }).stalls;
    expect(vipChance(lv({ tea: 1, fried: 1 }))).toBeCloseTo(0.2);
    expect(vipChance(lv({ tea: 2, fried: 2 }))).toBeCloseTo(0.24);
    expect(vipChance(lv({ tea: 3, fried: 3, noodle: 3, dumpling: 3 }))).toBeCloseTo(0.4);
    expect(vipChance(lv({ tea: 3, fried: 3, noodle: 3, dumpling: 3, sweet: 3 }))).toBe(
      BALANCE.vipMaxChance
    );
  });
});

describe('vipOrder：金幣、XP、體力（FR28）', () => {
  it('紅茶鹽酥雞套餐、兩攤 Lv2：5 × 8 × 1.1 × 3 = 132 金幣，XP (3 + 3) × 2 = 12', () => {
    const order = vipOrder(setup(), 'tea-fried', 77);
    expect(order).toEqual({
      id: 77,
      kind: 'vip',
      recipe: 'tea-fried',
      requirements: [],
      coins: 132,
      xp: 12,
      // 和一般訂單同一個公式：ceil((4 + 4) × 0.3)
      energy: 3,
    });
  });

  it('兩攤等級不同時取加成平均：冰火小籠塔、蒸籠 Lv3 甜品 Lv2', () => {
    const state = setup({ levels: { tea: 1, fried: 1, dumpling: 3, sweet: 2 } });
    // 5 × (32 + 16) × (1.2 + 1.1) / 2 × 3 = 828
    expect(vipOrder(state, 'dumpling-sweet', 1).coins).toBe(828);
  });
});

describe('rollVip', () => {
  it('尚未發現任何發明菜：不會出現貴客單，也不消耗亂數', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const state = setup({ seed });
      const [order, next] = rollVip(state, NOW);
      expect(order).toBeNull();
      expect(next).toBe(state);
    }
  });

  it('已經有貴客或線索單：不會再出現（同時最多 1 張）', () => {
    const vip: Order = { ...normal(5), kind: 'vip', recipe: 'tea-fried', requirements: [] };
    expect(hasSpecialOrder([normal(4), vip])).toBe(true);
    // 換 200 個 seed：只靠單一 seed 的話，可能剛好擲到「不是貴客」而誤判為通過（E3 retro A4）
    for (let seed = 1; seed <= 200; seed++) {
      const state = setup({ seed, found: ['tea-fried'], orders: [normal(4), vip] });
      expect(rollVip(state, NOW)[0]).toBeNull();
    }
  });

  it('固定 seed 下結果可重現；長期比例接近 vipChance', () => {
    // 三攤都 Lv2 的三道配方都發現過：沒有線索候選，只會出現貴客單
    let state = setup({
      found: ['tea-fried', 'fried-sweet', 'tea-sweet'],
      levels: { tea: 2, fried: 2, sweet: 2 },
    });
    const again = rollVip(state, NOW);
    expect(rollVip(state, NOW)).toEqual(again);

    let vips = 0;
    const picked = new Set<string>();
    const rolls = 2000;
    for (let i = 0; i < rolls; i++) {
      const [order, next] = rollVip(state, NOW);
      state = next;
      if (order) {
        vips += 1;
        picked.add(order.recipe as string);
        expect(order.id).toBe(1000);
      }
    }
    // Σ等級 = 6 → 28%
    expect(vips / rolls).toBeGreaterThan(0.24);
    expect(vips / rolls).toBeLessThan(0.32);
    // 只會指定已發現的配方，三道都會出現
    expect([...picked].sort()).toEqual(['fried-sweet', 'tea-fried', 'tea-sweet']);
  });
});

describe('createOrder 與 completeOrder', () => {
  /** 找一個 seed，讓「交完一般訂單後補的新訂單」是貴客單 */
  function stateWhereNextOrderIsVip(): GameState {
    for (let seed = 1; seed < 500; seed++) {
      const state = setup({
        seed,
        found: ['tea-fried'],
        orders: [normal(900)],
        cells: { 0: { id: 1, kind: 'item', chain: 'tea', level: 2 } },
      });
      const next = completeOrder(state, 900, NOW);
      if (next.orders[next.orders.length - 1].kind === 'vip') return state;
    }
    throw new Error('找不到會產生貴客單的 seed');
  }

  it('交完一般訂單後，新訂單可能是貴客單（id 為 nextId，存檔合法）', () => {
    const next = completeOrder(stateWhereNextOrderIsVip(), 900, NOW);
    const vip = next.orders[next.orders.length - 1];
    expect(vip).toMatchObject({ kind: 'vip', recipe: 'tea-fried', requirements: [] });
    expect(isValidSaveV2(JSON.parse(serializeSave(next)))).toBe(true);
  });

  it('交付貴客單：扣 1 份發明菜（3 → 2）、拿到金幣與 XP、人龍 −1、送出 order_completed { kind: vip }', () => {
    const vip = vipOrder(setup(), 'tea-fried', 500);
    const state = setup({
      found: ['tea-fried'],
      orders: [vip],
      cells: { 3: { id: 7, kind: 'dish', recipe: 'tea-fried', count: 3 } },
    });
    const before = { ...state, coins: 0, level: 20 };
    const next = completeOrder(before, 500, NOW);

    expect(next.board[3]).toEqual({ id: 7, kind: 'dish', recipe: 'tea-fried', count: 2 });
    expect(next.coins).toBe(132);
    expect(next.queue.remaining).toBe(before.queue.remaining - 1);
    expect(next.events).toContainEqual({ type: 'order_completed', kind: 'vip', coins: 132 });
    expect(next.orders.find((o) => o.id === 500)).toBeUndefined();
  });

  it('交付貴客單扣到 0 份時清空格子；棋盤上沒有那道菜時不能交付', () => {
    const vip = vipOrder(setup(), 'tea-fried', 500);
    const one = setup({
      found: ['tea-fried'],
      orders: [vip],
      cells: { 3: { id: 7, kind: 'dish', recipe: 'tea-fried', count: 1 } },
    });
    expect(completeOrder(one, 500, NOW).board[3]).toBeNull();

    const none = setup({
      found: ['tea-fried'],
      orders: [vip],
      cells: { 3: { id: 7, kind: 'dish', recipe: 'fried-sweet', count: 3 } },
    });
    expect(completeOrder(none, 500, NOW)).toBe(none);
  });

  it('交完貴客單後補的新訂單可以再是貴客（剛交的那張不算在場上）', () => {
    const vip = vipOrder(setup(), 'tea-fried', 500);
    let found = false;
    for (let seed = 1; seed < 500 && !found; seed++) {
      const state = setup({
        seed,
        found: ['tea-fried'],
        orders: [vip],
        cells: { 3: { id: 7, kind: 'dish', recipe: 'tea-fried', count: 3 } },
      });
      const next = completeOrder(state, 500, NOW);
      found = next.orders.some((o) => o.kind === 'vip');
    }
    expect(found).toBe(true);
  });
});

// —— Story 4.2：線索單（FR29、FR30、RC-9）——

const CLUE_MS = BALANCE.clueDurationMs;
const clue = (id: number, recipe: RecipeId, expiresAt: number): Order => ({
  id,
  kind: 'clue',
  recipe,
  requirements: [],
  coins: 0,
  xp: 0,
  energy: 0,
  expiresAt,
});

describe('rollVip：線索單', () => {
  // tea、fried、sweet 都 Lv2，只發現 tea-fried：tea-sweet、fried-sweet 是線索候選
  const withCandidates = (seed: number) =>
    setup({ seed, found: ['tea-fried'], levels: { tea: 2, fried: 2, sweet: 2 } });

  it('有候選時，貴客判定成立後約一半改為線索單：10 分鐘後離開、設定 clueSeen、只指定候選', () => {
    let clues = 0;
    let vips = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const [order, next] = rollVip(withCandidates(seed), NOW);
      if (order?.kind === 'clue') {
        clues += 1;
        expect(order).toMatchObject({ requirements: [], coins: 0, xp: 0, energy: 0 });
        expect(order.expiresAt).toBe(NOW + CLUE_MS);
        expect(['tea-sweet', 'fried-sweet']).toContain(order.recipe);
        expect(next.inventions[order.recipe as RecipeId]?.clueSeen).toBe(true);
        expect(next.inventions[order.recipe as RecipeId]?.discovered).toBe(false);
      } else if (order?.kind === 'vip') {
        vips += 1;
        expect(order.recipe).toBe('tea-fried');
      }
    }
    expect(clues).toBeGreaterThan(0);
    expect(vips).toBeGreaterThan(0);
    // 50%：兩者數量相近
    expect(Math.abs(clues - vips)).toBeLessThan((clues + vips) * 0.3);
  });

  it('沒有候選（相關配方都發現過、或另一攤還沒 Lv2）時不會產生線索單', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const allFound = setup({ seed, found: ['tea-fried'] });
      expect(rollVip(allFound, NOW)[0]?.kind).not.toBe('clue');
      const sweetLv1 = setup({
        seed,
        found: ['tea-fried'],
        levels: { tea: 2, fried: 2, sweet: 1 },
      });
      expect(rollVip(sweetLv1, NOW)[0]?.kind).not.toBe('clue');
    }
  });

  it('場上已有線索單時不會再出現貴客或線索（同時最多 1 張）', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const state = {
        ...withCandidates(seed),
        orders: [normal(1), clue(2, 'tea-sweet', NOW + CLUE_MS)],
      };
      expect(rollVip(state, NOW)[0]).toBeNull();
    }
  });
});

describe('線索單不能交付', () => {
  it('completeOrder 對線索單回傳原 state，不扣人龍', () => {
    const state = setup({ found: ['tea-fried'], orders: [clue(5, 'tea-sweet', NOW + CLUE_MS)] });
    expect(completeOrder(state, 5, NOW)).toBe(state);
  });
});

describe('syncOrders：線索單到期（四種時間情境，E2 retro A3）', () => {
  const base = () =>
    setup({
      found: ['tea-fried'],
      orders: [normal(1), clue(2, 'tea-sweet', NOW + CLUE_MS), normal(3)],
    });

  it('正常：還沒到期時回傳同一個參考', () => {
    const state = base();
    expect(syncOrders(state, NOW + CLUE_MS - 1)).toBe(state);
  });

  it('到期（剛好等於也算）：移除線索單、補一張新訂單排在最後，不動人龍', () => {
    const state = base();
    const next = syncOrders(state, NOW + CLUE_MS);
    expect(next.orders.map((o) => o.id)).toEqual([1, 3, 1000]);
    expect(next.orders.some((o) => o.id === 2)).toBe(false);
    expect(next.queue).toEqual(state.queue);
    expect(next.nextId).toBe(1001);
  });

  it('時鐘倒退：剩餘時間截到 10 分鐘以內', () => {
    const rewound = NOW - 60 * 60 * 1000;
    const next = syncOrders(base(), rewound);
    expect(next.orders[1].expiresAt).toBe(rewound + CLUE_MS);
  });

  it('快轉後：syncAll 一次就移除到期的線索單', () => {
    const next = syncAll(base(), NOW + 2 * CLUE_MS);
    expect(next.orders.some((o) => o.kind === 'clue' && o.id === 2)).toBe(false);
    expect(next.orders).toHaveLength(3);
  });
});

describe('needsTick：線索單（AC5 修訂）', () => {
  const full = (expiresAt: number) =>
    setup({
      found: ['tea-fried'],
      orders: [clue(2, 'tea-sweet', expiresAt)],
    });

  it('體力已滿：線索單到期時為 true（才會移除），還沒到期時為 false（不每秒存檔）', () => {
    const state = { ...full(NOW + CLUE_MS), energy: BALANCE.maxEnergy };
    expect(needsTick(state, NOW)).toBe(false);
    expect(needsTick(state, NOW + CLUE_MS)).toBe(true);
  });

  it('時鐘倒退讓剩餘時間超過 10 分鐘：true（立刻截短）', () => {
    const state = { ...full(NOW + CLUE_MS), energy: BALANCE.maxEnergy };
    expect(needsTick(state, NOW - 60 * 60 * 1000)).toBe(true);
  });
});

describe('dismissOrder：請客人先走（RC-9）', () => {
  it('移除線索單、補一張新訂單，不動人龍', () => {
    const state = setup({
      found: ['tea-fried'],
      orders: [normal(1), clue(2, 'tea-sweet', NOW + CLUE_MS)],
    });
    const next = dismissOrder(state, 2, NOW);
    expect(next.orders.map((o) => o.id)).toEqual([1, 1000]);
    expect(next.queue).toEqual(state.queue);
  });

  it('對一般單、貴客單、不存在的訂單呼叫時回傳原 state', () => {
    const vip = vipOrder(setup(), 'tea-fried', 4);
    const state = setup({ found: ['tea-fried'], orders: [normal(1), vip] });
    expect(dismissOrder(state, 1, NOW)).toBe(state);
    expect(dismissOrder(state, 4, NOW)).toBe(state);
    expect(dismissOrder(state, 99, NOW)).toBe(state);
  });
});

describe('存檔驗證：線索單', () => {
  it('接受線索單；拒絕沒有到期時間或帶獎勵的線索單', () => {
    const state = setup({
      found: ['tea-fried'],
      orders: [normal(1), clue(2, 'tea-sweet', NOW + CLUE_MS)],
    });
    const valid = (s: GameState) => isValidSaveV2(JSON.parse(serializeSave(s)));
    expect(valid(state)).toBe(true);

    const noExpiry = {
      ...state,
      orders: [normal(1), { ...clue(2, 'tea-sweet', 0), expiresAt: undefined }],
    };
    expect(valid(noExpiry)).toBe(false);
    const withReward = {
      ...state,
      orders: [normal(1), { ...clue(2, 'tea-sweet', NOW), coins: 50 }],
    };
    expect(valid(withReward)).toBe(false);
  });
});
