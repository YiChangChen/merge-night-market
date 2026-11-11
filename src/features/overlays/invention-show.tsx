import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { RECIPES_BY_ID, type RecipeId, STALLS } from '@/game/content';

/** 首次發明演出的長度；沒點跳過時自動結束 */
export const INVENTION_SHOW_MS = 3200;
/** 演出剛出現的這段時間不接受點擊：發明後緊接著的那一下點擊，不該直接關掉慶祝 */
export const SHOW_TAP_GUARD_MS = 400;

const RAY_COUNT = 12;
const DISH_SIZE = 168;
const AVATAR_SIZE = 56;

/** 發明菜背後慢慢轉動的光芒 */
function Rays({ color }: { color: string }) {
  const spin = useSharedValue(0);
  useEffect(() => {
    spin.set(withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1));
    return () => cancelAnimation(spin);
  }, [spin]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.get() * 360}deg` }] }));
  return (
    <Animated.View pointerEvents="none" style={[styles.rays, style]}>
      {Array.from({ length: RAY_COUNT }, (_, index) => (
        <View
          key={index}
          style={[
            styles.ray,
            { backgroundColor: color, transform: [{ rotate: `${(index * 360) / RAY_COUNT}deg` }] },
          ]}
        />
      ))}
    </Animated.View>
  );
}

type InventionShowProps = {
  recipe: RecipeId;
  onDone: () => void;
};

/**
 * 「老闆發明！」全螢幕演出（S3.4、FR25、UX-DR5）：光芒、發明菜大圖、菜名、發明的老闆。
 * 點任何地方跳過，時間到自動結束。只讀內容資料，不寫入遊戲狀態。★1 卡牌在 E5 接上。
 */
export function InventionShow({ recipe, onDone }: InventionShowProps) {
  const dish = RECIPES_BY_ID[recipe];
  const stall = STALLS[dish.owner];
  const label = `老闆發明！${stall.owner.name}做出了${dish.name}。點一下繼續`;

  useEffect(() => {
    // 演出會自動結束，讀螢幕軟體使用者要主動聽到菜名
    AccessibilityInfo.announceForAccessibility(label);
    // 只在演出開始時唸一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // 用 JS 計時收尾，不必從 worklet 回呼（演出本身在 UI 執行緒播放）
    const timer = setTimeout(onDone, INVENTION_SHOW_MS);
    return () => clearTimeout(timer);
  }, [onDone]);

  // 剛出現時忽略點擊（code review 2026-11-11）：計時器過了才接受跳過
  const tappable = useRef(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      tappable.current = true;
    }, SHOW_TAP_GUARD_MS);
    return () => clearTimeout(timer);
  }, []);
  const onPress = () => {
    if (tappable.current) onDone();
  };

  // 發明菜彈出、標題稍後落下、老闆最後登場
  const pop = useSharedValue(0);
  const title = useSharedValue(0);
  const owner = useSharedValue(0);
  useEffect(() => {
    pop.set(withSequence(withSpring(1.12, { damping: 7 }), withTiming(1, { duration: 160 })));
    title.set(withDelay(200, withSpring(1, { damping: 10 })));
    owner.set(withDelay(500, withTiming(1, { duration: 300 })));
  }, [owner, pop, title]);
  const dishStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, pop.get()),
    transform: [{ scale: pop.get() }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, title.get()),
    transform: [{ translateY: (1 - title.get()) * -24 }],
  }));
  const ownerStyle = useAnimatedStyle(() => ({
    opacity: owner.get(),
    transform: [{ translateY: (1 - owner.get()) * 16 }],
  }));

  return (
    <Pressable
      testID="invention-show"
      accessibilityRole="button"
      accessibilityLabel={label}
      // 焦點不要跑到底下的棋盤（iOS）
      accessibilityViewIsModal
      onPress={onPress}
      style={styles.backdrop}>
      <View pointerEvents="none" style={styles.content}>
        <Animated.Text style={[styles.title, titleStyle]}>老闆發明！</Animated.Text>
        <View style={styles.stage}>
          <Rays color={stall.neon} />
          <Animated.View style={dishStyle}>
            <Image
              source={dish.art}
              contentFit="contain"
              cachePolicy="memory-disk"
              style={styles.dish}
            />
          </Animated.View>
        </View>
        <Text style={styles.dishName}>{dish.name}</Text>
        <Animated.View style={[styles.owner, ownerStyle]}>
          <Image
            source={stall.art.owner}
            contentFit="cover"
            contentPosition="top"
            cachePolicy="memory-disk"
            style={[styles.avatar, { borderColor: stall.color }]}
          />
          <Text style={styles.ownerText}>{stall.owner.name}的新菜色</Text>
        </Animated.View>
        {/* ★1 卡牌（收藏冊）在 E5 接上，先保留位置 */}
        <View testID="invention-card-slot" style={styles.cardSlot} />
        <Text style={styles.hint}>點一下繼續</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0B1638E6',
  },
  content: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 24,
  },
  title: {
    color: '#FFD966',
    fontSize: 40,
    fontWeight: '900',
    textShadowColor: '#FF6B3D',
    textShadowRadius: 12,
    textShadowOffset: { width: 0, height: 0 },
  },
  stage: {
    width: DISH_SIZE * 1.6,
    height: DISH_SIZE * 1.6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rays: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ray: {
    position: 'absolute',
    width: 14,
    height: DISH_SIZE * 1.6,
    borderRadius: 7,
    opacity: 0.22,
  },
  dish: {
    width: DISH_SIZE,
    height: DISH_SIZE,
  },
  dishName: {
    color: '#FFF3D6',
    fontSize: 24,
    fontWeight: '800',
  },
  owner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#11173AF2',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2,
    backgroundColor: '#1E2550',
  },
  ownerText: {
    color: '#FFD966',
    fontSize: 16,
    fontWeight: '700',
  },
  cardSlot: {
    height: 8,
  },
  hint: {
    color: '#9FB3D1',
    fontSize: 12,
  },
});
