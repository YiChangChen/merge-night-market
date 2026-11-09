import { fireEvent, render, screen } from '@testing-library/react-native';

import { log } from '@/services/log';

import { ErrorScreen } from '../error-screen';

jest.mock('@/services/log', () => ({
  log: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('ErrorScreen', () => {
  beforeEach(() => {
    jest.mocked(log.error).mockClear();
  });

  it('顯示說明與「重新載入」按鈕，按下會呼叫 onRetry', async () => {
    const onRetry = jest.fn();
    await render(<ErrorScreen error={new Error('boom')} onRetry={onRetry} />);

    expect(screen.getByText('夜市暫時停電了')).toBeTruthy();
    expect(screen.getByText('畫面出了點問題，你的進度都還在。')).toBeTruthy();

    await fireEvent.press(screen.getByText('重新載入'));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('出現時以 render scope 記一筆 log.error', async () => {
    const error = new Error('boom');
    await render(<ErrorScreen error={error} onRetry={jest.fn()} />);

    expect(log.error).toHaveBeenCalledTimes(1);
    expect(log.error).toHaveBeenCalledWith('render', expect.any(String), error);
  });

  it('開發版顯示錯誤訊息，方便除錯', async () => {
    await render(<ErrorScreen error={new Error('找不到品項圖')} onRetry={jest.fn()} />);

    expect(screen.getByText('找不到品項圖')).toBeTruthy();
  });
});
