// FxController：GameEvent 的三個訂閱者之一（另兩個是 AudioService、Telemetry）。
// 把遊戲事件轉成 Overlay Host 的演出。只讀事件，絕不同步呼叫 apply。
// 只在 src/app/_layout.tsx 的啟動序列呼叫一次。
import { gameEvents } from '@/game/events';

import { useOverlayStore } from './overlay-store';

/**
 * 升級攤位的同一次結算裡出現的阿嬤提示（教學提示），延到招牌通電演出（約 0.9 秒，見 street/neon-sign）
 * 播完才出現，不會一升級就被全螢幕的阿嬤蓋住（E4 code review）。
 */
export const HINT_AFTER_UPGRADE_MS = 1000;

/** 啟動演出控制，回傳停止函式。 */
export function startFxController(): () => void {
  // 同一批事件裡剛送出過 stall_upgraded：之後的阿嬤提示要延後；批次結束（microtask）就重設
  let upgradedInBatch = false;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const unsubscribe = gameEvents.subscribe((event) => {
    switch (event.type) {
      case 'stall_reopened':
        // 夜市街上的鐵捲門拉起（FR10），霓虹的第一段同時通電（FR14）
        useOverlayStore.getState().playShutter(event.stall);
        useOverlayStore.getState().playNeonPowerOn(event.stall);
        break;
      case 'stall_upgraded':
        // 招牌通電：新亮起的那一段霓虹閃幾下再亮起（FR14）
        useOverlayStore.getState().playNeonPowerOn(event.stall);
        upgradedInBatch = true;
        queueMicrotask(() => {
          upgradedInBatch = false;
        });
        break;
      case 'queue_sold_out':
        // 完售：煙火、獎勵、全街招牌一起閃（FR19、UX-DR4）
        useOverlayStore.getState().playSellout(event.wave);
        break;
      case 'dish_invented':
        // 第一次發明：全螢幕「老闆發明！」（FR25、UX-DR5）；已發現的配方只給小提示
        if (event.first) useOverlayStore.getState().playInvention(event.recipe);
        else useOverlayStore.getState().showDishMade(event.recipe);
        break;
      case 'hint_shown':
        // 阿嬤直接說出兩個材料（UX-DR7）
        if (upgradedInBatch) {
          const timer = setTimeout(() => {
            timers.delete(timer);
            useOverlayStore.getState().playHint(event.recipe);
          }, HINT_AFTER_UPGRADE_MS);
          timers.add(timer);
        } else {
          useOverlayStore.getState().playHint(event.recipe);
        }
        break;
      default:
        // 其他演出（卡牌升星…）由之後的 story 加入
        break;
    }
  });
  return () => {
    unsubscribe();
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
  };
}
