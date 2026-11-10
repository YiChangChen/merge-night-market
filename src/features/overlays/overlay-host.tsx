import { useEffect } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';

import { useOverlayStore } from './overlay-store';
import { StallPanel } from './stall-panel';

/**
 * Overlay Host：掛在根層，面板與演出都以元件顯示，不走路由（架構〈Navigation〉）。
 * 目前有攤位面板；完售煙火、老闆發明、阿嬤提示等之後加在這裡。
 */
export function OverlayHost() {
  const stallPanel = useOverlayStore((store) => store.stallPanel);
  const close = useOverlayStore((store) => store.closeStallPanel);

  // Android 返回鍵：面板開著時先關面板，不要切換分頁或離開 App
  useEffect(() => {
    if (!stallPanel) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => subscription.remove();
  }, [close, stallPanel]);

  if (!stallPanel) return null;
  return (
    <View style={styles.layer} pointerEvents="box-none">
      <Pressable
        testID="overlay-backdrop"
        accessibilityLabel="關閉面板"
        onPress={close}
        style={styles.backdrop}
      />
      <View style={styles.center} pointerEvents="box-none">
        <StallPanel chain={stallPanel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000AA',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
});
