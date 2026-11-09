// 除錯工具的開關決定正式版玩家看不看得到除錯入口，所以例外替這個純函式寫測試。
import { resolveDebugTools } from '../config';

describe('resolveDebugTools', () => {
  it.each([
    ['開發模式、development', { debugTools: true, buildProfile: 'development' as const }, true, true],
    ['preview 建置（非開發模式）', { debugTools: true, buildProfile: 'preview' as const }, false, true],
    ['production 建置', { debugTools: false, buildProfile: 'production' as const }, false, false],
    // OTA 更新漏設 APP_VARIANT：extra 被當成 development，但正式版不是開發模式
    ['漏設變數的正式版 OTA', { debugTools: true, buildProfile: 'development' as const }, false, false],
    ['extra 缺少欄位', {}, true, false],
  ])('%s', (_name, extra, isDev, expected) => {
    expect(resolveDebugTools(extra, isDev)).toBe(expected);
  });
});
