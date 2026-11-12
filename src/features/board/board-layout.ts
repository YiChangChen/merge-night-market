// 棋盤畫面的版面分配（實機回饋：手機網頁扣掉瀏覽器的網址列與工具列後高度不夠，棋盤格太小）。
import { BALANCE } from '@/game/content';

/** 高度不夠時，客人圖最多縮到原本的這個比例，把空間讓給棋盤 */
export const MIN_ART_SCALE = 0.55;

type Size = { width: number; height: number };

/**
 * 決定格子大小與客人圖大小。
 * - 高度夠：格子由寬度決定（寬 / 7），客人圖維持原尺寸。
 * - 高度不夠：先縮小客人圖（等比，最小 MIN_ART_SCALE），讓格子盡量維持寬度決定的大小；
 *   客人圖縮到底還是不夠，格子才由剩下的高度決定。
 * @param height 扣掉其他固定元素後，留給「客人圖 + 棋盤」的高度
 */
export function fitBoard({
  boardWidth,
  height,
  art,
}: {
  boardWidth: number;
  height: number;
  art: Size;
}): { cellSize: number; art: Size } {
  const widthCell = Math.floor(boardWidth / BALANCE.boardColumns);
  const boardNeeds = widthCell * BALANCE.boardRows;
  if (height - art.height >= boardNeeds) return { cellSize: widthCell, art };

  const artHeight = Math.max(art.height * MIN_ART_SCALE, height - boardNeeds);
  const scale = Math.min(1, artHeight / art.height);
  const fitted = { width: Math.floor(art.width * scale), height: Math.floor(art.height * scale) };
  const cellSize = Math.floor(
    Math.max(0, Math.min(widthCell, (height - fitted.height) / BALANCE.boardRows))
  );
  return { cellSize, art: fitted };
}
