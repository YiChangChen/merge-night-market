import { useEffect } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';

import { DishMadeToast } from './dish-made-toast';
import { InventionShow } from './invention-show';
import { useOverlayStore } from './overlay-store';
import { SelloutShow } from './sellout-show';
import { StallPanel } from './stall-panel';

/**
 * Overlay Host：掛在根層，面板與演出都以元件顯示，不走路由（架構〈Navigation〉）。
 * 由下往上：攤位面板 → 完售演出（S2.4）→ 首次發明演出（S3.4）→ 小提示。阿嬤提示等之後加在這裡。
 */
export function OverlayHost() {
  const stallPanel = useOverlayStore((store) => store.stallPanel);
  const closePanel = useOverlayStore((store) => store.closeStallPanel);
  const sellout = useOverlayStore((store) => store.sellout);
  const finishSellout = useOverlayStore((store) => store.finishSellout);
  const invention = useOverlayStore((store) => store.invention);
  const finishInvention = useOverlayStore((store) => store.finishInvention);
  const dishMade = useOverlayStore((store) => store.dishMade);
  const hideDishMade = useOverlayStore((store) => store.hideDishMade);
  // 會擋住操作、需要返回鍵關閉的層（小提示不擋操作，不算）
  const blocking = stallPanel !== null || sellout !== null || invention !== null;

  // Android 返回鍵：由上往下關閉最上層；不要切換分頁或離開 App
  useEffect(() => {
    if (!blocking) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      const overlays = useOverlayStore.getState();
      if (overlays.invention) finishInvention();
      else if (overlays.sellout) finishSellout();
      else closePanel();
      return true;
    });
    return () => subscription.remove();
  }, [blocking, closePanel, finishInvention, finishSellout]);

  if (!blocking && !dishMade) return null;
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
      {invention ? (
        <InventionShow key={invention.token} recipe={invention.recipe} onDone={finishInvention} />
      ) : null}
      {dishMade ? (
        <DishMadeToast key={dishMade.token} recipe={dishMade.recipe} onDone={hideDishMade} />
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
