import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { median, tabSwitchSamples } from '@/features/tabs';
import { config } from '@/services/config';

// 長按版本號這麼久才開啟除錯面板（架構〈Debug Tools〉）
const DEBUG_LONG_PRESS_MS = 2000;

/**
 * 設定畫面（modal），入口在夜市街左上角。
 * 版本號在除錯工具開啟時可以長按 2 秒開啟除錯面板（S1.8）；S7.2 再加上音樂與音效開關。
 */
export function SettingsScreen() {
  const samples = tabSwitchSamples();
  const switchMedian = median(samples);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>設定</Text>
        <Pressable
          testID="close-settings"
          accessibilityRole="button"
          accessibilityLabel="關閉"
          hitSlop={8}
          onPress={() => router.back()}
          style={styles.close}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>
      <View style={styles.body}>
        {/* production 沒有長按行為；除錯工具開啟時長按 2 秒開啟除錯面板 */}
        <Pressable
          testID="app-version-press"
          disabled={!config.debugTools}
          delayLongPress={DEBUG_LONG_PRESS_MS}
          onLongPress={() => router.push('/debug')}
          style={styles.versionRow}>
          <Text testID="app-version" style={styles.version}>
            版本 {config.appVersion}
          </Text>
        </Pressable>
        {config.debugTools ? (
          <Text testID="tab-switch-timing" style={styles.debug}>
            分頁切換（{samples.length} 次）：中位數{' '}
            {switchMedian === null ? '—' : `${Math.round(switchMedian)} ms`}
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0A1E3D',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  title: {
    color: '#FFD966',
    fontSize: 22,
    fontWeight: '800',
  },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#FFFFFF',
    fontSize: 22,
  },
  body: {
    gap: 12,
    padding: 16,
  },
  versionRow: {
    minHeight: 44,
    justifyContent: 'center',
  },
  version: {
    color: '#C9D1E8',
    fontSize: 15,
  },
  debug: {
    color: '#9FB3D1',
    fontSize: 12,
  },
});
