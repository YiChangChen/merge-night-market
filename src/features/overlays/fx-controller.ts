// FxController：GameEvent 的三個訂閱者之一（另兩個是 AudioService、Telemetry）。
// 把遊戲事件轉成 Overlay Host 的演出。只讀事件，絕不同步呼叫 apply。
// 只在 src/app/_layout.tsx 的啟動序列呼叫一次。
import { gameEvents } from '@/game/events';

import { useOverlayStore } from './overlay-store';

/** 啟動演出控制，回傳停止函式。 */
export function startFxController(): () => void {
  return gameEvents.subscribe((event) => {
    switch (event.type) {
      case 'stall_reopened':
        // 夜市街上的鐵捲門拉起（FR10），霓虹的第一段同時通電（FR14）
        useOverlayStore.getState().playShutter(event.stall);
        useOverlayStore.getState().playNeonPowerOn(event.stall);
        break;
      case 'stall_upgraded':
        // 招牌通電：新亮起的那一段霓虹閃幾下再亮起（FR14）
        useOverlayStore.getState().playNeonPowerOn(event.stall);
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
      default:
        // 其他演出（阿嬤提示、卡牌升星…）由之後的 story 加入
        break;
    }
  });
}
