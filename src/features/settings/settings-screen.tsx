import { router } from 'expo-router';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { median, tabSwitchSamples } from '@/features/tabs';
import { config } from '@/services/config';
import {
  setAnalyticsEnabled,
  setMusicEnabled,
  setSfxEnabled,
  useSettings,
} from '@/services/settings';

// 長按版本號這麼久才開啟除錯面板（架構〈Debug Tools〉）
const DEBUG_LONG_PRESS_MS = 2000;

/**
 * 設定畫面（modal），入口在夜市街左上角。
 * 音樂與音效開關（S7.2，存在 merge-night-market/settings，不寫進遊戲存檔）。
 * 分析資料開關（E7 retro）：關掉後不再送出匿名的遊玩數據。
 * 版本號在除錯工具開啟時可以長按 2 秒開啟除錯面板（S1.8）。
 */
export function SettingsScreen() {
  const music = useSettings((store) => store.music);
  const sfx = useSettings((store) => store.sfx);
  const analytics = useSettings((store) => store.analytics);
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
        <View style={styles.row}>
          <Text style={styles.rowLabel}>音樂</Text>
          <Switch
            testID="toggle-music"
            accessibilityLabel="音樂"
            value={music}
            onValueChange={setMusicEnabled}
            trackColor={{ true: '#FFD966', false: '#3A4466' }}
          />
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>音效</Text>
          <Switch
            testID="toggle-sfx"
            accessibilityLabel="音效"
            value={sfx}
            onValueChange={setSfxEnabled}
            trackColor={{ true: '#FFD966', false: '#3A4466' }}
          />
        </View>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>分析資料</Text>
            <Text style={styles.rowNote}>傳送匿名的遊玩數據，幫助改進遊戲</Text>
          </View>
          <Switch
            testID="toggle-analytics"
            accessibilityLabel="分析資料"
            value={analytics}
            onValueChange={setAnalyticsEnabled}
            trackColor={{ true: '#FFD966', false: '#3A4466' }}
          />
        </View>
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
          <>
            <Text testID="debug-entry-hint" style={styles.debug}>
              除錯：長按版本號 2 秒開啟除錯面板
            </Text>
            <Text testID="tab-switch-timing" style={styles.debug}>
              分頁切換（{samples.length} 次）：中位數{' '}
              {switchMedian === null ? '—' : `${Math.round(switchMedian)} ms`}
            </Text>
          </>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  rowText: {
    flex: 1,
    gap: 2,
    paddingRight: 12,
  },
  rowLabel: {
    color: '#F2F4FA',
    fontSize: 17,
    fontWeight: '700',
  },
  rowNote: {
    color: '#9FB3D1',
    fontSize: 13,
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
