// 讀取 app.config.ts 注入的 extra。元件與其他服務一律經由這裡取得設定，不直接讀 expo-constants。
import Constants from 'expo-constants';

type BuildProfile = 'development' | 'preview' | 'production';

export type Extra = {
  buildProfile?: BuildProfile;
  debugTools?: boolean;
};

/**
 * 除錯工具（除錯面板、spike 畫面）只在開發模式或 preview 建置出現。
 * extra.debugTools 之外再加一道執行期防護（fail-closed）：如果 OTA 更新求值 app.config.ts 時
 * 漏設 APP_VARIANT，extra 會被當成 development，但正式版執行的是非開發模式的 JS（isDev = false），
 * 除錯工具仍然不會出現。
 */
export function resolveDebugTools(extra: Extra, isDev: boolean): boolean {
  return extra.debugTools === true && (isDev || extra.buildProfile === 'preview');
}

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

export const config = {
  appVersion: Constants.expoConfig?.version ?? '0.0.0',
  buildProfile: extra.buildProfile ?? 'development',
  debugTools: resolveDebugTools(extra, __DEV__),
} as const;
