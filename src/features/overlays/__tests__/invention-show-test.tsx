import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { createGame } from '@/game/engine';
import { gameEvents } from '@/game/events';
import { useGameStore } from '@/game/store';

import { DISH_MADE_TOAST_MS } from '../dish-made-toast';
import { startFxController } from '../fx-controller';
import { INVENTION_SHOW_MS, SHOW_TAP_GUARD_MS } from '../invention-show';
import { OverlayHost } from '../overlay-host';
import { useOverlayStore } from '../overlay-store';

const NOW = 1_000_000;

beforeEach(() => {
  jest.useFakeTimers();
  useGameStore.setState({ state: createGame(NOW, 1), status: { kind: 'ready' } });
  useOverlayStore.setState({
    stallPanel: null,
    shutterOpening: {},
    neonPowerOn: {},
    sellout: null,
    invention: null,
    pendingInventions: [],
    dishMade: null,
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('首次發明演出（S3.4、FR25、UX-DR5）', () => {
  it('FxController：第一次發明播全螢幕演出，已發現的配方只給小提示', () => {
    const stop = startFxController();
    gameEvents.emit({ type: 'dish_invented', recipe: 'tea-fried', first: true });
    expect(useOverlayStore.getState().invention).toMatchObject({ recipe: 'tea-fried' });
    expect(useOverlayStore.getState().dishMade).toBeNull();

    useOverlayStore.getState().finishInvention();
    gameEvents.emit({ type: 'dish_invented', recipe: 'tea-fried', first: false });
    stop();

    expect(useOverlayStore.getState().invention).toBeNull();
    expect(useOverlayStore.getState().dishMade).toMatchObject({ recipe: 'tea-fried' });
  });

  it('顯示發明菜名稱、發明的老闆與名字，並保留卡牌的位置', async () => {
    useOverlayStore.getState().playInvention('noodle-dumpling');
    await render(<OverlayHost />);

    expect(screen.getByText('老闆發明！')).toBeTruthy();
    expect(screen.getByText('麵線小籠湯')).toBeTruthy();
    // 麵線小籠湯的負責老闆是林嬸（noodle）
    expect(screen.getByText('林嬸的新菜色')).toBeTruthy();
    expect(screen.getByTestId('invention-card-slot')).toBeTruthy();
    expect(screen.getByLabelText('老闆發明！林嬸做出了麵線小籠湯。點一下繼續')).toBeTruthy();
  });

  it('點一下跳過；遊戲狀態不變', async () => {
    const before = useGameStore.getState().state;
    useOverlayStore.getState().playInvention('tea-fried');
    await render(<OverlayHost />);

    // 剛出現的 0.4 秒內點擊不算（發明後緊接著的點擊不會直接關掉慶祝）
    await fireEvent.press(screen.getByTestId('invention-show'));
    expect(useOverlayStore.getState().invention).not.toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(SHOW_TAP_GUARD_MS);
    });
    await fireEvent.press(screen.getByTestId('invention-show'));

    expect(useOverlayStore.getState().invention).toBeNull();
    expect(useGameStore.getState().state).toBe(before);
  });

  it('沒有點的話時間到自動結束', async () => {
    useOverlayStore.getState().playInvention('tea-fried');
    await render(<OverlayHost />);

    await act(async () => {
      jest.advanceTimersByTime(INVENTION_SHOW_MS);
    });

    expect(useOverlayStore.getState().invention).toBeNull();
  });

  it('連續兩次首次發明：排隊依序播放，第二道不會蓋掉第一道', async () => {
    useOverlayStore.getState().playInvention('tea-fried');
    useOverlayStore.getState().playInvention('fried-sweet');
    await render(<OverlayHost />);

    expect(screen.getByText('紅茶鹽酥雞套餐')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(INVENTION_SHOW_MS);
    });
    expect(screen.getByText('甜鹹地瓜雞')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(INVENTION_SHOW_MS);
    });
    expect(useOverlayStore.getState().invention).toBeNull();
    expect(useOverlayStore.getState().pendingInventions).toEqual([]);
  });

  it('小提示不擋操作，時間到自動消失', async () => {
    useOverlayStore.getState().showDishMade('fried-sweet');
    // 實際 App 由 expo-router 的根層提供 SafeAreaProvider
    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <OverlayHost />
      </SafeAreaProvider>
    );

    const toast = screen.getByTestId('dish-made-toast');
    expect(toast.props.pointerEvents).toBe('none');
    expect(screen.getByText('又做出一份 甜鹹地瓜雞！')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(DISH_MADE_TOAST_MS);
    });
    expect(useOverlayStore.getState().dishMade).toBeNull();
  });

  it('返回鍵依序關閉：發明演出 → 完售演出 → 攤位面板', async () => {
    const { BackHandler } = jest.requireActual<typeof import('react-native')>('react-native');
    const listeners: (() => boolean)[] = [];
    const spy = jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((_event, handler) => {
        listeners.push(handler as () => boolean);
        return { remove: jest.fn() };
      });
    useOverlayStore.setState({ stallPanel: 'tea' });
    useOverlayStore.getState().playSellout(1);
    useOverlayStore.getState().playInvention('tea-fried');
    await render(<OverlayHost />);

    const back = async () => {
      await act(async () => {
        listeners[listeners.length - 1]();
      });
    };
    await back();
    expect(useOverlayStore.getState().invention).toBeNull();
    expect(useOverlayStore.getState().sellout).not.toBeNull();
    await back();
    expect(useOverlayStore.getState().sellout).toBeNull();
    expect(useOverlayStore.getState().stallPanel).toBe('tea');
    await back();
    expect(useOverlayStore.getState().stallPanel).toBeNull();
    spy.mockRestore();
  });
});
