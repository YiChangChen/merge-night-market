import { Image } from 'expo-image';
import { memo, useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useOverlayStore } from '@/features/overlays';
import { type ChainId, STALLS } from '@/game/content';
import { useGameStore } from '@/game/store';

import { NeonSign } from './neon-sign';
import { RollingShutter } from './rolling-shutter';

export const STALL_WIDTH = 220;

// 外觀依等級變大（FR14）：鐵捲門與小攤較矮，大店撐滿整個高度
const APPEARANCE = [
  { label: '鐵捲門', scale: 0.66 },
  { label: 'Lv1 小攤', scale: 0.76 },
  { label: 'Lv2 店面', scale: 0.86 },
  { label: 'Lv3 大店', scale: 1 },
] as const;

const FACADE_HEIGHT = 250;

// 換外觀時新舊兩張圖交叉淡入，尺寸同時平滑長大，不會突然跳一下
const FACADE_FADE_MS = 280;
const FACADE_GROW_MS = 320;
const FACADE_TRANSITION = { duration: FACADE_FADE_MS, effect: 'cross-dissolve' } as const;

type StallViewProps = {
  chain: ChainId;
  /** 夜市街在前景時才播放循環動畫 */
  animate: boolean;
};

/**
 * 夜市街上的一個攤位，點一下開啟攤位面板（UX-DR3）。只訂閱自己的攤位等級：拖曳棋子、出單都不會讓它重繪。
 * 圖層由下往上：外觀 → 霓虹 → 重開演出 → 老闆。招牌菜（E3）與人龍頭像（S2.3）之後加入。
 */
export const StallView = memo(function StallView({ chain, animate }: StallViewProps) {
  const level = useGameStore((store) => store.state?.stalls[chain].level ?? 0);
  const stall = STALLS[chain];
  const appearance = APPEARANCE[level];
  const closed = level === 0;
  // 外觀用 scale 縮放（以底部為基準），不改版面尺寸，動畫只在 UI 執行緒跑
  const scale = useSharedValue<number>(appearance.scale);
  useEffect(() => {
    scale.set(
      withTiming(appearance.scale, { duration: FACADE_GROW_MS, easing: Easing.out(Easing.cubic) })
    );
  }, [appearance.scale, scale]);
  const facadeStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  // 先在背後載好下一級的外觀，重開或升級時不必等圖片載入（Expo Go 經 tunnel 載圖特別慢）
  const nextFacade = level < 3 ? stall.art.facade[level + 1] : null;
  // 重開演出（FxController 收到 stall_reopened 後觸發）
  const opening = useOverlayStore((store) => store.shutterOpening[chain]);
  const openPanel = useOverlayStore((store) => store.openStallPanel);
  const finishShutter = useOverlayStore((store) => store.finishShutter);
  const onShutterDone = useCallback(() => finishShutter(chain), [chain, finishShutter]);
  // 升級演出（FxController 收到 stall_upgraded 後觸發）
  const powerOn = useOverlayStore((store) => store.neonPowerOn[chain]);
  const finishNeonPowerOn = useOverlayStore((store) => store.finishNeonPowerOn);
  const onPowerOnDone = useCallback(() => finishNeonPowerOn(chain), [chain, finishNeonPowerOn]);
  // 演出途中攤位被關閉（除錯或匯入）時，演出元件會卸載、收不了尾；在這裡清掉，之後才不會莫名重播
  useEffect(() => {
    if (!closed) return;
    if (opening !== undefined) finishShutter(chain);
    if (powerOn !== undefined) finishNeonPowerOn(chain);
  }, [chain, closed, finishNeonPowerOn, finishShutter, opening, powerOn]);

  return (
    <Pressable
      testID={`stall-${chain}`}
      accessibilityRole="button"
      accessibilityLabel={`${stall.name}，${appearance.label}`}
      onPress={() => openPanel(chain)}
      style={styles.stall}>
      <NeonSign
        name={stall.name}
        color={stall.neon}
        layers={stall.art.neon}
        level={level}
        animate={animate}
        powerOn={powerOn}
        onPowerOnDone={onPowerOnDone}
      />
      <View style={styles.facade}>
        {nextFacade !== null ? (
          <Image
            testID={`stall-${chain}-preload`}
            source={nextFacade}
            contentFit="contain"
            contentPosition="bottom"
            cachePolicy="memory-disk"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
            style={[styles.facadeImage, styles.preload]}
          />
        ) : null}
        <Animated.View style={[styles.facadeFrame, facadeStyle]}>
          <Image
            testID={closed ? `stall-${chain}-shutter` : `stall-${chain}-facade`}
            source={stall.art.facade[level]}
            contentFit="contain"
            contentPosition="bottom"
            cachePolicy="memory-disk"
            transition={FACADE_TRANSITION}
            style={styles.facadeImage}
          />
        </Animated.View>
        {opening !== undefined && !closed ? (
          <RollingShutter
            key={opening}
            source={stall.art.facade[0]}
            height={FACADE_HEIGHT * APPEARANCE[0].scale}
            onDone={onShutterDone}
          />
        ) : null}
        <Text style={styles.levelLabel}>{appearance.label}</Text>
      </View>
      <View style={styles.owner}>
        <Image
          source={stall.art.owner}
          contentFit="cover"
          contentPosition="top"
          cachePolicy="memory-disk"
          style={[styles.avatar, { borderColor: stall.color }, closed && styles.avatarClosed]}
        />
        <View style={styles.ownerText}>
          <Text style={styles.ownerName}>{stall.owner.name}</Text>
          <Text style={styles.persona} numberOfLines={2}>
            {stall.owner.persona}
          </Text>
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  stall: {
    width: STALL_WIDTH,
    justifyContent: 'flex-end',
    gap: 6,
  },
  facade: {
    height: FACADE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  facadeFrame: {
    ...StyleSheet.absoluteFill,
    transformOrigin: 'bottom',
  },
  facadeImage: {
    width: STALL_WIDTH,
    height: FACADE_HEIGHT,
  },
  preload: {
    position: 'absolute',
    bottom: 0,
    opacity: 0,
  },
  levelLabel: {
    position: 'absolute',
    bottom: 4,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: '#000000AA',
  },
  owner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#11173AE6',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    backgroundColor: '#1E2550',
  },
  avatarClosed: {
    opacity: 0.4,
  },
  ownerText: {
    flex: 1,
  },
  ownerName: {
    color: '#FFD966',
    fontSize: 14,
    fontWeight: '700',
  },
  persona: {
    color: '#C9D1E8',
    fontSize: 11,
    lineHeight: 15,
  },
});
