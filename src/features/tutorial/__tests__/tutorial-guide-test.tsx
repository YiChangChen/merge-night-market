// S6.4：新手手指引導（FR40、UX-DR11）。
import { act, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { InfoBar } from '@/features/board';
import { useOverlayStore } from '@/features/overlays';
import { BALANCE } from '@/game/content';
import { createGame, type Order, type Piece } from '@/game/engine';
import { useGameStore } from '@/game/store';

import { TutorialGuide } from '../tutorial-guide';
import { TutorialLine, tutorialLine } from '../tutorial-line';
import { useTutorialTargets } from '../tutorial-targets';

const NOW = 1_000_000;
const BOARD = { x: 10, y: 300, width: 350, height: 400 };
const ORDER = { x: 20, y: 120, width: 110, height: 140 };
const TAB = { x: 200, y: 780, width: 190, height: 60 };
const STALL_TEA = { x: 30, y: 200, width: 220, height: 400 };
const UPGRADE = { x: 60, y: 500, width: 260, height: 48 };

/** 三張訂單都要炸物 L2（生雞肉）；開局棋盤 0 格手搖飲吧台、1 格炸物鍋 */
const FRIED_ORDERS: Order[] = [101, 102, 103].map((id) => ({
  id,
  kind: 'normal',
  requirements: [{ chain: 'fried', level: 2 }],
  coins: 25,
  xp: 2,
  energy: 1,
}));

function setGame(step: number, coins = 0, items: Record<number, Piece> = {}) {
  const base = createGame(NOW, 1);
  const board: (Piece | null)[] = [...base.board];
  for (const [cell, piece] of Object.entries(items)) board[Number(cell)] = piece;
  useGameStore.setState({
    state: {
      ...base,
      board,
      orders: FRIED_ORDERS,
      coins,
      meta: { ...base.meta, tutorialStep: step },
    },
    status: { kind: 'ready' },
  });
}

/** 在第 9、12 格放一對紅茶 L1（可以合成） */
function withPair(step: number) {
  setGame(step, 0, {
    9: { id: 901, kind: 'item', chain: 'tea', level: 1 },
    12: { id: 902, kind: 'item', chain: 'tea', level: 1 },
  });
}

function ringsAt() {
  return screen.getAllByTestId('merge-hint-ring').map((ring) => {
    const style = StyleSheet.flatten(ring.props.style);
    return { left: style.left, top: style.top };
  });
}

function fingerAt() {
  const style = StyleSheet.flatten(screen.getByTestId('tutorial-finger').props.style);
  return { left: style.left, top: style.top };
}

beforeEach(() => {
  useOverlayStore.getState().reset();
  useTutorialTargets.setState({
    rects: { board: BOARD, 'order-0': ORDER, 'tab-street': TAB },
    remeasureToken: 0,
  });
});

describe('手指指向這一步的目標', () => {
  it('第 1 步：指向訂單要的產生器（訂單要生雞肉 → 第 1 格炸物鍋）；整層不擋觸控', async () => {
    setGame(0);
    await render(<TutorialGuide />);

    // 炸物鍋在第 1 格：格寬 350 / 7 = 50，手指中心對準格子中心，指尖在中心
    expect(fingerAt()).toEqual({ left: 10 + 50 + 25 - 20, top: 300 + 25 });
    expect(screen.getByTestId('tutorial-guide').props.pointerEvents).toBe('none');
  });

  it('第 2 步：還沒有生雞肉時指炸物鍋；做出來後指那張訂單（實機回饋）', async () => {
    setGame(1, 0, { 7: { id: 701, kind: 'item', chain: 'tea', level: 3 } });
    await render(<TutorialGuide />);
    expect(fingerAt()).toEqual({ left: 10 + 50 + 25 - 20, top: 300 + 25 });

    await act(async () =>
      setGame(1, 0, { 7: { id: 702, kind: 'item', chain: 'fried', level: 2 } })
    );
    expect(fingerAt()).toEqual({ left: 20 + 55 - 20, top: 120 + 70 });
  });

  it('第 3 步：金幣不夠時不指；夠了先指夜市街分頁，再指攤位，面板開著時指升級按鈕', async () => {
    setGame(2, 199);
    await render(<TutorialGuide />);
    expect(screen.queryByTestId('tutorial-finger')).toBeNull();

    await act(async () => setGame(2, 200));
    expect(fingerAt()).toEqual({ left: 200 + 95 - 20, top: 780 + 30 });

    await act(async () => {
      useTutorialTargets.getState().setRect('stall-tea', STALL_TEA);
    });
    expect(fingerAt()).toEqual({ left: 30 + 110 - 20, top: 200 + 200 });

    await act(async () => {
      useTutorialTargets.getState().setRect('upgrade', UPGRADE);
      useOverlayStore.getState().openStallPanel('tea');
    });
    expect(fingerAt()).toEqual({ left: 60 + 130 - 20, top: 500 + 24 });
  });

  it('攤位面板開著時，第 1、2 步不顯示手指', async () => {
    setGame(1);
    useOverlayStore.getState().openStallPanel('noodle');
    await render(<TutorialGuide />);

    expect(screen.queryByTestId('tutorial-finger')).toBeNull();
  });

  it('有全螢幕演出（完售、發明、阿嬤）時隱藏', async () => {
    setGame(0);
    await render(<TutorialGuide />);
    expect(screen.getByTestId('tutorial-finger')).toBeTruthy();

    await act(async () => useOverlayStore.getState().playSellout(1));
    expect(screen.queryByTestId('tutorial-finger')).toBeNull();
    await act(async () => useOverlayStore.getState().finishSellout());
    await act(async () => useOverlayStore.getState().playInvention('tea-fried'));
    expect(screen.queryByTestId('tutorial-finger')).toBeNull();
    await act(async () => useOverlayStore.getState().finishInvention());
    // 阿嬤提示、升星演出（E6 code review）
    await act(async () => useOverlayStore.getState().playHint('tea-fried'));
    expect(screen.queryByTestId('tutorial-finger')).toBeNull();
    await act(async () => useOverlayStore.getState().finishHint());
    await act(async () => useOverlayStore.getState().playStarred('tea-fried', 2));
    expect(screen.queryByTestId('tutorial-finger')).toBeNull();
    await act(async () => useOverlayStore.getState().finishStarred());
    expect(screen.getByTestId('tutorial-finger')).toBeTruthy();
  });

  it('體力不足的提示卡開著時讓開（S6.2 實機回饋）', async () => {
    withPair(0);
    await render(<TutorialGuide />);
    expect(screen.getByTestId('merge-hint')).toBeTruthy();

    await act(async () => useOverlayStore.getState().openEnergyPrompt());
    expect(screen.queryByTestId('merge-hint')).toBeNull();
    await act(async () => useOverlayStore.getState().closeEnergyPrompt());
    expect(screen.getByTestId('merge-hint')).toBeTruthy();
  });

  it('目標還沒登記（所在畫面不在前景）時不顯示', async () => {
    useTutorialTargets.setState({ rects: {} });
    setGame(1);
    await render(<TutorialGuide />);

    expect(screen.queryByTestId('tutorial-finger')).toBeNull();
  });

  it('教學完成後什麼都不顯示', async () => {
    setGame(BALANCE.tutorialSteps, 999);
    await render(<TutorialGuide />);

    expect(screen.queryByTestId('tutorial-guide')).toBeNull();
  });
});

describe('說明文字', () => {
  it('每一步一句；第 3 步金幣不夠時顯示目前進度', () => {
    expect(tutorialLine(0, 0)).toContain('合成');
    expect(tutorialLine(1, 0)).toContain('出餐');
    expect(tutorialLine(2, 120)).toBe('存到 200 金幣就能升級攤位（目前 120/200）');
    expect(tutorialLine(2, 200)).toContain('夜市街');
    expect(tutorialLine(3, 999)).toBeNull();
  });

  it('棋盤資訊列：教學期間沒有選取時顯示這一步的說明；完成後恢復原本的提示', async () => {
    setGame(1);
    await render(<InfoBar selected={null} onSell={() => {}} />);
    // 第 2 步依第一張訂單說出要做什麼（訂單要生雞肉）
    expect(screen.getByTestId('info-bar-hint')).toHaveTextContent(
      '👆 點炸物鍋做出「生雞肉」，再點訂單出餐'
    );

    await act(async () => setGame(BALANCE.tutorialSteps));
    expect(screen.getByTestId('info-bar-hint')).toHaveTextContent(
      '點產生器出食材，拖曳相同品項合成'
    );
  });

  it('夜市街的說明列只在第 3 步出現，不擋觸控', async () => {
    setGame(1);
    await render(<TutorialLine steps={[2]} />);
    expect(screen.queryByTestId('tutorial-line')).toBeNull();

    await act(async () => setGame(2, 50));
    expect(screen.getByTestId('tutorial-line')).toHaveTextContent(
      '存到 200 金幣就能升級攤位（目前 50/200）'
    );
    expect(screen.getByTestId('tutorial-line').props.pointerEvents).toBe('none');
  });
});

describe('合成提示', () => {
  it('第 1 步：棋盤上有一對相同品項時，不再指產生器，改成圈出那兩格', async () => {
    withPair(0);
    await render(<TutorialGuide />);

    expect(screen.queryByTestId('tutorial-finger')).toBeNull();
    // 格寬 50：第 9 格在第 2 列第 3 欄、第 12 格在第 2 列第 6 欄
    expect(ringsAt()).toEqual([
      { left: 10 + 2 * 50, top: 300 + 50 },
      { left: 10 + 5 * 50, top: 300 + 50 },
    ]);
    expect(screen.getByTestId('merge-hint').props.pointerEvents).toBe('none');
  });

  it('教學完成後，手指層不再顯示合成提示（改由棋盤晃動那一對，見 merge-hint-test）', async () => {
    withPair(BALANCE.tutorialSteps);
    await render(<TutorialGuide />);
    expect(screen.queryByTestId('merge-hint')).toBeNull();
  });
});

describe('第 3 步的夜市街分頁按鈕（E6 code review）', () => {
  it('棋盤畫面不在前景（收藏冊、設定等疊在上面，棋盤目標沒有登記）時不指分頁按鈕', async () => {
    useTutorialTargets.setState({ rects: { 'tab-street': TAB } });
    setGame(2, 200);
    await render(<TutorialGuide />);
    expect(screen.queryByTestId('tutorial-finger')).toBeNull();
  });
});
