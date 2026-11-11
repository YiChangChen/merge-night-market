// S3.2：接上 applyDrop 之後玩家就能做出發明菜，棋盤要能畫出它（正式的份數徽章與冒熱氣在 S3.3）。
import { render, screen } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { BOARD_SIZE } from '@/game/content';
import type { Piece } from '@/game/engine';

import { Board } from '../board';

describe('棋盤上的發明菜（S3.2 最小版本）', () => {
  it('畫得出發明菜，2 份以上顯示 ×份數，1 份不顯示', async () => {
    const board = Array<Piece | null>(BOARD_SIZE).fill(null);
    board[0] = { id: 1, kind: 'dish', recipe: 'tea-fried', count: 2 };
    board[1] = { id: 2, kind: 'dish', recipe: 'dumpling-sweet', count: 1 };
    board[2] = { id: 3, kind: 'item', chain: 'tea', level: 3 };

    await render(
      <GestureHandlerRootView>
        <Board
          board={board}
          cellSize={48}
          selected={null}
          onTapCell={jest.fn()}
          onMove={jest.fn()}
        />
      </GestureHandlerRootView>
    );

    expect(screen.getByText('×2')).toBeTruthy();
    expect(screen.queryByText('×1')).toBeNull();
    // 品項照舊顯示階數
    expect(screen.getByText('3')).toBeTruthy();
  });
});
