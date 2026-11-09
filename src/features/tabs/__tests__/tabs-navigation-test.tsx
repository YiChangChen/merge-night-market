// 路由整合測試：用真正的 (tabs)/_layout、夜市街與設定畫面，確認分頁切換與設定入口。
// 棋盤分頁換成簡單的替身，避免把拖曳與棋盤版面一起拉進來。
import { fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';

import TabsLayout from '@/app/(tabs)/_layout';
import StreetTab from '@/app/(tabs)/street';
import SettingsRoute from '@/app/settings';
import { createGame } from '@/game/engine';
import { useGameStore } from '@/game/store';

function BoardStub() {
  return <Text>棋盤畫面</Text>;
}

beforeEach(() => {
  useGameStore.setState({ state: createGame(1_000_000, 1), status: { kind: 'ready' } });
});

async function renderApp() {
  await renderRouter(
    {
      '(tabs)/_layout': TabsLayout,
      '(tabs)/index': BoardStub,
      '(tabs)/street': StreetTab,
      settings: SettingsRoute,
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
});
