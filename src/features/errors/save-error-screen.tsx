import { Pressable, StyleSheet, Text, View } from 'react-native';

type SaveErrorScreenProps = {
  reason: string;
  onRetry: () => void;
};

// 存檔讀取或遷移失敗時顯示。刻意不提供「開新局」：原檔與備份都保留，等更新版本或手動處理。
export function SaveErrorScreen({ reason, onRetry }: SaveErrorScreenProps) {
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
  detail: {
    marginTop: 16,
    color: '#9FB3D1',
    fontSize: 12,
  },
});
