// 激勵廣告服務（NP-4）。UI 只透過這個介面播放廣告，獎勵一律由規則層的 grantAdReward 發放。
//
// 目前是假的實作（E5 retro D1）：只有 iPhone + Expo Go，沒有開發版建置環境，接不了 AdMob。
// - 除錯工具開著時：模擬播放 FAKE_AD_MS 後回傳除錯面板設定的結果（看完、跳過、沒有廣告）。
// - 正式版（沒有除錯工具）：isReady 一律 false，按鈕不會出現；寧可不給，也不發沒看廣告的獎勵（NFR10）。
// 接真的 AdMob（S1.4）時，只換掉 ads 的實作，介面與呼叫端不變。
import { create } from 'zustand';

import type { Placement } from '@/game/daily';

import { config } from './config';

export type AdResult = 'earned' | 'dismissed' | 'unavailable';

export type AdService = {
  init(): void;
  /** 已載入、有網路，可以馬上播放 */
  isReady(placement: Placement): boolean;
  /** 播放廣告；只有 'earned' 代表看完、可以發獎勵 */
  show(placement: Placement): Promise<AdResult>;
};

/** 假廣告的模擬播放時間 */
export const FAKE_AD_MS = 1200;

type FakeAdStore = {
  /** 除錯工具開著時才啟用 */
  enabled: boolean;
  /** 下一次播放的結果；'unavailable' 模擬離線或沒有庫存 */
  mode: AdResult;
  setMode: (mode: AdResult) => void;
};

export const useFakeAds = create<FakeAdStore>()((set) => ({
  enabled: config.debugTools,
  mode: 'earned',
  setMode: (mode) => set({ mode }),
}));

function fakeReady(): boolean {
  const { enabled, mode } = useFakeAds.getState();
  return enabled && mode !== 'unavailable';
}

export const ads: AdService = {
  init() {
    // 真的 AdMob 在這裡初始化（UMP 同意 → ATT → mobileAds().initialize()，S1.4）
  },
  isReady() {
    return fakeReady();
  },
  show() {
    if (!fakeReady()) return Promise.resolve('unavailable');
    const { mode } = useFakeAds.getState();
    return new Promise((resolve) => setTimeout(() => resolve(mode), FAKE_AD_MS));
  },
};

/** 給 UI 用的 isReady：除錯面板切換模式時按鈕會跟著出現或消失 */
export function useAdReady(_placement: Placement): boolean {
  return useFakeAds((store) => store.enabled && store.mode !== 'unavailable');
}
