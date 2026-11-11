import { Image } from 'expo-image';
import { memo, useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useOverlayStore } from '@/features/overlays';
import { useTutorialTarget } from '@/features/tutorial/tutorial-targets';
import { cardStars } from '@/game/cards';
import { type ChainId, RECIPES_BY_ID, STALLS } from '@/game/content';
import { useGameStore } from '@/game/store';

import { NeonSign } from './neon-sign';
import { RollingShutter } from './rolling-shutter';
import { StallQueue } from './stall-queue';
import { UpgradeBurst } from './upgrade-burst';

export const STALL_WIDTH = 220;

// 外觀依等級變大（FR14）：鐵捲門與小攤較矮，大店撐滿整個高度
const APPEARANCE = [
  { label: '鐵捲門', scale: 0.66 },
  { label: 'Lv1 小攤', scale: 0.76 },
  { label: 'Lv2 店面', scale: 0.86 },
  { label: 'Lv3 大店', scale: 1 },
] as const;

const FACADE_HEIGHT = 250;

// 換外觀時新舊兩張圖交叉淡入，尺寸同時平滑長大，不會突然跳一下。
// 升級時放慢並彈一下（實機回饋：原本 0.3 秒太快，感受不到升級）
const FACADE_FADE_MS = 600;
const FACADE_GROW_MS = 320;
const FACADE_UPGRADE_GROW_MS = 520;
const FACADE_OVERSHOOT = 1.12;
const FACADE_TRANSITION = { duration: FACADE_FADE_MS, effect: 'cross-dissolve' } as const;

type StallViewProps = {
  chain: ChainId;
  /** 夜市街在前景時才播放循環動畫 */
  animate: boolean;
};

/**
 * 夜市街上的一個攤位，點一下開啟攤位面板（UX-DR3）。只訂閱自己的攤位等級：拖曳棋子、出單都不會讓它重繪。
 * 由上往下：霓虹 → 外觀（重開演出疊在上面，Lv3 的招牌菜掛在頂端）→ 排隊頭像（S2.3）→ 老闆。
 */
export const StallView = memo(function StallView({ chain, animate }: StallViewProps) {
  const level = useGameStore((store) => store.state?.stalls[chain].level ?? 0);
  // 招牌菜（S3.5、FR13）：字串或 null，只有這一攤升 Lv3 時才會改變
  const signatureDish = useGameStore((store) => store.state?.stalls[chain].signatureDish ?? null);
  // 招牌菜的星等徽章（S5.3）：selector 回傳星等數字，多做幾份但沒升星時不重繪
  const signatureStars = useGameStore((store) => {
    const dish = store.state?.stalls[chain].signatureDish;
    return dish ? cardStars(store.state?.inventions[dish]?.made ?? 0) : 0;
  });
  const stall = STALLS[chain];
  const appearance = APPEARANCE[level];
  const closed = level === 0;
  // 外觀用 scale 縮放（以底部為基準），不改版面尺寸，動畫只在 UI 執行緒跑
  const scale = useSharedValue<number>(appearance.scale);
  useEffect(() => {
    // 變大（重開、升級）時先長過頭再彈回；變小（除錯調低等級）時直接縮
    scale.set(
      appearance.scale > scale.get()
        ? withSequence(
            withTiming(appearance.scale * FACADE_OVERSHOOT, {
              duration: FACADE_UPGRADE_GROW_MS,
              easing: Easing.out(Easing.cubic),
            }),
            withSpring(appearance.scale, { damping: 6, stiffness: 140 })
          )
        : withTiming(appearance.scale, {
            duration: FACADE_GROW_MS,
            easing: Easing.out(Easing.cubic),
          })
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
  // 完售演出（S2.4）：全街已開攤位的招牌一起閃
  const selloutToken = useOverlayStore((store) => store.sellout?.token);
  // 演出途中攤位被關閉（除錯或匯入）時，演出元件會卸載、收不了尾；在這裡清掉，之後才不會莫名重播
  useEffect(() => {
    if (!closed) return;
    if (opening !== undefined) finishShutter(chain);
    if (powerOn !== undefined) finishNeonPowerOn(chain);
  }, [chain, closed, finishNeonPowerOn, finishShutter, opening, powerOn]);

  // 新手引導第 3 步指向開局的兩攤（S6.4）；只在夜市街在前景時量測
  const tutorialTarget = useTutorialTarget(
    chain === 'fried' ? 'stall-fried' : 'stall-tea',
    animate && (chain === 'tea' || chain === 'fried')
  );

  return (
    <Pressable
      ref={tutorialTarget.ref}
      onLayout={tutorialTarget.onLayout}
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
        flash={selloutToken}
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
        {/* 升級慶祝：招牌通電期間播放；重開（Lv1）由鐵捲門演出負責 */}
        {powerOn !== undefined && opening === undefined && level >= 2 ? (
          <UpgradeBurst key={powerOn} label={appearance.label} color={stall.neon} />
        ) : null}
        <Text style={styles.levelLabel}>{appearance.label}</Text>
        {/* 招牌菜只屬於 Lv3（FR13）；存檔驗證與除錯面板也會維持這一點 */}
        {level === 3 && signatureDish ? (
          // 招牌菜掛在霓虹招牌正下方，附星等徽章；絕對定位，不改變攤位高度
          <View
            testID={`stall-${chain}-signature`}
            accessible
            accessibilityLabel={
              signatureStars > 0
                ? `招牌菜 ${RECIPES_BY_ID[signatureDish].name}，${signatureStars} 星`
                : `招牌菜 ${RECIPES_BY_ID[signatureDish].name}`
            }
            style={styles.signature}>
            <Image
              source={RECIPES_BY_ID[signatureDish].art}
              contentFit="contain"
              cachePolicy="memory-disk"
              style={styles.signatureIcon}
            />
            <Text style={styles.signatureText} numberOfLines={1}>
              招牌：{RECIPES_BY_ID[signatureDish].name}
            </Text>
            {/* 存檔不一致（招牌菜還沒有製作紀錄）時不顯示「★0」（E5 code review） */}
            {signatureStars > 0 ? (
              <Text
                testID={`stall-${chain}-signature-stars`}
                style={[styles.signatureStars, signatureStars === 5 && styles.signatureStarsGold]}>
                ★{signatureStars}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
      <StallQueue chain={chain} animate={animate} />
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
  signature: {
    position: 'absolute',
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: STALL_WIDTH - 16,
    paddingLeft: 2,
    paddingRight: 10,
    paddingVertical: 2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FFD966',
    backgroundColor: '#11173AE6',
  },
  signatureIcon: {
    width: 32,
    height: 32,
  },
  signatureText: {
    flexShrink: 1,
    color: '#FFD966',
    fontSize: 12,
    fontWeight: '700',
  },
  signatureStars: {
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    color: '#11173A',
    backgroundColor: '#FFD966',
    fontSize: 11,
    fontWeight: '900',
  },
  // ★5 和收藏冊的金框呼應
  signatureStarsGold: {
    backgroundColor: '#FFB800',
    color: '#5A3200',
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
