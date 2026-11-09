// 存檔遷移鏈。migrations[n] 把 vn 的存檔轉成 v(n+1)；輸入不合法時回傳 null，由呼叫端顯示錯誤畫面。
// 每新增一個版本：遞增 SAVE_VERSION、新增 migrations[n]、新增 fixture（見 project-context）。
import { BALANCE } from '../content';
import { stallsForPlayerLevel } from '../engine';
import { queueCapacity } from '../queue';
import { type GameState, SAVE_VERSION } from '../types';
import { type GameStateV1, isValidSaveV1 } from './v1';

/** v1 → v2（FR46）：攤位依舊等級推算、訂單補上 kind、開一波人龍，v1 玩家不享開幕週也不重跑教學。 */
export function migrateV1ToV2(save: GameStateV1, now: number): GameState {
  const stalls = stallsForPlayerLevel(save.level);
  const emptyQueue = { wave: 1, length: 0, remaining: 0, cooldownEndsAt: null, bonus: 0 };
  const length = queueCapacity({ stalls, queue: emptyQueue });
  return {
    version: SAVE_VERSION,
    board: save.board.map((piece) => (piece ? { ...piece } : null)),
    orders: save.orders.map((order) => ({ ...order, kind: 'normal' })),
    energy: save.energy,
    energyUpdatedAt: save.energyUpdatedAt,
    coins: save.coins,
    level: save.level,
    xp: save.xp,
    pendingGenerators: [...save.pendingGenerators],
    nextId: save.nextId,
    rngSeed: save.rngSeed,
    stalls,
    queue: { ...emptyQueue, length, remaining: length },
    inventions: {},
    meta: {
      // v1 玩家視為開幕週已過（架構 Decision #14）
      firstLaunchAt: now - BALANCE.openingWeekMs,
      // v1 玩家不重跑教學
      tutorialStep: BALANCE.tutorialSteps,
      hintedRecipes: [],
    },
    daily: { dateKey: '', adEnergyUsed: 0, adDoubleUsed: 0 },
    lastSellout: null,
    events: [],
  };
}

type Migration = (save: unknown, now: number) => unknown | null;

export const migrations: Record<number, Migration> = {
  1: (save, now) => (isValidSaveV1(save) ? migrateV1ToV2(save, now) : null),
};
