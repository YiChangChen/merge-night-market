// 入口與路由的開關：除錯工具開啟時長按版本號 2 秒開啟面板；關閉時沒有入口，直接開路由也會被導回首頁。
import { fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';

import DebugRoute from '@/app/debug';
import SettingsRoute from '@/app/settings';
import { createGame } from '@/game/engine';
import { useGameStore } from '@/game/store';

const mockConfig = { appVersion: '1.0.0', buildProfile: 'development', debugTools: true };
// 用 getter 延後讀取：路由模組在檔案最上方就被 import，那時 mockConfig 還沒初始化；
// 路由要到 render 時才讀 config，這時已經可以拿到（而且每個測試可以切換開關）
jest.mock('@/services/config', () => ({
  get config() {
    return mockConfig;
  },
}));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(), getStringAsync: jest.fn() }));

function Home() {
  return <Text>首頁</Text>;
}

async function renderRoutes(initialUrl: string) {
  await renderRouter({ index: Home, settings: SettingsRoute, debug: DebugRoute }, { initialUrl });
}

beforeEach(() => {
  useGameStore.setState({ state: createGame(1_000_000, 1), status: { kind: 'ready' }, timeOffsetMs: 0 });
});

describe('除錯面板入口', () => {
  it('除錯工具開啟：在設定畫面長按版本號開啟除錯面板', async () => {
    mockConfig.debugTools = true;
    await renderRoutes('/settings');

    await fireEvent(screen.getByTestId('app-version-press'), 'longPress');

    expect(await screen.findByText('除錯面板')).toBeTruthy();
  });

  it('除錯工具關閉：版本號沒有長按行為', async () => {
    mockConfig.debugTools = false;
    await renderRoutes('/settings');

    expect(screen.getByTestId('app-version-press')).toBeDisabled();
  });

  it('除錯工具關閉：直接開 /debug 會被導回首頁，面板不會掛載', async () => {
    mockConfig.debugTools = false;
    await renderRoutes('/debug');

    expect(await screen.findByText('首頁')).toBeTruthy();
    expect(screen.queryByText('除錯面板')).toBeNull();
  });
});
