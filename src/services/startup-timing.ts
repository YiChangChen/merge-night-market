// 冷啟動各階段的時間（E6 retro A3）：冷啟動從約 2 秒變約 3 秒，剛好碰到 NFR2 的門檻。
// 在啟動流程的幾個點記下 performance.now()，除錯面板列出來，找出時間花在哪裡。
// 只記錄、不送出；每個階段只記第一次（之後的重新掛載不算）。

export type StartupStage = 'js-start' | 'root-mounted' | 'save-loaded' | 'board-visible';

export const STARTUP_STAGES: readonly { stage: StartupStage; label: string }[] = [
  { stage: 'js-start', label: 'JS 開始執行' },
  { stage: 'root-mounted', label: '根畫面掛載' },
  { stage: 'save-loaded', label: '存檔讀完' },
  { stage: 'board-visible', label: '棋盤第一次畫出來' },
];

const marks = new Map<StartupStage, number>();

function now(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

/** 記下這個階段的時間；同一個階段只記第一次。 */
export function markStartup(stage: StartupStage, at: number = now()): void {
  if (!marks.has(stage)) marks.set(stage, at);
}

/** 依階段順序列出已記錄的時間（毫秒，performance.now 的時間軸）。 */
export function getStartupMarks(): { stage: StartupStage; label: string; at: number }[] {
  return STARTUP_STAGES.flatMap(({ stage, label }) => {
    const at = marks.get(stage);
    return at === undefined ? [] : [{ stage, label, at }];
  });
}

/**
 * RN 原生的啟動時間（如果這個版本有提供）：從原生啟動到開始執行 JS bundle。
 * 非標準 API，沒有時回傳 null。
 */
export function getNativeStartupTiming(): Record<string, number> | null {
  const timing = (performance as unknown as { rnStartupTiming?: Record<string, unknown> })
    ?.rnStartupTiming;
  if (!timing) return null;
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(timing)) {
    if (typeof value === 'number' && Number.isFinite(value)) result[key] = value;
  }
  return Object.keys(result).length > 0 ? result : null;
}

/** 測試用：清除紀錄 */
export function resetStartupMarks(): void {
  marks.clear();
}
