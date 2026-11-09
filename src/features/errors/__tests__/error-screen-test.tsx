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

describe('SaveErrorScreen', () => {
  // 延後載入，避免和上方 ErrorScreen 的 log mock 互相影響
  const { SaveErrorScreen } = jest.requireActual('../save-error-screen');

  it('「備份後開新局」要再按一次確認才會執行，取消則回到原畫面', async () => {
    const onStartOver = jest.fn();
    await render(<SaveErrorScreen reason="invalid" onRetry={jest.fn()} onStartOver={onStartOver} />);

    await fireEvent.press(screen.getByText('備份後開新局'));
    expect(onStartOver).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('取消'));
    expect(screen.getByText('備份後開新局')).toBeTruthy();

    await fireEvent.press(screen.getByText('備份後開新局'));
    await fireEvent.press(screen.getByText('確定開新局'));
    expect(onStartOver).toHaveBeenCalledTimes(1);
  });

  it('存檔來自較新版本時只提示更新，不提供開新局', async () => {
    await render(<SaveErrorScreen reason="newer-version" onRetry={jest.fn()} onStartOver={jest.fn()} />);

    expect(screen.getByText('這份存檔來自較新的版本，請先更新 App 再開啟。')).toBeTruthy();
    expect(screen.queryByText('備份後開新局')).toBeNull();
  });

  it('「重試」呼叫 onRetry', async () => {
    const onRetry = jest.fn();
    await render(<SaveErrorScreen reason="corrupt-json" onRetry={onRetry} onStartOver={jest.fn()} />);

    await fireEvent.press(screen.getByText('重試'));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
