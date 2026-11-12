// S6.4 實機回饋：教學完成後的合成小提示 —— 棋盤停著一段時間，可以合成的一對會晃動。
import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Board } from '@/features/board';
import { BALANCE } from '@/game/content';
import { createGame, type Piece } from '@/game/engine';
import { useGameStore } from '@/game/store';

import { IDLE_HINT_MS, useIdleMergePair } from '../merge-hint';

const NOW = 1_000_000;

/** 第 9、12 格放一對紅茶 L1（可以合成） */
function setGame(step: number, pair = true) {
  const base = createGame(NOW, 1);
  const board: (Piece | null)[] = [...base.board];
  if (pair) {
    board[9] = { id: 901, kind: 'item', chain: 'tea', level: 1 };
    board[12] = { id: 902, kind: 'item', chain: 'tea', level: 1 };
  }
  useGameStore.setState({
    state: { ...base, board, meta: { ...base.meta, tutorialStep: step } },
    status: { kind: 'ready' },
  });
}

function Probe({ active }: { active: boolean }) {
  const pair = useIdleMergePair(active);
  return <Text testID="pair">{pair ? pair.join(',') : 'none'}</Text>;
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useIdleMergePair', () => {
  it('教學完成後：棋盤停著 6 秒才回傳那一對；棋盤一變動就清掉並重新計時', async () => {
    setGame(BALANCE.tutorialSteps);
    await render(<Probe active />);
    expect(screen.getByTestId('pair')).toHaveTextContent('none');

    await act(async () => jest.advanceTimersByTime(IDLE_HINT_MS - 1));
    expect(screen.getByTestId('pair')).toHaveTextContent('none');
    await act(async () => jest.advanceTimersByTime(1));
    expect(screen.getByTestId('pair')).toHaveTextContent('9,12');

    await act(async () => {
      useGameStore.setState((store) => ({
        state: store.state && { ...store.state, board: [...store.state.board] },
      }));
    });
    expect(screen.getByTestId('pair')).toHaveTextContent('none');
    await act(async () => jest.advanceTimersByTime(IDLE_HINT_MS));
    expect(screen.getByTestId('pair')).toHaveTextContent('9,12');
  });

  it('教學第 3 步（升級攤位）也有；第 1、2 步由手指層的圈兩格負責，不重複', async () => {
    setGame(2);
    await render(<Probe active />);
    await act(async () => jest.advanceTimersByTime(IDLE_HINT_MS));
    expect(screen.getByTestId('pair')).toHaveTextContent('9,12');

    await act(async () => setGame(1));
    await act(async () => jest.advanceTimersByTime(IDLE_HINT_MS * 2));
    expect(screen.getByTestId('pair')).toHaveTextContent('none');
  });

  it('棋盤不在前景或有演出蓋住（active 為 false）、或沒有可以合成的一對時，都不提示', async () => {
    setGame(BALANCE.tutorialSteps);
    await render(<Probe active={false} />);
    await act(async () => jest.advanceTimersByTime(IDLE_HINT_MS * 2));
    expect(screen.getByTestId('pair')).toHaveTextContent('none');

    await act(async () => setGame(BALANCE.tutorialSteps, false));
    await render(<Probe active />);
    await act(async () => jest.advanceTimersByTime(IDLE_HINT_MS * 2));
    expect(screen.getAllByTestId('pair').every((node) => node.props.children === 'none')).toBe(
      true
    );
  });
});

describe('棋盤晃動 hintCells', () => {
  it('只有提示的那兩格會晃', async () => {
    setGame(BALANCE.tutorialSteps);
    const board = useGameStore.getState().state?.board ?? [];
    await render(
      <GestureHandlerRootView>
        <Board
          board={board}
          cellSize={48}
          selected={null}
          onTapCell={jest.fn()}
          onMove={jest.fn()}
          hintCells={[9, 12]}
        />
      </GestureHandlerRootView>
    );

    expect(screen.getByTestId('wobble-9')).toBeTruthy();
    expect(screen.getByTestId('wobble-12')).toBeTruthy();
    expect(screen.queryByTestId('wobble-0')).toBeNull();
  });
});

describe('useIdleMergePair（E6 code review）', () => {
  it('被蓋住後再回到前景：重新等 6 秒，不會馬上晃', async () => {
    setGame(BALANCE.tutorialSteps);
    await render(<Probe active />);
    await act(async () => jest.advanceTimersByTime(IDLE_HINT_MS));
    expect(screen.getByTestId('pair')).toHaveTextContent('9,12');

    // 同一個元件：被蓋住（active false）再回到前景
    await screen.rerender(<Probe active={false} />);
    await screen.rerender(<Probe active />);
    expect(screen.getByTestId('pair')).toHaveTextContent('none');
    await act(async () => jest.advanceTimersByTime(IDLE_HINT_MS));
    expect(screen.getByTestId('pair')).toHaveTextContent('9,12');
  });
});
