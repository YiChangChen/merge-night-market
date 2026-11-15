// 讀取 app.config.ts 注入的 extra。元件與其他服務一律經由這裡取得設定，不直接讀 expo-constants。
import Constants, { ExecutionEnvironment } from 'expo-constants';

type BuildProfile = 'development' | 'preview' | 'production';

export type Extra = {
  buildProfile?: BuildProfile;
  debugTools?: boolean;
  /** `.env.local` 的 EXPO_GO_DEBUG_TOOLS=1：在 Expo Go 的非開發模式（--no-dev）也開除錯工具 */
  expoGoDebugTools?: boolean;
  /** PostHog 的 Project API Key（S7.3） */
  posthogKey?: string | null;
  posthogHost?: string;
};

export type TelemetrySettings = {
  key: string;
  host: string;
  /** 每個事件都附上 env，報表篩選 production（開發與測試的資料也送同一個專案，7.3 AC6 審查決策） */
  env: BuildProfile;
};

/**
 * 埋點設定（S7.3）：只接受 Project API Key（phc_ 開頭）。沒有 key 或放錯成其他 key 時回傳 null，埋點停用。
 * app.config.ts 已經擋過一次；這裡再檢查，避免舊的建置或 OTA 帶著錯的 key。
 */
export function resolveTelemetry(extra: Extra): TelemetrySettings | null {
  const key = extra.posthogKey;
  if (typeof key !== 'string' || !key.startsWith('phc_')) return null;
  return {
    key,
    host: extra.posthogHost ?? 'https://us.i.posthog.com',
    env: extra.buildProfile ?? 'development',
  };
}

/**
 * 除錯工具（除錯面板、spike 畫面）只在開發模式或 preview 建置出現。
 * extra.debugTools 之外再加一道執行期防護（fail-closed）：如果 OTA 更新求值 app.config.ts 時
 * 漏設 APP_VARIANT，extra 會被當成 development，但正式版執行的是非開發模式的 JS（isDev = false），
 * 除錯工具仍然不會出現。
 *
 * 例外：本機用 Expo Go 跑 `--no-dev` 做實機驗證時（E1 retro A1），extra.expoGoDebugTools 打開，
 * 而且執行期確認真的在 Expo Go（或 dev client）裡才開啟。正式版的執行環境是 standalone，不會符合。
 */
export function resolveDebugTools(extra: Extra, isDev: boolean, isExpoGo = false): boolean {
  if (extra.debugTools !== true) return false;
  return isDev || extra.buildProfile === 'preview' || (isExpoGo && extra.expoGoDebugTools === true);
}

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

export const config = {
  appVersion: Constants.expoConfig?.version ?? '0.0.0',
  buildProfile: extra.buildProfile ?? 'development',
  telemetry: resolveTelemetry(extra),
  debugTools: resolveDebugTools(
    extra,
    __DEV__,
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient
  ),
} as const;
