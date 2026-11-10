import { BottomTabBarHeightCallbackContext, type BottomTabBarProps } from 'expo-router/js-tabs';
import { useContext } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { markTabPress } from './tab-timing';

const TABS: Record<string, { label: string; icon: string }> = {
  index: { label: '棋盤', icon: '🧺' },
  street: { label: '夜市街', icon: '🏮' },
};

/** 底部只有「棋盤」與「夜市街」兩個分頁的自訂 tab bar（UX-DR1）；每個按鈕至少 44 pt。 */
// Expo Router 58 內建的 tab bar 介面：用 emitter 送出 tabPress、navigateToTab(routeKey) 切換分頁，
// insets 由 navigator 傳入（和原版 React Navigation 的 navigation 物件不同）。
export function TabBar({ state, emitter, navigateToTab, insets }: BottomTabBarProps) {
  // 自訂 tab bar 要自己回報實際高度，useBottomTabBarHeight() 才會拿到正確值（否則是 49 + 安全區的估計）；
  // 棋盤畫面靠它計算格子大小
  const onHeightChange = useContext(BottomTabBarHeightCallbackContext);
  return (
    <View
      testID="tab-bar"
      onLayout={(event) => onHeightChange?.(event.nativeEvent.layout.height)}
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, index) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const focused = state.index === index;
        const onPress = () => {
          const event = emitter.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            markTabPress(route.name);
            navigateToTab(route.key);
          }
        };
        return (
          <Pressable
            key={route.key}
            testID={`tab-${route.name}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={tab.label}
            onPress={onPress}
            style={styles.tab}>
            <Text style={[styles.icon, !focused && styles.dim]}>{tab.icon}</Text>
            <Text style={[styles.label, focused ? styles.labelFocused : styles.dim]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#2A3366',
    backgroundColor: '#0A1230',
  },
  tab: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  icon: {
    fontSize: 22,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
  labelFocused: {
    color: '#FFD966',
  },
  dim: {
    color: '#8A93B8',
    opacity: 0.7,
  },
});
