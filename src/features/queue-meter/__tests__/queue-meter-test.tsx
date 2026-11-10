import { act, render, screen } from '@testing-library/react-native';
import { Profiler } from 'react';

import { createGame, type GameState } from '@/game/engine';
import { useGameStore } from '@/game/store';
import type { QueueState } from '@/game/types';

import { QueueMeter } from '../queue-meter';

const NOW = 1_000_000;
let now: jest.SpyInstance<number, []>;

async function setQueue(queue: Partial<QueueState>) {
  await act(async () => {
    useGameStore.setState((store) => ({
      state: store.state && { ...store.state, queue: { ...store.state.queue, ...queue } },
    }));
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  now = jest.spyOn(Date, 'now').mockReturnValue(NOW);
  useGameStore.setState({
    state: createGame(NOW, 1),
    status: { kind: 'ready' },
    timeOffsetMs: 0,
  });
});

afterEach(() => {
  now.mockRestore();
  jest.useRealTimers();
});

describe('QueueMeter（S2.2）', () => {
  it('新局顯示「今晚客流 0/12」，出一單後變成 1/12', async () => {
    await render(<QueueMeter />);
    expect(screen.getByTestId('queue-meter-count')).toHaveTextContent('0/12');

    await setQueue({ remaining: 11 });
    expect(screen.getByTestId('queue-meter-count')).toHaveTextContent('1/12');
    expect(screen.getByLabelText('今晚客流 1/12')).toBeTruthy();
  });

  it('波中加長：分母直接更新，已出單數不會歸零', async () => {
    await render(<QueueMeter />);
    await setQueue({ length: 12, remaining: 5 });
    expect(screen.getByTestId('queue-meter-count')).toHaveTextContent('7/12');

    await setQueue({ length: 14, remaining: 7 });
    expect(screen.getByTestId('queue-meter-count')).toHaveTextContent('7/14');
  });

  it('剩最後 3 人才進入閃爍狀態', async () => {
    await render(<QueueMeter />);
    await setQueue({ remaining: 4 });
    expect(screen.getByTestId('queue-meter').props.accessibilityState).toEqual({ busy: false });

    await setQueue({ remaining: 3 });
    expect(screen.getByTestId('queue-meter').props.accessibilityState).toEqual({ busy: true });
  });

  it('冷卻中顯示「完售！下一波 m:ss」並每秒倒數（含除錯快轉）', async () => {
    await render(<QueueMeter />);
    await setQueue({ remaining: 0, cooldownEndsAt: NOW + 151_000 });
    expect(screen.getByTestId('queue-meter-cooldown')).toHaveTextContent('完售！下一波 2:31');

    now.mockReturnValue(NOW + 1000);
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId('queue-meter-cooldown')).toHaveTextContent('完售！下一波 2:30');

    await act(async () => {
      useGameStore.setState({ timeOffsetMs: 60_000 });
    });
    expect(screen.getByTestId('queue-meter-cooldown')).toHaveTextContent('完售！下一波 1:30');
  });

  it('只訂閱 queue：棋盤、金幣改變時不重繪', async () => {
    const onRender = jest.fn();
    await render(
      <Profiler id="meter" onRender={onRender}>
        <QueueMeter />
      </Profiler>
    );
    const rendersAfterMount = onRender.mock.calls.length;

    await act(async () => {
      useGameStore.getState().apply((state: GameState) => ({
        ...state,
        coins: state.coins + 100,
        board: [...state.board].reverse(),
      }));
    });

    expect(onRender).toHaveBeenCalledTimes(rendersAfterMount);
  });
});
