import {
  BALANCE,
  BOARD_SIZE,
  CHAIN_IDS,
  CHAINS,
  type ChainId,
  CUSTOMERS,
  VIP_CUSTOMERS,
} from '../content';
import {
  canMerge,
  completeOrder,
  createGame,
  customerForOrder,
  findMerges,
  findOrderCells,
  findSpawns,
  type GameState,
  getSpawnBlocker,
  movePiece,
  msUntilNextEnergy,
  type Order,
  type Piece,
  dishSellPrice,
  sellPiece,
  syncEnergy,
  tapGenerator,
  xpToNextLevel,
} from '../engine';
import { isValidSaveV2, serializeSave } from '../save';

const NOW = 1_000_000;

function item(id: number, chain: ChainId, level: number): Piece {
  return { id, kind: 'item', chain, level };
}

function withBoard(state: GameState, pieces: Record<number, Piece>): GameState {
  const board = Array<Piece | null>(BOARD_SIZE).fill(null);
  for (const [cell, piece] of Object.entries(pieces)) board[Number(cell)] = piece;
  return { ...state, board, nextId: 1000 };
}

function fullBoard(state: GameState): GameState {
  const board = state.board.map((piece, index) => piece ?? item(5000 + index, 'tea', 1));
  return { ...state, board };
}

function order(requirements: Order['requirements']): Order {
  return { id: 900, kind: 'normal', requirements, coins: 10, xp: 2, energy: 1 };
}

describe('createGame', () => {
  it('開局只有已開攤位（手搖飲、炸物）的產生器與訂單', () => {
    const state = createGame(NOW, 1);
    const generators = state.board.filter((piece) => piece?.kind === 'generator');
    expect(generators).toHaveLength(2);
    expect(state.energy).toBe(BALANCE.maxEnergy);
    expect(state.orders).toHaveLength(BALANCE.orderSlots);
    for (const { requirements } of state.orders) {
      for (const { chain, level } of requirements) {
        expect(['tea', 'fried']).toContain(chain);
        expect(level).toBeGreaterThanOrEqual(2);
        expect(level).toBeLessThanOrEqual(CHAINS[chain].items.length);
      }
    }
  });

  it('is deterministic for a seed', () => {
    expect(createGame(NOW, 42)).toEqual(createGame(NOW, 42));
  });
});

describe('tapGenerator', () => {
  it('spawns an item of its chain next to the generator and costs energy', () => {
    const state = withBoard(createGame(NOW, 1), {
      10: { id: 1, kind: 'generator', chain: 'tea' },
    });
    const next = tapGenerator(state, 10);
    const spawned = next.board.findIndex((piece) => piece?.kind === 'item');
    expect(next.board[spawned]).toMatchObject({ chain: 'tea' });
    expect([1, BALANCE.boardColumns]).toContain(Math.abs(spawned - 10));
    expect(next.energy).toBe(state.energy - 1);
  });

  it('does nothing without energy, and reports why', () => {
    const state = { ...createGame(NOW, 1), energy: 0 };
    const cell = state.board.findIndex((piece) => piece?.kind === 'generator');
    expect(getSpawnBlocker(state)).toBe('no-energy');
    expect(tapGenerator(state, cell)).toBe(state);
  });

  it('does not charge energy when the board is full', () => {
    const state = fullBoard(createGame(NOW, 1));
    const cell = state.board.findIndex((piece) => piece?.kind === 'generator');
    expect(getSpawnBlocker(state)).toBe('board-full');
    expect(tapGenerator(state, cell)).toBe(state);
  });

  it('ignores cells that are not generators', () => {
    const state = withBoard(createGame(NOW, 1), { 3: item(1, 'tea', 1) });
    expect(tapGenerator(state, 3)).toBe(state);
    expect(tapGenerator(state, 4)).toBe(state);
  });
});

describe('movePiece', () => {
  it('merges identical items into the next level at the target', () => {
    const state = withBoard(createGame(NOW, 1), { 0: item(1, 'tea', 2), 5: item(2, 'tea', 2) });
    const next = movePiece(state, 0, 5);
    expect(next.board[0]).toBeNull();
    expect(next.board[5]).toMatchObject({ kind: 'item', chain: 'tea', level: 3 });
    expect(next.board[5]?.id).toBe(1000);
  });

  it('moves to an empty cell', () => {
    const state = withBoard(createGame(NOW, 1), { 0: item(1, 'tea', 1) });
    const next = movePiece(state, 0, 9);
    expect(next.board[0]).toBeNull();
    expect(next.board[9]?.id).toBe(1);
  });

  it.each([
    ['different level', item(2, 'tea', 2)],
    ['different chain', item(2, 'fried', 1)],
    ['generator', { id: 2, kind: 'generator', chain: 'tea' } as Piece],
  ])('swaps with %s', (_name, other) => {
    const state = withBoard(createGame(NOW, 1), { 0: item(1, 'tea', 1), 1: other });
    const next = movePiece(state, 0, 1);
    expect(next.board[0]?.id).toBe(2);
    expect(next.board[1]?.id).toBe(1);
  });

  it('does not merge max-level items or generators', () => {
    const max = CHAINS.tea.items.length;
    expect(canMerge(item(1, 'tea', max), item(2, 'tea', max))).toBe(false);
    const generator: Piece = { id: 1, kind: 'generator', chain: 'tea' };
    expect(canMerge(generator, { ...generator, id: 2 })).toBe(false);
  });

  it('ignores invalid moves', () => {
    const state = withBoard(createGame(NOW, 1), { 0: item(1, 'tea', 1) });
    expect(movePiece(state, 0, 0)).toBe(state);
    expect(movePiece(state, 1, 2)).toBe(state);
    expect(movePiece(state, 0, -1)).toBe(state);
    expect(movePiece(state, 0, BOARD_SIZE)).toBe(state);
  });
});

describe('syncEnergy', () => {
  const regen = BALANCE.energyRegenMs;

  it('regenerates by elapsed time and keeps partial progress', () => {
    const state = { ...createGame(NOW, 1), energy: 10 };
    const next = syncEnergy(state, NOW + regen * 3 + 500);
    expect(next.energy).toBe(13);
    expect(next.energyUpdatedAt).toBe(NOW + regen * 3);
    expect(msUntilNextEnergy(next, NOW + regen * 3 + 500)).toBe(regen - 500);
  });

  it('caps natural regen at max after a long absence', () => {
    const state = { ...createGame(NOW, 1), energy: 10 };
    const later = NOW + regen * 1000;
    expect(syncEnergy(state, later)).toMatchObject({
      energy: BALANCE.maxEnergy,
      energyUpdatedAt: later,
    });
  });

  it('keeps bonus energy above the cap', () => {
    const state = { ...createGame(NOW, 1), energy: BALANCE.maxEnergy + 7 };
    expect(syncEnergy(state, NOW + regen * 5).energy).toBe(BALANCE.maxEnergy + 7);
  });

  it('does not bank regen while energy is full', () => {
    const later = NOW + regen * 50;
    const spent = { ...syncEnergy(createGame(NOW, 1), later), energy: BALANCE.maxEnergy - 1 };
    expect(syncEnergy(spent, later + 1).energy).toBe(BALANCE.maxEnergy - 1);
  });

  it('recovers when the device clock moves backwards', () => {
    const state = { ...createGame(NOW, 1), energy: 10 };
    const rewound = syncEnergy(state, NOW - regen * 100);
    expect(rewound.energy).toBe(10);
    expect(syncEnergy(rewound, NOW - regen * 99).energy).toBe(11);
  });
});

describe('orders', () => {
  it('finds distinct cells for duplicate requirements', () => {
    const state = withBoard(createGame(NOW, 1), { 0: item(1, 'tea', 2) });
    const two = order([
      { chain: 'tea', level: 2 },
      { chain: 'tea', level: 2 },
    ]);
    expect(findOrderCells(state, two)).toBeNull();
    const enough = withBoard(state, { 0: item(1, 'tea', 2), 8: item(2, 'tea', 2) });
    expect(findOrderCells(enough, two)).toEqual([0, 8]);
  });

  it('consumes items, pays rewards and replaces the order in place', () => {
    const base = createGame(NOW, 1);
    const target = order([{ chain: 'tea', level: 2 }]);
    const state = {
      ...withBoard(base, { 4: item(1, 'tea', 2) }),
      orders: [base.orders[0], target, base.orders[2]],
    };
    const next = completeOrder(state, target.id, NOW);
    expect(next.board[4]).toBeNull();
    expect(next.coins).toBe(state.coins + target.coins);
    expect(next.xp).toBe(state.xp + target.xp);
    expect(next.energy).toBe(state.energy + target.energy);
    expect(next.orders).toHaveLength(3);
    expect(next.orders.map((o) => o.id)).not.toContain(target.id);
    // 右邊的訂單往左遞補，新訂單排到最後
    expect(next.orders[0]).toBe(base.orders[0]);
    expect(next.orders[1]).toBe(base.orders[2]);
  });

  it('does nothing when items are missing or the order is unknown', () => {
    const target = order([{ chain: 'tea', level: 2 }]);
    const state = { ...withBoard(createGame(NOW, 1), {}), orders: [target] };
    expect(completeOrder(state, target.id, NOW)).toBe(state);
    expect(completeOrder(state, 12345, NOW)).toBe(state);
  });

  it('升級時給體力，但不再自動放上產生器（RC-1、FR11）', () => {
    const target = { ...order([{ chain: 'tea', level: 2 }]), xp: xpToNextLevel(2) };
    const state: GameState = {
      ...withBoard(createGame(NOW, 1), { 4: item(1, 'tea', 2) }),
      level: 2,
      xp: 0,
      orders: [target],
    };
    const next = completeOrder(state, target.id, NOW);
    expect(next.level).toBe(3);
    expect(next.xp).toBe(0);
    expect(next.energy).toBe(state.energy + target.energy + BALANCE.levelUpEnergy);
    expect(next.board.some((p) => p?.kind === 'generator' && p.chain === 'noodle')).toBe(false);
    expect(next.pendingGenerators).toEqual([]);
  });

  it('訂單只出自已開的攤位，階數不超過該鏈範圍（RC-2、FR7）', () => {
    let state = createGame(NOW, 7);
    for (let level = 1; level <= 30; level++) {
      for (let i = 0; i < 40; i++) {
        const target = { ...order([{ chain: 'tea', level: 2 }]), xp: 0 };
        const ready: GameState = {
          ...withBoard(state, { 0: item(1, 'tea', 2) }),
          level,
          xp: 0,
          orders: [target],
        };
        state = completeOrder(ready, target.id, NOW);
        for (const { chain, level: required } of state.orders[0].requirements) {
          // 玩家等級再高，只要攤位還是鐵捲門，就不會出現在訂單裡
          expect(state.stalls[chain].level).toBeGreaterThanOrEqual(1);
          expect(required).toBeGreaterThanOrEqual(2);
          expect(required).toBeLessThanOrEqual(CHAINS[chain].items.length);
        }
      }
    }
  });
});

describe('selling and a full board', () => {
  it('sells items for coins but refuses generators', () => {
    const generator: Piece = { id: 2, kind: 'generator', chain: 'tea' };
    const state = withBoard(createGame(NOW, 1), { 0: item(1, 'tea', 3), 1: generator });
    const next = sellPiece(state, 0);
    expect(next.board[0]).toBeNull();
    expect(next.coins).toBe(state.coins + 4);
    expect(sellPiece(state, 1)).toBe(state);
  });

  it('賣出發明菜一次 1 份：3 → 2 → 1 → 清空，金幣累計正確（S3.4、FR24）', () => {
    const dish: Piece = { id: 7, kind: 'dish', recipe: 'tea-fried', count: 3 };
    const start = withBoard({ ...createGame(NOW, 1), coins: 0 }, { 0: dish });
    const price = dishSellPrice('tea-fried');
    expect(price).toBe(12);

    const two = sellPiece(start, 0);
    expect(two.board[0]).toEqual({ ...dish, count: 2 });
    expect(two.coins).toBe(price);

    const one = sellPiece(two, 0);
    expect(one.board[0]).toEqual({ ...dish, count: 1 });
    expect(one.coins).toBe(price * 2);

    const empty = sellPiece(one, 0);
    expect(empty.board[0]).toBeNull();
    expect(empty.coins).toBe(price * 3);
  });

  it('賣完最後一份發明菜時，待放的產生器放上空出的格子', () => {
    const dish: Piece = { id: 7, kind: 'dish', recipe: 'tea-fried', count: 1 };
    const state = {
      ...withBoard(createGame(NOW, 1), { 0: dish }),
      pendingGenerators: ['noodle' as const],
    };
    const next = sellPiece(state, 0);
    expect(next.pendingGenerators).toEqual([]);
    expect(next.board.some((p) => p?.kind === 'generator' && p.chain === 'noodle')).toBe(true);
  });

  it('棋盤全滿時待放的產生器依序等待，空出格子才放上去', () => {
    const base = fullBoard(createGame(NOW, 1));
    const orderCell = base.board.findIndex((piece) => piece?.kind === 'item');
    base.board[orderCell] = item(9999, 'fried', 6);
    const target = { ...order([{ chain: 'fried', level: 6 }]), xp: xpToNextLevel(2) };

    // 交單空出的唯一一格先給排在前面的甜品車，麵線鍋繼續等；升級本身不會再加產生器
    const state: GameState = {
      ...base,
      level: 2,
      xp: 0,
      orders: [target],
      pendingGenerators: ['sweet', 'noodle'],
    };
    const afterOrder = completeOrder(state, target.id, NOW);
    expect(afterOrder.pendingGenerators).toEqual(['noodle']);
    expect(afterOrder.board[orderCell]).toMatchObject({ kind: 'generator', chain: 'sweet' });

    const cell = afterOrder.board.findIndex((piece) => piece?.kind === 'item');
    const afterSell = sellPiece(afterOrder, cell);
    expect(afterSell.pendingGenerators).toEqual([]);
    expect(afterSell.board[cell]).toMatchObject({ kind: 'generator', chain: 'noodle' });
  });
});

describe('content', () => {
  it('stays within the planned size', () => {
    const items = CHAIN_IDS.reduce((sum, id) => sum + CHAINS[id].items.length, 0);
    expect(CHAIN_IDS).toHaveLength(5);
    expect(items).toBeGreaterThanOrEqual(30);
    expect(items).toBeLessThanOrEqual(40);
  });
});

describe('createGame（v2）', () => {
  it('產生合法的 v2 存檔', () => {
    expect(isValidSaveV2(JSON.parse(serializeSave(createGame(NOW, 1))))).toBe(true);
  });

  it('開局只開手搖飲與炸物攤，人龍 12 人，教學從第 0 步開始', () => {
    const state = createGame(NOW, 1);

    expect(state.version).toBe(2);
    expect(state.stalls.tea.level).toBe(1);
    expect(state.stalls.fried.level).toBe(1);
    expect(state.stalls.noodle.level).toBe(0);
    expect(state.stalls.dumpling.level).toBe(0);
    expect(state.stalls.sweet.level).toBe(0);
    expect(state.queue).toEqual({
      wave: 1,
      length: 12,
      remaining: 12,
      cooldownEndsAt: null,
      bonus: 0,
    });
    expect(state.meta).toEqual({ firstLaunchAt: NOW, tutorialStep: 0, hintedRecipes: [] });
    expect(state.orders.every((order) => order.kind === 'normal')).toBe(true);
    expect(state.events).toEqual([]);
  });
});

describe('findSpawns', () => {
  const generator: Piece = { id: 1, kind: 'generator', chain: 'tea' };

  it('reports the item a generator tap produced, and where it came from', () => {
    const state = withBoard(createGame(NOW, 1), { 3: generator });
    const after = tapGenerator(state, 3);
    const spawns = findSpawns(state.board, after.board);
    expect(spawns).toHaveLength(1);
    expect(spawns[0].from).toBe(3);
    expect(after.board[spawns[0].to]).toBe(spawns[0].piece);
  });

  it('reports every item when several taps land in one update', () => {
    const state = withBoard(createGame(NOW, 1), { 0: generator });
    const after = tapGenerator(tapGenerator(state, 0), 0);
    expect(findSpawns(state.board, after.board)).toHaveLength(2);
  });

  it('ignores merges', () => {
    const state = withBoard(createGame(NOW, 1), {
      0: generator,
      1: item(10, 'tea', 1),
      2: item(11, 'tea', 1),
    });
    expect(findSpawns(state.board, movePiece(state, 1, 2).board)).toEqual([]);
  });

  it('ignores moves and swaps', () => {
    const state = withBoard(createGame(NOW, 1), { 0: generator, 1: item(10, 'tea', 1) });
    expect(findSpawns(state.board, movePiece(state, 1, 5).board)).toEqual([]);
    expect(findSpawns(state.board, movePiece(state, 1, 0).board)).toEqual([]);
  });

  it('ignores selling, even when that places a pending generator', () => {
    const state: GameState = {
      ...withBoard(createGame(NOW, 1), { 0: generator, 1: item(10, 'tea', 1) }),
      pendingGenerators: ['fried'],
    };
    expect(findSpawns(state.board, sellPiece(state, 1).board)).toEqual([]);
  });
});

describe('findMerges', () => {
  const generator: Piece = { id: 1, kind: 'generator', chain: 'tea' };
  const twoLeaves = () =>
    withBoard(createGame(NOW, 1), {
      0: generator,
      1: item(10, 'tea', 1),
      2: item(11, 'tea', 1),
    });

  it('reports the merged item at the drop cell', () => {
    const state = twoLeaves();
    const after = movePiece(state, 1, 2);
    expect(findMerges(state.board, after.board)).toEqual([{ piece: after.board[2], cell: 2 }]);
  });

  it('ignores generator spawns', () => {
    const state = twoLeaves();
    expect(findMerges(state.board, tapGenerator(state, 0).board)).toEqual([]);
  });

  it('ignores moves, swaps and sales', () => {
    const state = twoLeaves();
    expect(findMerges(state.board, movePiece(state, 1, 5).board)).toEqual([]);
    expect(findMerges(state.board, movePiece(state, 1, 0).board)).toEqual([]);
    expect(findMerges(state.board, sellPiece(state, 1).board)).toEqual([]);
  });
});

describe('customerForOrder', () => {
  it('always gives the same order the same customer', () => {
    const target = { ...order([{ chain: 'tea', level: 2 }]), id: 7 };
    expect(customerForOrder({ ...target })).toBe(customerForOrder(target));
  });

  it('can reach every customer', () => {
    const seen = new Set(
      CUSTOMERS.map((_, id) => customerForOrder({ ...order([{ chain: 'tea', level: 2 }]), id }))
    );
    expect(seen.size).toBe(CUSTOMERS.length);
  });

  it('貴客單只從 3 位貴客挑，同一張單讀檔後不換人（S4.3）', () => {
    const vip = (id: number) => ({
      ...order([]),
      id,
      kind: 'vip' as const,
      recipe: 'tea-fried' as const,
    });
    const names = new Set([0, 1, 2, 3, 4, 5].map((id) => customerForOrder(vip(id)).name));
    expect([...names].sort()).toEqual(['YouTuber', '富豪', '藝人'].sort());
    expect(customerForOrder(vip(8))).toBe(customerForOrder(JSON.parse(JSON.stringify(vip(8)))));
    expect(VIP_CUSTOMERS).toHaveLength(3);
  });
});
