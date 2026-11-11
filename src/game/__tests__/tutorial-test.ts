// Story 6.4：新手教學的推進與新手訂單金幣（FR40）。
import { BALANCE, CHAINS } from '../content';
import {
  completeOrder,
  createGame,
  expectedOrderCoins,
  findMergePair,
  type GameState,
  type Piece,
} from '../engine';
import type { GameEvent } from '../events';
import { xpToNextLevel } from '../levels';
import { migrateV1ToV2 } from '../save/migrations';
import { useGameStore } from '../store';
import { advanceTutorial, tutorialDone, tutorialOrderCoinMultiplier } from '../tutorial';

const NOW = 1_000_000;

const at = (step: number, events: GameEvent[] = [], overrides: Partial<GameState> = {}) => {
  const base = createGame(NOW, 1);
  return { ...base, ...overrides, meta: { ...base.meta, tutorialStep: step }, events };
};

const MERGED: GameEvent = { type: 'item_merged', chain: 'tea', level: 2 };
const ORDER: GameEvent = { type: 'order_completed', kind: 'normal', coins: 25 };
const UPGRADED: GameEvent = { type: 'stall_upgraded', stall: 'tea', level: 2 };

describe('advanceTutorial：三步依序由事件推進（FR40）', () => {
  it.each([
    [0, MERGED, 1],
    [1, ORDER, 2],
    [2, UPGRADED, 3],
  ] as const)('step %i 收到這一步的事件 → %i', (step, event, next) => {
    expect(advanceTutorial(at(step, [event])).meta.tutorialStep).toBe(next);
  });

  it.each([
    [0, ORDER],
    [0, UPGRADED],
    [1, MERGED],
    [1, UPGRADED],
    [2, MERGED],
    [2, ORDER],
  ] as const)('step %i 收到別的事件不推進，回傳同一個參考', (step, event) => {
    const state = at(step, [event]);
    expect(advanceTutorial(state)).toBe(state);
  });

  it('同一批事件可以連續推進', () => {
    expect(advanceTutorial(at(0, [MERGED, ORDER])).meta.tutorialStep).toBe(2);
  });

  it('第 3 步：已經有攤位 ≥ Lv2 時直接算完成（自己先升級也算）', () => {
    const base = createGame(NOW, 1);
    const stalls = { ...base.stalls, fried: { level: 2 as const, signatureDish: null } };
    expect(advanceTutorial(at(2, [], { stalls })).meta.tutorialStep).toBe(3);
    // 還在第 1、2 步時不會跳過
    expect(advanceTutorial(at(1, [], { stalls })).meta.tutorialStep).toBe(1);
  });

  it('完成後不再變動', () => {
    const state = at(BALANCE.tutorialSteps, [MERGED, ORDER, UPGRADED]);
    expect(advanceTutorial(state)).toBe(state);
    expect(tutorialDone(state)).toBe(true);
    expect(tutorialDone(at(2))).toBe(false);
  });

  it('v1 遷移的玩家不出現教學', () => {
    const migrated = migrateV1ToV2(
      {
        version: 1,
        board: Array(BALANCE.boardColumns * BALANCE.boardRows).fill(null),
        orders: [],
        energy: 50,
        energyUpdatedAt: NOW,
        coins: 0,
        level: 4,
        xp: 0,
        pendingGenerators: [],
        nextId: 1,
        rngSeed: 1,
      },
      NOW
    );
    expect(tutorialDone(migrated)).toBe(true);
  });

  it('store 的 apply 在 action 之後推進教學', () => {
    useGameStore.setState({ state: at(0), status: { kind: 'ready' } });
    useGameStore.getState().apply((state) => ({ ...state, events: [MERGED] }));
    expect(useGameStore.getState().state?.meta.tutorialStep).toBe(1);
  });
});

describe('新手訂單金幣（AC4）', () => {
  it('教學期間 ×2.5，完成後恢復', () => {
    expect(BALANCE.tutorialOrderCoinMultiplier).toBe(2.5);
    expect(tutorialOrderCoinMultiplier(at(0))).toBe(2.5);
    expect(tutorialOrderCoinMultiplier(at(2))).toBe(2.5);
    expect(tutorialOrderCoinMultiplier(at(3))).toBe(1);
  });

  it('新局的一般單：Lv1 每張 25 金幣', () => {
    for (const order of createGame(NOW, 1).orders) {
      expect(order.coins).toBe(25);
    }
  });

  it('教學完成後建立的訂單恢復原價', () => {
    const done = at(BALANCE.tutorialSteps, [], { orders: [] });
    const state = fulfilFirst({ ...done, orders: createGame(NOW, 1).orders });
    expect(state.orders[state.orders.length - 1].coins).toBe(10);
  });

  it('expectedOrderCoins 驗證：8 張訂單以內存到 200 金幣', () => {
    // 前 3 張是開局建立的；之後每交 1 張補 1 張，補單時的玩家等級依累計 XP（Lv1 每張 2 XP）
    const opening = createGame(NOW, 1).stalls;
    let level = 1;
    let xp = 0;
    const levels = [1, 1, 1];
    for (let done = 1; levels.length < 8; done++) {
      xp += 2;
      while (xp >= xpToNextLevel(level)) {
        xp -= xpToNextLevel(level);
        level += 1;
      }
      levels.push(level);
    }
    const total = levels.reduce(
      (sum, created) =>
        sum + expectedOrderCoins(created, opening) * BALANCE.tutorialOrderCoinMultiplier,
      0
    );
    expect(total).toBeGreaterThanOrEqual(200);
  });

  it('實際交 8 張單（50 個 seed）：每一局都存到 200 金幣', () => {
    for (let seed = 1; seed <= 50; seed++) {
      let state = createGame(NOW, seed);
      for (let i = 0; i < 8; i++) state = fulfilFirst(state);
      expect(state.coins).toBeGreaterThanOrEqual(200);
    }
  });
});

/** 把第一張訂單要的品項直接放上棋盤的空格，然後交單 */
function fulfilFirst(state: GameState): GameState {
  const order = state.orders[0];
  const board = [...state.board];
  let id = 90_000 + state.nextId;
  for (const requirement of order.requirements) {
    const cell = board.lastIndexOf(null);
    board[cell] = { id: id++, kind: 'item', chain: requirement.chain, level: requirement.level };
  }
  return completeOrder({ ...state, board }, order.id, NOW);
}

describe('findMergePair：棋盤上可以合成的一對（S6.4 合成提示）', () => {
  const empty = () => Array<Piece | null>(BALANCE.boardColumns * BALANCE.boardRows).fill(null);

  it('找到第一對相同品項（依格子順序）', () => {
    const board = empty();
    board[0] = { id: 1, kind: 'generator', chain: 'tea' };
    board[3] = { id: 2, kind: 'item', chain: 'tea', level: 1 };
    board[5] = { id: 3, kind: 'item', chain: 'fried', level: 1 };
    board[9] = { id: 4, kind: 'item', chain: 'tea', level: 1 };
    board[10] = { id: 5, kind: 'item', chain: 'fried', level: 1 };
    expect(findMergePair(board)).toEqual([3, 9]);
  });

  it('沒有可以合成的一對：不同鏈、不同階、產生器、已到頂的品項都不算', () => {
    const board = empty();
    board[0] = { id: 1, kind: 'generator', chain: 'tea' };
    board[1] = { id: 2, kind: 'generator', chain: 'tea' };
    board[2] = { id: 3, kind: 'item', chain: 'tea', level: 1 };
    board[3] = { id: 4, kind: 'item', chain: 'tea', level: 2 };
    board[4] = { id: 5, kind: 'item', chain: 'fried', level: 1 };
    expect(findMergePair(board)).toBeNull();
    // 已到最高階的兩個品項不能再合成
    const max = CHAINS.tea.items.length;
    board[10] = { id: 6, kind: 'item', chain: 'tea', level: max };
    board[11] = { id: 7, kind: 'item', chain: 'tea', level: max };
    expect(findMergePair(board)).toBeNull();
  });
});
