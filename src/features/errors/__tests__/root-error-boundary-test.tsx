// 整合測試：用真正的根層 _layout.tsx，確認子路由 render 出錯時顯示錯誤畫面而不是白屏，
// 並且按「重新載入」後能恢復。
import { fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';

import RootLayout, { ErrorBoundary } from '@/app/_layout';

let shouldThrow = true;

function CrashingScreen() {
  if (shouldThrow) throw new Error('棋盤渲染失敗');
  return <Text>棋盤</Text>;
}

describe('根層 ErrorBoundary', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    shouldThrow = true;
    // React 會把被 boundary 攔下的錯誤印到 console.error；log.error 在開發版也會輸出。這裡靜音。
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('子路由 render 出錯時顯示「重新載入」，按下後恢復畫面', async () => {
    await renderRouter({
      _layout: { default: RootLayout, ErrorBoundary },
      index: CrashingScreen,
    });

    expect(screen.getByText('夜市暫時停電了')).toBeTruthy();
    expect(screen.queryByText('棋盤')).toBeNull();

    shouldThrow = false;
    await fireEvent.press(screen.getByText('重新載入'));

    expect(await screen.findByText('棋盤')).toBeTruthy();
    expect(screen.queryByText('夜市暫時停電了')).toBeNull();
  });
});
