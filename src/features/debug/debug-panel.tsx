import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/shallow';

import { CHAIN_IDS, type ChainId, STALLS } from '@/game/content';
import {
  debugAddCoins,
  debugAddEnergy,
  debugMinStallLevel,
  debugNewGame,
  debugQueueLastCustomer,
  debugSetPlayerLevel,
  debugSetStallLevel,
} from '@/game/debug';
import { useGameStore } from '@/game/store';
import type { StallLevel } from '@/game/types';
import { exportSaveToClipboard, importSaveFromClipboard } from '@/services/save-transfer';

const MINUTE = 60 * 1000;

const IMPORT_FAILURES: Record<string, string> = {
  'empty-clipboard': '剪貼簿是空的',
  'not-ready': '遊戲還在讀檔',
  'load-failed': '存檔讀取失敗時不能匯入，請先在棋盤畫面處理（重試或備份後開新局）',
  'corrupt-json': '不是合法的 JSON',
  'unknown-version': '缺少版本號',
  'newer-version': '存檔來自較新的版本',
  'migration-failed': '舊版存檔無法遷移',
  invalid: '存檔內容不合法',
  'storage-error': '無法讀取剪貼簿',
};

function formatOffset(ms: number): string {
  if (ms === 0) return '無';
  const minutes = Math.round(ms / MINUTE);
  return minutes >= 60 ? `+${Math.floor(minutes / 60)} 小時 ${minutes % 60} 分` : `+${minutes} 分`;
}

function DebugButton({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

function StallRow({ chain }: { chain: ChainId }) {
  const level = useGameStore((store) => store.state?.stalls[chain].level ?? 0);
  const apply = useGameStore((store) => store.apply);
  // 用 apply 傳入的最新 state 計算，快速連點時每一下都算數
  const step = (delta: 1 | -1) =>
    apply((state) => {
      const next = state.stalls[chain].level + delta;
      if (next < debugMinStallLevel(chain) || next > 3) return state;
      return debugSetStallLevel(state, chain, next as StallLevel);
    });
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{STALLS[chain].name}</Text>
      <DebugButton testID={`debug-stall-${chain}-down`} label="−" onPress={() => step(-1)} />
      <Text testID={`debug-stall-${chain}-level`} style={styles.value}>
        Lv{level}
      </Text>
      <DebugButton testID={`debug-stall-${chain}-up`} label="＋" onPress={() => step(1)} />
    </View>
  );
}

/**
 * 除錯面板（S1.8）：只在 development／preview 出現（入口：設定畫面長按版本號 2 秒）。
 * 所有操作都透過 apply 呼叫規則層的 debug 函式，不直接修改 state。
 */
export function DebugPanel() {
  const apply = useGameStore((store) => store.apply);
  const advanceTime = useGameStore((store) => store.advanceTime);
  const resetTime = useGameStore((store) => store.resetTime);
  const summary = useGameStore(
    useShallow((store) => ({
      coins: store.state?.coins ?? 0,
      energy: store.state?.energy ?? 0,
      level: store.state?.level ?? 1,
      offset: store.timeOffsetMs,
      wave: store.state?.queue.wave ?? 1,
      queueLength: store.state?.queue.length ?? 0,
      queueRemaining: store.state?.queue.remaining ?? 0,
      cooling: store.state?.queue.cooldownEndsAt != null,
    }))
  );
  const [message, setMessage] = useState<string | null>(null);

  const onExport = async () => {
    const result = await exportSaveToClipboard();
    setMessage(result.ok ? `已複製存檔到剪貼簿（${result.length} 字）` : '匯出失敗');
  };

  // 開新局：先把目前的存檔複製到剪貼簿當備份，確認後才換成新的一局（之後可以用「從剪貼簿匯入」還原）
  const onNewGame = () => {
    Alert.alert('開新局？', '目前的進度會先複製到剪貼簿當備份，之後可以用「從剪貼簿匯入」還原。', [
      { text: '取消', style: 'cancel' },
      {
        text: '開新局',
        style: 'destructive',
        onPress: async () => {
          const backup = await exportSaveToClipboard();
          if (!backup.ok) {
            setMessage('備份失敗，沒有開新局');
            return;
          }
          resetTime();
          apply((state, now) => debugNewGame(state, now));
          setMessage(`已開新局（舊進度已複製到剪貼簿，${backup.length} 字）`);
        },
      },
    ]);
  };

  const onImport = async () => {
    const result = await importSaveFromClipboard();
    setMessage(
      result.ok
        ? `已匯入：Lv${result.level}、金幣 ${result.coins}${result.migratedFrom ? `（由 v${result.migratedFrom} 遷移）` : ''}`
        : `拒絕匯入：${IMPORT_FAILURES[result.reason] ?? result.reason}`
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>除錯面板</Text>
        <Pressable
          testID="close-debug"
          accessibilityRole="button"
          accessibilityLabel="關閉"
          hitSlop={8}
          onPress={() => router.back()}
          style={styles.close}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {message ? (
          <Text testID="debug-message" style={styles.message}>
            {message}
          </Text>
        ) : null}

        <Text style={styles.section}>資源</Text>
        <View style={styles.row}>
          <Text style={styles.label}>金幣 {summary.coins}</Text>
          <DebugButton
            testID="debug-coins-100"
            label="+100"
            onPress={() => apply((s) => debugAddCoins(s, 100))}
          />
          <DebugButton
            testID="debug-coins-1000"
            label="+1000"
            onPress={() => apply((s) => debugAddCoins(s, 1000))}
          />
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>體力 {summary.energy}</Text>
          <DebugButton
            testID="debug-energy-20"
            label="+20"
            onPress={() => apply((s) => debugAddEnergy(s, 20))}
          />
          <DebugButton
            testID="debug-energy-100"
            label="+100"
            onPress={() => apply((s) => debugAddEnergy(s, 100))}
          />
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>玩家等級</Text>
          <DebugButton
            testID="debug-level-down"
            label="−"
            onPress={() => apply((s) => debugSetPlayerLevel(s, s.level - 1))}
          />
          <Text testID="debug-level" style={styles.value}>
            Lv{summary.level}
          </Text>
          <DebugButton
            testID="debug-level-up"
            label="＋"
            onPress={() => apply((s) => debugSetPlayerLevel(s, s.level + 1))}
          />
        </View>

        <Text style={styles.section}>人龍（調整攤位等級時，進行中的這一波會跟著加長）</Text>
        <View style={styles.row}>
          <Text testID="debug-queue" style={styles.label}>
            第 {summary.wave} 波{' '}
            {summary.cooling
              ? '已完售，冷卻中'
              : `已出單 ${summary.queueLength - summary.queueRemaining}/${summary.queueLength}`}
          </Text>
          <DebugButton
            testID="debug-queue-last"
            label="剩最後 1 位"
            onPress={() => apply(debugQueueLastCustomer)}
          />
        </View>

        <Text style={styles.section}>攤位等級（0 = 鐵捲門）</Text>
        {CHAIN_IDS.map((chain) => (
          <StallRow key={chain} chain={chain} />
        ))}

        <Text style={styles.section}>時間快轉（目前：{formatOffset(summary.offset)}）</Text>
        <View style={styles.row}>
          <DebugButton
            testID="debug-time-2m"
            label="+2 分"
            onPress={() => advanceTime(2 * MINUTE)}
          />
          <DebugButton
            testID="debug-time-10m"
            label="+10 分"
            onPress={() => advanceTime(10 * MINUTE)}
          />
          <DebugButton
            testID="debug-time-1h"
            label="+1 小時"
            onPress={() => advanceTime(60 * MINUTE)}
          />
          <DebugButton testID="debug-time-reset" label="歸零" onPress={resetTime} />
        </View>

        <Text style={styles.section}>存檔</Text>
        <View style={styles.row}>
          <DebugButton testID="debug-export" label="匯出到剪貼簿" onPress={onExport} />
          <DebugButton testID="debug-import" label="從剪貼簿匯入" onPress={onImport} />
          <DebugButton testID="debug-new-game" label="開新局" onPress={onNewGame} />
        </View>
        <Text style={styles.note}>
          匯入會先執行遷移與驗證，不合法的存檔一律拒絕，匯入時也會取消時間快轉。快轉量本身不存檔，但快轉期間結算出的時間會被存起來；App
          重開或按「歸零」後，計時改回真實時間，可能少掉不到 2 分鐘的體力回復。
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#101418',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  title: {
    color: '#7CFC00',
    fontSize: 20,
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
    gap: 8,
    padding: 16,
  },
  message: {
    padding: 10,
    borderRadius: 8,
    color: '#FFFFFF',
    backgroundColor: '#2B3A4A',
  },
  section: {
    marginTop: 12,
    color: '#9FB3D1',
    fontSize: 13,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    minWidth: 110,
    color: '#FFFFFF',
    fontSize: 14,
  },
  value: {
    minWidth: 40,
    color: '#FFD966',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  button: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#2E4057',
  },
  pressed: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  note: {
    marginTop: 12,
    color: '#7D8597',
    fontSize: 12,
    lineHeight: 18,
  },
});
