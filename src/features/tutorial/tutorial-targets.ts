// 新手引導的目標位置登記表（S6.4）：元件回報自己在視窗中的位置，根層的手指層依步驟挑一個指過去。
// 介面狀態，不存檔；教學完成後元件就不再量測。
import { type ComponentRef, useCallback, useEffect, useRef } from 'react';
import type { View } from 'react-native';
import { create } from 'zustand';

import { useGameStore } from '@/game/store';
import { tutorialDone } from '@/game/tutorial';

export type TutorialTargetId =
  'board' | `order-${number}` | 'tab-street' | 'stall-tea' | 'stall-fried' | 'upgrade';

export type TargetRect = { x: number; y: number; width: number; height: number };

type TargetStore = {
  rects: Partial<Record<TutorialTargetId, TargetRect>>;
  /** 遞增序號：版面可能整體移動時（例如夜市街捲動停止）要求所有目標重新量測 */
  remeasureToken: number;
  setRect: (id: TutorialTargetId, rect: TargetRect | null) => void;
  requestRemeasure: () => void;
};

export const useTutorialTargets = create<TargetStore>()((set) => ({
  rects: {},
  remeasureToken: 0,
  setRect: (id, rect) =>
    set((store) => {
      const current = store.rects[id];
      if (rect === null) {
        if (!current) return store;
        const { [id]: _removed, ...rest } = store.rects;
        return { rects: rest };
      }
      if (
        current &&
        current.x === rect.x &&
        current.y === rect.y &&
        current.width === rect.width &&
        current.height === rect.height
      ) {
        return store;
      }
      return { rects: { ...store.rects, [id]: rect } };
    }),
  requestRemeasure: () => set((store) => ({ remeasureToken: store.remeasureToken + 1 })),
}));

/** 教學期間定時重新量測的間隔：外層版面移動（例如安全區晚一步套用）不會觸發這個元件的 onLayout */
export const REMEASURE_INTERVAL_MS = 500;

/**
 * 把一個元件登記成引導目標：回傳要掛在那個 View 上的 ref 與 onLayout。
 * active 為 false（例如所在分頁不在前景）時不量測並移除登記；教學完成後也一樣，除非 always
 * （棋盤：教學完成後的合成小提示也要用）。教學期間每 0.5 秒重新量一次。
 */
export function useTutorialTarget(
  id: TutorialTargetId,
  active = true,
  { always = false }: { always?: boolean } = {}
) {
  const node = useRef<ComponentRef<typeof View> | null>(null);
  const done = useGameStore((store) => (store.state ? tutorialDone(store.state) : true));
  const enabled = active && (always || !done);
  const polling = active && !done;
  const remeasureToken = useTutorialTargets((store) => store.remeasureToken);
  const setRect = useTutorialTargets((store) => store.setRect);

  const measure = useCallback(() => {
    if (!enabled) return;
    node.current?.measureInWindow((x, y, width, height) => {
      setRect(id, width > 0 && height > 0 ? { x, y, width, height } : null);
    });
  }, [enabled, id, setRect]);

  useEffect(() => {
    if (!enabled) {
      setRect(id, null);
      return;
    }
    // 等這一幀排版完成再量（例如剛切回這個分頁）
    const frame = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frame);
  }, [enabled, id, measure, remeasureToken, setRect]);

  // 外層版面移動不會觸發 onLayout（實機上第一次量到的位置少了安全區的高度），教學期間定時重量
  useEffect(() => {
    if (!polling) return;
    const timer = setInterval(measure, REMEASURE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [measure, polling]);

  useEffect(() => () => setRect(id, null), [id, setRect]);

  // callback ref：元件掛上時記下節點（不在 render 期間讀寫 ref）
  const ref = useCallback((element: ComponentRef<typeof View> | null) => {
    node.current = element;
  }, []);

  return { ref, onLayout: measure };
}
