// S6.2：體力不足時看廣告補體力（FR37、FR39、NP-4）。
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { createGame } from '@/game/engine';
import { useGameStore } from '@/game/store';
import { ads, FAKE_AD_MS, useFakeAds } from '@/services/ads';

import { EnergyPrompt } from '../energy-prompt';

const NOW = Date.UTC(2026, 10, 12, 4, 0, 0);

function setGame(energy: number, adEnergyUsed = 0) {
  const base = createGame(NOW, 1);
  useGameStore.setState({
    state: {
      ...base,
      energy,
      energyUpdatedAt: NOW,
      daily: { ...base.daily, adEnergyUsed },
    },
    status: { kind: 'ready' },
    timeOffsetMs: 0,
  });
}

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  useFakeAds.setState({ enabled: true, mode: 'earned' });
});

afterEach(() => {
  jest.useRealTimers();
});

async function renderPrompt() {
  const onClose = jest.fn();
  const onRewarded = jest.fn();
  await render(<EnergyPrompt onClose={onClose} onRewarded={onRewarded} />);
  return { onClose, onRewarded };
}

describe('體力不足提示', () => {
  it('顯示下一點體力的倒數，以及看廣告的按鈕與今天剩下的次數', async () => {
    setGame(0, 2);
    await renderPrompt();

    expect(screen.getByText('體力不足')).toBeTruthy();
    expect(screen.getByTestId('energy-countdown')).toHaveTextContent('下一點體力 2:00');
    expect(screen.getByTestId('watch-ad-energy')).toHaveTextContent('📺 看廣告 +20 體力');
    expect(screen.getByTestId('ad-remaining')).toHaveTextContent('今天還剩 3 次');
  });

  it('看完（earned）才給 +20 體力，計數 +1，然後關閉', async () => {
    setGame(0);
    const { onClose, onRewarded } = await renderPrompt();

    await fireEvent.press(screen.getByTestId('watch-ad-energy'));
    // 播放中：按鈕停用，不能連點
    expect(screen.getByTestId('watch-ad-energy')).toHaveTextContent('廣告播放中…');
    await fireEvent.press(screen.getByTestId('watch-ad-energy'));
    expect(useGameStore.getState().state?.energy).toBe(0);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(FAKE_AD_MS);
    });
    expect(useGameStore.getState().state?.energy).toBe(20);
    expect(useGameStore.getState().state?.daily.adEnergyUsed).toBe(1);
    expect(onRewarded).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();
  });

  it('跳過（dismissed）：不給任何東西，提示還在，可以再看', async () => {
    useFakeAds.setState({ mode: 'dismissed' });
    setGame(0);
    const { onClose, onRewarded } = await renderPrompt();

    await fireEvent.press(screen.getByTestId('watch-ad-energy'));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(FAKE_AD_MS);
    });

    expect(useGameStore.getState().state?.energy).toBe(0);
    expect(useGameStore.getState().state?.daily.adEnergyUsed).toBe(0);
    expect(onRewarded).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('watch-ad-energy')).toHaveTextContent(/看廣告 \+20 體力/);
  });

  it('沒有廣告（離線、沒有庫存）：隱藏按鈕，只顯示倒數（FR39）', async () => {
    useFakeAds.setState({ mode: 'unavailable' });
    setGame(0);
    await renderPrompt();

    expect(screen.queryByTestId('watch-ad-energy')).toBeNull();
    expect(screen.getByTestId('energy-countdown')).toBeTruthy();
  });

  it('今天已經看滿 5 次：隱藏按鈕', async () => {
    setGame(0, 5);
    await renderPrompt();

    expect(screen.queryByTestId('watch-ad-energy')).toBeNull();
    expect(screen.getByText('今天的廣告次數用完了')).toBeTruthy();
  });

  it('體力自然回來時自動關閉；✕ 也能關閉', async () => {
    setGame(0);
    const { onClose } = await renderPrompt();
    await fireEvent.press(screen.getByTestId('close-energy-prompt'));
    expect(onClose).toHaveBeenCalledTimes(1);

    await act(async () => {
      useGameStore.setState((store) => ({ state: store.state && { ...store.state, energy: 1 } }));
    });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('E6 code review', () => {
  it('廣告服務出錯（reject）：當成沒有廣告，提示卡不會卡在播放中', async () => {
    const spy = jest.spyOn(ads, 'show').mockRejectedValue(new Error('SDK'));
    setGame(0);
    const { onRewarded } = await renderPrompt();

    await fireEvent.press(screen.getByTestId('watch-ad-energy'));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByTestId('watch-ad-energy')).toHaveTextContent(/看廣告 \+20 體力/);
    expect(onRewarded).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('看完了但獎勵沒有發出（例如次數在播放中用完）：不說 +20，也不關閉', async () => {
    setGame(0, 4);
    const { onClose, onRewarded } = await renderPrompt();
    await fireEvent.press(screen.getByTestId('watch-ad-energy'));
    // 播放中，別的地方用掉了最後一次
    await act(async () => {
      useGameStore.setState((store) => ({
        state: store.state && { ...store.state, daily: { ...store.state.daily, adEnergyUsed: 5 } },
      }));
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(FAKE_AD_MS);
    });
    expect(onRewarded).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(useGameStore.getState().state?.energy).toBe(0);
  });

  function captureBack() {
    const { BackHandler } = jest.requireActual<typeof import('react-native')>('react-native');
    const listeners: (() => boolean)[] = [];
    const spy = jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((_event, handler) => {
        listeners.push(handler as () => boolean);
        return { remove: jest.fn() };
      });
    const press = async () => {
      let handled = false;
      await act(async () => {
        handled = listeners[listeners.length - 1]();
      });
      return handled;
    };
    return { press, restore: () => spy.mockRestore() };
  }

  it('Android 返回鍵先關提示卡，不離開 App', async () => {
    const back = captureBack();
    setGame(0);
    const { onClose } = await renderPrompt();
    expect(await back.press()).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
    back.restore();
  });

  it('播放中按返回鍵：吃掉但不關閉', async () => {
    const back = captureBack();
    setGame(0);
    const { onClose } = await renderPrompt();
    await fireEvent.press(screen.getByTestId('watch-ad-energy'));
    expect(await back.press()).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    back.restore();
  });
});
