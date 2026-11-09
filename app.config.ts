import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * EAS 建置時由 EAS 注入 EAS_BUILD_PROFILE（development / preview / production）。
 * 本機 `expo start` 沒有這個變數，視為 development。
 */
type BuildProfile = 'development' | 'preview' | 'production';

const profile: BuildProfile =
  process.env.EAS_BUILD_PROFILE === 'production' || process.env.EAS_BUILD_PROFILE === 'preview'
    ? process.env.EAS_BUILD_PROFILE
    : 'development';

const isProduction = profile === 'production';

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
  },
});
