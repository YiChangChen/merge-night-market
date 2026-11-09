import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type SaveErrorScreenProps = {
  reason: string;
  onRetry: () => void;
  /** 備份目前的存檔後開新局；存檔來自較新版本時不提供。 */
  onStartOver: () => void;
};

// 存檔讀取或遷移失敗時顯示。不會自動開新局：
// 「重試」重新讀一次；「備份後開新局」要再按一次確認，原檔會先完整備份。
export function SaveErrorScreen({ reason, onRetry, onStartOver }: SaveErrorScreenProps) {
  const [confirming, setConfirming] = useState(false);
  const needsUpdate = reason === 'newer-version';
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>存檔讀取失敗</Text>
      <Text style={styles.body}>
        {needsUpdate
          ? '這份存檔來自較新的版本，請先更新 App 再開啟。'
          : '你的進度還保存在手機裡，沒有被刪除或覆寫。請稍後再試，或更新到最新版本。'}
      </Text>
      <Pressable
        testID="save-error-retry"
        accessibilityRole="button"
        onPress={onRetry}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
        <Text style={styles.buttonText}>重試</Text>
      </Pressable>
      {needsUpdate ? null : confirming ? (
        <View style={styles.confirm}>
          <Text style={styles.body}>
            讀不出來的存檔會原封不動備份在手機裡，然後從頭開始一局新遊戲。確定嗎？
          </Text>
          <View style={styles.confirmRow}>
            <Pressable
              testID="save-error-start-over-cancel"
              accessibilityRole="button"
              onPress={() => setConfirming(false)}
              style={({ pressed }) => [styles.secondary, pressed && styles.buttonPressed]}>
              <Text style={styles.secondaryText}>取消</Text>
            </Pressable>
            <Pressable
              testID="save-error-start-over-confirm"
              accessibilityRole="button"
              onPress={onStartOver}
              style={({ pressed }) => [styles.danger, pressed && styles.buttonPressed]}>
              <Text style={styles.buttonText}>確定開新局</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          testID="save-error-start-over"
          accessibilityRole="button"
          onPress={() => setConfirming(true)}
          style={({ pressed }) => [styles.secondary, pressed && styles.buttonPressed]}>
          <Text style={styles.secondaryText}>備份後開新局</Text>
        </Pressable>
      )}
      {__DEV__ ? <Text style={styles.detail}>原因：{reason}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    backgroundColor: '#0A1E3D',
  },
  title: {
    color: '#FFD966',
    fontSize: 22,
    fontWeight: '700',
  },
  body: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  button: {
    minWidth: 160,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingHorizontal: 24,
    borderRadius: 24,
    backgroundColor: '#FF7A45',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  secondary: {
    minWidth: 160,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#9FB3D1',
  },
  secondaryText: {
    color: '#9FB3D1',
    fontSize: 16,
  },
  danger: {
    minWidth: 140,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: '#C0392B',
  },
  confirm: {
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  confirmRow: {
    flexDirection: 'row',
    gap: 12,
  },
  detail: {
    marginTop: 16,
    color: '#9FB3D1',
    fontSize: 12,
  },
});
