import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { startGameSession } from '@/services/game-session';

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
