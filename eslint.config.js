// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

/** 規則層（src/game/**）不得依賴的模組：UI、平台、服務層。見 game-architecture.md〈Architectural Boundaries〉。 */
const PLATFORM_AND_UPPER_LAYERS = [
  {
    // react-native 本體、社群套件（react-native-reanimated 等）、@react-native-* 與 @expo/* 範圍套件
    group: [
      'react-native',
      'react-native/*',
      'react-native-*',
      '@react-native/*',
      '@react-native-*/*',
      'expo',
      'expo/*',
      'expo-*',
      '@expo/*',
    ],
    message: '規則層必須是純 TS，不得依賴 react-native、expo 或任何原生套件（含 AsyncStorage）。',
  },
  {
    // 不帶子路徑的 '../../services' 也要擋：之後新增 index.ts 時才不會悄悄通過
    group: ['@/services', '@/services/*', '**/services', '**/services/*'],
    message: '規則層不得 import 服務層；I/O 由 services 呼叫規則層。',
  },
  {
    group: ['@/features', '@/features/*', '**/features', '**/features/*'],
    message: '規則層不得 import 畫面層。',
  },
  {
    group: ['@/ui', '@/ui/*', '**/ui', '**/ui/*'],
    message: '規則層不得 import 共用 UI。',
  },
];

const NO_REACT = {
  group: ['react', 'react/*', 'react-dom', 'react-dom/*'],
  message: '規則層必須是純 TS，不得依賴 react（store.ts 例外，只能用 zustand）。',
};

const NO_ZUSTAND = {
  group: ['zustand', 'zustand/*'],
  message: '只有 src/game/store.ts 可以使用 zustand。',
};

const NO_RANDOM = [
  {
    // Math.random() 與 Math['random']()
    selector:
      "MemberExpression[object.name='Math'][property.name='random'], MemberExpression[object.name='Math'][property.value='random']",
    message: '規則層不得呼叫 Math.random()；亂數一律使用 random.ts 的 seeded RNG。',
  },
  {
    // globalThis.Math.random() 這類繞道寫法
    selector: "MemberExpression[property.name='random'][object.property.name='Math']",
    message: '規則層不得呼叫 Math.random()；亂數一律使用 random.ts 的 seeded RNG。',
  },
];

const NO_CLOCK = [
  {
    // Date.now() 與 Date['now']()
    selector:
      "MemberExpression[object.name='Date'][property.name='now'], MemberExpression[object.name='Date'][property.value='now']",
    message: '規則層不得呼叫 Date.now()；時間一律以最後一個參數 now 傳入。',
  },
  {
    selector: "NewExpression[callee.name='Date'][arguments.length=0], CallExpression[callee.name='Date']",
    message: '規則層不得用 new Date() 或 Date() 取得目前時間；時間一律以最後一個參數 now 傳入。',
  },
  {
    selector: "MemberExpression[object.name='performance'][property.name='now']",
    message: '規則層不得呼叫 performance.now()；時間一律以最後一個參數 now 傳入。',
  },
];

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },

  // 全專案禁止 console，一律透過 src/services/log.ts。
  {
    rules: {
      'no-console': 'error',
    },
  },
  {
    files: ['src/services/log.ts'],
    rules: {
      'no-console': 'off',
    },
  },

  // 規則層：分層 import 限制，禁止讀取時鐘與 Math.random。
  {
    files: ['src/game/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [NO_REACT, NO_ZUSTAND, ...PLATFORM_AND_UPPER_LAYERS] },
      ],
      'no-restricted-syntax': ['error', ...NO_CLOCK, ...NO_RANDOM],
    },
  },
  // store.ts 例外：它是規則層與外界的邊界。
  // 可以 import zustand（以及 zustand 所需的 react），也可以讀 Date.now 交給 syncAll；
  // Math.random 與其他 import 限制照舊。
  {
    files: ['src/game/store.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: PLATFORM_AND_UPPER_LAYERS }],
      'no-restricted-syntax': ['error', ...NO_RANDOM],
    },
  },
]);
