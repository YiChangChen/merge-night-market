import { BALANCE } from '../content';
import { createGame } from '../engine';
import {
  debugAddCardMade,
  debugAddCoins,
  debugAddEnergy,
  debugNewGame,
  debugQueueLastCustomer,
  debugRevealClues,
  debugSetPlayerLevel,
  debugSetStallLevel,
} from '../debug';
import { isValidSaveV2, serializeSave } from '../save';

const NOW = 1_000_000;
const valid = (state: ReturnType<typeof createGame>) =>
  isValidSaveV2(JSON.parse(serializeSave(state)));

describe('除錯用規則函式（S1.8）', () => {
  it('加金幣與加體力', () => {
    const state = createGame(NOW, 1);

    expect(debugAddCoins(state, 1000).coins).toBe(state.coins + 1000);
    expect(debugAddEnergy(state, 20).energy).toBe(state.energy + 20);
  });

  it('人龍只剩最後一位：存檔仍然合法；冷卻中或已經剩 1 位時不動作', () => {
    const state = createGame(NOW, 1);
    const last = debugQueueLastCustomer(state);

    expect(last.queue).toMatchObject({ length: 12, remaining: 1 });
    expect(valid(last)).toBe(true);
    expect(debugQueueLastCustomer(last)).toBe(last);

    const cooling = { ...state, queue: { ...state.queue, remaining: 0, cooldownEndsAt: NOW } };
    expect(debugQueueLastCustomer(cooling)).toBe(cooling);
  });

  it('數量不合法時回傳原 state', () => {
    const state = createGame(NOW, 1);

    expect(debugAddCoins(state, -5)).toBe(state);
    expect(debugAddEnergy(state, Number.NaN)).toBe(state);
  });

  it('設定玩家等級：XP 歸零，不放產生器，不給升級獎勵', () => {
    const state = { ...createGame(NOW, 1), xp: 7 };

    const next = debugSetPlayerLevel(state, 7);

    expect(next.level).toBe(7);
    expect(next.xp).toBe(0);
    expect(next.energy).toBe(state.energy);
    expect(next.board).toBe(state.board);
  });

  it('玩家等級不得小於 1', () => {
    const state = createGame(NOW, 1);
    expect(debugSetPlayerLevel(state, 0)).toBe(state);
    expect(debugSetPlayerLevel(state, 2.5)).toBe(state);
  });

  it('把鐵捲門攤位調高時補上該鏈的產生器，存檔仍然合法', () => {
    const state = createGame(NOW, 1);

    const next = debugSetStallLevel(state, 'noodle', 2);

    expect(next.stalls.noodle.level).toBe(2);
    expect(next.board.some((p) => p?.kind === 'generator' && p.chain === 'noodle')).toBe(true);
    expect(valid(next)).toBe(true);
  });

  it('調高攤位等級時，進行中的人龍跟著加長；調低不會變短', () => {
    const state = createGame(NOW, 1);

    const raised = debugSetStallLevel(state, 'noodle', 2);
    expect(raised.queue).toMatchObject({ length: 16, remaining: 16 });

    const lowered = debugSetStallLevel(raised, 'noodle', 0);
    expect(lowered.queue).toMatchObject({ length: 16, remaining: 16 });
  });

  it('棋盤已滿時產生器進待放佇列', () => {
    const base = createGame(NOW, 1);
    let nextId = base.nextId;
    const board = base.board.map(
      (piece) => piece ?? { id: nextId++, kind: 'item' as const, chain: 'tea' as const, level: 1 }
    );
    const state = { ...base, board, nextId };

    const next = debugSetStallLevel(state, 'sweet', 1);

    expect(next.pendingGenerators).toEqual(['sweet']);
    expect(valid(next)).toBe(true);
  });

  it('已經有產生器的攤位調整等級時，不會再多放一個', () => {
    const state = createGame(NOW, 1);

    const next = debugSetStallLevel(debugSetStallLevel(state, 'tea', 3), 'tea', 1);

    const teaGenerators = next.board.filter((p) => p?.kind === 'generator' && p.chain === 'tea');
    expect(teaGenerators).toHaveLength(1);
    expect(next.stalls.tea.level).toBe(1);
  });

  it('等級超出 0–3 時回傳原 state', () => {
    const state = createGame(NOW, 1);
    expect(debugSetStallLevel(state, 'tea', 4 as never)).toBe(state);
  });

  it('加體力可以超過上限（和獎勵一樣）', () => {
    const state = createGame(NOW, 1);
    expect(debugAddEnergy(state, 100).energy).toBe(BALANCE.maxEnergy + 100);
  });
});

describe('除錯函式的邊界（code review 2026-11-10）', () => {
  it('開局攤位（手搖飲、炸物）不能調成鐵捲門，否則之後永遠回不來', () => {
    const state = createGame(NOW, 1);
    expect(debugSetStallLevel(state, 'tea', 0)).toBe(state);
    expect(debugSetStallLevel(state, 'fried', 0)).toBe(state);
    expect(
      debugSetStallLevel(debugSetStallLevel(state, 'noodle', 1), 'noodle', 0).stalls.noodle.level
    ).toBe(0);
  });

  it('玩家等級上限 99', () => {
    const state = createGame(NOW, 1);
    expect(debugSetPlayerLevel(state, 99).level).toBe(99);
    expect(debugSetPlayerLevel(state, 100)).toBe(state);
  });
});

describe('除錯：招牌菜只屬於 Lv3（code review 2026-11-11）', () => {
  it('把 Lv3 攤位調低時清除招牌菜，存檔仍然合法', () => {
    const base = createGame(NOW, 1);
    const lv3 = {
      ...base,
      stalls: { ...base.stalls, tea: { level: 3 as const, signatureDish: 'tea-fried' as const } },
    };

    const lowered = debugSetStallLevel(lv3, 'tea', 2);
    expect(lowered.stalls.tea).toEqual({ level: 2, signatureDish: null });
    expect(valid(lowered)).toBe(true);
  });
});

describe('除錯：開新局（S4.4）', () => {
  it('換成全新的一局：存檔合法、清掉進度，種子和原本不同', () => {
    const played = {
      ...createGame(NOW, 1),
      coins: 5000,
      level: 9,
      inventions: { 'tea-fried': { discovered: true, made: 3, failures: 0, clueSeen: false } },
    };
    const fresh = debugNewGame(played, NOW + 1000);

    expect(fresh).toMatchObject({
      coins: 0,
      level: 1,
      inventions: {},
      energyUpdatedAt: NOW + 1000,
    });
    expect(fresh.meta.hintedRecipes).toEqual([]);
    expect(fresh.rngSeed).not.toBe(played.rngSeed);
    expect(valid(fresh)).toBe(true);
  });
});

describe('除錯：卡牌（S5.2）', () => {
  const found = { discovered: true, made: 2, failures: 0, clueSeen: false };
  const unknown = { discovered: false, made: 0, failures: 3, clueSeen: false };
  const base = () => ({
    ...createGame(NOW, 1),
    inventions: { 'tea-fried': found, 'tea-noodle': unknown },
  });

  it('debugAddCardMade：只有已發現的卡增加製作次數，存檔仍然合法', () => {
    const next = debugAddCardMade(base(), 13);
    expect(next.inventions['tea-fried']?.made).toBe(15);
    expect(next.inventions['tea-noodle']).toEqual(unknown);
    expect(next.events).toEqual([]);
    expect(valid(next)).toBe(true);
    expect(debugAddCardMade(base(), 0)).toEqual(base());
    expect(debugAddCardMade(base(), 0.5)).toEqual(base());
  });

  it('debugRevealClues：未發現的配方都標成看過線索，保留失敗次數；已發現的不動', () => {
    const next = debugRevealClues(base());
    expect(next.inventions['tea-fried']).toEqual(found);
    expect(next.inventions['tea-noodle']).toEqual({ ...unknown, clueSeen: true });
    expect(next.inventions['dumpling-sweet']).toEqual({
      discovered: false,
      made: 0,
      failures: 0,
      clueSeen: true,
    });
    expect(valid(next)).toBe(true);
  });
});
