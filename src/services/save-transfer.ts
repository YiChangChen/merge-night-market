// 存檔匯出／匯入（除錯面板，S1.8）：透過剪貼簿搬移存檔 JSON，用來重現 bug、測試後期內容、製作 fixture。
// 匯入一律先跑遷移與驗證；不合法的資料直接拒絕，不會碰到目前的遊戲狀態。
import * as Clipboard from 'expo-clipboard';

import { type LoadFailure, parseSave, serializeSave } from '@/game/save';
import { useGameStore } from '@/game/store';

import { log } from './log';

export type ExportResult = { ok: true; length: number } | { ok: false };

export type ImportResult =
  | { ok: true; level: number; coins: number; migratedFrom: number | null }
  | { ok: false; reason: LoadFailure | 'empty-clipboard' | 'not-ready' };

/** 把目前的存檔（不含暫態 events）複製到剪貼簿。 */
export async function exportSaveToClipboard(): Promise<ExportResult> {
  const { state } = useGameStore.getState();
  if (!state) return { ok: false };
  try {
    const text = serializeSave(state);
    await Clipboard.setStringAsync(text);
    log.info('save', '已匯出存檔到剪貼簿', { length: text.length, level: state.level });
    return { ok: true, length: text.length };
  } catch (error) {
    log.warn('save', '無法匯出存檔到剪貼簿', error);
    return { ok: false };
  }
}

/** 從剪貼簿讀取存檔：遷移、驗證都通過才取代目前的遊戲狀態（之後由自動存檔寫入）。 */
export async function importSaveFromClipboard(): Promise<ImportResult> {
  if (useGameStore.getState().status.kind !== 'ready') return { ok: false, reason: 'not-ready' };

  let text: string;
  try {
    text = await Clipboard.getStringAsync();
  } catch (error) {
    log.warn('save', '無法讀取剪貼簿', error);
    return { ok: false, reason: 'storage-error' };
  }
  if (text.trim() === '') return { ok: false, reason: 'empty-clipboard' };

  const result = parseSave(text, Date.now());
  if (result.kind === 'empty') return { ok: false, reason: 'empty-clipboard' };
  if (result.kind === 'failed') {
    log.warn('save', '匯入的存檔不合法，已拒絕', { reason: result.reason, version: result.version });
    return { ok: false, reason: result.reason };
  }

  useGameStore.getState().hydrate(result.state);
  log.info('save', '已從剪貼簿匯入存檔', {
    level: result.state.level,
    coins: result.state.coins,
    migratedFrom: result.migratedFrom,
  });
  return {
    ok: true,
    level: result.state.level,
    coins: result.state.coins,
    migratedFrom: result.migratedFrom,
  };
}
