// Spike A 的量測統計：純函式，方便測試。

/** 幀間隔超過這個值，代表錯過了一個 60 Hz 畫面（16.7 ms × 1.5）。 */
export const JANK_THRESHOLD_MS = 25;

export type FrameSummary = {
  frames: number;
  avgFps: number;
  /** 卡頓幀佔全部幀的百分比（0–100）。 */
  jankPercent: number;
};

export function summarizeFrames(deltas: readonly number[]): FrameSummary {
  if (deltas.length === 0) return { frames: 0, avgFps: 0, jankPercent: 0 };
  let total = 0;
  let janky = 0;
  for (const delta of deltas) {
    total += delta;
    if (delta > JANK_THRESHOLD_MS) janky += 1;
  }
  return {
    frames: deltas.length,
    avgFps: total > 0 ? (deltas.length * 1000) / total : 0,
    jankPercent: (janky / deltas.length) * 100,
  };
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
