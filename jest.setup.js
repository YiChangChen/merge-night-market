// Jest 全域設定：替原生模組換上官方提供的 mock，讓畫面元件能在 Node 裡渲染。
require('react-native-gesture-handler/jestSetup');

// Worklets 在 Node 裡沒有原生模組，改用官方 mock；Reanimated 在 Jest 裡會改用 JS 實作（JSReanimated）。
// jest-expo 以 iOS 平台解析模組，會載入 initializers.native.ts，它呼叫的 setCSSEventHandler
// 在 JSReanimated 不存在而直接拋錯（Reanimated 4.7 + RN 0.88）；測試裡不需要 CSS 動畫，所以只把這個初始化換成空函式。
jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));
// 以 iOS 平台解析時實際載入的是 .native 版本；Reanimated 也有 src/ 與 lib/module/ 兩套建置，全部列出
// （jest.mock 的 factory 必須是行內函式，babel 才能把它提到 import 之前）
jest.mock('react-native-reanimated/src/initializers', () => ({ initializeReanimatedModule: () => {} }));
jest.mock('react-native-reanimated/src/initializers.native', () => ({
  initializeReanimatedModule: () => {},
}));
jest.mock('react-native-reanimated/lib/module/initializers', () => ({
  initializeReanimatedModule: () => {},
}));
jest.mock('react-native-reanimated/lib/module/initializers.native', () => ({
  initializeReanimatedModule: () => {},
}));
// Reanimated 官方 mock：useSharedValue 有完整的 get／set，動畫函式直接回傳目標值。
// （它會 import Reanimated 本體，所以要先把上面的初始化換掉才載得起來）
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
