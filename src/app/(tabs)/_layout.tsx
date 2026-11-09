// 底部兩個分頁：棋盤與夜市街（FR41、UX-DR1）。兩頁常駐，失焦時凍結，切換 ≤ 300 ms（NFR3）。
import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '@/features/tabs';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // 開機就掛載兩頁，切換時不必等夜市街第一次渲染
        lazy: false,
        // 不在前景的分頁凍結，不參與重繪
        freezeOnBlur: true,
      }}>
      <Tabs.Screen name="index" options={{ title: '棋盤' }} />
      <Tabs.Screen name="street" options={{ title: '夜市街' }} />
    </Tabs>
  );
}
