// S7.2：設定畫面的音樂、音效開關。
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DEFAULT_SETTINGS, useSettings } from '@/services/settings';

import { SettingsScreen } from '../settings-screen';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

async function renderSettings() {
  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <SettingsScreen />
    </SafeAreaProvider>
  );
}

beforeEach(() => {
  useSettings.setState({ ...DEFAULT_SETTINGS, loaded: true });
});

describe('設定畫面（S7.2）', () => {
  it('顯示目前的音樂、音效開關', async () => {
    useSettings.setState({ music: false, sfx: true });
    await renderSettings();

    expect(screen.getByTestId('toggle-music').props.value).toBe(false);
    expect(screen.getByTestId('toggle-sfx').props.value).toBe(true);
  });

  it('切換開關會改設定', async () => {
    await renderSettings();

    await fireEvent(screen.getByTestId('toggle-music'), 'valueChange', false);
    await fireEvent(screen.getByTestId('toggle-sfx'), 'valueChange', false);

    expect(useSettings.getState()).toMatchObject({ music: false, sfx: false });
    expect(screen.getByTestId('toggle-music').props.value).toBe(false);
  });
});
