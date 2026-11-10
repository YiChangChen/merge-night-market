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
  useOverlayStore.setState({ stallPanel: null, shutterOpening: {}, neonPowerOn: {} });
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

  it('已經開著的攤位：沒有重開條件，改顯示升級條件', async () => {
    useOverlayStore.setState({ stallPanel: 'tea' });
    await render(<OverlayHost />);

    expect(screen.queryByText('重開條件')).toBeNull();
    expect(screen.getByText('升級到 Lv2 店面')).toBeTruthy();
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

const withStall = (chain: 'tea' | 'noodle', level: 0 | 1 | 2 | 3) => ({
  stalls: { ...createGame(NOW, 1).stalls, [chain]: { level, signatureDish: null } },
});

describe('升級攤位（S1.10）', () => {
  it('金幣不足：標示出來，按鈕停用', async () => {
    setGame({ coins: 150 });
    useOverlayStore.setState({ stallPanel: 'tea' });
    await render(<OverlayHost />);

    expect(screen.getByText('金幣 200')).toBeTruthy();
    expect(screen.getAllByTestId('condition-unmet')).toHaveLength(1);
    expect(screen.getByTestId('upgrade-stall')).toBeDisabled();
    expect(screen.getByText('金幣不足')).toBeTruthy();
  });

  it('金幣足夠：升到 Lv2、扣金幣、關閉面板，霓虹亮到第 2 段並播放通電', async () => {
    setGame({ coins: 250 });
    useOverlayStore.setState({ stallPanel: 'tea' });
    const stopFx = startFxController();
    await render(
      <>
        <StallView chain="tea" animate={false} />
        <OverlayHost />
      </>
    );

    await fireEvent.press(screen.getByTestId('upgrade-stall'));

    expect(useGameStore.getState().state?.stalls.tea.level).toBe(2);
    expect(useGameStore.getState().state?.coins).toBe(50);
    expect(screen.queryByTestId('stall-panel')).toBeNull();
    expect(screen.getByTestId('neon-segment-powering-on')).toBeTruthy();
    expect(screen.getAllByTestId('neon-segment-lit')).toHaveLength(1);
    stopFx();
  });

  it('Lv2 攤位：顯示 Lv3 條件，按鈕鎖住並提示需要發明菜', async () => {
    setGame({ coins: 9999, ...withStall('tea', 2) });
    useOverlayStore.setState({ stallPanel: 'tea' });
    await render(<OverlayHost />);

    expect(screen.getByText('升級到 Lv3 大店')).toBeTruthy();
    expect(screen.getByText('1 份含這一攤食材的發明菜')).toBeTruthy();
    expect(screen.getByTestId('upgrade-stall')).toBeDisabled();
    expect(screen.getByText('需要發明菜（即將開放）')).toBeTruthy();
  });

  it('Lv3 攤位：已經是最高等級', async () => {
    setGame(withStall('tea', 3));
    useOverlayStore.setState({ stallPanel: 'tea' });
    await render(<OverlayHost />);

    expect(screen.getByText('已經是最高等級的大店。')).toBeTruthy();
    expect(screen.queryByTestId('upgrade-stall')).toBeNull();
  });

  it('FxController 收到 stall_upgraded 播放通電；演出結束後自動清除，霓虹回到全亮', async () => {
    jest.useFakeTimers();
    setGame(withStall('tea', 2));
    const stop = startFxController();
    gameEvents.emit({ type: 'stall_upgraded', stall: 'tea', level: 2 });
    stop();
    await render(<StallView chain="tea" animate={false} />);
    expect(screen.getByTestId('neon-segment-powering-on')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(useOverlayStore.getState().neonPowerOn.tea).toBeUndefined();
    expect(screen.queryByTestId('neon-segment-powering-on')).toBeNull();
    expect(screen.getAllByTestId('neon-segment-lit')).toHaveLength(2);
    jest.useRealTimers();
  });
});
