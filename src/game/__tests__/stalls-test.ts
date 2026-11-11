// Story 1.9：重開攤位（FR9、FR10、RC-1）
import { BOARD_SIZE, CHAINS, type RecipeId, STALLS } from '../content';
import {
  completeOrder,
  createGame,
  type GameState,
  type Order,
  orderCoins,
  type Piece,
} from '../engine';
import { isValidSaveV2, serializeSave } from '../save';
import { reopenCheck, reopenStall, upgradeCheck, upgradeStall } from '../stalls';

const NOW = 1_000_000;

function ready(overrides: Partial<GameState> = {}): GameState {
  return { ...createGame(NOW, 1), ...overrides };
}

const dish = (id: number, recipe: RecipeId, count: 1 | 2 | 3): Piece => ({
  id,
  kind: 'dish',
  recipe,
  count,
});

/** 手搖飲 Lv2、棋盤只放指定的格子 */
function lv2Tea(overrides: Partial<GameState>, cells: Record<number, Piece>): GameState {
  const base = ready(overrides);
  const board = Array<Piece | null>(BOARD_SIZE).fill(null);
  for (const [cell, piece] of Object.entries(cells)) board[Number(cell)] = piece;
  return {
    ...base,
    board,
    nextId: 1000,
    pendingGenerators: [],
    stalls: { ...base.stalls, tea: { level: 2, signatureDish: null } },
  };
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
      state = completeOrder(
        { ...state, board, orders: [target], nextId: 100_000 + i * 10 },
        target.id,
        NOW
      );
      seen = state.orders.some((order) => order.requirements.some((r) => r.chain === 'noodle'));
    }
    expect(seen).toBe(true);
  });
});

describe('升級費用（FR12）', () => {
  it('Lv2 只要金幣：200 / 200 / 400 / 600 / 900', () => {
    expect(
      [STALLS.tea, STALLS.fried, STALLS.noodle, STALLS.dumpling, STALLS.sweet].map(
        (s) => s.upgradeCoins[2]
      )
    ).toEqual([200, 200, 400, 600, 900]);
  });

  it('Lv3 要金幣 600 / 600 / 1000 / 1500 / 2000 加上發明菜', () => {
    expect(
      [STALLS.tea, STALLS.fried, STALLS.noodle, STALLS.dumpling, STALLS.sweet].map(
        (s) => s.upgradeCoins[3]
      )
    ).toEqual([600, 600, 1000, 1500, 2000]);
  });
});

describe('upgradeCheck', () => {
  it('Lv1 → Lv2：只看金幣', () => {
    expect(upgradeCheck(ready({ coins: 150 }), 'tea')).toEqual({
      targetLevel: 2,
      coins: 200,
      coinsMet: false,
      needsDish: false,
      candidates: [],
      ok: false,
    });
    expect(upgradeCheck(ready({ coins: 200 }), 'tea')).toMatchObject({ coinsMet: true, ok: true });
  });

  it('Lv2 → Lv3：棋盤上沒有含這一攤食材的發明菜時鎖住（就算金幣夠）', () => {
    const state = lv2Tea({ coins: 9999 }, { 0: dish(1, 'fried-sweet', 1) });
    expect(upgradeCheck(state, 'tea')).toEqual({
      targetLevel: 3,
      coins: 600,
      coinsMet: true,
      needsDish: true,
      candidates: [],
      ok: false,
    });
  });

  it('Lv2 → Lv3：列出棋盤上含這一攤食材的發明菜（不重複，依配方順序）', () => {
    const state = lv2Tea(
      { coins: 600 },
      {
        0: dish(1, 'tea-sweet', 1),
        3: dish(2, 'tea-fried', 2),
        5: dish(3, 'tea-sweet', 3),
        7: dish(4, 'fried-sweet', 1),
      }
    );
    expect(upgradeCheck(state, 'tea')).toMatchObject({
      candidates: ['tea-fried', 'tea-sweet'],
      ok: true,
    });
    expect(upgradeCheck({ ...state, coins: 599 }, 'tea')).toMatchObject({ ok: false });
  });

  it('鐵捲門與 Lv3 沒有升級條件', () => {
    const state = ready({ stalls: { ...ready().stalls, tea: { level: 3, signatureDish: null } } });
    expect(upgradeCheck(state, 'tea')).toBeNull();
    expect(upgradeCheck(state, 'noodle')).toBeNull();
  });
});

describe('upgradeStall（Lv1 → Lv2）', () => {
  it('金幣足夠：扣金幣、升到 Lv2、送出 stall_upgraded', () => {
    const next = upgradeStall(ready({ coins: 250 }), 'fried', NOW);

    expect(next.coins).toBe(50);
    expect(next.stalls.fried.level).toBe(2);
    expect(next.events).toContainEqual({ type: 'stall_upgraded', stall: 'fried', level: 2 });
    expect(isValidSaveV2(JSON.parse(serializeSave(next)))).toBe(true);
  });

  it('金幣不足：回傳原 state', () => {
    const state = ready({ coins: 199 });
    expect(upgradeStall(state, 'tea', NOW)).toBe(state);
  });

  it('鐵捲門攤位不能升級（要先重開）', () => {
    const state = ready({ level: 9, coins: 9999 });
    expect(upgradeStall(state, 'noodle', NOW)).toBe(state);
  });

  it('升級後新訂單金幣 +10%（FR15，S1.6 的公式自動套用）', () => {
    const upgraded = upgradeStall(ready({ coins: 200 }), 'tea', NOW);
    expect(orderCoins([{ chain: 'tea', level: 2 }], upgraded.stalls)).toBe(11);
  });
});

describe('upgradeStall（Lv2 → Lv3，FR12、FR13、RC-7、RC-8）', () => {
  it('扣金幣、從 3 份中扣掉 1 份、升到 Lv3、設定招牌菜、送出 stall_upgraded', () => {
    const state = lv2Tea({ coins: 700 }, { 4: dish(9, 'tea-fried', 3) });
    const next = upgradeStall(state, 'tea', NOW, 'tea-fried');

    expect(next.coins).toBe(100);
    expect(next.board[4]).toEqual(dish(9, 'tea-fried', 2));
    expect(next.stalls.tea).toEqual({ level: 3, signatureDish: 'tea-fried' });
    expect(next.events).toContainEqual({ type: 'stall_upgraded', stall: 'tea', level: 3 });
    expect(isValidSaveV2(JSON.parse(serializeSave(next)))).toBe(true);
  });

  it('扣到 0 份時清空格子，待放的產生器放上去', () => {
    const state = {
      ...lv2Tea({ coins: 600 }, { 4: dish(9, 'tea-fried', 1) }),
      pendingGenerators: ['noodle' as const],
    };
    const next = upgradeStall(state, 'tea', NOW, 'tea-fried');

    expect(next.board[4]).toBeNull();
    // 待放的產生器放進第一個空格
    expect(next.board.some((p) => p?.kind === 'generator' && p.chain === 'noodle')).toBe(true);
    expect(next.pendingGenerators).toEqual([]);
  });

  it('同一道菜放在好幾格時，從第一格扣', () => {
    const state = lv2Tea(
      { coins: 600 },
      { 2: dish(1, 'tea-fried', 2), 6: dish(2, 'tea-fried', 3) }
    );
    const next = upgradeStall(state, 'tea', NOW, 'tea-fried');

    expect(next.board[2]).toEqual(dish(1, 'tea-fried', 1));
    expect(next.board[6]).toEqual(dish(2, 'tea-fried', 3));
  });

  it('缺少發明菜、沒有指定、或指定的發明菜不含這一攤：回傳原 state', () => {
    const noDish = lv2Tea({ coins: 9999 }, {});
    expect(upgradeStall(noDish, 'tea', NOW, 'tea-fried')).toBe(noDish);

    const withDish = lv2Tea(
      { coins: 9999 },
      { 0: dish(1, 'tea-fried', 1), 1: dish(2, 'fried-sweet', 1) }
    );
    expect(upgradeStall(withDish, 'tea', NOW)).toBe(withDish);
    // 甜鹹地瓜雞（炸物＋甜品）不含手搖飲
    expect(upgradeStall(withDish, 'tea', NOW, 'fried-sweet')).toBe(withDish);
  });

  it('金幣不足：回傳原 state', () => {
    const state = lv2Tea({ coins: 599 }, { 0: dish(1, 'tea-fried', 1) });
    expect(upgradeStall(state, 'tea', NOW, 'tea-fried')).toBe(state);
  });

  it('人龍進行中時立刻加長（NP-2）', () => {
    const base = lv2Tea({ coins: 600 }, { 0: dish(1, 'tea-fried', 1) });
    const state = { ...base, queue: { ...base.queue, length: 14, remaining: 5 } };
    const next = upgradeStall(state, 'tea', NOW, 'tea-fried');

    expect(next.queue).toMatchObject({ length: 16, remaining: 7 });
  });

  it('Lv3 之後沒有下一級：招牌菜不能更換', () => {
    const base = lv2Tea(
      { coins: 9999 },
      { 0: dish(1, 'tea-fried', 1), 1: dish(2, 'tea-sweet', 1) }
    );
    const lv3 = upgradeStall(base, 'tea', NOW, 'tea-fried');
    expect(upgradeCheck(lv3, 'tea')).toBeNull();
    expect(upgradeStall(lv3, 'tea', NOW, 'tea-sweet')).toBe(lv3);
  });
});

describe('Epic 1 完成定義', () => {
  it('新局可以把手搖飲、炸物升到 Lv2；玩家升到 Lv3 後可以重開麵線攤', () => {
    let state = ready({ coins: 400 });
    state = upgradeStall(state, 'tea', NOW);
    state = upgradeStall(state, 'fried', NOW);
    expect(state.stalls.tea.level).toBe(2);
    expect(state.stalls.fried.level).toBe(2);
    expect(state.coins).toBe(0);

    state = reopenStall({ ...state, level: 3, coins: 300 }, 'noodle', NOW);
    expect(state.stalls.noodle.level).toBe(1);
  });
});
