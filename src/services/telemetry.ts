// 數據埋點（S7.3、FR45）：GameEvent 的三個訂閱者之一（另兩個是 FxController、AudioService）。只讀事件，絕不呼叫 apply。
// 只在 src/app/_layout.tsx 的啟動序列呼叫一次。網頁版見 telemetry.web.ts（no-op）。
//
// 隱私：只用 PostHog 的匿名 ID，不建立個人資料、不擷取 geoip、不自動擷取畫面與觸控（AC4）。
import PostHog from 'posthog-react-native';
import { AppState, type AppStateStatus } from 'react-native';

import type { Placement } from '@/game/daily';
import { type GameEvent, gameEvents } from '@/game/events';
import { useGameStore } from '@/game/store';

import { config } from './config';
import { log } from './log';

type Props = Record<string, string | number | boolean>;

const DAY_MS = 24 * 60 * 60 * 1000;

/** 首次啟動到現在過了幾天（第 0 天是安裝當天），給 D1／D7／D30 留存用 */
export function daysSinceFirstLaunch(firstLaunchAt: number, now: number): number {
  return Math.max(0, Math.floor((now - firstLaunchAt) / DAY_MS));
}

/** 事件屬性維持扁平：去掉 type；陣列改成逗號字串加上數量 */
export function eventProperties(event: GameEvent): Props {
  const props: Props = {};
  for (const [key, value] of Object.entries(event)) {
    if (key === 'type') continue;
    if (Array.isArray(value)) {
      props[key] = value.join(',');
      props[`${key}_count`] = value.length;
    } else if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      props[key] = value;
    }
  }
  return props;
}

// 目前的 PostHog 實例（廣告服務的 trackAdShown 也要用）
let client: PostHog | null = null;
let warned = false;

function warnOnce(message: string, error: unknown) {
  if (warned) return;
  warned = true;
  log.warn('telemetry', message, { error: String(error) });
}

function capture(event: string, props?: Props) {
  if (!client) return;
  try {
    client.capture(event, props);
  } catch (error) {
    warnOnce('送出埋點失敗', error);
  }
}

/** 廣告開始播放（ads.show 呼叫）；看完的獎勵另由 GameEvent ad_rewarded 送出 */
export function trackAdShown(placement: Placement): void {
  capture('ad_shown', { placement });
}

/**
 * 啟動埋點，回傳停止函式。沒有 Project API Key（phc_）時什麼都不做。
 * 首幀之後才建立 PostHog（E6 retro A3：不拖慢冷啟動）；之前的事件直接略過。
 */
export function startTelemetry({
  settings = config.telemetry,
}: { settings?: { key: string; host: string } | null } = {}): () => void {
  if (!settings) return () => {};
  warned = false;

  const init = () => {
    try {
      client = new PostHog(settings.key, {
        host: settings.host,
        // 自己送 app_open；不使用 PostHogProvider，所以也沒有畫面與觸控的自動擷取
        captureAppLifecycleEvents: false,
        // 離線時暫存在手機上，連上網路後批次送出（AC5）
        persistence: 'file',
        flushAt: 20,
        flushInterval: 30_000,
        // 只用匿名 ID，不建立個人資料、不擷取 geoip（AC4）
        personProfiles: 'never',
        disableGeoip: true,
      });
    } catch (error) {
      warnOnce('初始化埋點失敗', error);
      client = null;
      return;
    }
    trackAppOpen();
  };
  const frame = requestAnimationFrame(init);

  // app_open：讀檔完成時送一次；從背景回到前景再送（留存要靠它）
  let openedThisSession = false;
  const trackAppOpen = () => {
    const { state, status } = useGameStore.getState();
    if (!client || !state || status.kind !== 'ready' || openedThisSession) return;
    openedThisSession = true;
    capture('app_open', {
      days_since_first_launch: daysSinceFirstLaunch(state.meta.firstLaunchAt, Date.now()),
    });
  };

  // tutorial_step：教學步驟變大時送（讀檔時的第一次不算改變）
  let tutorialStep = useGameStore.getState().state?.meta.tutorialStep ?? null;
  const unsubscribeStore = useGameStore.subscribe((store) => {
    trackAppOpen();
    const step = store.state?.meta.tutorialStep ?? null;
    if (step === null) return;
    if (tutorialStep !== null && step > tutorialStep) capture('tutorial_step', { step });
    tutorialStep = step;
  });

  const unsubscribeEvents = gameEvents.subscribe((event) => {
    capture(event.type, eventProperties(event));
  });

  const appStateSubscription = AppState.addEventListener('change', (state: AppStateStatus) => {
    if (state === 'background') {
      // 進背景：先把排隊的事件送出去，下一次回到前景算新的一次開啟
      openedThisSession = false;
      client?.flush().catch((error: unknown) => warnOnce('送出埋點失敗', error));
    } else if (state === 'active') {
      trackAppOpen();
    }
  });

  return () => {
    cancelAnimationFrame(frame);
    unsubscribeEvents();
    unsubscribeStore();
    appStateSubscription.remove();
    client?.flush().catch((error: unknown) => warnOnce('送出埋點失敗', error));
    client = null;
  };
}
