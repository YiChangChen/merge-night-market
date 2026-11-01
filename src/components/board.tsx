import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, ZoomIn } from 'react-native-reanimated';

import { BALANCE, BOARD_SIZE, CHAINS } from '@/game/content';
import { canMerge, type Piece } from '@/game/engine';

type BoardProps = {
  board: (Piece | null)[];
  cellSize: number;
  selected: number | null;
  onTapCell: (cell: number) => void;
  onMove: (from: number, to: number) => void;
};

export function pieceEmoji(piece: Piece): string {
  const chain = CHAINS[piece.chain];
  return piece.kind === 'generator' ? chain.generatorEmoji : chain.items[piece.level - 1].emoji;
}

function PieceView({ piece, size }: { piece: Piece; size: number }) {
  return (
    <>
      <Text style={{ fontSize: size * 0.56 }}>{pieceEmoji(piece)}</Text>
      {piece.kind === 'item' ? <Text style={styles.level}>{piece.level}</Text> : null}
    </>
  );
}

export function Board({ board, cellSize, selected, onTapCell, onMove }: BoardProps) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [hoverCell, setHoverCell] = useState<number | null>(null);
  const pressedCell = useRef<number | null>(null);
  const dragging = useRef(false);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);

  const width = cellSize * BALANCE.boardColumns;
  const height = cellSize * BALANCE.boardRows;

  const cellAt = (x: number, y: number): number | null => {
    if (x < 0 || y < 0 || x >= width || y >= height) return null;
    const cell = Math.floor(y / cellSize) * BALANCE.boardColumns + Math.floor(x / cellSize);
    return cell < BOARD_SIZE ? cell : null;
  };

  const updateDrag = (x: number, y: number) => {
    dragX.set(x - cellSize / 2);
    dragY.set(y - cellSize / 2);
    setHoverCell(cellAt(x, y));
  };

  // 拖曳的放置判定要讀 React 狀態，所以整個手勢都跑在 JS 執行緒
  const pan = usePanGesture({
    disableReanimated: true,
    minDistance: 6,
    onBegin: (event) => {
      pressedCell.current = cellAt(event.x, event.y);
      dragging.current = false;
    },
    onActivate: (event) => {
      const from = pressedCell.current;
      if (from === null || !board[from]) return;
      dragging.current = true;
      setDragFrom(from);
      updateDrag(event.x, event.y);
    },
    onUpdate: (event) => {
      if (dragging.current) updateDrag(event.x, event.y);
    },
    onDeactivate: (event) => {
      const from = pressedCell.current;
      if (!dragging.current || from === null) return;
      const to = cellAt(event.x, event.y);
      if (to !== null) onMove(from, to);
    },
    onFinalize: () => {
      // 手指沒有移動到啟動拖曳的距離，就當作點擊
      if (!dragging.current && pressedCell.current !== null) onTapCell(pressedCell.current);
      pressedCell.current = null;
      dragging.current = false;
      setDragFrom(null);
      setHoverCell(null);
    },
  });

  const floatingStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.value }, { translateY: dragY.value }, { scale: 1.15 }],
  }));

  const dragged = dragFrom !== null ? board[dragFrom] : null;

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.board, { width, height }]} testID="board">
        {board.map((piece, cell) => {
          const row = Math.floor(cell / BALANCE.boardColumns);
          const dark = (row + cell % BALANCE.boardColumns) % 2 === 0;
          const mergeHint =
            dragged && cell === hoverCell && cell !== dragFrom && piece && canMerge(dragged, piece);
          return (
            <View
              key={cell}
              testID={`cell-${cell}`}
              style={[
                styles.cell,
                { width: cellSize, height: cellSize },
                dark ? styles.cellDark : styles.cellLight,
                cell === selected && styles.cellSelected,
                cell === hoverCell && cell !== dragFrom && styles.cellHover,
                mergeHint && styles.cellMerge,
              ]}>
              {piece && cell !== dragFrom ? (
                <Animated.View
                  key={piece.id}
                  entering={ZoomIn.duration(140)}
                  style={[styles.piece, piece.kind === 'generator' && styles.generator]}>
                  <PieceView piece={piece} size={cellSize} />
                </Animated.View>
              ) : null}
            </View>
          );
        })}
        {dragged ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.floating, { width: cellSize, height: cellSize }, floatingStyle]}>
            <View style={[styles.piece, dragged.kind === 'generator' && styles.generator]}>
              <PieceView piece={dragged} size={cellSize} />
            </View>
          </Animated.View>
        ) : null}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  board: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 12,
    overflow: 'hidden',
  },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellDark: { backgroundColor: '#3A2A4D' },
  cellLight: { backgroundColor: '#463459' },
  cellSelected: { backgroundColor: '#7A5FA0' },
  cellHover: { backgroundColor: '#5E4A78' },
  cellMerge: { backgroundColor: '#E0A030' },
  piece: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  generator: {
    backgroundColor: '#FFD36E44',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FFD36E',
  },
  level: {
    position: 'absolute',
    right: 4,
    bottom: 1,
    color: '#FFF3D6',
    fontSize: 11,
    fontWeight: '700',
  },
  floating: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 10,
  },
});
