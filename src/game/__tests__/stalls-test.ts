// Story 1.9：重開攤位（FR9、FR10、RC-1）
import { BOARD_SIZE, CHAINS, STALLS } from '../content';
import { completeOrder, createGame, type GameState, type Order, type Piece } from '../engine';
import { isValidSaveV2, serializeSave } from '../save';
import { reopenCheck, reopenStall } from '../stalls';

const NOW = 1_000_000;

function ready(overrides: Partial<GameState> = {}): GameState {
  return { ...createGame(NOW, 1), ...overrides };
}

function fullBoard(state: GameState): GameState {
  let nextId = state.nextId;
  const board = state.board.map(
    (piece) => piece ?? ({ id: nextId++, kind: 'item', chain: 'tea', level: 1 } as Piece)
  );
  return { ...state, board, nextId };
}

describe('重開條件（FR10）', () => {
  it('麵線 Lv3 + 300、蒸籠 Lv5 + 600、甜品 Lv7 + 1000；開局的攤位不需要重開', () => {
    expect([CHAINS.noodle.unlockLevel, STALLS.noodle.reopenCoins]).toEqual([3, 300]);
    expect([CHAINS.dumpling.unlockLevel, STALLS.dumpling.reopenCoins]).toEqual([5, 600]);
    expect([CHAINS.sweet.unlockLevel, STALLS.sweet.reopenCoins]).toEqual([7, 1000]);
    expect(STALLS.tea.reopenCoins).toBeNull();
    expect(STALLS.fried.reopenCoins).toBeNull();
  });

  it('reopenCheck 分別標示等級與金幣是否達成（UX-DR3）', () => {
    expect(reopenCheck(ready({ level: 2, coins: 500 }), 'noodle')).toEqual({
      playerLevel: 3,
      coins: 300,
      levelMet: false,
      coinsMet: true,
      ok: false,
    });
    expect(reopenCheck(ready({ level: 3, coins: 299 }), 'noodle')).toMatchObject({
      levelMet: true,
      coinsMet: false,
      ok: false,
    });
  });

  it('已經開著的攤位沒有重開條件', () => {
    expect(reopenCheck(ready({ level: 9, coins: 9999 }), 'tea')).toBeNull();
  });
});

describe('reopenStall', () => {
  it('等級不足：回傳原 state', () => {
    const state = ready({ level: 2, coins: 1000 });
    expect(reopenStall(state, 'noodle', NOW)).toBe(state);
  });

  it('金幣不足：回傳原 state', () => {
    const state = ready({ level: 3, coins: 299 });
    expect(reopenStall(state, 'noodle', NOW)).toBe(state);
  });

  it('金幣剛好夠：扣金幣、攤位設為 Lv1、放上產生器、送出 stall_reopened', () => {
    const state = ready({ level: 3, coins: 300 });

    const next = reopenStall(state, 'noodle', NOW);

    expect(next.coins).toBe(0);
    expect(next.stalls.noodle.level).toBe(1);
    expect(next.board.some((p) => p?.kind === 'generator' && p.chain === 'noodle')).toBe(true);
    expect(next.events).toContainEqual({ type: 'stall_reopened', stall: 'noodle', level: 1 });
    expect(isValidSaveV2(JSON.parse(serializeSave(next)))).toBe(true);
  });

  it('棋盤已滿：產生器放進待放佇列', () => {
    const state = fullBoard(ready({ level: 5, coins: 600 }));

    const next = reopenStall(state, 'dumpling', NOW);

    expect(next.stalls.dumpling.level).toBe(1);
    expect(next.pendingGenerators).toEqual(['dumpling']);
    expect(next.board).toEqual(state.board);
  });

  it('重複重開：第二次回傳原 state，不會再扣錢或多放產生器', () => {
    const once = reopenStall(ready({ level: 7, coins: 5000 }), 'sweet', NOW);
    const settled = { ...once, events: [] };

    expect(reopenStall(settled, 'sweet', NOW)).toBe(settled);
  });

  it('開局就開著的攤位不能重開', () => {
    const state = ready({ level: 9, coins: 9999 });
    expect(reopenStall(state, 'tea', NOW)).toBe(state);
  });

  it('重開之後，新的訂單就可能出現這條鏈', () => {
    let state = reopenStall(ready({ level: 9, coins: 1000 }), 'noodle', NOW);
    let seen = false;
    for (let i = 0; i < 60 && !seen; i++) {
      const target: Order = {
        id: 90_000 + i,
        kind: 'normal',
        requirements: [{ chain: 'tea', level: 2 }],
        coins: 0,
        xp: 0,
        energy: 0,
      };
      const board = Array<Piece | null>(BOARD_SIZE).fill(null);
      board[0] = { id: 80_000 + i, kind: 'item', chain: 'tea', level: 2 };
      state = completeOrder({ ...state, board, orders: [target], nextId: 100_000 + i * 10 }, target.id, NOW);
      seen = state.orders.some((order) => order.requirements.some((r) => r.chain === 'noodle'));
    }
    expect(seen).toBe(true);
  });
});
