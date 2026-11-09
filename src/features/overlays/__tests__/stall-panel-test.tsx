import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { StallView } from '@/features/street';
import { createGame, type GameState } from '@/game/engine';
import { gameEvents } from '@/game/events';
import { useGameStore } from '@/game/store';

import { startFxController } from '../fx-controller';
import { OverlayHost } from '../overlay-host';
import { useOverlayStore } from '../overlay-store';

const NOW = 1_000_000;

function setGame(overrides: Partial<GameState>) {
  useGameStore.setState({ state: { ...createGame(NOW, 1), ...overrides }, status: { kind: 'ready' } });
}

beforeEach(() => {
  setGame({});
  useOverlayStore.setState({ stallPanel: null, shutterOpening: {} });
});

describe('攤位面板（S1.9、UX-DR3）', () => {
  it('點夜市街的攤位開啟面板', async () => {
    await render(
      <>
        <StallView chain="noodle" animate={false} />
        <OverlayHost />
      </>
    );

    await fireEvent.press(screen.getByTestId('stall-noodle'));

    expect(screen.getByTestId('stall-panel')).toBeTruthy();
    expect(screen.getByText('重開條件')).toBeTruthy();
  });

  it('條件不足：未達成的條件標示出來，重開按鈕停用', async () => {
    setGame({ level: 2, coins: 500 });
    useOverlayStore.setState({ stallPanel: 'noodle' });
    await render(<OverlayHost />);

    expect(screen.getByText('玩家等級 Lv3')).toBeTruthy();
    expect(screen.getByText('目前 Lv2')).toBeTruthy();
    expect(screen.getAllByTestId('condition-unmet')).toHaveLength(1);
    expect(screen.getByTestId('reopen-stall')).toBeDisabled();
  });

  it('條件滿足：按「重開」扣金幣、攤位變 Lv1、關閉面板，夜市街播放鐵捲門拉起', async () => {
    setGame({ level: 3, coins: 350 });
    useOverlayStore.setState({ stallPanel: 'noodle' });
    const stopFx = startFxController();
    await render(
      <>
        <StallView chain="noodle" animate={false} />
        <OverlayHost />
      </>
    );

    await fireEvent.press(screen.getByTestId('reopen-stall'));

    expect(useGameStore.getState().state?.stalls.noodle.level).toBe(1);
    expect(useGameStore.getState().state?.coins).toBe(50);
    expect(screen.queryByTestId('stall-panel')).toBeNull();
    expect(screen.getByTestId('rolling-shutter')).toBeTruthy();
    stopFx();
  });

  it('已經開著的攤位：沒有重開條件', async () => {
    useOverlayStore.setState({ stallPanel: 'tea' });
    await render(<OverlayHost />);

    expect(screen.queryByText('重開條件')).toBeNull();
    expect(screen.getByText('營業中。升級功能即將開放。')).toBeTruthy();
  });

  it('點背景或「關閉」都會關閉面板', async () => {
    useOverlayStore.setState({ stallPanel: 'tea' });
    await render(<OverlayHost />);

    await fireEvent.press(screen.getByTestId('overlay-backdrop'));
    expect(screen.queryByTestId('stall-panel')).toBeNull();

    await act(async () => useOverlayStore.getState().openStallPanel('fried'));
    await fireEvent.press(screen.getByTestId('close-stall-panel'));
    expect(screen.queryByTestId('stall-panel')).toBeNull();
  });
});

describe('FxController', () => {
  it('收到 stall_reopened 就播放該攤的鐵捲門演出；停止後不再反應', () => {
    const stop = startFxController();

    gameEvents.emit({ type: 'stall_reopened', stall: 'sweet', level: 1 });
    expect(useOverlayStore.getState().shutterOpening.sweet).toBeDefined();

    stop();
    useOverlayStore.setState({ shutterOpening: {} });
    gameEvents.emit({ type: 'stall_reopened', stall: 'dumpling', level: 1 });
    expect(useOverlayStore.getState().shutterOpening.dumpling).toBeUndefined();
  });

  it('鐵捲門演出結束後自動清除', async () => {
    jest.useFakeTimers();
    setGame({ stalls: { ...createGame(NOW, 1).stalls, noodle: { level: 1, signatureDish: null } } });
    useOverlayStore.getState().playShutter('noodle');
    await render(<StallView chain="noodle" animate={false} />);
    expect(screen.getByTestId('rolling-shutter')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(1200);
    });

    expect(useOverlayStore.getState().shutterOpening.noodle).toBeUndefined();
    expect(screen.queryByTestId('rolling-shutter')).toBeNull();
    jest.useRealTimers();
  });
});
