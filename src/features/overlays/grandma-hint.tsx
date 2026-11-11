import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, SlideInLeft } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type ChainId, CHAINS, GRANDMA_ART, RECIPES_BY_ID, type RecipeId } from '@/game/content';

/** 剛出現的這段時間不接受點擊：組錯後緊接著的點擊，不該直接關掉提示 */
export const HINT_TAP_GUARD_MS = 400;

const GRANDMA_HEIGHT = 260;
// 立繪寬高比（762 × 1024）
const GRANDMA_ASPECT = 762 / 1024;

/** 阿嬤的台詞：直接說出兩個材料的名稱（UX-DR7，口吻依 docs/content.md） */
export function hintLine(recipe: RecipeId): string {
  const { a, b } = RECIPES_BY_ID[recipe];
  const name = (chain: ChainId, level: number) => CHAINS[chain].items[level - 1].name;
  return `憨孫，${name(a.chain, a.level)}配${name(b.chain, b.level)}啦！`;
}

type GrandmaHintProps = {
  recipe: RecipeId;
  onDone: () => void;
};

/**
 * 阿嬤提示（S4.4、UX-DR7）：左下角探出半身，右上方的對話框直接說出兩個材料。
 * 不會自動消失（讓玩家看清楚），點任何地方關閉。只讀內容資料，不寫入遊戲狀態。
 */
export function GrandmaHint({ recipe, onDone }: GrandmaHintProps) {
  const insets = useSafeAreaInsets();
  const line = hintLine(recipe);

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`阿嬤說：${line}`);
    // 只在出現時唸一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 剛出現時忽略點擊：計時器過了才接受關閉
  const tappable = useRef(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      tappable.current = true;
    }, HINT_TAP_GUARD_MS);
    return () => clearTimeout(timer);
  }, []);
  const onPress = () => {
    if (tappable.current) onDone();
  };

  return (
    <Pressable
      testID="grandma-hint"
      accessibilityRole="button"
      // 台詞已經在出現時主動唸過，這裡只說明怎麼關閉，避免同一句唸兩次（E4 code review）
      accessibilityLabel="阿嬤的提示，點一下關閉"
      accessibilityViewIsModal
      onPress={onPress}
      style={styles.backdrop}>
      <Animated.View
        pointerEvents="none"
        entering={SlideInLeft.duration(320)}
        style={[styles.grandma, { bottom: insets.bottom }]}>
        <Image
          source={GRANDMA_ART}
          contentFit="contain"
          contentPosition="bottom"
          cachePolicy="memory-disk"
          style={{ width: GRANDMA_HEIGHT * GRANDMA_ASPECT, height: GRANDMA_HEIGHT }}
        />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        entering={FadeIn.delay(220).duration(240)}
        style={[styles.bubble, { bottom: insets.bottom + GRANDMA_HEIGHT * 0.62 }]}>
        <Text style={styles.speaker}>阿嬤</Text>
        <Text testID="grandma-line" style={styles.line}>
          {line}
        </Text>
        <Text style={styles.sub}>拖在一起試試看，就是「{RECIPES_BY_ID[recipe].name}」</Text>
        <View style={styles.tail} />
      </Animated.View>
      <Text style={[styles.hint, { bottom: insets.bottom + 12 }]}>點一下繼續</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0B163899',
  },
  grandma: {
    position: 'absolute',
    left: 0,
  },
  bubble: {
    position: 'absolute',
    left: GRANDMA_HEIGHT * GRANDMA_ASPECT * 0.55,
    right: 16,
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: '#FFFDF5',
    borderWidth: 2,
    borderColor: '#C98A1E',
  },
  // 對話框左下角指向阿嬤的小尾巴
  tail: {
    position: 'absolute',
    left: 18,
    bottom: -10,
    width: 18,
    height: 18,
    backgroundColor: '#FFFDF5',
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#C98A1E',
    transform: [{ rotate: '45deg' }],
  },
  speaker: {
    color: '#C98A1E',
    fontSize: 13,
    fontWeight: '800',
  },
  line: {
    color: '#3A2A1A',
    fontSize: 20,
    fontWeight: '800',
  },
  sub: {
    color: '#6A5A4A',
    fontSize: 13,
  },
  hint: {
    position: 'absolute',
    right: 20,
    color: '#C9D1E8',
    fontSize: 12,
  },
});
