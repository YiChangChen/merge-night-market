import { BALANCE, BOARD_SIZE, CHAIN_IDS, CHAINS, type ChainId } from '../content';
import {
  canMerge,
  completeOrder,
  createGame,
  findOrderCells,
  type GameState,
  getSpawnBlocker,
  isValidSave,
  movePiece,
  msUntilNextEnergy,
  type Order,
  type Piece,
  sellPiece,
  syncEnergy,
  tapGenerator,
  xpToNextLevel,
} from '../engine';

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
  return { id: 900, requirements, coins: 10, xp: 2, energy: 1 };
}

describe('createGame', () => {
  it('starts with level 1 generators, full energy and fillable orders', () => {
    const state = createGame(NOW, 1);
    const generators = state.board.filter((piece) => piece?.kind === 'generator');
    expect(generators).toHaveLength(2);
    expect(state.energy).toBe(BALANCE.maxEnergy);
    expect(state.orders).toHaveLength(BALANCE.orderSlots);
    for (const { requirements } of state.orders) {
      for (const { chain, level } of requirements) {
        expect(CHAINS[chain].unlockLevel).toBe(1);
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
    const next = completeOrder(state, target.id);
    expect(next.board[4]).toBeNull();
    expect(next.coins).toBe(state.coins + target.coins);
    expect(next.xp).toBe(state.xp + target.xp);
    expect(next.energy).toBe(state.energy + target.energy);
    expect(next.orders).toHaveLength(3);
    expect(next.orders[1].id).not.toBe(target.id);
    expect(next.orders[0]).toBe(base.orders[0]);
  });

  it('does nothing when items are missing or the order is unknown', () => {
    const target = order([{ chain: 'tea', level: 2 }]);
    const state = { ...withBoard(createGame(NOW, 1), {}), orders: [target] };
    expect(completeOrder(state, target.id)).toBe(state);
    expect(completeOrder(state, 12345)).toBe(state);
  });

  it('levels up, grants energy and unlocks the next generator', () => {
    const target = { ...order([{ chain: 'tea', level: 2 }]), xp: xpToNextLevel(2) };
    const state: GameState = {
      ...withBoard(createGame(NOW, 1), { 4: item(1, 'tea', 2) }),
      level: 2,
      xp: 0,
      orders: [target],
    };
    const next = completeOrder(state, target.id);
    expect(next.level).toBe(3);
    expect(next.xp).toBe(0);
    expect(next.energy).toBe(state.energy + target.energy + BALANCE.levelUpEnergy);
    expect(next.board.some((p) => p?.kind === 'generator' && p.chain === 'noodle')).toBe(true);
  });

  it('never asks for a locked chain or an impossible level', () => {
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
        state = completeOrder(ready, target.id);
        for (const { chain, level: required } of state.orders[0].requirements) {
          expect(CHAINS[chain].unlockLevel).toBeLessThanOrEqual(level);
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

  it('queues an unlocked generator on a full board and places it once a cell opens', () => {
    const base = fullBoard(createGame(NOW, 1));
    const orderCell = base.board.findIndex((piece) => piece?.kind === 'item');
    base.board[orderCell] = item(9999, 'fried', 6);
    const target = { ...order([{ chain: 'fried', level: 6 }]), xp: xpToNextLevel(2) };

    // 交單空出的唯一一格會先給等待中的甜品車，升級解鎖的麵線鍋只能繼續等
    const state: GameState = {
      ...base,
      level: 2,
      xp: 0,
      orders: [target],
      pendingGenerators: ['sweet'],
    };
    const afterOrder = completeOrder(state, target.id);
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

describe('isValidSave', () => {
  it('accepts a real game after a JSON round trip', () => {
    expect(isValidSave(JSON.parse(JSON.stringify(createGame(NOW, 1))))).toBe(true);
  });

  it.each([
    ['null', null],
    ['a string', 'save'],
    ['another version', { ...createGame(NOW, 1), version: 2 }],
    ['a short board', { ...createGame(NOW, 1), board: [] }],
    ['a non-numeric energy', { ...createGame(NOW, 1), energy: 'lots' }],
    ['NaN coins', { ...createGame(NOW, 1), coins: NaN }],
  ])('rejects %s', (_name, value) => {
    expect(isValidSave(value)).toBe(false);
  });
});
