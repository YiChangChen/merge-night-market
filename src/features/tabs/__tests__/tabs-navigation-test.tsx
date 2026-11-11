// 路由整合測試：用真正的 (tabs)/_layout、夜市街與設定畫面，確認分頁切換與設定入口。
// 棋盤分頁換成簡單的替身，避免把拖曳與棋盤版面一起拉進來。
import { fireEvent, screen } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';

import TabsLayout from '@/app/(tabs)/_layout';
import StreetTab from '@/app/(tabs)/street';
import CollectionRoute from '@/app/collection';
import SettingsRoute from '@/app/settings';
import { createGame } from '@/game/engine';
import { useGameStore } from '@/game/store';

// 和根層 _layout.tsx 一樣用 Stack：modal 疊在分頁上面，分頁不會卸載（夜市街捲動位置保留）
function RootStack() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

function BoardStub() {
  return <Text>棋盤畫面</Text>;
}

beforeEach(() => {
  useGameStore.setState({ state: createGame(1_000_000, 1), status: { kind: 'ready' } });
});

async function renderApp() {
  await renderRouter(
    {
      _layout: RootStack,
      '(tabs)/_layout': TabsLayout,
      '(tabs)/index': BoardStub,
      '(tabs)/street': StreetTab,
      settings: SettingsRoute,
      collection: CollectionRoute,
    },
    { initialUrl: '/' }
  );
}

describe('底部分頁與設定', () => {
  it('只有「棋盤」與「夜市街」兩個分頁，預設在棋盤', async () => {
    await renderApp();

    expect(screen.getByTestId('tab-index')).toBeTruthy();
    expect(screen.getByTestId('tab-street')).toBeTruthy();
    expect(screen.getByText('棋盤畫面')).toBeTruthy();
  });

  it('點「夜市街」切到夜市街，5 個攤位都在', async () => {
    await renderApp();

    await fireEvent.press(screen.getByTestId('tab-street'));

    expect(await screen.findByTestId('stall-tea')).toBeTruthy();
    for (const chain of ['tea', 'fried', 'noodle', 'dumpling', 'sweet']) {
      expect(screen.getByTestId(`stall-${chain}`)).toBeTruthy();
    }
  });

  it('夜市街左上角的設定入口開啟設定畫面，顯示版本號', async () => {
    await renderApp();
    await fireEvent.press(screen.getByTestId('tab-street'));

    await fireEvent.press(await screen.findByTestId('open-settings'));

    expect(await screen.findByTestId('app-version')).toBeTruthy();
    expect(screen.getByText(/^版本 /)).toBeTruthy();
  });

  it('夜市街右上角的收藏冊入口開啟收藏冊（S5.2）；關閉後回到夜市街', async () => {
    await renderApp();
    await fireEvent.press(screen.getByTestId('tab-street'));
    const street = await screen.findByTestId('stall-tea');

    await fireEvent.press(screen.getByTestId('open-collection'));
    expect(await screen.findByTestId('collection-progress')).toHaveTextContent('0/10');

    await fireEvent.press(screen.getByTestId('close-collection'));
    // 同一個元件實體：夜市街沒有被卸載重建，捲動位置因此保留（AC6）
    expect(await screen.findByTestId('stall-tea')).toBe(street);
    expect(screen.queryByTestId('collection-progress')).toBeNull();
  });
});

describe('tab bar 高度（code review 2026-11-10）', () => {
  it('自訂 tab bar 把實際高度回報給 BottomTabBarHeightCallbackContext', async () => {
    const { BottomTabBarHeightCallbackContext } = jest.requireActual<typeof import('expo-router/js-tabs')>(
      'expo-router/js-tabs'
    );
    const { TabBar } = jest.requireActual<typeof import('../tab-bar')>('../tab-bar');
    const { render } = jest.requireActual<typeof import('@testing-library/react-native')>(
      '@testing-library/react-native'
    );
    const onHeightChange = jest.fn();
    const props = {
      state: { index: 0, routes: [{ key: 'index-1', name: 'index' }, { key: 'street-1', name: 'street' }] },
      descriptors: {},
      emitter: { emit: () => ({ defaultPrevented: false }) },
      navigateToTab: jest.fn(),
      insets: { top: 0, bottom: 34, left: 0, right: 0 },
    } as unknown as Parameters<typeof TabBar>[0];
    await render(
      <BottomTabBarHeightCallbackContext.Provider value={onHeightChange}>
        <TabBar {...props} />
      </BottomTabBarHeightCallbackContext.Provider>
    );

    await fireEvent(screen.getByTestId('tab-bar'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 89 } },
    });

    expect(onHeightChange).toHaveBeenCalledWith(89);
  });
});
