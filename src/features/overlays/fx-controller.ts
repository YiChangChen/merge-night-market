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
        // 夜市街上的鐵捲門拉起（FR10）
        useOverlayStore.getState().playShutter(event.stall);
        break;
      case 'stall_upgraded':
        // 招牌通電：新亮起的那一段霓虹閃幾下再亮起（FR14）
        useOverlayStore.getState().playNeonPowerOn(event.stall);
        break;
      default:
        // 其他演出（完售煙火、老闆發明…）由之後的 story 加入
        break;
    }
  });
}
