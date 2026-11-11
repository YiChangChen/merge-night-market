// Story 1.6：產生器與訂單改由攤位控制（RC-1、RC-2、RC-3、FR7、FR8、FR11、FR15）
import { BALANCE, BOARD_SIZE, type ChainId } from '../content';
import {
  baseCost,
  completeOrder,
  createGame,
  expectedOrderCoins,
  type GameState,
  type Order,
  orderCoins,
  type Piece,
} from '../engine';
import type { StallLevel, StallState } from '../types';

const NOW = 1_000_000;

function stalls(levels: Partial<Record<ChainId, StallLevel>>): Record<ChainId, StallState> {
  const base = createGame(NOW, 1).stalls;
  const result = { ...base };
  for (const [chain, level] of Object.entries(levels) as [ChainId, StallLevel][]) {
    result[chain] = { level, signatureDish: null };
  }
  return result;
}

/** 放好訂單需要的品項並交單，回傳交單後的 state（會產生一張新訂單）。 */
/** 教學已完成的局：新訂單不套用新手金幣倍率（S6.4） */
function tutorialFinished(state: GameState): GameState {
  return { ...state, meta: { ...state.meta, tutorialStep: BALANCE.tutorialSteps } };
}

function fulfil(state: GameState, target: Order): GameState {
  const board = Array<Piece | null>(BOARD_SIZE).fill(null);
  target.requirements.forEach((requirement, index) => {
    board[index] = { id: 50_000 + index, kind: 'item', ...requirement };
  });
  return completeOrder({ ...state, board, orders: [target], nextId: 60_000 }, target.id, NOW);
}

const simpleOrder = (chain: ChainId, level: number): Order => ({
  id: 900,
  kind: 'normal',
  requirements: [{ chain, level }],
  coins: 10,
  xp: 0,
  energy: 0,
});

describe('orderCoins（FR8、FR15、RC-3）', () => {
  it('Lv1 攤位沒有加成：5 × baseCost', () => {
    expect(orderCoins([{ chain: 'tea', level: 3 }], stalls({}))).toBe(5 * baseCost(3));
  });

  it('每升 1 級加 10%：Lv2 為 ×1.1、Lv3 為 ×1.2', () => {
    expect(orderCoins([{ chain: 'tea', level: 2 }], stalls({ tea: 2 }))).toBe(11);
    expect(orderCoins([{ chain: 'tea', level: 4 }], stalls({ tea: 3 }))).toBe(48);
  });

  it('兩品項訂單分別依各自攤位的等級計算', () => {
    const requirements = [
      { chain: 'tea' as const, level: 2 },
      { chain: 'fried' as const, level: 3 },
    ];
    // tea Lv3：10 × 1.2 = 12；fried Lv1：20
    expect(orderCoins(requirements, stalls({ tea: 3 }))).toBe(32);
  });
});

describe('訂單由攤位控制', () => {
  it('新訂單的金幣依建立當下的攤位等級計算', () => {
    // 教學已完成：這裡比的是攤位加成，不含新手訂單的金幣倍率（S6.4）
    let state: GameState = {
      ...tutorialFinished(createGame(NOW, 3)),
      level: 6,
      stalls: stalls({ tea: 3, fried: 2 }),
    };
    for (let i = 0; i < 30; i++) {
      state = fulfil(state, simpleOrder('tea', 2));
      const created = state.orders[state.orders.length - 1];
      expect(created.coins).toBe(orderCoins(created.requirements, state.stalls));
    }
  });

  it('訂單金幣在建立時鎖定，之後攤位升級不會回溯（RC-3）', () => {
    const state = fulfil({ ...createGame(NOW, 3), level: 4 }, simpleOrder('tea', 2));
    const created = state.orders[state.orders.length - 1];

    const upgraded: GameState = { ...state, stalls: stalls({ tea: 3, fried: 3 }) };

    expect(upgraded.orders[upgraded.orders.length - 1].coins).toBe(created.coins);
  });

  it('重開的攤位會出現在新訂單裡；鐵捲門攤位不會', () => {
    let state: GameState = { ...createGame(NOW, 5), level: 9, stalls: stalls({ noodle: 1 }) };
    const seen = new Set<ChainId>();
    for (let i = 0; i < 80; i++) {
      state = fulfil({ ...state, level: 9 }, simpleOrder('tea', 2));
      for (const { chain } of state.orders[state.orders.length - 1].requirements) seen.add(chain);
    }
    expect(seen.has('noodle')).toBe(true);
    expect(seen.has('dumpling')).toBe(false);
    expect(seen.has('sweet')).toBe(false);
  });

  it('交單時送出 order_completed 事件，帶訂單種類與金幣', () => {
    const target = { ...simpleOrder('tea', 2), coins: 37 };

    const next = fulfil(createGame(NOW, 1), target);

    expect(next.events).toContainEqual({ type: 'order_completed', kind: 'normal', coins: 37 });
  });

  it('交單失敗時不送事件', () => {
    const state = createGame(NOW, 1);
    expect(completeOrder(state, 12345, NOW)).toBe(state);
  });
});

describe('expectedOrderCoins（各玩家等級每單期望金幣）', () => {
  const opening = stalls({});

  it('Lv1 開局：只會出 2 階品項，每單 10 金幣', () => {
    expect(expectedOrderCoins(1, opening)).toBe(10);
  });

  it('Lv2：2–3 階平均 15 金幣；Lv3 起有 40% 機率兩品項', () => {
    expect(expectedOrderCoins(2, opening)).toBeCloseTo(15, 10);
    expect(expectedOrderCoins(3, opening)).toBeCloseTo(15 * (1 + BALANCE.twoItemOrderChance), 10);
  });

  it('攤位加成反映在期望值裡；鐵捲門攤位不計入', () => {
    // Lv1：tea Lv2 → 11，fried Lv1 → 10，平均 10.5
    expect(expectedOrderCoins(1, stalls({ tea: 2 }))).toBeCloseTo(10.5, 10);
  });

  it('期望值和實際抽出的訂單相符（大量抽樣誤差 5% 以內）', () => {
    const level = 6;
    const open = stalls({ noodle: 1, dumpling: 2 });
    let state: GameState = { ...tutorialFinished(createGame(NOW, 11)), level, stalls: open };
    let total = 0;
    const samples = 3000;
    for (let i = 0; i < samples; i++) {
      state = fulfil({ ...state, level, xp: 0 }, simpleOrder('tea', 2));
      total += state.orders[state.orders.length - 1].coins;
    }
    expect(total / samples / expectedOrderCoins(level, open)).toBeCloseTo(1, 1);
  });
});

describe('鐵捲門攤位的倍率（code review 2026-11-10）', () => {
  it('攤位等級 0 不會產生 ×0.9 的負加成', () => {
    expect(orderCoins([{ chain: 'noodle', level: 2 }], stalls({ noodle: 0 }))).toBe(10);
  });
});
