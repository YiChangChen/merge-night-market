import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * 建置 profile 優先讀 APP_VARIANT（eas.json 各 profile 的 env 注入，本機也可手動設定），
 * 其次讀 EAS 建置時自動注入的 EAS_BUILD_PROFILE；兩者都沒有時視為 development。
 */
type BuildProfile = 'development' | 'preview' | 'production';

const rawProfile = process.env.APP_VARIANT ?? process.env.EAS_BUILD_PROFILE;

const profile: BuildProfile =
  rawProfile === 'production' || rawProfile === 'preview' ? rawProfile : 'development';

const isProduction = profile === 'production';

/**
 * 本機用 Expo Go 跑 `--no-dev` 時也打開除錯工具（E1 retro A1）。在 `.env.local` 設定 `EXPO_GO_DEBUG_TOOLS=1`。
 * production 一律關閉；執行期還會再檢查是否真的在 Expo Go 裡（services/config.ts）。
 */
const expoGoDebugTools = !isProduction && process.env.EXPO_GO_DEBUG_TOOLS === '1';

/** 正式 ad unit ID 只在 production 注入；development / preview 一律用 TestIds（S1.4、S6.2）。 */
const adUnitIds = isProduction
  ? {
      ios: {
        energy: process.env.ADMOB_IOS_ENERGY_UNIT_ID,
        selloutDouble: process.env.ADMOB_IOS_SELLOUT_DOUBLE_UNIT_ID,
      },
      android: {
        energy: process.env.ADMOB_ANDROID_ENERGY_UNIT_ID,
        selloutDouble: process.env.ADMOB_ANDROID_SELLOUT_DOUBLE_UNIT_ID,
      },
    }
  : null;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: '合成夜市',
  slug: 'merge-night-market',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'mergenightmarket',
  userInterfaceStyle: 'light',
  runtimeVersion: { policy: 'fingerprint' },
  ios: {
    icon: './assets/expo.icon',
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#208AEF',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
    [
      'expo-build-properties',
      {
        android: { minSdkVersion: 26 },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    router: {
      asyncRoutes: {
        web: true,
      },
    },
    eas: {
      projectId: 'c930d437-72ec-4aa6-8f21-f6a68493e755',
    },
    buildProfile: profile,
    adUnitIds,
    posthogKey: process.env.POSTHOG_KEY ?? null,
    sentryDsn: process.env.SENTRY_DSN ?? null,
    debugTools: !isProduction,
    expoGoDebugTools,
  },
});
