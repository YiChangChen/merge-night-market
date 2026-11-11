// 新手教學第 1、2 步「現在該做什麼」（S6.4 實機回饋）：依第一張做得出來的訂單，決定指產生器、提示合成，或指訂單。
// 純函式，UI 的手指與說明文字都用它；放在獨立模組，避免 engine ↔ tutorial 互相 import。
import { CHAINS, type ChainId } from './content';
import { findMergePair, findOrderCells } from './engine';
import type { GameState, ItemPiece, Requirement } from './types';

export type TutorialFocus =
  /** 點這個產生器出食材 */
  | { kind: 'generator'; cell: number; chain: ChainId }
  /** 把這兩格合成 */
  | { kind: 'merge'; pair: [number, number] }
  /** 點這張訂單出餐（orders 的 index） */
  | { kind: 'order'; index: number };

/** 第一張訂單第一個還沒備好的品項（教學期間只有一般單，Lv1 每張只要一個品項） */
function neededItem(state: GameState): Requirement | null {
  const order = state.orders.find((candidate) => candidate.kind === 'normal');
  if (!order) return null;
  return (
    order.requirements.find(
      (requirement) =>
        !state.board.some(
          (piece) =>
            piece?.kind === 'item' &&
            piece.chain === requirement.chain &&
            piece.level === requirement.level
        )
    ) ?? order.requirements[0]
  );
}

function generatorCell(state: GameState, chain: ChainId | undefined): number {
  const own = state.board.findIndex(
    (piece) => piece?.kind === 'generator' && (chain === undefined || piece.chain === chain)
  );
  return own >= 0 ? own : state.board.findIndex((piece) => piece?.kind === 'generator');
}

const isItemOf =
  (chain: ChainId, belowLevel = Infinity) =>
  (piece: ItemPiece) =>
    piece.chain === chain && piece.level < belowLevel;

/**
 * 第 1 步（合成）：有一對可以合成的就提示合成，優先是訂單要的那條鏈；否則指訂單要的那條鏈的產生器。
 * 第 2 步（出餐）：有訂單做得出來就指那張；否則提示合成訂單要的品項（只合成比需要的階數低的），
 * 再沒有就指那條鏈的產生器。其他步驟回傳 null。
 */
export function tutorialFocus(state: GameState): TutorialFocus | null {
  const step = state.meta.tutorialStep;
  if (step !== 0 && step !== 1) return null;
  const need = neededItem(state);

  if (step === 1) {
    const ready = state.orders.findIndex((order) => findOrderCells(state, order) !== null);
    if (ready >= 0) return { kind: 'order', index: ready };
  }

  const pair =
    (need &&
      findMergePair(state.board, isItemOf(need.chain, step === 1 ? need.level : Infinity))) ??
    (step === 0 ? findMergePair(state.board) : null);
  if (pair) return { kind: 'merge', pair };

  const cell = generatorCell(state, need?.chain);
  if (cell < 0) return null;
  const generator = state.board[cell];
  return generator?.kind === 'generator'
    ? { kind: 'generator', cell, chain: generator.chain }
    : null;
}

/** 第 1、2 步的說明文字（含要做的品項名稱）；不是這兩步時回傳 null */
export function tutorialFocusLine(state: GameState): string | null {
  const step = state.meta.tutorialStep;
  if (step !== 0 && step !== 1) return null;
  const focus = tutorialFocus(state);
  const need = neededItem(state);
  const needName = need ? CHAINS[need.chain].items[need.level - 1]?.name : undefined;
  if (step === 0) {
    if (focus?.kind === 'generator') {
      return `👆 點${CHAINS[focus.chain].generatorName}出食材，把兩個一樣的拖在一起合成`;
    }
    return '👆 把兩個一樣的拖在一起合成';
  }
  if (focus?.kind === 'order') return '👆 點訂單出餐';
  if (!needName || !need) return '👆 做出訂單要的品項，點訂單出餐';
  if (focus?.kind === 'merge') return `👆 合成出「${needName}」，再點訂單出餐`;
  return `👆 點${CHAINS[need.chain].generatorName}做出「${needName}」，再點訂單出餐`;
}
