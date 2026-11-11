// S3.4：資訊列（UX-DR12）。點選發明菜後顯示名稱、份數與賣出價。
import { fireEvent, render, screen } from '@testing-library/react-native';

import { BOARD_SIZE } from '@/game/content';
import { createGame, type Piece } from '@/game/engine';
import { useGameStore } from '@/game/store';

import { InfoBar } from '../info-bar';

function setBoard(cells: Record<number, Piece>) {
  const board = Array<Piece | null>(BOARD_SIZE).fill(null);
  for (const [cell, piece] of Object.entries(cells)) board[Number(cell)] = piece;
  useGameStore.setState({
    state: { ...createGame(1_000_000, 1), board, nextId: 1000 },
    status: { kind: 'ready' },
  });
}

describe('InfoBar', () => {
  it('沒有選取時顯示操作說明', async () => {
    setBoard({});
    await render(<InfoBar selected={null} onSell={jest.fn()} />);
    expect(screen.getByText('點產生器出食材，拖曳相同品項合成')).toBeTruthy();
  });

  it('發明菜：顯示名稱、份數與一份的賣出價，按下賣出', async () => {
    setBoard({ 5: { id: 1, kind: 'dish', recipe: 'tea-fried', count: 3 } });
    const onSell = jest.fn();
    await render(<InfoBar selected={5} onSell={onSell} />);

    expect(screen.getByText('紅茶鹽酥雞套餐 ×3')).toBeTruthy();
    expect(screen.getByText('賣出 🪙12')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('sell'));
    expect(onSell).toHaveBeenCalledWith(5);
  });

  it('品項：顯示名稱、階數與賣出價；產生器沒有賣出按鈕', async () => {
    setBoard({
      0: { id: 1, kind: 'item', chain: 'tea', level: 3 },
      1: { id: 2, kind: 'generator', chain: 'tea' },
    });
    await render(<InfoBar selected={0} onSell={jest.fn()} />);
    expect(screen.getByText('賣出 🪙4')).toBeTruthy();

    await render(<InfoBar selected={1} onSell={jest.fn()} />);
    expect(screen.queryByTestId('sell')).toBeNull();
  });
});
