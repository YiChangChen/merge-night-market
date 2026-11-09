import { type ErrorBoundaryProps, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ErrorScreen } from '@/features/errors';
import { startGameSession } from '@/services/game-session';

// 根層錯誤防護：子路由 render 出錯時由 Expo Router 交到這裡，顯示「重新載入」而不是白屏。
// retry 會清除錯誤並重新渲染路由；遊戲狀態在 store 裡，不受影響。
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <>
      <StatusBar style="light" />
      <ErrorScreen error={error} onRetry={retry} />
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === 'web') document.title = '合成夜市';
  }, []);

  // 啟動序列：讀檔、自動存檔、每秒結算
  useEffect(() => startGameSession(), []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </GestureHandlerRootView>
  );
}
