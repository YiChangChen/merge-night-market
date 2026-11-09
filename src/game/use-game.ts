// v1 的 useGame 介面，現在只是 store 的薄包裝。
// 新程式碼請直接用 useGameStore 的 selector 訂閱需要的切片（見 project-context.md）。
import { useGameStore } from './store';

/** @deprecated 會訂閱整個 state；改用 `useGameStore((s) => s.state?.xxx)`。 */
export function useGame() {
  const state = useGameStore((store) => store.state);
  const apply = useGameStore((store) => store.apply);
  return { state, apply };
}
