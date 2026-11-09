// 讀取 app.config.ts 注入的 extra。元件與其他服務一律經由這裡取得設定，不直接讀 expo-constants。
import Constants from 'expo-constants';

type Extra = {
  buildProfile?: 'development' | 'preview' | 'production';
  debugTools?: boolean;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

export const config = {
  buildProfile: extra.buildProfile ?? 'development',
  /** 除錯工具（除錯面板、spike 畫面）只在 development 與 preview 出現。 */
  debugTools: extra.debugTools === true,
} as const;
