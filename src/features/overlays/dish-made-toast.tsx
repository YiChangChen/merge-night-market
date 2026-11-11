import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RECIPES_BY_ID, type RecipeId } from '@/game/content';

/** 小提示停留的時間 */
export const DISH_MADE_TOAST_MS = 1600;

type DishMadeToastProps = {
  recipe: RecipeId;
  onDone: () => void;
};

/**
 * 已發現的配方又做出一份時的小提示（S3.4）。不擋操作（pointerEvents none），自動消失。
 * 發明只會發生在棋盤上，所以放在畫面上方，不會蓋住棋盤。
 */
export function DishMadeToast({ recipe, onDone }: DishMadeToastProps) {
  const insets = useSafeAreaInsets();
  const dish = RECIPES_BY_ID[recipe];

  useEffect(() => {
    const timer = setTimeout(onDone, DISH_MADE_TOAST_MS);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <Animated.View
      testID="dish-made-toast"
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      entering={FadeInUp.duration(200)}
      exiting={FadeOutUp.duration(200)}
      style={[styles.toast, { top: insets.top + 8 }]}>
      <Image source={dish.art} contentFit="contain" cachePolicy="memory-disk" style={styles.icon} />
      <Text style={styles.text}>又做出一份 {dish.name}！</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: '#000000CC',
  },
  icon: {
    width: 28,
    height: 28,
  },
  text: {
    color: '#FFF3D6',
    fontSize: 14,
    fontWeight: '700',
  },
});
