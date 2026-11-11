// S6.4 實機回饋：教學第 1、2 步依第一張訂單決定指哪裡（訂單不一定是手搖飲）。
import { createGame, type GameState, type Order, type Piece } from '../engine';
import { tutorialFocus, tutorialFocusLine } from '../tutorial-focus';

const NOW = 1_000_000;

const friedOrder = (id: number): Order => ({
  id,
  kind: 'normal',
  requirements: [{ chain: 'fried', level: 2 }],
  coins: 25,
  xp: 2,
  energy: 1,
});

/** 開局棋盤（0 格手搖飲吧台、1 格炸物鍋），三張訂單都要生雞肉（fried L2），和實機截圖相同 */
function game(step: number, items: Record<number, Piece> = {}): GameState {
  const base = createGame(NOW, 1);
  const board = [...base.board];
  for (const [cell, piece] of Object.entries(items)) board[Number(cell)] = piece;
  return {
    ...base,
    board,
    orders: [friedOrder(101), friedOrder(102), friedOrder(103)],
    meta: { ...base.meta, tutorialStep: step },
  };
}

const item = (id: number, chain: 'tea' | 'fried', level: number): Piece => ({
  id,
  kind: 'item',
  chain,
  level,
});

describe('tutorialFocus', () => {
  it('開局棋盤：0 格手搖飲、1 格炸物鍋', () => {
    const board = createGame(NOW, 1).board;
    expect(board[0]).toMatchObject({ kind: 'generator', chain: 'tea' });
    expect(board[1]).toMatchObject({ kind: 'generator', chain: 'fried' });
  });

  it('第 1 步：指向訂單要的那條鏈的產生器（不是第一個產生器）', () => {
    expect(tutorialFocus(game(0))).toEqual({ kind: 'generator', cell: 1, chain: 'fried' });
    expect(tutorialFocusLine(game(0))).toBe('👆 點炸物鍋出食材，把兩個一樣的拖在一起合成');
  });

  it('第 1 步：有一對可以合成時提示合成，訂單要的鏈優先', () => {
    const state = game(0, {
      7: item(1, 'tea', 1),
      8: item(2, 'tea', 1),
      9: item(3, 'fried', 1),
      10: item(4, 'fried', 1),
    });
    expect(tutorialFocus(state)).toEqual({ kind: 'merge', pair: [9, 10] });
    // 只有別條鏈的一對時也提示（這一步只要合成一次）
    expect(tutorialFocus(game(0, { 7: item(1, 'tea', 1), 8: item(2, 'tea', 1) }))).toEqual({
      kind: 'merge',
      pair: [7, 8],
    });
  });

  it('第 2 步（實機情境）：手上只有紅茶，訂單要生雞肉 → 指炸物鍋並說出品項', () => {
    const state = game(1, { 7: item(1, 'tea', 3) });
    expect(tutorialFocus(state)).toEqual({ kind: 'generator', cell: 1, chain: 'fried' });
    expect(tutorialFocusLine(state)).toBe('👆 點炸物鍋做出「生雞肉」，再點訂單出餐');
  });

  it('第 2 步：有兩個地瓜粉 → 提示合成；別條鏈的一對不提示', () => {
    const state = game(1, { 7: item(1, 'fried', 1), 9: item(2, 'fried', 1) });
    expect(tutorialFocus(state)).toEqual({ kind: 'merge', pair: [7, 9] });
    expect(tutorialFocusLine(state)).toBe('👆 合成出「生雞肉」，再點訂單出餐');
    expect(tutorialFocus(game(1, { 7: item(1, 'tea', 1), 8: item(2, 'tea', 1) }))).toEqual({
      kind: 'generator',
      cell: 1,
      chain: 'fried',
    });
  });

  it('第 2 步：已經有生雞肉 → 指做得出來的那張訂單', () => {
    const state = game(1, { 7: item(1, 'fried', 2) });
    expect(tutorialFocus(state)).toEqual({ kind: 'order', index: 0 });
    expect(tutorialFocusLine(state)).toBe('👆 點訂單出餐');
  });

  it('第 3 步之後不管', () => {
    expect(tutorialFocus(game(2))).toBeNull();
    expect(tutorialFocusLine(game(3))).toBeNull();
  });
});
