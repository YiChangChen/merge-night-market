// S5.3：升星演出（卡牌加上新的星等；★5 換金框）。
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { createGame } from '@/game/engine';
import { gameEvents } from '@/game/events';
import { useGameStore } from '@/game/store';

import { startFxController } from '../fx-controller';
import { OverlayHost } from '../overlay-host';
import { useOverlayStore } from '../overlay-store';
import { GOLD_SHOW_MS, STAR_SHOW_MS, STAR_SWAP_MS } from '../star-show';

const NOW = 1_000_000;

beforeEach(() => {
  jest.useFakeTimers();
  useGameStore.setState({ state: createGame(NOW, 1), status: { kind: 'ready' } });
  useOverlayStore.getState().reset();
});

afterEach(() => {
  jest.useRealTimers();
});

async function renderHost() {
  await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}>
      <OverlayHost />
    </SafeAreaProvider>
  );
}

describe('FxController：card_starred', () => {
  it('播升星演出，並收掉同一次製作的小提示', () => {
    const stop = startFxController();
    // drop.ts 的順序：先 dish_invented（小提示），再 card_starred
    gameEvents.emit({ type: 'dish_invented', recipe: 'tea-fried', first: false });
    gameEvents.emit({ type: 'card_starred', recipe: 'tea-fried', stars: 3 });
    stop();

    expect(useOverlayStore.getState().starred).toMatchObject({ recipe: 'tea-fried', stars: 3 });
    expect(useOverlayStore.getState().dishMade).toBeNull();
  });

  it('升星演出要排隊時保留小提示，這次製作才有即時回饋', () => {
    useOverlayStore.getState().playStarred('fried-sweet', 2);
    const stop = startFxController();
    gameEvents.emit({ type: 'dish_invented', recipe: 'tea-fried', first: false });
    gameEvents.emit({ type: 'card_starred', recipe: 'tea-fried', stars: 3 });
    stop();

    expect(useOverlayStore.getState().dishMade).toMatchObject({ recipe: 'tea-fried' });
    expect(useOverlayStore.getState().pendingStarred).toEqual([{ recipe: 'tea-fried', stars: 3 }]);
  });

  it('reset 會清掉升星演出與排隊', () => {
    useOverlayStore.getState().playStarred('tea-fried', 2);
    useOverlayStore.getState().playStarred('fried-sweet', 3);
    useOverlayStore.getState().reset();

    expect(useOverlayStore.getState().starred).toBeNull();
    expect(useOverlayStore.getState().pendingStarred).toEqual([]);
  });
});

describe('升星演出（S5.3）', () => {
  it('先顯示舊星等，再換成新星等；一般框', async () => {
    useOverlayStore.getState().playStarred('tea-fried', 3);
    await renderHost();

    expect(screen.getByText('★3 升星！')).toBeTruthy();
    expect(screen.getByText('★★☆☆☆')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(STAR_SWAP_MS);
    });
    expect(screen.getByText('★★★☆☆')).toBeTruthy();
    expect(screen.getByTestId('card-frame-normal-tea-fried')).toBeTruthy();
    expect(screen.queryByText('★3 金框解鎖！')).toBeNull();
    expect(screen.getByLabelText('紅茶鹽酥雞套餐 升到 3 星。點卡牌跳過')).toBeTruthy();
  });

  it('★5：從一般框換成金框，並顯示金框解鎖', async () => {
    useOverlayStore.getState().playStarred('tea-fried', 5);
    await renderHost();

    expect(screen.getByTestId('card-frame-normal-tea-fried')).toBeTruthy();
    expect(screen.queryByText('★5 金框解鎖！')).toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(STAR_SWAP_MS);
    });
    expect(screen.getByTestId('card-frame-gold-tea-fried')).toBeTruthy();
    expect(screen.getByText('★5 金框解鎖！')).toBeTruthy();
  });

  it('點卡牌跳過；遊戲狀態不變', async () => {
    const before = useGameStore.getState().state;
    useOverlayStore.getState().playStarred('tea-fried', 2);
    await renderHost();

    await fireEvent.press(screen.getByTestId('star-show-card'));

    expect(useOverlayStore.getState().starred).toBeNull();
    expect(useGameStore.getState().state).toBe(before);
  });

  it('不擋操作：只有卡牌本身能點，橫幅與外層都讓觸控穿透', async () => {
    useOverlayStore.getState().playStarred('tea-fried', 2);
    await renderHost();

    expect(screen.getByTestId('star-show').props.pointerEvents).toBe('box-none');
    expect(screen.getByTestId('star-show-panel').props.pointerEvents).toBe('box-none');
  });

  it('首次發明演出播放時，升星演出先等，發明演出結束後才播', async () => {
    useOverlayStore.getState().playInvention('fried-sweet');
    useOverlayStore.getState().playStarred('tea-fried', 3);
    await renderHost();

    expect(screen.getByTestId('invention-show')).toBeTruthy();
    // 發明演出是 accessibilityViewIsModal，同層元素預設查不到，要連隱藏的一起查
    expect(screen.queryByTestId('star-show', { includeHiddenElements: true })).toBeNull();

    await act(async () => {
      useOverlayStore.getState().finishInvention();
    });
    expect(screen.getByTestId('star-show')).toBeTruthy();
  });

  it('時間到自動結束；★5 播比較久', async () => {
    useOverlayStore.getState().playStarred('tea-fried', 4);
    await renderHost();
    await act(async () => {
      jest.advanceTimersByTime(STAR_SHOW_MS);
    });
    expect(useOverlayStore.getState().starred).toBeNull();

    await act(async () => {
      useOverlayStore.getState().playStarred('tea-fried', 5);
    });
    await act(async () => {
      jest.advanceTimersByTime(STAR_SHOW_MS);
    });
    expect(useOverlayStore.getState().starred).not.toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(GOLD_SHOW_MS - STAR_SHOW_MS);
    });
    expect(useOverlayStore.getState().starred).toBeNull();
  });

  it('連續升星：排隊依序播放', async () => {
    useOverlayStore.getState().playStarred('tea-fried', 2);
    useOverlayStore.getState().playStarred('fried-sweet', 3);
    await renderHost();

    expect(screen.getByText('★2 升星！')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(STAR_SHOW_MS);
    });
    expect(screen.getByText('★3 升星！')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(STAR_SHOW_MS);
    });
    expect(useOverlayStore.getState().starred).toBeNull();
    expect(useOverlayStore.getState().pendingStarred).toEqual([]);
  });
});
