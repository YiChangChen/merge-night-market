// S4.3：一般、貴客、線索三種訂單卡。
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { createGame, type Order } from '@/game/engine';
import { useGameStore } from '@/game/store';

import { OrderCard } from '../order-card';

const NOW = 1_000_000;
const ART = { width: 120, height: 92 };

const normal: Order = {
  id: 12,
  kind: 'normal',
  requirements: [{ chain: 'tea', level: 3 }],
  coins: 20,
  xp: 3,
  energy: 2,
};
// id 9 → VIP_CUSTOMERS[9 % 3] = 富豪
const vip: Order = {
  id: 9,
  kind: 'vip',
  recipe: 'tea-fried',
  requirements: [],
  coins: 132,
  xp: 12,
  energy: 3,
};
const clue: Order = {
  id: 13,
  kind: 'clue',
  recipe: 'fried-sweet',
  requirements: [],
  coins: 0,
  xp: 0,
  energy: 0,
  expiresAt: NOW + 10 * 60 * 1000,
};

let now: jest.SpyInstance<number, []>;

beforeEach(() => {
  jest.useFakeTimers();
  now = jest.spyOn(Date, 'now').mockReturnValue(NOW);
  useGameStore.setState({ state: createGame(NOW, 1), status: { kind: 'ready' }, timeOffsetMs: 0 });
});

afterEach(() => {
  now.mockRestore();
  jest.useRealTimers();
});

async function renderCard(order: Order, ready = false) {
  const onComplete = jest.fn();
  const onDismiss = jest.fn();
  await render(
    <OrderCard
      order={order}
      ready={ready}
      artSize={ART}
      onComplete={onComplete}
      onDismiss={onDismiss}
    />
  );
  return { onComplete, onDismiss };
}

describe('一般單：外觀與行為不變', () => {
  it('品名與獎勵；沒備齊時不能出餐', async () => {
    await renderCard(normal);
    expect(screen.getByText('紅茶')).toBeTruthy();
    expect(screen.getByText('🪙20 ⚡2')).toBeTruthy();
    expect(screen.getByTestId('order')).toBeDisabled();
    expect(screen.queryByTestId('vip-badge')).toBeNull();
  });

  it('備齊後顯示「點我出餐！」並可以出餐', async () => {
    const { onComplete } = await renderCard(normal, true);
    expect(screen.getByText('點我出餐！')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('order'));
    expect(onComplete).toHaveBeenCalledWith(12);
  });
});

describe('貴客單（AC1、AC4）', () => {
  it('貴客徽章、富豪、指定的發明菜與高價金幣', async () => {
    await renderCard(vip);
    expect(screen.getByTestId('vip-badge')).toHaveTextContent('貴客');
    expect(screen.getByText('紅茶鹽酥雞套餐')).toBeTruthy();
    // 體力也照實顯示（E4 code review）
    expect(screen.getByText('🪙132 ⚡3')).toBeTruthy();
    expect(screen.getByLabelText('貴客富豪：紅茶鹽酥雞套餐，132 金幣')).toBeTruthy();
    expect(screen.getByTestId('order')).toBeDisabled();
  });

  it('可以出餐時，讀螢幕軟體也聽得到', async () => {
    await renderCard(vip, true);
    expect(screen.getByLabelText('貴客富豪：紅茶鹽酥雞套餐，132 金幣，可以出餐')).toBeTruthy();
  });

  it('請貴客先走（E4 code review，使用者決定）：觸控區 ≥ 44 pt，按下呼叫 onDismiss', async () => {
    const { onDismiss, onComplete } = await renderCard(vip);
    const button = screen.getByTestId('dismiss-vip');
    // 視覺 22 pt + 四周 hitSlop 12 = 46 pt
    expect(button.props.hitSlop).toBe(12);
    await fireEvent.press(button);
    expect(onDismiss).toHaveBeenCalledWith(9);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('棋盤上有這道菜時可以出餐', async () => {
    const { onComplete } = await renderCard(vip, true);
    expect(screen.getByText('點我出餐！')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('order'));
    expect(onComplete).toHaveBeenCalledWith(9);
  });
});

describe('線索單（AC2）', () => {
  it('對話框顯示台詞與剩餘時間，每秒倒數（含除錯快轉）', async () => {
    await renderCard(clue);
    expect(screen.getByTestId('clue-bubble')).toHaveTextContent(/怎麼有一股甜甜鹹鹹的香味/);
    expect(screen.getByTestId('clue-countdown')).toHaveTextContent('⏳ 10:00');

    now.mockReturnValue(NOW + 1000);
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId('clue-countdown')).toHaveTextContent('⏳ 9:59');

    await act(async () => {
      useGameStore.setState({ timeOffsetMs: 5 * 60 * 1000 });
    });
    expect(screen.getByTestId('clue-countdown')).toHaveTextContent('⏳ 4:59');
  });

  it('「請客人先走」按鈕：觸控區 ≥ 44 pt，按下呼叫 onDismiss', async () => {
    const { onDismiss } = await renderCard(clue);
    const button = screen.getByTestId('dismiss-order');
    expect(button).toHaveTextContent('請客人先走');
    // 視覺高度 40 + 上下 hitSlop 4 = 48
    expect(button.props.hitSlop).toEqual({ top: 4, bottom: 4 });

    await fireEvent.press(button);
    expect(onDismiss).toHaveBeenCalledWith(13);
  });
});
