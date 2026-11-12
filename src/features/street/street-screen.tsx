import { Image } from 'expo-image';
import { router, useIsFocused } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TutorialLine } from '@/features/tutorial/tutorial-line';
import { useTutorialTargets } from '@/features/tutorial/tutorial-targets';
import { CHAIN_IDS, STREET_BACKGROUND } from '@/game/content';

import { StallView } from './stall-view';

/**
 * 夜市街：橫向捲動的 5 個攤位（FR41、UX-DR10）。渲染方案依 #4 閘門結論：純 RN + Reanimated。
 * 這個畫面本身不訂閱 store，只有各個 StallView 訂閱自己的攤位。
 */
export function StreetScreen() {
  // 分頁失焦時暫停所有循環動畫（霓虹）
  const focused = useIsFocused();
  const requestRemeasure = useTutorialTargets((store) => store.requestRemeasure);

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
        {/* 收藏冊入口（FR35、UX-DR8），和左上角的設定對稱 */}
        <Pressable
          testID="open-collection"
          accessibilityRole="button"
          accessibilityLabel="收藏冊"
          hitSlop={8}
          onPress={() => router.push('/collection')}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
          <Text style={styles.icon}>📖</Text>
        </Pressable>
      </View>
      <View style={styles.streetArea}>
        <ScrollView
          // 捲動停止後，手指重新量測攤位位置（S6.4）
          onScrollEndDrag={requestRemeasure}
          onMomentumScrollEnd={requestRemeasure}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.street}>
          {CHAIN_IDS.map((chain) => (
            <StallView key={chain} chain={chain} animate={focused} />
          ))}
        </ScrollView>
        {/* 新手引導第 3 步的說明（S6.4）：疊在攤位區頂端，不佔版面、不擋觸控（E6 code review） */}
        <View pointerEvents="none" style={styles.tutorialLine}>
          <TutorialLine steps={[2]} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    // 深藍夜空（UX-DR10）
    backgroundColor: '#0B1638',
  },
  streetArea: {
    flex: 1,
  },
  tutorialLine: {
    position: 'absolute',
    top: 4,
    left: 0,
    right: 0,
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
