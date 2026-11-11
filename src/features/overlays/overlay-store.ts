// Overlay Host 的介面狀態（不是遊戲狀態，不存檔）：目前開著哪個面板、哪些演出正在播。
import { create } from 'zustand';

import type { ChainId, RecipeId } from '@/game/content';

type OverlayStore = {
  /** 開著的攤位面板（UX-DR3）；null 代表沒有面板 */
  stallPanel: ChainId | null;
  /** 正在播放鐵捲門拉起動畫的攤位（值是遞增序號，同一攤連續觸發時也會重播） */
  shutterOpening: Partial<Record<ChainId, number>>;
  /** 正在播放招牌通電演出的攤位（同上，值是遞增序號） */
  neonPowerOn: Partial<Record<ChainId, number>>;
  /** 正在播放的完售演出（S2.4）；token 是遞增序號，夜市街的招牌用它一起閃爍 */
  sellout: { wave: number; token: number } | null;
  /** 首次發明的全螢幕演出（S3.4）；token 讓同一道菜連續觸發時也會重播 */
  invention: { recipe: RecipeId; token: number } | null;
  /** 已發現的配方又做出一份：棋盤上方的小提示（S3.4） */
  dishMade: { recipe: RecipeId; token: number } | null;
  openStallPanel: (chain: ChainId) => void;
  closeStallPanel: () => void;
  playShutter: (chain: ChainId) => void;
  finishShutter: (chain: ChainId) => void;
  playNeonPowerOn: (chain: ChainId) => void;
  finishNeonPowerOn: (chain: ChainId) => void;
  playSellout: (wave: number) => void;
  finishSellout: () => void;
  playInvention: (recipe: RecipeId) => void;
  finishInvention: () => void;
  showDishMade: (recipe: RecipeId) => void;
  hideDishMade: () => void;
};

let sequence = 0;

export const useOverlayStore = create<OverlayStore>()((set) => ({
  stallPanel: null,
  shutterOpening: {},
  neonPowerOn: {},
  sellout: null,
  invention: null,
  dishMade: null,
  openStallPanel: (chain) => set({ stallPanel: chain }),
  closeStallPanel: () => set({ stallPanel: null }),
  playShutter: (chain) =>
    set((store) => ({ shutterOpening: { ...store.shutterOpening, [chain]: ++sequence } })),
  finishShutter: (chain) =>
    set((store) => {
      const { [chain]: _done, ...rest } = store.shutterOpening;
      return { shutterOpening: rest };
    }),
  playNeonPowerOn: (chain) =>
    set((store) => ({ neonPowerOn: { ...store.neonPowerOn, [chain]: ++sequence } })),
  finishNeonPowerOn: (chain) =>
    set((store) => {
      const { [chain]: _done, ...rest } = store.neonPowerOn;
      return { neonPowerOn: rest };
    }),
  playSellout: (wave) => set({ sellout: { wave, token: ++sequence } }),
  finishSellout: () => set({ sellout: null }),
  playInvention: (recipe) => set({ invention: { recipe, token: ++sequence } }),
  finishInvention: () => set({ invention: null }),
  showDishMade: (recipe) => set({ dishMade: { recipe, token: ++sequence } }),
  hideDishMade: () => set({ dishMade: null }),
}));
