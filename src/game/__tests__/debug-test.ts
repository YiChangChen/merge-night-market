import { BALANCE } from '../content';
import { createGame } from '../engine';
import {
  debugAddCoins,
  debugAddEnergy,
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
