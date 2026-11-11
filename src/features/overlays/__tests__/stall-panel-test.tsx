import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { StallView } from '@/features/street';
import { BOARD_SIZE } from '@/game/content';
import { createGame, type GameState, type Piece } from '@/game/engine';
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

  it('Lv2 攤位、棋盤上沒有含這一攤食材的發明菜：按鈕停用並提示需要哪一攤的食材', async () => {
    setGame({ coins: 9999, ...withStall('tea', 2) });
    useOverlayStore.setState({ stallPanel: 'tea' });
    await render(<OverlayHost />);

    expect(screen.getByText('升級到 Lv3 大店')).toBeTruthy();
    expect(screen.getByText('1 份含這一攤食材的發明菜')).toBeTruthy();
    expect(screen.getByText('棋盤上沒有')).toBeTruthy();
    expect(screen.getByTestId('upgrade-stall')).toBeDisabled();
    expect(screen.getByText('需要含手搖飲吧台食材的發明菜')).toBeTruthy();
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

describe('攤位面板的邊界（code review 2026-11-10）', () => {
  it('關閉的開局攤位顯示「暫停營業中」，不會說是最高等級', async () => {
    setGame({ stalls: { ...createGame(NOW, 1).stalls, tea: { level: 0, signatureDish: null } } });
    useOverlayStore.setState({ stallPanel: 'tea' });
    await render(<OverlayHost />);

    expect(screen.getByText('暫停營業中。')).toBeTruthy();
    expect(screen.queryByText('已經是最高等級的大店。')).toBeNull();
  });

  it('升級效果的百分比來自數值設定', async () => {
    useOverlayStore.setState({ stallPanel: 'tea' });
    await render(<OverlayHost />);

    expect(screen.getByText(/訂單金幣 \+10%/)).toBeTruthy();
  });
});

describe('Lv3 升級與招牌菜（S3.5、FR12、FR13、RC-7）', () => {
  /** 手搖飲 Lv2、棋盤只放指定的發明菜 */
  function lv2TeaWith(coins: number, cells: Record<number, Piece>) {
    const board = Array<Piece | null>(BOARD_SIZE).fill(null);
    for (const [cell, piece] of Object.entries(cells)) board[Number(cell)] = piece;
    setGame({ coins, board, nextId: 1000, pendingGenerators: [], ...withStall('tea', 2) });
    useOverlayStore.setState({ stallPanel: 'tea' });
  }

  it('列出棋盤上含這一攤食材的發明菜；選好之前按鈕停用', async () => {
    lv2TeaWith(700, {
      0: { id: 1, kind: 'dish', recipe: 'tea-fried', count: 2 },
      1: { id: 2, kind: 'dish', recipe: 'tea-sweet', count: 1 },
      2: { id: 3, kind: 'dish', recipe: 'fried-sweet', count: 1 },
    });
    await render(<OverlayHost />);

    expect(screen.getByText('棋盤上有 2 道')).toBeTruthy();
    expect(screen.getByTestId('signature-option-tea-fried')).toBeTruthy();
    expect(screen.getByTestId('signature-option-tea-sweet')).toBeTruthy();
    // 甜鹹地瓜雞不含手搖飲，不能選
    expect(screen.queryByTestId('signature-option-fried-sweet')).toBeNull();
    expect(screen.getByText('招牌菜確定後不能更換。')).toBeTruthy();
    expect(screen.getByTestId('upgrade-stall')).toBeDisabled();
    expect(screen.getByText('先選一道招牌菜')).toBeTruthy();
  });

  it('選好後升級：扣金幣與 1 份發明菜、升到 Lv3、設定招牌菜，夜市街顯示招牌菜', async () => {
    lv2TeaWith(700, { 4: { id: 9, kind: 'dish', recipe: 'tea-fried', count: 2 } });
    await render(
      <>
        <StallView chain="tea" animate={false} />
        <OverlayHost />
      </>
    );
    expect(screen.queryByTestId('stall-tea-signature')).toBeNull();

    await fireEvent.press(screen.getByTestId('signature-option-tea-fried'));
    expect(screen.getByText('升級（🪙600）')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('upgrade-stall'));

    const state = useGameStore.getState().state;
    expect(state?.coins).toBe(100);
    expect(state?.stalls.tea).toEqual({ level: 3, signatureDish: 'tea-fried' });
    expect(state?.board[4]).toEqual({ id: 9, kind: 'dish', recipe: 'tea-fried', count: 1 });
    expect(screen.queryByTestId('stall-panel')).toBeNull();
    expect(screen.getByText('招牌：紅茶鹽酥雞套餐')).toBeTruthy();
    expect(screen.getAllByTestId('neon-segment-lit')).toHaveLength(3);
  });

  it('防連點：面板關閉前快速按兩次，只送出一次升級', async () => {
    lv2TeaWith(2000, {
      0: { id: 1, kind: 'dish', recipe: 'tea-fried', count: 3 },
    });
    // 規則層本身也會擋第二次（Lv3 沒有下一級），所以直接數 apply 被呼叫幾次
    const original = useGameStore.getState().apply;
    const apply = jest.fn(original);
    useGameStore.setState({ apply });
    await render(<OverlayHost />);
    await fireEvent.press(screen.getByTestId('signature-option-tea-fried'));

    const button = screen.getByTestId('upgrade-stall');
    await act(async () => {
      fireEvent.press(button);
      fireEvent.press(button);
    });

    expect(apply).toHaveBeenCalledTimes(1);
    expect(useGameStore.getState().state?.coins).toBe(1400);
    expect(useGameStore.getState().state?.board[0]).toMatchObject({ count: 2 });
    useGameStore.setState({ apply: original });
  });
});

describe('演出狀態與返回鍵（code review 2026-11-10）', () => {
  it('重開時同時播放鐵捲門與霓虹通電', () => {
    const stop = startFxController();
    gameEvents.emit({ type: 'stall_reopened', stall: 'noodle', level: 1 });
    stop();

    expect(useOverlayStore.getState().shutterOpening.noodle).toBeDefined();
    expect(useOverlayStore.getState().neonPowerOn.noodle).toBeDefined();
  });

  it('演出途中攤位被關閉時，清掉演出狀態，之後不會莫名重播', async () => {
    setGame({ stalls: { ...createGame(NOW, 1).stalls, noodle: { level: 1, signatureDish: null } } });
    useOverlayStore.getState().playShutter('noodle');
    useOverlayStore.getState().playNeonPowerOn('noodle');
    await render(<StallView chain="noodle" animate={false} />);

    await act(async () => {
      useGameStore.setState((store) => ({
        state: store.state && { ...store.state, stalls: { ...store.state.stalls, noodle: { level: 0, signatureDish: null } } },
      }));
    });

    expect(useOverlayStore.getState().shutterOpening.noodle).toBeUndefined();
    expect(useOverlayStore.getState().neonPowerOn.noodle).toBeUndefined();
  });

  it('Android 返回鍵關閉面板', async () => {
    const { BackHandler } = jest.requireActual<typeof import('react-native')>('react-native');
    const listeners: (() => boolean)[] = [];
    const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
      listeners.push(handler as () => boolean);
      return { remove: jest.fn() };
    });
    useOverlayStore.setState({ stallPanel: 'tea' });
    await render(<OverlayHost />);

    let handled = false;
    await act(async () => {
      handled = listeners[listeners.length - 1]();
    });

    expect(handled).toBe(true);
    expect(useOverlayStore.getState().stallPanel).toBeNull();
    spy.mockRestore();
  });
});
