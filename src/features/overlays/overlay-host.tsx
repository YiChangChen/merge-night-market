import { useEffect } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';

import { useOverlayStore } from './overlay-store';
import { SelloutShow } from './sellout-show';
import { StallPanel } from './stall-panel';

/**
 * Overlay Host：掛在根層，面板與演出都以元件顯示，不走路由（架構〈Navigation〉）。
 * 由下往上：攤位面板 → 完售演出（S2.4）。老闆發明、阿嬤提示等之後加在這裡。
 */
export function OverlayHost() {
  const stallPanel = useOverlayStore((store) => store.stallPanel);
  const closePanel = useOverlayStore((store) => store.closeStallPanel);
  const sellout = useOverlayStore((store) => store.sellout);
  const finishSellout = useOverlayStore((store) => store.finishSellout);
  const open = stallPanel !== null || sellout !== null;

  // Android 返回鍵：先關最上層（完售演出），再關面板；不要切換分頁或離開 App
  useEffect(() => {
    if (!open) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (useOverlayStore.getState().sellout) finishSellout();
      else closePanel();
      return true;
    });
    return () => subscription.remove();
  }, [closePanel, finishSellout, open]);

  if (!open) return null;
  return (
    <View style={styles.layer} pointerEvents="box-none">
      {stallPanel ? (
        <>
          <Pressable
            testID="overlay-backdrop"
            accessibilityLabel="關閉面板"
            onPress={closePanel}
            style={styles.backdrop}
          />
          <View style={styles.center} pointerEvents="box-none">
            <StallPanel chain={stallPanel} />
          </View>
        </>
      ) : null}
      {sellout ? (
        <SelloutShow key={sellout.token} wave={sellout.wave} onDone={finishSellout} />
      ) : null}
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
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
});
