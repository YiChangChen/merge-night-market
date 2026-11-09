// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

/** 規則層（src/game/**）不得依賴的模組：UI、平台、服務層。見 game-architecture.md〈Architectural Boundaries〉。 */
const PLATFORM_AND_UPPER_LAYERS = [
  {
    group: ['react-native', 'react-native/*', 'expo', 'expo-*', 'expo/*'],
    message: '規則層必須是純 TS，不得依賴 react-native 或 expo。',
  },
  {
    group: ['@/services', '@/services/*', '**/services/*'],
    message: '規則層不得 import 服務層；I/O 由 services 呼叫規則層。',
  },
  {
    group: ['@/features', '@/features/*', '**/features/*'],
    message: '規則層不得 import 畫面層。',
  },
  {
    group: ['@/ui', '@/ui/*', '**/ui/*'],
    message: '規則層不得 import 共用 UI。',
  },
];

const NO_REACT = {
  group: ['react', 'react/*', 'react-dom', 'react-dom/*'],
  message: '規則層必須是純 TS，不得依賴 react（store.ts 例外，只能用 zustand）。',
};

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

  // 規則層：分層 import 限制，禁止 Date.now 與 Math.random。
  {
    files: ['src/game/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [NO_REACT, ...PLATFORM_AND_UPPER_LAYERS] }],
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='Date'][property.name='now']",
          message: '規則層不得呼叫 Date.now()；時間一律以最後一個參數 now 傳入。',
        },
        {
          selector: "MemberExpression[object.name='Math'][property.name='random']",
          message: '規則層不得呼叫 Math.random()；亂數一律使用 random.ts 的 seeded RNG。',
        },
      ],
    },
  },
  // store.ts 例外：它是規則層與外界的邊界。
  // 可以 import zustand（以及 zustand 所需的 react），也可以讀 Date.now 交給 syncAll；
  // Math.random 與其他 import 限制照舊。
  {
    files: ['src/game/store.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: PLATFORM_AND_UPPER_LAYERS }],
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='Math'][property.name='random']",
          message: '規則層不得呼叫 Math.random()；亂數一律使用 random.ts 的 seeded RNG。',
        },
      ],
    },
  },
]);
