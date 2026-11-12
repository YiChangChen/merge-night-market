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
  /** 演出還在播時又發明了新菜：排隊，依序播放，每道菜的首次演出都不會被蓋掉 */
  pendingInventions: RecipeId[];
  /** 阿嬤提示（S4.4）；同一次失敗可能同時提示兩道，排隊依序顯示 */
  hint: { recipe: RecipeId; token: number } | null;
  pendingHints: RecipeId[];
  /** 卡牌升星演出（S5.3）；同發明演出，播放中又升星就排隊 */
  starred: { recipe: RecipeId; stars: number; token: number } | null;
  pendingStarred: { recipe: RecipeId; stars: number }[];
  /** 體力不足的提示卡（S6.2）；放在這裡，新手引導等疊在上面的層才知道要讓開 */
  energyPrompt: boolean;
  openEnergyPrompt: () => void;
  closeEnergyPrompt: () => void;
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
  playHint: (recipe: RecipeId) => void;
  finishHint: () => void;
  hideDishMade: () => void;
  playStarred: (recipe: RecipeId, stars: number) => void;
  finishStarred: () => void;
  /** 換成另一局（除錯開新局、匯入存檔）時清掉所有面板、演出與排隊，舊進度的演出不會出現在新局 */
  reset: () => void;
};

let sequence = 0;

const INITIAL = {
  stallPanel: null,
  shutterOpening: {},
  neonPowerOn: {},
  sellout: null,
  invention: null,
  pendingInventions: [],
  dishMade: null,
  hint: null,
  pendingHints: [],
  starred: null,
  pendingStarred: [],
  energyPrompt: false,
} as const;

export const useOverlayStore = create<OverlayStore>()((set) => ({
  reset: () => set({ ...INITIAL, pendingInventions: [], pendingHints: [], pendingStarred: [] }),
  stallPanel: null,
  shutterOpening: {},
  neonPowerOn: {},
  sellout: null,
  invention: null,
  pendingInventions: [],
  dishMade: null,
  hint: null,
  pendingHints: [],
  starred: null,
  pendingStarred: [],
  energyPrompt: false,
  openEnergyPrompt: () => set({ energyPrompt: true }),
  closeEnergyPrompt: () => set({ energyPrompt: false }),
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
  playInvention: (recipe) =>
    set((store) =>
      store.invention
        ? { pendingInventions: [...store.pendingInventions, recipe] }
        : { invention: { recipe, token: ++sequence } }
    ),
  finishInvention: () =>
    set((store) => {
      const [next, ...rest] = store.pendingInventions;
      return next
        ? { invention: { recipe: next, token: ++sequence }, pendingInventions: rest }
        : { invention: null, pendingInventions: [] };
    }),
  showDishMade: (recipe) => set({ dishMade: { recipe, token: ++sequence } }),
  hideDishMade: () => set({ dishMade: null }),
  playStarred: (recipe, stars) =>
    set((store) =>
      store.starred
        ? { pendingStarred: [...store.pendingStarred, { recipe, stars }] }
        : { starred: { recipe, stars, token: ++sequence } }
    ),
  finishStarred: () =>
    set((store) => {
      const [next, ...rest] = store.pendingStarred;
      return next
        ? { starred: { ...next, token: ++sequence }, pendingStarred: rest }
        : { starred: null, pendingStarred: [] };
    }),
  playHint: (recipe) =>
    set((store) =>
      store.hint
        ? { pendingHints: [...store.pendingHints, recipe] }
        : { hint: { recipe, token: ++sequence } }
    ),
  finishHint: () =>
    set((store) => {
      const [next, ...rest] = store.pendingHints;
      return next
        ? { hint: { recipe: next, token: ++sequence }, pendingHints: rest }
        : { hint: null, pendingHints: [] };
    }),
}));
