import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RECIPE_IDS, type RecipeId } from '@/game/content';
import { useGameStore } from '@/game/store';
import type { GameState } from '@/game/types';

import { CardDetail } from './card-detail';
import { cardLabel, CardView } from './card-view';

const PADDING = 16;
const GAP = 12;
const MAX_CARD_WIDTH = 180;
const COLUMNS = 2;
// 讀檔前（state 為 null）用的固定空物件，避免 selector 每次回傳新物件造成重繪
const NO_INVENTIONS: GameState['inventions'] = {};

/**
 * 收藏冊（modal，入口在夜市街右上角；FR35、UX-DR8）：2 欄網格的 10 張卡牌，最上方是收集進度。
 * 只訂閱 inventions 切片；點已發現的卡開詳情。
 */
export function CollectionScreen() {
  const inventions = useGameStore((store) => store.state?.inventions ?? NO_INVENTIONS);
  const { width } = useWindowDimensions();
  const cardWidth = Math.min((width - PADDING * 2 - GAP) / COLUMNS, MAX_CARD_WIDTH);
  // 寬螢幕上卡寬到上限後，一排仍然只放 2 張（E5 code review）
  const gridWidth = cardWidth * COLUMNS + GAP;
  // 用配方記住選取（E3 retro A5）；該卡變成未發現時（例如除錯開新局）就不顯示詳情
  const [selected, setSelected] = useState<RecipeId | null>(null);
  const closeDetail = useCallback(() => setSelected(null), []);

  const found = RECIPE_IDS.filter((recipe) => inventions[recipe]?.discovered).length;
  const selectedInvention = selected ? inventions[selected] : undefined;
  // 詳情開著時，底下的標題列與網格對讀螢幕軟體隱藏（Android 沒有 accessibilityViewIsModal）
  const hidden = selected !== null && selectedInvention?.discovered === true;
  const hideProps = hidden
    ? ({
        importantForAccessibility: 'no-hide-descendants',
        accessibilityElementsHidden: true,
      } as const)
    : {};

  const close = () => {
    // 從深連結直接開啟時沒有上一頁，改回夜市街（E5 code review）
    if (router.canGoBack()) router.back();
    else router.replace('/street');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View testID="collection-header" style={styles.header} {...hideProps}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>收藏冊</Text>
          <Text
            testID="collection-progress"
            accessibilityLabel={`已收集 ${found} 張，共 ${RECIPE_IDS.length} 張`}
            style={styles.progress}>
            {found}/{RECIPE_IDS.length}
          </Text>
        </View>
        <Pressable
          testID="close-collection"
          accessibilityRole="button"
          accessibilityLabel="關閉"
          hitSlop={8}
          onPress={close}
          style={styles.close}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>
      <ScrollView
        testID="collection-grid"
        contentContainerStyle={[styles.grid, { width: gridWidth + PADDING * 2 }]}
        {...hideProps}>
        {RECIPE_IDS.map((recipe) => {
          const invention = inventions[recipe];
          return (
            <Pressable
              key={recipe}
              testID={`open-card-${recipe}`}
              // 標籤放在按鈕上：iOS 的可點元素會蓋掉裡面卡牌自己的標籤（E5 code review）
              accessibilityRole="button"
              accessibilityLabel={cardLabel(recipe, invention)}
              accessibilityState={{ disabled: !invention?.discovered }}
              disabled={!invention?.discovered}
              onPress={() => setSelected(recipe)}
              style={({ pressed }) => pressed && styles.pressed}>
              <CardView recipe={recipe} invention={invention} width={cardWidth} />
            </Pressable>
          );
        })}
      </ScrollView>
      {selected && selectedInvention?.discovered ? (
        <CardDetail
          recipe={selected}
          invention={selectedInvention}
          cardWidth={Math.min(width - 96, 260)}
          onClose={closeDetail}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0A1E3D',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PADDING,
    paddingVertical: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  title: {
    color: '#FFD966',
    fontSize: 22,
    fontWeight: '800',
  },
  progress: {
    color: '#F2F4FA',
    fontSize: 18,
    fontWeight: '700',
  },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#F2F4FA',
    fontSize: 22,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: GAP,
    paddingHorizontal: PADDING,
    paddingBottom: 24,
  },
  pressed: {
    opacity: 0.7,
  },
});
