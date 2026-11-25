// Story 7.5：遊戲沒有失敗狀態（NFR12）。用規則層函式驗證幾種「看起來卡死」的局面都還有出路。
import { BALANCE, BOARD_SIZE, CHAIN_IDS, CHAINS, type ChainId, RECIPES } from '../content';
import {
  completeOrder,
  createGame,
  findOrderCells,
  type GameState,
  getSpawnBlocker,
  type Order,
  type Piece,
  sellPiece,
  stallsForPlayerLevel,
  syncEnergy,
  tapGenerator,
} from '../engine';
import { dismissOrder } from '../orders';
import { clueOrder, vipOrder } from '../vip';

const NOW = 1_000_000;
// 開幕週結束之後的時間點：體力上限 100（開幕週內也一樣會回復，這裡取比較嚴格的情況）
const LATER = NOW + BALANCE.openingWeekMs + 60 * 60 * 1000;

const item = (id: number, chain: ChainId, level: number): Piece => ({
  id,
  kind: 'item',
  chain,
  level,
});

const normal = (id: number, chain: ChainId, level: number): Order => ({
  id,
  kind: 'normal',
  requirements: [{ chain, level }],
  coins: 10,
  xp: 2,
  energy: 1,
});

/** 測試用的可重現亂數（不動 state 的 rngSeed） */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * 全部攤位都開著、棋盤 56 格全滿：前 5 格是 5 個產生器，其餘依 fill 填入。
 * 體力 0、金幣 0，時間在開幕週之後。
 */
function fullBoard(fill: (cell: number) => Piece, overrides: Partial<GameState> = {}): GameState {
  const base = createGame(NOW, 1);
  const board: (Piece | null)[] = Array<Piece | null>(BOARD_SIZE).fill(null);
  CHAIN_IDS.forEach((chain, index) => {
    board[index] = { id: index + 1, kind: 'generator', chain };
  });
  for (let cell = CHAIN_IDS.length; cell < BOARD_SIZE; cell++) board[cell] = fill(cell);
  return {
    ...base,
    level: 7,
    stalls: stallsForPlayerLevel(7),
    board,
    energy: 0,
    energyUpdatedAt: LATER,
    coins: 0,
    nextId: 10_000,
    ...overrides,
  };
}

/** 隨機的滿棋盤：每格是任一條鏈、任一階的品項 */
function randomFullBoard(seed: number, overrides: Partial<GameState> = {}): GameState {
  const rand = lcg(seed);
  return fullBoard((cell) => {
    const chain = CHAIN_IDS[Math.floor(rand() * CHAIN_IDS.length)];
    const level = 1 + Math.floor(rand() * CHAINS[chain].items.length);
    return item(100 + cell, chain, level);
  }, overrides);
}

const emptyCount = (state: GameState) => state.board.filter((piece) => piece === null).length;

describe('沒有失敗狀態（NFR12、S7.5）', () => {
  it('棋盤全滿（含 5 個產生器）、體力 0、金幣 0：至少能賣掉一格，或交出一張訂單', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const state = randomFullBoard(seed);
      expect(getSpawnBlocker(state)).toBe('board-full');

      const canComplete = state.orders.some((order) => findOrderCells(state, order) !== null);
      const sellable = state.board.findIndex(
        (piece) => piece !== null && piece.kind !== 'generator'
      );
      expect(canComplete || sellable !== -1).toBe(true);

      // 賣掉一格：空出一格、拿到金幣，而且不會因為金幣 0 就賣不了
      const sold = sellPiece(state, sellable);
      expect(emptyCount(sold)).toBe(1);
      expect(sold.coins).toBeGreaterThan(0);
    }
  });

  it('棋盤全滿、體力 0：時間過去後體力會回復，賣出一格後可以再產出', () => {
    const state = randomFullBoard(7);
    const later = LATER + BALANCE.energyRegenMs;
    const rested = syncEnergy(state, later);
    expect(rested.energy).toBe(1);

    const sold = sellPiece(rested, CHAIN_IDS.length);
    expect(getSpawnBlocker(sold)).toBeNull();
    const spawned = tapGenerator(sold, 0);
    expect(emptyCount(spawned)).toBe(0);
    expect(spawned.energy).toBe(0);
  });

  it('棋盤全滿而且沒有任何品項符合訂單：賣出品項可以空出格子', () => {
    // 訂單都要手搖飲 2 階，棋盤上只有炸物 1 階
    const orders = [normal(1, 'tea', 2), normal(2, 'tea', 3), normal(3, 'tea', 4)];
    const state = fullBoard((cell) => item(100 + cell, 'fried', 1), { orders });
    expect(state.orders.every((order) => findOrderCells(state, order) === null)).toBe(true);

    const sold = sellPiece(state, BOARD_SIZE - 1);
    expect(emptyCount(sold)).toBe(1);
    expect(getSpawnBlocker({ ...sold, energy: 1 })).toBeNull();
  });

  it('棋盤全滿、還有待放的產生器：賣出一格後產生器會被放上棋盤', () => {
    // 甜品的產生器在待放佇列，棋盤上只有 4 個產生器
    const state = fullBoard((cell) => item(100 + cell, 'fried', 1), {
      pendingGenerators: ['sweet'],
    });
    const board = [...state.board];
    board[CHAIN_IDS.indexOf('sweet')] = item(99, 'tea', 1);
    const blocked = { ...state, board };
    expect(blocked.board.some((p) => p?.kind === 'generator' && p.chain === 'sweet')).toBe(false);

    const sold = sellPiece(blocked, BOARD_SIZE - 1);
    expect(sold.pendingGenerators).toEqual([]);
    expect(sold.board[BOARD_SIZE - 1]).toMatchObject({ kind: 'generator', chain: 'sweet' });
  });

  it('唯一的貴客單指定的發明菜不在棋盤上：其他兩張訂單照常可做，人龍仍然可以消化', () => {
    const recipe = RECIPES[0];
    const base = fullBoard((cell) => item(100 + cell, 'tea', 2), {
      stalls: {
        ...stallsForPlayerLevel(7),
        tea: { level: 2, signatureDish: null },
        fried: { level: 2, signatureDish: null },
      },
      inventions: { [recipe.id]: { discovered: true, made: 1, failures: 0, clueSeen: false } },
    });
    const vip = vipOrder(base, recipe.id, 500);
    const state: GameState = {
      ...base,
      orders: [vip, normal(501, 'tea', 2), normal(502, 'tea', 2)],
    };
    // 棋盤上沒有發明菜，貴客單交不出去
    expect(findOrderCells(state, vip)).toBeNull();

    const remaining = state.queue.remaining;
    const first = completeOrder(state, 501, NOW);
    expect(first.queue.remaining).toBe(remaining - 1);
    const second = completeOrder(first, 502, NOW);
    expect(second.queue.remaining).toBe(remaining - 2);
    // 補上的訂單不會再是貴客：場上已經有一張貴客單了（hasSpecialOrder）
    expect(second.orders.filter((order) => order.kind !== 'normal')).toEqual([vip]);

    // 做不出來的貴客單也可以請走，補一張一般單（RC-9）
    const dismissed = dismissOrder(second, vip.id, NOW);
    expect(dismissed.orders.some((order) => order.id === vip.id)).toBe(false);
    expect(dismissed.orders).toHaveLength(BALANCE.orderSlots);
    expect(dismissed.orders.every((order) => order.kind === 'normal')).toBe(true);
  });

  it('線索單占用貴客上限：可以用「請客人先走」移除', () => {
    const recipe = RECIPES[0];
    const base = fullBoard((cell) => item(100 + cell, 'tea', 2), {
      stalls: {
        ...stallsForPlayerLevel(7),
        tea: { level: 2, signatureDish: null },
        fried: { level: 2, signatureDish: null },
      },
    });
    const clue = clueOrder(recipe.id, 500, NOW);
    const state: GameState = {
      ...base,
      orders: [clue, normal(501, 'tea', 2), normal(502, 'tea', 2)],
    };
    // 線索單不能交付
    expect(findOrderCells(state, clue)).toBeNull();

    const dismissed = dismissOrder(state, clue.id, NOW);
    expect(dismissed.orders.some((order) => order.kind === 'clue')).toBe(false);
    expect(dismissed.orders).toHaveLength(BALANCE.orderSlots);
    // 人龍不扣（RC-9）
    expect(dismissed.queue.remaining).toBe(state.queue.remaining);
  });
});
