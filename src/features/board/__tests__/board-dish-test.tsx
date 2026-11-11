// S3.2／S3.3：棋盤上的發明菜（份數徽章）與冒熱氣。
import { render, screen, within } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { BOARD_SIZE } from '@/game/content';
import type { Piece } from '@/game/engine';

import { Board } from '../board';

async function renderBoard(cells: Record<number, Piece>, animate = true) {
  const board = Array<Piece | null>(BOARD_SIZE).fill(null);
  for (const [cell, piece] of Object.entries(cells)) board[Number(cell)] = piece;
  await render(
    <GestureHandlerRootView>
      <Board
        board={board}
        cellSize={48}
        selected={null}
        onTapCell={jest.fn()}
        onMove={jest.fn()}
        animate={animate}
      />
    </GestureHandlerRootView>
  );
}

describe('棋盤上的發明菜（UX-DR6、FR23）', () => {
  it('2 份以上在右下角顯示 ×份數，1 份不顯示；品項照舊顯示階數', async () => {
    await renderBoard({
      0: { id: 1, kind: 'dish', recipe: 'tea-fried', count: 2 },
      1: { id: 2, kind: 'dish', recipe: 'dumpling-sweet', count: 1 },
      2: { id: 3, kind: 'item', chain: 'tea', level: 3 },
    });

    expect(screen.getByText('×2')).toBeTruthy();
    expect(screen.queryByText('×1')).toBeNull();
    expect(screen.getByText('3')).toBeTruthy();
  });
});

describe('冒熱氣（UX-DR9）', () => {
  const steamIn = (cell: number) =>
    within(screen.getByTestId(`cell-${cell}`)).queryAllByTestId('steam').length;

  it('L4 以上的品項與發明菜冒熱氣；L3 與產生器不冒', async () => {
    await renderBoard({
      0: { id: 1, kind: 'item', chain: 'tea', level: 3 },
      1: { id: 2, kind: 'item', chain: 'tea', level: 4 },
      2: { id: 3, kind: 'dish', recipe: 'tea-fried', count: 1 },
      3: { id: 4, kind: 'generator', chain: 'fried' },
    });

    expect(steamIn(0)).toBe(0);
    expect(steamIn(1)).toBe(1);
    expect(steamIn(2)).toBe(1);
    expect(steamIn(3)).toBe(0);
  });

  it('棋盤失焦（animate = false）時不冒熱氣', async () => {
    await renderBoard(
      {
        1: { id: 2, kind: 'item', chain: 'tea', level: 5 },
        2: { id: 3, kind: 'dish', recipe: 'tea-fried', count: 3 },
      },
      false
    );

    expect(screen.queryByTestId('steam')).toBeNull();
  });
});
