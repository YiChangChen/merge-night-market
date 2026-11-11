import { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CARD_ASPECT, CardView } from '@/features/collection';
import { RECIPES_BY_ID, type RecipeId } from '@/game/content';
import type { InventionState } from '@/game/types';

/** 一般升星演出的長度；沒點跳過時自動結束 */
export const STAR_SHOW_MS = 2000;
/** 升到 ★5（換金框）的演出長度 */
export const GOLD_SHOW_MS = 2800;
/** 卡牌先顯示舊星等，這段時間後換成新星等 */
export const STAR_SWAP_MS = 450;

// 畫面頂端的橫向小橫幅：卡牌在左、文字在右，盡量少蓋到訂單卡與棋盤（E5 code review）
const CARD_WIDTH = 84;
const CARD_HEIGHT = CARD_WIDTH * CARD_ASPECT;
// 演出只顯示卡牌本身，不需要真正的製作次數（星等由 stars 指定）
const SHOWN: InventionState = { discovered: true, made: 0, failures: 0, clueSeen: false };

type StarShowProps = {
  recipe: RecipeId;
  stars: number;
  onDone: () => void;
};

/**
 * 卡牌升星演出（S5.3）：畫面頂端的小橫幅，卡牌先顯示舊星等，再彈一下換成新星等；★5 換金框並有光芒掃過。
 * 不擋操作：只有卡牌本身可以點（點了就跳過），橫幅的其他部分與畫面其他地方的觸控都穿透到底下。
 */
export function StarShow({ recipe, stars, onDone }: StarShowProps) {
  const insets = useSafeAreaInsets();
  const name = RECIPES_BY_ID[recipe].name;
  const gold = stars === 5;
  const label = `${name} 升到 ${stars} 星。點卡牌跳過`;
  const [shown, setShown] = useState(stars - 1);
  // ★5 換成金框之後，標題改成「★5 金框解鎖！」
  const swapped = gold && shown === 5;

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`${name} 升到 ${stars} 星`);
    // 只在演出開始時唸一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setTimeout(onDone, gold ? GOLD_SHOW_MS : STAR_SHOW_MS);
    return () => clearTimeout(timer);
  }, [gold, onDone]);

  // 卡牌彈出 → 換成新星等時再彈一下；★5 同時光芒掃過卡面
  const pop = useSharedValue(0);
  const shine = useSharedValue(0);
  useEffect(() => {
    pop.set(withSpring(1, { damping: 9 }));
    const timer = setTimeout(() => {
      setShown(stars);
      pop.set(withSequence(withTiming(1.14, { duration: 120 }), withSpring(1, { damping: 7 })));
      if (gold) {
        shine.set(withDelay(80, withTiming(1, { duration: 700, easing: Easing.out(Easing.quad) })));
      }
    }, STAR_SWAP_MS);
    return () => clearTimeout(timer);
  }, [gold, pop, shine, stars]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, pop.get()),
    transform: [{ scale: 0.6 + 0.4 * pop.get() }],
  }));
  const shineStyle = useAnimatedStyle(() => ({
    opacity: shine.get() > 0 && shine.get() < 1 ? 0.85 : 0,
    transform: [{ translateX: -CARD_WIDTH + shine.get() * CARD_WIDTH * 2.2 }, { rotate: '20deg' }],
  }));

  return (
    <View testID="star-show" pointerEvents="box-none" style={styles.layer}>
      <Animated.View
        testID="star-show-panel"
        pointerEvents="box-none"
        style={[styles.panel, { marginTop: insets.top + 4 }, cardStyle]}>
        <Pressable
          testID="star-show-card"
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={onDone}
          style={styles.card}>
          <CardView recipe={recipe} invention={SHOWN} width={CARD_WIDTH} stars={shown} />
          {gold ? <Animated.View pointerEvents="none" style={[styles.shine, shineStyle]} /> : null}
        </Pressable>
        <View pointerEvents="none" style={styles.text}>
          <Text style={[styles.title, swapped && styles.gold]}>
            {swapped ? '★5 金框解鎖！' : `★${stars} 升星！`}
          </Text>
          <Text numberOfLines={1} style={styles.name}>
            {name}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
  },
  panel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    maxWidth: '92%',
    paddingLeft: 8,
    paddingRight: 16,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: '#11173AE6',
    borderWidth: 1,
    borderColor: '#FFD966',
  },
  title: {
    color: '#FFD966',
    fontSize: 18,
    fontWeight: '900',
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    overflow: 'hidden',
  },
  text: {
    flexShrink: 1,
    gap: 4,
  },
  name: {
    color: '#F2F4FA',
    fontSize: 14,
    fontWeight: '700',
  },
  shine: {
    position: 'absolute',
    top: -CARD_HEIGHT * 0.25,
    width: 20,
    height: CARD_HEIGHT * 1.5,
    backgroundColor: '#FFF6D0',
  },
  gold: {
    color: '#FFD23F',
    textShadowColor: '#FF6B3D',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 0 },
  },
});
