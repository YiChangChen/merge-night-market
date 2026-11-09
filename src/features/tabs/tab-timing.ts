// 分頁切換時間量測（NFR3：≤ 300 ms）：點擊分頁 → 目標分頁取得焦點後的下一幀。
// 結果顯示在設定畫面（只在除錯工具開啟時）。這裡不寫 log：切換是熱路徑。
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

let pending: { target: string; startedAt: number } | null = null;
const samples: number[] = [];
const MAX_SAMPLES = 50;

export function markTabPress(target: string) {
  pending = { target, startedAt: performance.now() };
}

/** 在分頁畫面裡呼叫：取得焦點後等一幀，記錄從點擊到畫面出現的時間。 */
export function useTabSwitchTiming(name: string) {
  useFocusEffect(
    useCallback(() => {
      if (pending?.target !== name) return;
      const { startedAt } = pending;
      pending = null;
      const frame = requestAnimationFrame(() => {
        samples.push(performance.now() - startedAt);
        if (samples.length > MAX_SAMPLES) samples.shift();
      });
      return () => cancelAnimationFrame(frame);
    }, [name])
  );
}

export function tabSwitchSamples(): readonly number[] {
  return samples;
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
