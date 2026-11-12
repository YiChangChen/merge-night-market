import { BottomTabBarHeightCallbackContext, type BottomTabBarProps } from 'expo-router/js-tabs';
import { useContext } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TutorialTarget } from '@/features/tutorial/tutorial-target-view';

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
        const button = (
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
        // 新手引導第 3 步：還在棋盤時指向夜市街分頁（S6.4）
        return route.name === 'street' ? (
          <TutorialTarget
            key={route.key}
            id="tab-street"
            // 已經在夜市街時不指分頁按鈕（改指攤位）；有其他畫面疊在上面時由手指層判斷（E6 code review）
            active={!focused}
            style={styles.tab}>
            {button}
          </TutorialTarget>
        ) : (
          button
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
