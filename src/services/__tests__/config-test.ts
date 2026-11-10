// 除錯工具的開關決定正式版玩家看不看得到除錯入口，所以例外替這個純函式寫測試。
import { resolveDebugTools } from '../config';

describe('resolveDebugTools', () => {
  it.each([
    [
      '開發模式、development',
      { debugTools: true, buildProfile: 'development' as const },
      true,
      true,
    ],
    [
      'preview 建置（非開發模式）',
      { debugTools: true, buildProfile: 'preview' as const },
      false,
      true,
    ],
    ['production 建置', { debugTools: false, buildProfile: 'production' as const }, false, false],
    // OTA 更新漏設 APP_VARIANT：extra 被當成 development，但正式版不是開發模式
    [
      '漏設變數的正式版 OTA',
      { debugTools: true, buildProfile: 'development' as const },
      false,
      false,
    ],
    ['extra 缺少欄位', {}, true, false],
  ])('%s', (_name, extra, isDev, expected) => {
    expect(resolveDebugTools(extra, isDev)).toBe(expected);
  });

  describe('Expo Go 的 --no-dev（E1 retro A1）', () => {
    const local = {
      debugTools: true,
      buildProfile: 'development' as const,
      expoGoDebugTools: true,
    };

    it.each([
      ['在 Expo Go 且打開開關', local, true, true],
      ['開關打開但不在 Expo Go（正式版 OTA）', local, false, false],
      ['在 Expo Go 但沒打開開關', { ...local, expoGoDebugTools: false }, true, false],
      [
        'production 建置（app.config 不會讓兩者同時成立，仍以 debugTools 擋下）',
        { ...local, debugTools: false, buildProfile: 'production' as const },
        true,
        false,
      ],
    ])('%s', (_name, extra, isExpoGo, expected) => {
      expect(resolveDebugTools(extra, false, isExpoGo)).toBe(expected);
    });
  });
});
