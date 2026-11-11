import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { StallView } from '@/features/street';
import { shouldPlayFlash } from '@/features/street/neon-sign';
import { createGame, type GameState } from '@/game/engine';
import { gameEvents } from '@/game/events';
import { useGameStore } from '@/game/store';

import { startFxController } from '../fx-controller';
import { OverlayHost } from '../overlay-host';
import { useOverlayStore } from '../overlay-store';
import { SELLOUT_SHOW_MS } from '../sellout-show';

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
    // 加倍按鈕只留位置，E6 之前不顯示
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
