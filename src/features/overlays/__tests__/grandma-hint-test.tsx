// S4.4：阿嬤保底提示（UX-DR7）。
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RECIPE_IDS } from '@/game/content';
import { createGame } from '@/game/engine';
import { gameEvents } from '@/game/events';
import { useGameStore } from '@/game/store';

import { HINT_AFTER_UPGRADE_MS, startFxController } from '../fx-controller';
import { HINT_TAP_GUARD_MS, hintLine } from '../grandma-hint';
import { OverlayHost } from '../overlay-host';
import { useOverlayStore } from '../overlay-store';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

async function renderHost() {
  // 實際 App 由 expo-router 的根層提供 SafeAreaProvider
  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <OverlayHost />
    </SafeAreaProvider>
  );
}

beforeEach(() => {
  jest.useFakeTimers();
  useGameStore.setState({ state: createGame(1_000_000, 1), status: { kind: 'ready' } });
  useOverlayStore.setState({
    stallPanel: null,
    shutterOpening: {},
    neonPowerOn: {},
    sellout: null,
    invention: null,
    pendingInventions: [],
    dishMade: null,
    hint: null,
    pendingHints: [],
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('阿嬤保底提示（S4.4、UX-DR7）', () => {
  it('台詞直接說出兩個材料（口吻依 docs/content.md）；10 道配方都有', () => {
    expect(hintLine('tea-fried')).toBe('憨孫，紅茶配鹽酥雞啦！');
    expect(hintLine('dumpling-sweet')).toBe('憨孫，蒸籠拼盤配芒果冰啦！');
    for (const recipe of RECIPE_IDS) expect(hintLine(recipe)).toMatch(/^憨孫，.+配.+啦！$/);
  });

  it('FxController 收到 hint_shown 就讓阿嬤出現，顯示台詞與菜名', async () => {
    const stop = startFxController();
    gameEvents.emit({ type: 'hint_shown', recipe: 'tea-fried' });
    stop();
    await renderHost();

    expect(screen.getByTestId('grandma-line')).toHaveTextContent('憨孫，紅茶配鹽酥雞啦！');
    expect(screen.getByText('拖在一起試試看，就是「紅茶鹽酥雞套餐」')).toBeTruthy();
    expect(screen.getByLabelText('阿嬤的提示，點一下關閉')).toBeTruthy();
  });

  it('點一下關閉（剛出現的 0.4 秒內不算）；遊戲狀態不變', async () => {
    const before = useGameStore.getState().state;
    useOverlayStore.getState().playHint('tea-fried');
    await renderHost();

    await fireEvent.press(screen.getByTestId('grandma-hint'));
    expect(useOverlayStore.getState().hint).not.toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(HINT_TAP_GUARD_MS);
    });
    await fireEvent.press(screen.getByTestId('grandma-hint'));
    expect(useOverlayStore.getState().hint).toBeNull();
    expect(useGameStore.getState().state).toBe(before);
  });

  it('同時兩道提示時排隊，依序說完', async () => {
    useOverlayStore.getState().playHint('tea-fried');
    useOverlayStore.getState().playHint('tea-noodle');
    await renderHost();
    expect(screen.getByTestId('grandma-line')).toHaveTextContent('憨孫，紅茶配鹽酥雞啦！');

    await act(async () => {
      jest.advanceTimersByTime(HINT_TAP_GUARD_MS);
    });
    await fireEvent.press(screen.getByTestId('grandma-hint'));
    expect(screen.getByTestId('grandma-line')).toHaveTextContent('憨孫，鮮奶茶配蚵仔麵線啦！');
  });

  it('返回鍵先關阿嬤提示，再關底下的攤位面板', async () => {
    const { BackHandler } = jest.requireActual<typeof import('react-native')>('react-native');
    const listeners: (() => boolean)[] = [];
    const spy = jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((_event, handler) => {
        listeners.push(handler as () => boolean);
        return { remove: jest.fn() };
      });
    useOverlayStore.setState({ stallPanel: 'tea' });
    useOverlayStore.getState().playHint('tea-fried');
    await renderHost();

    await act(async () => {
      listeners[listeners.length - 1]();
    });
    expect(useOverlayStore.getState().hint).toBeNull();
    expect(useOverlayStore.getState().stallPanel).toBe('tea');
    spy.mockRestore();
  });
});

describe('E4 code review：演出時機與開新局', () => {
  it('升級攤位同時出現的教學提示，延到招牌通電演出之後才顯示', async () => {
    const stop = startFxController();
    gameEvents.emit({ type: 'stall_upgraded', stall: 'fried', level: 2 });
    gameEvents.emit({ type: 'hint_shown', recipe: 'tea-fried' });
    expect(useOverlayStore.getState().hint).toBeNull();

    await act(async () => {
      await Promise.resolve();
      jest.advanceTimersByTime(HINT_AFTER_UPGRADE_MS);
    });
    expect(useOverlayStore.getState().hint).toMatchObject({ recipe: 'tea-fried' });

    // 之後的提示（不是跟著升級）立刻顯示
    useOverlayStore.getState().finishHint();
    gameEvents.emit({ type: 'hint_shown', recipe: 'tea-noodle' });
    expect(useOverlayStore.getState().hint).toMatchObject({ recipe: 'tea-noodle' });
    stop();
  });

  it('reset 清掉所有面板、演出與排隊', () => {
    useOverlayStore.setState({ stallPanel: 'tea' });
    useOverlayStore.getState().playHint('tea-fried');
    useOverlayStore.getState().playHint('tea-noodle');
    useOverlayStore.getState().playInvention('tea-fried');
    useOverlayStore.getState().playInvention('fried-sweet');
    useOverlayStore.getState().reset();

    expect(useOverlayStore.getState()).toMatchObject({
      stallPanel: null,
      hint: null,
      pendingHints: [],
      invention: null,
      pendingInventions: [],
      sellout: null,
      dishMade: null,
    });
  });
});
