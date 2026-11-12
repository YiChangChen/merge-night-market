import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { StallView } from '@/features/street';
import { shouldPlayFlash } from '@/features/street/neon-sign';
import { BALANCE } from '@/game/content';
import { createGame, type GameState } from '@/game/engine';
import { gameEvents } from '@/game/events';
import { useGameStore } from '@/game/store';
import { ads, FAKE_AD_MS, useFakeAds } from '@/services/ads';

import { startFxController } from '../fx-controller';
import { OverlayHost } from '../overlay-host';
import { useOverlayStore } from '../overlay-store';
import { SELLOUT_DECIDE_MS, SELLOUT_SHOW_MS } from '../sellout-show';

const NOW = 1_000_000;
const SOLD_OUT = { wave: 1, coins: 60, energy: 10, xp: 12, doubled: false };

function setGame(overrides: Partial<GameState>) {
  useGameStore.setState({
    state: { ...createGame(NOW, 1), ...overrides },
    status: { kind: 'ready' },
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  // 預設沒有廣告（正式版沒有除錯工具時的狀態）；加倍的測試在下面另外打開
  useFakeAds.setState({ enabled: false, mode: 'earned' });
  setGame({ lastSellout: SOLD_OUT });
  useOverlayStore.setState({
    stallPanel: null,
    shutterOpening: {},
    neonPowerOn: {},
    sellout: null,
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('完售演出（S2.4、FR19、UX-DR4）', () => {
  it('FxController 收到 queue_sold_out 就開始演出', () => {
    const stop = startFxController();
    gameEvents.emit({ type: 'queue_sold_out', wave: 3, length: 14 });
    stop();

    expect(useOverlayStore.getState().sellout).toMatchObject({ wave: 3 });
  });

  it('顯示「完售！」與這一波的獎勵，沒有加倍按鈕', async () => {
    useOverlayStore.getState().playSellout(1);
    await render(<OverlayHost />);

    expect(screen.getByText('完售！')).toBeTruthy();
    expect(screen.getByText('第 1 波客人全部招呼完了')).toBeTruthy();
    expect(screen.getByText('🪙 +60')).toBeTruthy();
    expect(screen.getByText('⚡ +10')).toBeTruthy();
    expect(screen.getByText('⭐ +12')).toBeTruthy();
    // 沒有廣告時不顯示加倍按鈕（S6.3）
    expect(screen.queryByText(/看廣告/)).toBeNull();
    // 讀螢幕軟體聽得到獎勵
    expect(
      screen.getByLabelText('完售！第 1 波，獲得金幣 60、體力 10、經驗 12。點一下繼續')
    ).toBeTruthy();
  });

  it('lastSellout 不是這一波時不顯示獎勵數字', async () => {
    useOverlayStore.getState().playSellout(2);
    await render(<OverlayHost />);

    expect(screen.getByText('完售！')).toBeTruthy();
    expect(screen.queryByTestId('sellout-reward')).toBeNull();
  });

  it('演出途中 lastSellout 被清除（冷卻到期）時，獎勵仍然顯示', async () => {
    useOverlayStore.getState().playSellout(1);
    await render(<OverlayHost />);

    await act(async () => {
      useGameStore.setState((store) => ({
        state: store.state && { ...store.state, lastSellout: null },
      }));
    });

    expect(screen.getByText('🪙 +60')).toBeTruthy();
  });

  it('點一下跳過；遊戲狀態不變', async () => {
    const before = useGameStore.getState().state;
    useOverlayStore.getState().playSellout(1);
    await render(<OverlayHost />);

    // 剛出現的 0.4 秒內點擊不算（避免出單後緊接著的點擊直接關掉）
    await fireEvent.press(screen.getByTestId('sellout-show'));
    expect(useOverlayStore.getState().sellout).not.toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    await fireEvent.press(screen.getByTestId('sellout-show'));

    expect(useOverlayStore.getState().sellout).toBeNull();
    expect(screen.queryByTestId('sellout-show')).toBeNull();
    expect(useGameStore.getState().state).toBe(before);
  });

  it('沒有點的話時間到自動結束', async () => {
    useOverlayStore.getState().playSellout(1);
    await render(<OverlayHost />);

    await act(async () => {
      jest.advanceTimersByTime(SELLOUT_SHOW_MS);
    });

    expect(useOverlayStore.getState().sellout).toBeNull();
  });

  it('演出疊在攤位面板上；返回鍵先關演出，再關面板', async () => {
    const { BackHandler } = jest.requireActual<typeof import('react-native')>('react-native');
    const listeners: (() => boolean)[] = [];
    const spy = jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((_event, handler) => {
        listeners.push(handler as () => boolean);
        return { remove: jest.fn() };
      });
    useOverlayStore.setState({ stallPanel: 'tea' });
    useOverlayStore.getState().playSellout(1);
    await render(<OverlayHost />);

    await act(async () => {
      listeners[listeners.length - 1]();
    });
    expect(useOverlayStore.getState().sellout).toBeNull();
    expect(useOverlayStore.getState().stallPanel).toBe('tea');

    await act(async () => {
      listeners[listeners.length - 1]();
    });
    expect(useOverlayStore.getState().stallPanel).toBeNull();
    spy.mockRestore();
  });

  it.each([
    [
      '新的序號、夜市街在前景、攤位開著：播',
      { flash: 5, played: undefined, animate: true, level: 1 },
      true,
    ],
    ['同一個序號已經播過：不重播', { flash: 5, played: 5, animate: true, level: 2 }, false],
    [
      '夜市街失焦：先不播（切回來時補播）',
      { flash: 5, played: undefined, animate: false, level: 1 },
      false,
    ],
    ['鐵捲門攤位不閃', { flash: 5, played: undefined, animate: true, level: 0 }, false],
    [
      '跳過演出後序號消失：不播，也不會中斷',
      { flash: undefined, played: 5, animate: true, level: 1 },
      false,
    ],
  ] as const)('招牌閃爍判斷：%s', (_name, input, expected) => {
    expect(shouldPlayFlash(input)).toBe(expected);
  });

  it('夜市街的招牌收到完售序號', async () => {
    await render(<StallView chain="tea" animate />);
    expect(screen.queryByTestId('neon-sign-flash')).toBeNull();

    await act(async () => {
      useOverlayStore.getState().playSellout(1);
    });
    expect(screen.getByTestId('neon-sign-flash')).toBeTruthy();
  });
});

describe('完售時看廣告加倍（S6.3、FR38）', () => {
  beforeEach(() => {
    useFakeAds.setState({ enabled: true, mode: 'earned' });
  });

  async function renderShow(overrides: Partial<GameState> = {}) {
    const base = createGame(NOW, 1);
    setGame({ lastSellout: SOLD_OUT, coins: 100, energy: 5, xp: 0, ...overrides });
    useOverlayStore.getState().playSellout(1);
    await render(<OverlayHost />);
    return base;
  }

  it('可以看、有廣告時顯示按鈕與今天剩下的次數', async () => {
    const base = createGame(NOW, 1);
    await renderShow({ daily: { ...base.daily, adDoubleUsed: 1 } });

    expect(screen.getByTestId('watch-ad-double')).toHaveTextContent('📺 看廣告 獎勵加倍');
    expect(screen.getByTestId('double-remaining')).toHaveTextContent('今天還剩 2 次');
  });

  it('看完（earned）：金幣、體力、XP 再發一次，標記已加倍，顯示加倍後的數字', async () => {
    // 體力放在上限以上，結算時不會自然回復，只看獎勵
    await renderShow({ energy: 300 });

    await fireEvent.press(screen.getByTestId('watch-ad-double'));
    expect(screen.getByTestId('watch-ad-double')).toHaveTextContent('廣告播放中…');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(FAKE_AD_MS);
    });

    const state = useGameStore.getState().state;
    expect(state?.coins).toBe(100 + 60);
    // 完售體力 +10，XP 12 讓 Lv1 升到 Lv2，再加升級體力
    expect(state?.energy).toBe(300 + 10 + BALANCE.levelUpEnergy);
    expect(state?.xp).toBe(12 % 10);
    expect(state?.level).toBe(2);
    expect(state?.lastSellout).toEqual({ ...SOLD_OUT, doubled: true });
    expect(state?.daily.adDoubleUsed).toBe(1);
    expect(screen.getByText('獎勵加倍！')).toBeTruthy();
    expect(screen.getByText('🪙 +120')).toBeTruthy();
    expect(screen.queryByTestId('watch-ad-double')).toBeNull();
  });

  it('跳過（dismissed）：不給任何東西，按鈕還在', async () => {
    useFakeAds.setState({ mode: 'dismissed' });
    await renderShow();

    await fireEvent.press(screen.getByTestId('watch-ad-double'));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(FAKE_AD_MS);
    });

    expect(useGameStore.getState().state?.coins).toBe(100);
    expect(useGameStore.getState().state?.lastSellout?.doubled).toBe(false);
    expect(screen.getByTestId('watch-ad-double')).toHaveTextContent('📺 看廣告 獎勵加倍');
  });

  it('沒有廣告：不顯示按鈕，演出照常在 2.8 秒結束', async () => {
    useFakeAds.setState({ mode: 'unavailable' });
    await renderShow();

    expect(screen.queryByTestId('watch-ad-double')).toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(SELLOUT_SHOW_MS);
    });
    expect(useOverlayStore.getState().sellout).toBeNull();
  });

  it('下一波已經開始（lastSellout 清除）或今天看滿 3 次：不顯示按鈕', async () => {
    await renderShow({ lastSellout: null });
    expect(screen.queryByTestId('watch-ad-double')).toBeNull();
  });

  it('今天看滿 3 次：不顯示按鈕', async () => {
    const base = createGame(NOW, 1);
    await renderShow({ daily: { ...base.daily, adDoubleUsed: 3 } });
    expect(screen.queryByTestId('watch-ad-double')).toBeNull();
  });

  it('有按鈕時演出延長到 6 秒，讓玩家來得及決定', async () => {
    await renderShow();
    await act(async () => {
      jest.advanceTimersByTime(SELLOUT_SHOW_MS);
    });
    expect(useOverlayStore.getState().sellout).not.toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(SELLOUT_DECIDE_MS - SELLOUT_SHOW_MS);
    });
    expect(useOverlayStore.getState().sellout).toBeNull();
  });

  it('播放中不會自動結束，點背景也不會關掉（廣告播得比演出久）', async () => {
    // 真的廣告可能長達 30 秒：讓 show 一直不結束
    const spy = jest.spyOn(ads, 'show').mockReturnValue(new Promise(() => {}));
    await renderShow();
    await fireEvent.press(screen.getByTestId('watch-ad-double'));

    await act(async () => {
      jest.advanceTimersByTime(SELLOUT_DECIDE_MS * 2);
    });
    await fireEvent.press(screen.getByTestId('sellout-show'));
    expect(useOverlayStore.getState().sellout).not.toBeNull();
    spy.mockRestore();
  });
});
