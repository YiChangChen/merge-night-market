// 測試用：從 WebP 檔頭讀寬高（不必解碼整張圖），用來檢查美術的尺寸上限（art-manifest）。
type FsRead = { readFileSync(file: string): Uint8Array };

/** 支援 VP8X 延伸格式、VP8L 無損格式與 VP8 簡單有損格式。 */
export function webpSize(path: string): { width: number; height: number } {
  const { readFileSync } = jest.requireActual<FsRead>('fs');
  const b = readFileSync(path);
  const chunk = String.fromCharCode(b[12], b[13], b[14], b[15]);
  if (chunk === 'VP8X') {
    return {
      width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)),
      height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)),
    };
  }
  if (chunk === 'VP8L') {
    return {
      width: 1 + (((b[22] & 0x3f) << 8) | b[21]),
      height: 1 + (((b[24] & 0x0f) << 10) | (b[23] << 2) | ((b[22] & 0xc0) >> 6)),
    };
  }
  // VP8（簡單有損）：起始碼之後是 14 位元的寬高
  return { width: (b[26] | (b[27] << 8)) & 0x3fff, height: (b[28] | (b[29] << 8)) & 0x3fff };
}
