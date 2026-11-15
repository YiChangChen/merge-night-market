// S6.2：假的廣告服務（E5 retro D1：還沒有開發版建置環境，先用假的實作把流程做完）。
import { ads, FAKE_AD_MS, useFakeAds } from '../ads';
import { trackAdShown } from '../telemetry';

jest.mock('../telemetry', () => ({ trackAdShown: jest.fn() }));

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('假的廣告服務', () => {
  it('停用（正式版沒有除錯工具）：isReady 為 false，show 直接回傳 unavailable', async () => {
    useFakeAds.setState({ enabled: false, mode: 'earned' });
    expect(ads.isReady('energy')).toBe(false);
    await expect(ads.show('energy')).resolves.toBe('unavailable');
  });

  it.each(['earned', 'dismissed'] as const)(
    '模式 %s：模擬播放 FAKE_AD_MS 後回傳這個結果',
    async (mode) => {
      useFakeAds.setState({ enabled: true, mode });
      expect(ads.isReady('energy')).toBe(true);
      const result = jest.fn();
      void ads.show('energy').then(result);

      await jest.advanceTimersByTimeAsync(FAKE_AD_MS - 1);
      expect(result).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(1);
      expect(result).toHaveBeenCalledWith(mode);
    }
  );

  it('模式「沒有廣告」：isReady 為 false（按鈕隱藏），show 回傳 unavailable', async () => {
    useFakeAds.setState({ enabled: true, mode: 'unavailable' });
    expect(ads.isReady('sellout-double')).toBe(false);
    await expect(ads.show('sellout-double')).resolves.toBe('unavailable');
  });
});

describe('埋點（S7.3）', () => {
  beforeEach(() => {
    jest.mocked(trackAdShown).mockClear();
  });

  it('真的開始播放才送 ad_shown；沒有廣告時不送', async () => {
    useFakeAds.setState({ enabled: true, mode: 'unavailable' });
    await ads.show('energy');
    expect(trackAdShown).not.toHaveBeenCalled();

    useFakeAds.setState({ enabled: true, mode: 'dismissed' });
    void ads.show('sellout-double');
    expect(trackAdShown).toHaveBeenCalledWith('sellout-double');
    await jest.advanceTimersByTimeAsync(FAKE_AD_MS);
  });
});
