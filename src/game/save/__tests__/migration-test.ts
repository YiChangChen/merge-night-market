import fullBoardPending from './fixtures/save-v1-full-board-pending.json';
import lv3 from './fixtures/save-v1-lv3.json';
import lv7AllChains from './fixtures/save-v1-lv7-all-chains.json';
import newGame from './fixtures/save-v1-new-game.json';

import { BALANCE, CHAIN_IDS } from '../../content';
import { createGame } from '../../engine';
import { SAVE_VERSION } from '../../types';
import { isValidSaveV2, parseSave, serializeSave } from '..';
import type { GameStateV1 } from '../v1';

const NOW = 1_762_000_000_000;

const FIXTURES: [string, GameStateV1][] = [
  ['新局', newGame as GameStateV1],
  ['Lv3', lv3 as GameStateV1],
  ['Lv7 全鏈', lv7AllChains as GameStateV1],
  ['棋盤全滿且有待放產生器', fullBoardPending as GameStateV1],
];

function migrate(v1: GameStateV1) {
  const result = parseSave(JSON.stringify(v1), NOW);
  if (result.kind !== 'loaded') throw new Error(`遷移失敗：${JSON.stringify(result)}`);
  return result;
}

describe('v1 → v2 遷移（FR46、NFR5）', () => {
  it.each(FIXTURES)('%s：遷移成功並通過 v2 驗證', (_name, v1) => {
    const { state, migratedFrom } = migrate(v1);

    expect(migratedFrom).toBe(1);
    expect(state.version).toBe(SAVE_VERSION);
    expect(isValidSaveV2(JSON.parse(serializeSave(state)))).toBe(true);
  });

  it.each(FIXTURES)('%s：金幣、XP、等級、棋盤與其他 v1 欄位完全不變', (_name, v1) => {
    const { state } = migrate(v1);

    expect(state.coins).toBe(v1.coins);
    expect(state.xp).toBe(v1.xp);
    expect(state.level).toBe(v1.level);
    expect(state.board).toEqual(v1.board);
    expect(state.energy).toBe(v1.energy);
    expect(state.energyUpdatedAt).toBe(v1.energyUpdatedAt);
    expect(state.pendingGenerators).toEqual(v1.pendingGenerators);
    expect(state.nextId).toBe(v1.nextId);
    expect(state.rngSeed).toBe(v1.rngSeed);
  });

  it.each(FIXTURES)('%s：訂單補上 kind normal，其餘內容不變', (_name, v1) => {
    const { state } = migrate(v1);

    expect(state.orders).toEqual(v1.orders.map((order) => ({ ...order, kind: 'normal' })));
  });

  it('攤位依舊等級推算：已解鎖的鏈是 Lv1，其餘是鐵捲門', () => {
    expect(migrate(newGame as GameStateV1).state.stalls).toEqual({
      tea: { level: 1, signatureDish: null },
      fried: { level: 1, signatureDish: null },
      noodle: { level: 0, signatureDish: null },
      dumpling: { level: 0, signatureDish: null },
      sweet: { level: 0, signatureDish: null },
    });
    expect(migrate(lv3 as GameStateV1).state.stalls.noodle.level).toBe(1);
    expect(migrate(lv3 as GameStateV1).state.stalls.dumpling.level).toBe(0);
    const lv7 = migrate(lv7AllChains as GameStateV1).state;
    expect(CHAIN_IDS.every((chain) => lv7.stalls[chain].level === 1)).toBe(true);
  });

  it('以遷移後的攤位等級開一波人龍：2 攤 = 12 人、3 攤 = 14 人、5 攤 = 18 人', () => {
    expect(migrate(newGame as GameStateV1).state.queue).toEqual({
      wave: 1,
      length: 12,
      remaining: 12,
      cooldownEndsAt: null,
      bonus: 0,
    });
    expect(migrate(lv3 as GameStateV1).state.queue.length).toBe(14);
    expect(migrate(lv7AllChains as GameStateV1).state.queue.length).toBe(18);
  });

  it('v1 玩家不享開幕週，也不重跑教學；其他新欄位是空值', () => {
    const { state } = migrate(lv3 as GameStateV1);

    expect(state.meta).toEqual({
      firstLaunchAt: NOW - BALANCE.openingWeekMs,
      tutorialStep: BALANCE.tutorialSteps,
      hintedRecipes: [],
    });
    expect(state.inventions).toEqual({});
    expect(state.daily).toEqual({ dateKey: '', adEnergyUsed: 0, adDoubleUsed: 0 });
    expect(state.lastSellout).toBeNull();
    expect(state.events).toEqual([]);
  });

  it('棋盤全滿時，產生器與待放佇列原樣保留', () => {
    const { state } = migrate(fullBoardPending as GameStateV1);

    expect(state.board.every((piece) => piece !== null)).toBe(true);
    expect(state.pendingGenerators).toEqual(['dumpling', 'sweet']);
  });
});

describe('parseSave', () => {
  it('沒有存檔時回傳 empty（只有這種情況才開新局）', () => {
    expect(parseSave(null, NOW)).toEqual({ kind: 'empty' });
  });

  it('v2 存檔原樣讀回，不算遷移', () => {
    const state = createGame(NOW, 5);

    const result = parseSave(serializeSave(state), NOW);

    expect(result).toEqual({ kind: 'loaded', state, migratedFrom: null });
  });

  it.each([
    ['JSON 損毀', '{"version": 1, "board": [', 'corrupt-json'],
    ['沒有版本號', JSON.stringify({ coins: 10 }), 'unknown-version'],
    ['比 App 新的版本', JSON.stringify({ ...createGame(NOW, 1), version: 99 }), 'newer-version'],
    ['不合法的 v1', JSON.stringify({ ...newGame, board: [] }), 'migration-failed'],
    ['不合法的 v2', JSON.stringify({ ...createGame(NOW, 1), coins: 'lots' }), 'invalid'],
    ['v2 缺少新欄位', JSON.stringify({ ...createGame(NOW, 1), queue: undefined }), 'invalid'],
  ])('%s：回傳 failed（%#），不開新局', (_name, raw, reason) => {
    const result = parseSave(raw, NOW);

    expect(result.kind).toBe('failed');
    expect(result).toMatchObject({ reason });
  });
});

describe('serializeSave', () => {
  it('寫入的字串不含暫態的 events', () => {
    const state = {
      ...createGame(NOW, 1),
      events: [{ type: 'item_merged' as const, chain: 'tea' as const, level: 2 }],
    };

    expect(JSON.parse(serializeSave(state))).not.toHaveProperty('events');
  });
});

describe('isValidSaveV2', () => {
  const saved = () => JSON.parse(serializeSave(createGame(NOW, 1)));

  it('接受新局', () => {
    expect(isValidSaveV2(saved())).toBe(true);
  });

  // 放一個合法的新棋子到空格（id 用 nextId，不會撞號），再由各案例改壞它
  const withPiece = (s: any, piece: any) => {
    s.board[s.board.indexOf(null)] = { id: s.nextId, ...piece };
    s.nextId += 1;
  };

  it('接受完售後冷卻中的人龍，以及上限 20 的長度', () => {
    const cooling = saved();
    Object.assign(cooling.queue, { remaining: 0, cooldownEndsAt: NOW + 180_000 });
    cooling.lastSellout = { wave: 1, coins: 60, energy: 10, xp: 12, doubled: false };
    expect(isValidSaveV2(cooling)).toBe(true);

    const full = saved();
    Object.assign(full.queue, { length: 20, remaining: 20 });
    expect(isValidSaveV2(full)).toBe(true);
  });

  it('接受棋盤上新增的合法品項', () => {
    const save = saved();
    withPiece(save, { kind: 'item', chain: 'sweet', level: 7 });
    expect(isValidSaveV2(save)).toBe(true);
  });

  it.each([
    // 引擎與畫面還處理不了的資料（S3.2／E4 之前）
    ['發明菜棋子（S3.2 之前）', (s: any) => withPiece(s, { kind: 'dish', recipe: 'tea-fried', count: 1 })],
    ['貴客單（E4 之前）', (s: any) => Object.assign(s.orders[0], { kind: 'vip', recipe: 'tea-fried' })],
    ['線索單（E4 之前）', (s: any) => Object.assign(s.orders[0], { kind: 'clue', expiresAt: 1 })],
    // 型別
    ['未知的棋子種類', (s: any) => withPiece(s, { kind: 'bomb' })],
    ['未知的鏈', (s: any) => (s.pendingGenerators = ['pizza'])],
    ['攤位等級 4', (s: any) => (s.stalls.tea.level = 4)],
    ['缺少一個攤位', (s: any) => delete s.stalls.sweet],
    ['未知的訂單種類', (s: any) => (s.orders[0].kind = 'rush')],
    ['人龍冷卻時間不是數字', (s: any) => (s.queue.cooldownEndsAt = 'soon')],
    ['meta 缺少 firstLaunchAt', (s: any) => delete s.meta.firstLaunchAt],
    ['lastSellout 缺少 doubled', (s: any) => (s.lastSellout = { wave: 1, coins: 1, energy: 1, xp: 1 })],
    // 語意：會讓畫面或規則崩潰的資料
    ['品項階數超過該鏈長度', (s: any) => withPiece(s, { kind: 'item', chain: 'tea', level: 99 })],
    ['品項階數 0', (s: any) => withPiece(s, { kind: 'item', chain: 'tea', level: 0 })],
    ['訂單需求階數超過該鏈長度', (s: any) => (s.orders[0].requirements = [{ chain: 'fried', level: 7 }])],
    ['訂單需求階數 0', (s: any) => (s.orders[0].requirements = [{ chain: 'tea', level: 0 }])],
    ['訂單沒有需求（免費領獎）', (s: any) => (s.orders[0].requirements = [])],
    ['訂單需求超過 2 項', (s: any) => s.orders[0].requirements.push(...Array(2).fill({ chain: 'tea', level: 2 }))],
    ['訂單 id 為負數', (s: any) => (s.orders[0].id = -1)],
    ['訂單 id 為小數', (s: any) => (s.orders[0].id = 1.5)],
    ['nextId 為小數', (s: any) => (s.nextId = 1000.5)],
    ['nextId 不大於現有最大 id', (s: any) => (s.nextId = 1)],
    ['棋子與訂單 id 重複', (s: any) => withPiece(s, { kind: 'item', chain: 'tea', level: 1, id: s.orders[0].id })],
    ['玩家等級 0', (s: any) => (s.level = 0)],
    ['玩家等級為小數', (s: any) => (s.level = 2.5)],
    ['金幣為負數', (s: any) => (s.coins = -10)],
    ['體力為負數', (s: any) => (s.energy = -1)],
    ['待放產生器重複', (s: any) => (s.pendingGenerators = ['noodle', 'noodle'])],
    ['待放產生器的鏈已經在棋盤上', (s: any) => (s.pendingGenerators = ['tea'])],
    ['人龍剩餘人數大於長度', (s: any) => (s.queue.remaining = s.queue.length + 1)],
    ['人龍長度超過上限（放大完售獎勵）', (s: any) => Object.assign(s.queue, { length: 100000, remaining: 1 })],
    ['冷卻中還有人排隊', (s: any) => (s.queue.cooldownEndsAt = 2_000_000)],
    ['教學步數超過上限', (s: any) => (s.meta.tutorialStep = 99)],
    ['所有攤位都是鐵捲門（訂單無處可出）', (s: any) => Object.values(s.stalls).forEach((stall: any) => (stall.level = 0))],
  ])('拒絕：%s', (_name, corrupt) => {
    const save = saved();
    corrupt(save);
    expect(isValidSaveV2(save)).toBe(false);
  });
});
