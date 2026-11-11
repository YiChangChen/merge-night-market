import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { BALANCE } from '@/game/content';
import { createGame } from '@/game/engine';
import { useGameStore } from '@/game/store';

import { DebugPanel } from '../debug-panel';

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(async () => true),
  getStringAsync: jest.fn(async () => ''),
}));

const NOW = 1_000_000;
let now: jest.SpyInstance<number, []>;

beforeEach(() => {
  now = jest.spyOn(Date, 'now').mockReturnValue(NOW);
  useGameStore.setState({
    state: { ...createGame(NOW, 1), energy: 50, energyUpdatedAt: NOW },
    status: { kind: 'ready' },
    timeOffsetMs: 0,
  });
});

afterEach(() => now.mockRestore());

describe('DebugPanel（S1.8）', () => {
  it('加金幣、加體力透過規則函式寫入 store', async () => {
    await render(<DebugPanel />);

    await fireEvent.press(screen.getByTestId('debug-coins-1000'));
    await fireEvent.press(screen.getByTestId('debug-energy-20'));

    expect(useGameStore.getState().state?.coins).toBe(1000);
    expect(useGameStore.getState().state?.energy).toBe(70);
  });

  it('人龍狀態：剩最後 1 位；完售後顯示冷卻中，快轉超過冷卻就開新一波（S2.1）', async () => {
    await render(<DebugPanel />);
    expect(screen.getByTestId('debug-queue')).toHaveTextContent('第 1 波 已出單 0/12');

    await fireEvent.press(screen.getByTestId('debug-queue-last'));
    expect(screen.getByTestId('debug-queue')).toHaveTextContent('第 1 波 已出單 11/12');

    await act(async () => {
      useGameStore.setState((store) => ({
        state: store.state && {
          ...store.state,
          queue: {
            ...store.state.queue,
            remaining: 0,
            cooldownEndsAt: NOW + BALANCE.queueCooldownMs,
          },
        },
      }));
    });
    expect(screen.getByTestId('debug-queue')).toHaveTextContent('第 1 波 已完售，冷卻中');

    await fireEvent.press(screen.getByTestId('debug-time-10m'));
    expect(screen.getByTestId('debug-queue')).toHaveTextContent('第 2 波 已出單 0/12');
  });

  it('調整玩家等級與攤位等級', async () => {
    await render(<DebugPanel />);

    await fireEvent.press(screen.getByTestId('debug-level-up'));
    await fireEvent.press(screen.getByTestId('debug-stall-noodle-up'));
    await fireEvent.press(screen.getByTestId('debug-stall-noodle-up'));

    expect(useGameStore.getState().state?.level).toBe(2);
    expect(useGameStore.getState().state?.stalls.noodle.level).toBe(2);
    expect(screen.getByTestId('debug-stall-noodle-level')).toHaveTextContent('Lv2');
  });

  it('攤位等級不會低於 0 或高於 3', async () => {
    await render(<DebugPanel />);

    await fireEvent.press(screen.getByTestId('debug-stall-sweet-down'));
    for (let i = 0; i < 5; i++) await fireEvent.press(screen.getByTestId('debug-stall-tea-up'));

    expect(useGameStore.getState().state?.stalls.sweet.level).toBe(0);
    expect(useGameStore.getState().state?.stalls.tea.level).toBe(3);
  });

  it('時間快轉：偏移量注入 syncAll，體力依快轉時間回復', async () => {
    await render(<DebugPanel />);

    await fireEvent.press(screen.getByTestId('debug-time-10m'));

    expect(useGameStore.getState().timeOffsetMs).toBe(10 * 60 * 1000);
    expect(useGameStore.getState().state?.energy).toBe(
      50 + (10 * 60 * 1000) / BALANCE.energyRegenMs
    );
  });

  it('從空的剪貼簿匯入時顯示拒絕原因', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await render(<DebugPanel />);

    await fireEvent.press(screen.getByTestId('debug-import'));

    expect(await screen.findByText('拒絕匯入：剪貼簿是空的')).toBeTruthy();
    warn.mockRestore();
  });
});

it('開局攤位的 − 不會把攤位調成鐵捲門（code review 2026-11-10）', async () => {
  await render(<DebugPanel />);

  await fireEvent.press(screen.getByTestId('debug-stall-tea-down'));

  expect(useGameStore.getState().state?.stalls.tea.level).toBe(1);
});

describe('開新局（S4.4）', () => {
  const { Alert } = jest.requireActual<typeof import('react-native')>('react-native');

  it('確認後先備份到剪貼簿，再換成全新的一局；取消時不動', async () => {
    const Clipboard = jest.requireMock<{ setStringAsync: jest.Mock }>('expo-clipboard');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    useGameStore.setState((store) => ({
      state: store.state && { ...store.state, coins: 777, level: 6 },
    }));
    await render(<DebugPanel />);

    await fireEvent.press(screen.getByTestId('debug-new-game'));
    expect(alert).toHaveBeenCalledTimes(1);
    const buttons = alert.mock.calls[0][2] as { text: string; onPress?: () => Promise<void> }[];
    expect(useGameStore.getState().state?.coins).toBe(777);

    await act(async () => {
      await buttons.find((b) => b.text === '開新局')?.onPress?.();
    });

    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(expect.stringContaining('"coins":777'));
    expect(useGameStore.getState().state).toMatchObject({ coins: 0, level: 1 });
    expect(screen.getByTestId('debug-message')).toHaveTextContent(/已開新局/);
    alert.mockRestore();
  });
});
