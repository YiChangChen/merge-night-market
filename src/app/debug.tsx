// 除錯面板（presentation: modal）。入口：設定畫面長按版本號 2 秒。
// 除錯工具關閉時（production，或非開發模式的 OTA）直接導回首頁，面板不會掛載。
import { Redirect } from 'expo-router';

import { config } from '@/services/config';

export default function DebugRoute() {
  if (!config.debugTools) return <Redirect href="/" />;
  // 只有除錯工具開啟時才載入面板模組（刻意用 require 延後載入，production 不會執行到這裡）
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DebugPanel } = require('@/features/debug') as typeof import('@/features/debug');
  return <DebugPanel />;
}
