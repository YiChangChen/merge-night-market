import { act, render, screen } from '@testing-library/react-native';
import { Profiler } from 'react';

import { createGame, type GameState } from '@/game/engine';
import { useGameStore } from '@/game/store';
import type { QueueState } from '@/game/types';

import { StallQueue } from '../stall-queue';

const NOW = 1_000_000;

async function setState(update: (state: GameState) => GameState) {
  await act(async () => {
    useGameStore.setState((store) => ({ state: store.state && update(store.state) }));
  });
}

const withQueue = (queue: Partial<QueueState>) => (state: GameState) => ({
  ...state,
  queue: { ...state.queue, ...queue },
});

const avatars = (chain: string) => screen.queryAllByTestId(`stall-${chain}-queue-avatar`);

beforeEach(() => {
  // 新局：tea、fried 各 Lv1，12 人平均分給兩攤
  useGameStore.setState({ state: createGame(NOW, 1), status: { kind: 'ready' } });
});

describe('StallQueue（S2.3）', () => {
  it('每攤最多畫 4 個頭像，其餘顯示「+k」', async () => {
    await render(<StallQueue chain="tea" animate={false} />);

    expect(avatars('tea')).toHaveLength(4);
    expect(screen.getByTestId('stall-tea-queue-overflow')).toHaveTextContent('+2');
    expect(screen.getByLabelText('排隊 6 人')).toBeTruthy();
  });

  it('出單後人數更新；剩不到 4 人時沒有「+k」', async () => {
    await render(<StallQueue chain="tea" animate={false} />);

    await setState(withQueue({ remaining: 6 }));

    expect(screen.getByLabelText('排隊 3 人')).toBeTruthy();
    expect(avatars('tea')).toHaveLength(3);
    expect(screen.queryByTestId('stall-tea-queue-overflow')).toBeNull();
  });

  it('鐵捲門攤位沒有人排隊', async () => {
    await render(<StallQueue chain="noodle" animate={false} />);

    expect(avatars('noodle')).toHaveLength(0);
    expect(screen.getByLabelText('沒有人排隊')).toBeTruthy();
  });

  it('冷卻中街上沒有排隊；新一波開始時重新入列', async () => {
    await render(<StallQueue chain="tea" animate />);

    await setState(withQueue({ remaining: 0, cooldownEndsAt: NOW + 60_000 }));
    expect(avatars('tea')).toHaveLength(0);

    await setState(withQueue({ wave: 2, remaining: 12, cooldownEndsAt: null }));
    expect(avatars('tea')).toHaveLength(4);
  });

  it('只訂閱這一攤的人數：棋盤、金幣改變時不重繪', async () => {
    const onRender = jest.fn();
    await render(
      <Profiler id="queue" onRender={onRender}>
        <StallQueue chain="tea" animate={false} />
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
