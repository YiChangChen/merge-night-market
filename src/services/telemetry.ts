// 數據埋點（S7.3、FR45）：GameEvent 的三個訂閱者之一（另兩個是 FxController、AudioService）。只讀事件，絕不呼叫 apply。
// 只在 src/app/_layout.tsx 的啟動序列呼叫一次。網頁版見 telemetry.web.ts（no-op）。
//
// 隱私：只用 PostHog 的匿名 ID，不建立個人資料、不擷取 geoip、不自動擷取畫面與觸控（AC4）。
// 玩家可以在設定關掉「分析資料」：之後不再送出任何事件，並呼叫 PostHog 的 optOut（E7 retro）。
// IP 由 PostHog 專案設定「Discard client IP data」丟棄（7.3 審查決策）；SDK 附的 $device_name 是機型名稱，不是使用者取的名字。
import PostHog from 'posthog-react-native';
import { AppState, type AppStateStatus } from 'react-native';

import type { Placement } from '@/game/daily';
import { type GameEvent, gameEvents } from '@/game/events';
import { useGameStore } from '@/game/store';

import { config, type TelemetrySettings } from './config';
import { log } from './log';
import { useSettings } from './settings';

type Props = Record<string, string | number | boolean>;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 不送的 GameEvent：合成一局上百次，目前的指標（留存、漏斗、升級、發明、廣告）都用不到，
 * 送了只會吃掉 PostHog 的額度（7.3 審查決策）
 */
export const EXCLUDED_EVENTS: ReadonlySet<GameEvent['type']> = new Set(['item_merged']);

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
let env: TelemetrySettings['env'] = 'development';
let warned = false;

function warnOnce(message: string, error: unknown) {
  if (warned) return;
  warned = true;
  log.warn('telemetry', message, { error: String(error) });
}

/**
 * 每個事件都附上：
 * - env：建置 profile，報表篩選 production（AC6）
 * - days_since_first_launch：「第 1 天第一次升級率」「第 3 天首次發明率」要用安裝後第幾天分群（AC3）
 */
/** 設定讀完而且玩家沒有關掉分析資料（設定還沒讀完時先不送，避免關掉的玩家被送出一筆） */
function allowed(): boolean {
  const { loaded, analytics } = useSettings.getState();
  return loaded && analytics;
}

function capture(event: string, props: Props = {}) {
  if (!client || !allowed()) return;
  const state = useGameStore.getState().state;
  try {
    client.capture(event, {
      ...props,
      env,
      ...(state && {
        days_since_first_launch: daysSinceFirstLaunch(state.meta.firstLaunchAt, Date.now()),
      }),
    });
  } catch (error) {
    warnOnce('送出埋點失敗', error);
  }
}

/** 廣告開始播放（ads.show 呼叫）；看完的獎勵另由 GameEvent ad_rewarded 送出 */
export function trackAdShown(placement: Placement): void {
  capture('ad_shown', { placement });
}

/**
 * 點產生器時體力不足（棋盤畫面打開體力提示卡時呼叫，S7.5）：封測指標「前 3 天是否卡在體力」用。
 * 和 ad_shown 分開：沒有廣告、或玩家沒看廣告也要算到
 */
export function trackEnergyBlocked(): void {
  capture('energy_blocked');
}

/**
 * 啟動埋點，回傳停止函式。沒有 Project API Key（phc_）時什麼都不做。
 * 首幀之後才建立 PostHog（E6 retro A3：不拖慢冷啟動）；之前的事件直接略過。
 */
export function startTelemetry({
  settings = config.telemetry,
}: { settings?: TelemetrySettings | null } = {}): () => void {
  if (!settings) return () => {};
  warned = false;
  env = settings.env;

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
    applyConsent();
    trackAppOpen();
  };
  const frame = requestAnimationFrame(init);

  // 分析資料開關：同步給 PostHog（optOut 會保存在 SDK 的儲存裡，開回來時要 optIn）
  let consent: boolean | null = null;
  const applyConsent = () => {
    const { loaded, analytics } = useSettings.getState();
    if (!client || !loaded || consent === analytics) return;
    consent = analytics;
    (analytics ? client.optIn() : client.optOut()).catch((error: unknown) =>
      warnOnce('切換分析資料失敗', error)
    );
  };
  const unsubscribeSettings = useSettings.subscribe(() => {
    applyConsent();
    // 設定比存檔晚讀完時，app_open 等到這時候才送
    trackAppOpen();
  });

  // app_open：讀檔完成時送一次；從背景回到前景再送（留存要靠它）。
  // 只在前景送：iOS 進背景後的寬限期內計時器仍會更新 store，不能在那時候算成一次開啟
  let appActive = AppState.currentState !== 'background';
  let openedThisSession = false;
  // 這一次開啟的 app_open 時間；進背景時送 app_background 算單次遊玩時間（S7.5 指標「單次 3–6 分鐘」）
  let openedAt = 0;
  const trackAppOpen = () => {
    const { state, status } = useGameStore.getState();
    if (!client || !allowed() || !appActive || !state || status.kind !== 'ready') return;
    if (openedThisSession) return;
    openedThisSession = true;
    openedAt = Date.now();
    capture('app_open');
  };

  // tutorial_step：教學推進到新的步驟時送（讀檔時的第一次不算）。
  // 一次跳好幾步時每一步都補送；步驟倒退（除錯面板開新局、匯入存檔）後不重複送已經送過的步驟
  let maxTutorialStep = useGameStore.getState().state?.meta.tutorialStep ?? null;
  const unsubscribeStore = useGameStore.subscribe((store) => {
    trackAppOpen();
    const step = store.state?.meta.tutorialStep ?? null;
    if (step === null) return;
    if (maxTutorialStep === null) {
      maxTutorialStep = step;
      return;
    }
    for (let next = maxTutorialStep + 1; next <= step; next++) {
      capture('tutorial_step', { step: next });
    }
    maxTutorialStep = Math.max(maxTutorialStep, step);
  });

  const unsubscribeEvents = gameEvents.subscribe((event) => {
    if (EXCLUDED_EVENTS.has(event.type)) return;
    capture(event.type, eventProperties(event));
  });

  const appStateSubscription = AppState.addEventListener('change', (state: AppStateStatus) => {
    appActive = state !== 'background';
    if (!appActive) {
      // 進背景：送出這一次開啟玩了多久，再把排隊的事件送出去；下一次回到前景算新的一次開啟
      if (openedThisSession) {
        capture('app_background', {
          session_seconds: Math.max(0, Math.round((Date.now() - openedAt) / 1000)),
        });
      }
      openedThisSession = false;
      client?.flush().catch((error: unknown) => warnOnce('送出埋點失敗', error));
    } else {
      trackAppOpen();
    }
  });

  return () => {
    cancelAnimationFrame(frame);
    unsubscribeEvents();
    unsubscribeStore();
    unsubscribeSettings();
    appStateSubscription.remove();
    client?.flush().catch((error: unknown) => warnOnce('送出埋點失敗', error));
    client = null;
  };
}
