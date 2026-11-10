import { Image } from 'expo-image';
import { router, useIsFocused } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CHAIN_IDS, STREET_BACKGROUND } from '@/game/content';

import { StallView } from './stall-view';

/**
 * 夜市街：橫向捲動的 5 個攤位（FR41、UX-DR10）。渲染方案依 #4 閘門結論：純 RN + Reanimated。
 * 這個畫面本身不訂閱 store，只有各個 StallView 訂閱自己的攤位。
 */
export function StreetScreen() {
  // 分頁失焦時暫停所有循環動畫（霓虹）
  const focused = useIsFocused();

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      {/* 夜市街背景（星空、燈泡串、遠方街景，UX-DR10）；不跟著捲動，攤位在前面滑過 */}
      <Image
        source={STREET_BACKGROUND}
        contentFit="cover"
        contentPosition="bottom"
        cachePolicy="memory-disk"
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.header}>
        <Pressable
          testID="open-settings"
          accessibilityRole="button"
          accessibilityLabel="設定"
          hitSlop={8}
          onPress={() => router.push('/settings')}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
          <Text style={styles.icon}>⚙️</Text>
        </Pressable>
        <Text style={styles.title}>夜市街</Text>
        {/* 右上角保留給收藏冊入口（E5），先放同尺寸的空位讓標題置中 */}
        <View style={styles.iconButton} />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.street}>
        {CHAIN_IDS.map((chain) => (
          <StallView key={chain} chain={chain} animate={focused} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    // 深藍夜空（UX-DR10）
    backgroundColor: '#0B1638',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  icon: {
    fontSize: 24,
  },
  title: {
    color: '#FFD966',
    fontSize: 20,
    fontWeight: '800',
  },
  street: {
    alignItems: 'flex-end',
    gap: 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
});
