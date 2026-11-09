// 量測「點擊進入夜市街 → 夜市街首次 onLayout」的時間。存在模組層級，跨多次進出累積。
// 只給 Spike A 使用；正式的分頁切換量測在 Story 1.7 的 Tabs 上重做。
let pendingStart: number | null = null;
const samples: number[] = [];

export function markNavStart() {
  pendingStart = performance.now();
}

/** 在目標畫面第一次 onLayout 時呼叫；沒有對應的起點就忽略。 */
export function markNavEnd() {
  if (pendingStart === null) return;
  samples.push(performance.now() - pendingStart);
  pendingStart = null;
}

export function navSamples(): readonly number[] {
  return samples;
}

export function clearNavSamples() {
  samples.length = 0;
}
