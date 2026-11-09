// Jest 全域設定：替原生模組換上官方提供的 mock，讓畫面元件能在 Node 裡渲染。
require('react-native-gesture-handler/jestSetup');

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
