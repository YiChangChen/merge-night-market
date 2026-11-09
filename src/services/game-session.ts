// 遊戲的執行週期：開機讀檔、自動存檔、每秒結算時間、前景與背景切換。
// 只在 src/app/_layout.tsx 的啟動序列呼叫一次。
import { AppState } from 'react-native';

import { BALANCE } from '@/game/content';
import { useGameStore } from '@/game/store';

import { loadGame, saveGame } from './save';

const SAVE_DEBOUNCE_MS = 500;
const TICK_MS = 1000;

// 不改變任何東西的 action；apply 會先執行 syncAll，所以等同「結算到現在」
const settle = () => useGameStore.getState().apply((state) => state);

function saveNow() {
  // 讀檔失敗時 state 是 null，所以不會覆寫原本的存檔
  const { state } = useGameStore.getState();
  if (state) saveGame(state);
}

// 每次讀檔遞增；舊的讀檔結果（例如 session 已停止或使用者按了重試）一律丟棄
let loadGeneration = 0;

function loadIntoStore() {
  const generation = ++loadGeneration;
  loadGame().then((result) => {
    if (generation !== loadGeneration) return;
    const store = useGameStore.getState();
    if (result.kind === 'ready') store.hydrate(result.state);
    else store.failLoad(result.reason);
  });
}

/** 存檔讀取失敗畫面的「重試」：回到 loading 再讀一次。 */
export function retryLoadGame() {
  useGameStore.getState().resetLoad();
  loadIntoStore();
}

/** 啟動遊戲執行週期，回傳停止函式。 */
export function startGameSession(): () => void {
  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  loadIntoStore();

  // state 一有變動就延後存檔，連續操作只寫一次
  const unsubscribeSave = useGameStore.subscribe((store, previous) => {
    if (!store.state || store.state === previous.state) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, SAVE_DEBOUNCE_MS);
  });

  const tick = setInterval(() => {
    const { state } = useGameStore.getState();
    // 體力滿時不必結算，避免每秒產生新 state 並觸發存檔
    if (state && state.energy < BALANCE.maxEnergy) settle();
  }, TICK_MS);

  // App 退到背景時可能來不及等 debounce，立刻存一次
  const appState = AppState.addEventListener('change', (status) => {
    if (status === 'active') settle();
    else saveNow();
  });

  return () => {
    // 讓還沒回來的讀檔結果失效
    loadGeneration += 1;
    clearTimeout(saveTimer);
    clearInterval(tick);
    unsubscribeSave();
    appState.remove();
  };
}
