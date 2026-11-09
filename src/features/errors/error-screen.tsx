import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { log } from '@/services/log';

type ErrorScreenProps = {
  error: Error;
  onRetry: () => void;
};

// render 發生錯誤時取代整個畫面，避免白屏。遊戲進度在 store 與存檔裡，重新載入不會遺失。
export function ErrorScreen({ error, onRetry }: ErrorScreenProps) {
  useEffect(() => {
    // TODO(S7.4): Sentry 接上後，log.error 會一併送出 event
    log.error('render', '畫面渲染失敗', error);
  }, [error]);

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>夜市暫時停電了</Text>
      <Text style={styles.body}>畫面出了點問題，你的進度都還在。</Text>
      <Pressable
        testID="error-retry"
        accessibilityRole="button"
        onPress={onRetry}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
        <Text style={styles.buttonText}>重新載入</Text>
      </Pressable>
      {__DEV__ ? (
        <Text style={styles.detail} numberOfLines={6}>
          {error.message}
        </Text>
      ) : null}
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
    textAlign: 'center',
  },
});
