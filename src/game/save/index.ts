// 存檔的解析與序列化（純函式）。I/O 在 src/services/save.ts。
import { type GameState, SAVE_VERSION } from '../types';
import { migrations } from './migrations';
import { isValidSaveV2 } from './validate';

export { isValidSaveV2 } from './validate';

export type SaveFailure =
  | 'corrupt-json'
  | 'unknown-version'
  | 'newer-version'
  | 'migration-failed'
  | 'invalid';

/** 讀檔失敗的所有原因：解析失敗，加上服務層的儲存錯誤與未預期的例外。 */
export type LoadFailure = SaveFailure | 'storage-error' | 'unexpected-error';

export type ParseResult =
  | { kind: 'empty' }
  | { kind: 'loaded'; state: GameState; migratedFrom: number | null }
  | { kind: 'failed'; reason: SaveFailure; version: number | null };

function versionOf(value: unknown): number | null {
  if (typeof value !== 'object' || value === null) return null;
  const version = (value as { version?: unknown }).version;
  return Number.isInteger(version) ? (version as number) : null;
}

/**
 * 把存檔字串轉成目前版本的 GameState。
 * - 沒有存檔：empty（只有這種情況才開新局）
 * - 舊版本：依序套用 migrations，最後必須通過 v2 驗證
 * - 任何失敗：failed，呼叫端不得覆寫原檔、不得開新局
 */
export function parseSave(raw: string | null, now: number): ParseResult {
  if (raw === null) return { kind: 'empty' };

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { kind: 'failed', reason: 'corrupt-json', version: null };
  }

  const original = versionOf(data);
  if (original === null) return { kind: 'failed', reason: 'unknown-version', version: null };
  if (original > SAVE_VERSION) {
    return { kind: 'failed', reason: 'newer-version', version: original };
  }

  let version = original;
  while (version < SAVE_VERSION) {
    const migrate = migrations[version];
    const next = migrate ? migrate(data, now) : null;
    if (next === null) return { kind: 'failed', reason: 'migration-failed', version: original };
    data = next;
    version += 1;
  }

  // events 是暫態，不在存檔裡；驗證前先拿掉，驗證後補上空陣列
  const { events: _events, ...saved } = data as Record<string, unknown>;
  if (!isValidSaveV2(saved)) return { kind: 'failed', reason: 'invalid', version: original };

  return {
    kind: 'loaded',
    state: { ...(saved as Omit<GameState, 'events'>), events: [] },
    migratedFrom: original === SAVE_VERSION ? null : original,
  };
}

/** 寫入存檔用的字串：拿掉暫態的 events。 */
export function serializeSave(state: GameState): string {
  const { events: _events, ...saved } = state;
  return JSON.stringify(saved);
}
