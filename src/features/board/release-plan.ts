// 放開棋子之後要播什麼動畫（S3.3）。判定由規則層的 resolveDrop 決定，這裡只把結果換成動畫計畫。
import type { DropResult } from '@/game/drop';

export type ReleasePlan = {
  /** 目標格原本的棋子要不要滑回來源格（交換） */
  swapBack: boolean;
  /** 被拖的棋子：滑到落點、滑回原格，或不滑（由合成特效接手） */
  source: 'target' | 'origin' | 'none';
  /** 滑回之前先在放開處左右搖頭（組錯，UX-DR6） */
  shake: boolean;
};

export function releasePlan(kind: DropResult['kind']): ReleasePlan {
  switch (kind) {
    case 'merge':
      return { swapBack: false, source: 'none', shake: false };
    case 'swap':
      return { swapBack: true, source: 'target', shake: false };
    case 'reject':
      return { swapBack: false, source: 'origin', shake: true };
    case 'move':
    case 'stack':
    case 'invent':
      return { swapBack: false, source: 'target', shake: false };
  }
}
