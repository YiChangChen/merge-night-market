import { act, render, screen } from '@testing-library/react-native';
import { Profiler } from 'react';

import { createGame, type GameState } from '@/game/engine';
import { useGameStore } from '@/game/store';
import type { StallLevel } from '@/game/types';

import { StallView } from '../stall-view';

const NOW = 1_000_000;

// RNTL 14 的 act 是非同步的，要 await 才會把更新刷到畫面上
async function setTeaLevel(level: StallLevel) {
  await act(async () => {
    useGameStore.setState((store) => ({
      state: store.state && {
        ...store.state,
        stalls: { ...store.state.stalls, tea: { level, signatureDish: null } },
      },
    }));
  });
}

beforeEach(() => {
  useGameStore.setState({ state: createGame(NOW, 1), status: { kind: 'ready' } });
});

describe('StallView', () => {
  it('顯示攤位名稱與老闆（FR16，文字依 docs/content.md）', async () => {
    await render(<StallView chain="tea" animate={false} />);

    expect(screen.getByText('手搖飲吧台')).toBeTruthy();
    expect(screen.getByText('阿珍')).toBeTruthy();
  });

  it('鐵捲門攤位：顯示鐵捲門，霓虹全暗', async () => {
    await render(<StallView chain="noodle" animate={false} />);

    expect(screen.getByTestId('stall-noodle-shutter')).toBeTruthy();
    expect(screen.queryAllByTestId('neon-segment-lit')).toHaveLength(0);
    expect(screen.getAllByTestId('neon-segment-off')).toHaveLength(3);
  });

  it.each([
    [1, 'Lv1 小攤'],
    [2, 'Lv2 店面'],
    [3, 'Lv3 大店'],
  ] as const)('Lv%s：外觀為「%s」，霓虹亮的段數等於等級（FR14）', async (level, label) => {
    await render(<StallView chain="tea" animate={false} />);

    await setTeaLevel(level);

    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getAllByTestId('neon-segment-lit')).toHaveLength(level);
    expect(screen.queryByTestId('stall-tea-shutter')).toBeNull();
  });

  it('只訂閱自己的攤位：棋盤、金幣或其他攤位改變時不重繪', async () => {
    const onRender = jest.fn();
    await render(
      <Profiler id="tea" onRender={onRender}>
        <StallView chain="tea" animate={false} />
      </Profiler>
    );
    const rendersAfterMount = onRender.mock.calls.length;

    await act(async () => {
      useGameStore.getState().apply((state: GameState) => ({
        ...state,
        coins: state.coins + 100,
        board: [...state.board].reverse(),
        stalls: { ...state.stalls, fried: { level: 2, signatureDish: null } },
      }));
    });
    expect(onRender.mock.calls.length).toBe(rendersAfterMount);

    await setTeaLevel(2);
    expect(onRender.mock.calls.length).toBe(rendersAfterMount + 1);
  });
});
