import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

import { BALANCE, BOARD_SIZE, CHAINS } from '@/game/content';
import {
  canMerge,
  findMerges,
  findSpawns,
  type Merge,
  type Piece,
  type Spawn,
} from '@/game/engine';

const NO_CELL = -1;
const PRESS_SCALE = 0.84;
const PRESS_IN_MS = 70;
// 阻尼偏低，放開時才會明顯彈過頭再回穩
const PRESS_RELEASE_SPRING = { mass: 0.6, stiffness: 340, damping: 9 };
const FLIGHT_MS = 420;
// 動畫進度走到這裡時落地，剩下的時間做落地壓扁
const FLIGHT_LAND_AT = 0.72;
const MERGE_MS = 380;
const MERGE_SPARK_COUNT = 8;

type BoardProps = {
  board: (Piece | null)[];
  cellSize: number;
  selected: number | null;
  onTapCell: (cell: number) => void;
  onMove: (from: number, to: number) => void;
};

export function PieceIcon({ piece, size }: { piece: Piece; size: number }) {
  const chain = CHAINS[piece.chain];
  const isGenerator = piece.kind === 'generator';
  const iconSize = size * (isGenerator ? 0.88 : 0.84);
  return (
    <Image
      source={isGenerator ? chain.generatorArt : chain.items[piece.level - 1].art}
      contentFit="contain"
      // 網頁版的 img 預設可原生拖曳，會取消棋盤的拖曳手勢
      draggable={false}
      style={{ width: iconSize, height: iconSize, borderRadius: isGenerator ? 6 : 0 }}
    />
  );
}

function PieceView({ piece, size }: { piece: Piece; size: number }) {
  return (
    <>    
      <PieceIcon piece={piece} size={size} />
      {piece.kind === 'item' ? <Text style={styles.level}>{piece.level}</Text> : null}
    </>
  );
}

function GeneratorBody({
  piece,
  size,
  cell,
  pressCell,
  pressScale,
}: {
  piece: Piece;
  size: number;
  cell: number;
  pressCell: SharedValue<number>;
  pressScale: SharedValue<number>;
}) {
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressCell.value === cell ? pressScale.value : 1 }],
  }));
  return (
    <Animated.View style={[styles.piece, styles.generator, pressStyle]}>
      <PieceView piece={piece} size={size} />
    </Animated.View>
  );
}

function BoardPiece({
  piece,
  size,
  cell,
  flying,
  pressCell,
  pressScale,
}: {
  piece: Piece;
  size: number;
  cell: number;
  flying: boolean;
  pressCell: SharedValue<number>;
  pressScale: SharedValue<number>;
}) {
  // 進場動畫只在掛載時決定：飛行或合成中的品項由特效圖層負責出場，結束後不再放大一次
  const [entering] = useState(() => (flying ? undefined : ZoomIn.duration(140)));
  return (
    <Animated.View entering={entering} style={[styles.piece, flying && styles.hidden]}>
      {piece.kind === 'generator' ? (
        <GeneratorBody
          piece={piece}
          size={size}
          cell={cell}
          pressCell={pressCell}
          pressScale={pressScale}
        />
      ) : (
        <PieceView piece={piece} size={size} />
      )}
    </Animated.View>
  );
}

function SpawnFlight({
  spawn,
  cellSize,
  onDone,
}: {
  spawn: Spawn;
  cellSize: number;
  onDone: (id: number) => void;
}) {
  const progress = useSharedValue(0);
  const fromX = (spawn.from % BALANCE.boardColumns) * cellSize;
  const fromY = Math.floor(spawn.from / BALANCE.boardColumns) * cellSize;
  const toX = (spawn.to % BALANCE.boardColumns) * cellSize;
  const toY = Math.floor(spawn.to / BALANCE.boardColumns) * cellSize;
  const arcHeight = cellSize * 0.8;

  useEffect(() => {
    progress.set(withTiming(1, { duration: FLIGHT_MS, easing: Easing.linear }));
    // 用計時器收尾而不是動畫 callback，確保食材一定會顯示回棋盤上
    const timer = setTimeout(() => onDone(spawn.piece.id), FLIGHT_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 每次飛行只啟動一次
  }, []);

  const flightStyle = useAnimatedStyle(() => {
    const t = progress.value;
    const air = Math.min(t / FLIGHT_LAND_AT, 1);
    const arc = 4 * arcHeight * air * (1 - air);
    const airScale = interpolate(
      t,
      [0, FLIGHT_LAND_AT * 0.6, FLIGHT_LAND_AT],
      [0.35, 1.15, 1],
      'clamp'
    );
    const widen = interpolate(t, [FLIGHT_LAND_AT, 0.84, 1], [1, 1.2, 1], 'clamp');
    const flatten = interpolate(t, [FLIGHT_LAND_AT, 0.84, 1], [1, 0.78, 1], 'clamp');
    return {
      transform: [
        { translateX: fromX + (toX - fromX) * air },
        { translateY: fromY + (toY - fromY) * air - arc },
        { scaleX: airScale * widen },
        { scaleY: airScale * flatten },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.floating, { width: cellSize, height: cellSize }, flightStyle]}>
      <View style={styles.piece}>
        <PieceView piece={spawn.piece} size={cellSize} />
      </View>
    </Animated.View>
  );
}

function MergeSpark({
  angle,
  cellSize,
  progress,
}: {
  angle: number;
  cellSize: number;
  progress: SharedValue<number>;
}) {
  const sparkStyle = useAnimatedStyle(() => {
    const distance = interpolate(progress.value, [0, 1], [cellSize * 0.2, cellSize * 0.85]);
    return {
      opacity: interpolate(progress.value, [0, 0.5, 1], [1, 1, 0]),
      transform: [
        { translateX: Math.cos(angle) * distance },
        { translateY: Math.sin(angle) * distance },
        { scale: interpolate(progress.value, [0, 1], [1, 0.3]) },
      ],
    };
  });
  return <Animated.View style={[styles.mergeSpark, sparkStyle]} />;
}

function MergeBurst({
  merge,
  cellSize,
  onDone,
}: {
  merge: Merge;
  cellSize: number;
  onDone: (id: number) => void;
}) {
  const progress = useSharedValue(0);
  const left = (merge.cell % BALANCE.boardColumns) * cellSize;
  const top = Math.floor(merge.cell / BALANCE.boardColumns) * cellSize;

  useEffect(() => {
    progress.set(withTiming(1, { duration: MERGE_MS, easing: Easing.linear }));
    // 用計時器收尾而不是動畫 callback，確保品項一定會顯示回棋盤上
    const timer = setTimeout(() => onDone(merge.piece.id), MERGE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 每次合成只啟動一次
  }, []);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.9, 0]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.5, 1.7]) }],
  }));
  const pieceStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progress.value, [0, 0.4, 0.7, 1], [0.6, 1.35, 0.92, 1]) }],
  }));

  return (
    <View
      pointerEvents="none"
      style={[styles.floating, styles.burst, { left, top, width: cellSize, height: cellSize }]}>
      <Animated.View style={[styles.mergeRing, ringStyle]} />
      {Array.from({ length: MERGE_SPARK_COUNT }, (_, index) => (
        <MergeSpark
          key={index}
          angle={(index / MERGE_SPARK_COUNT) * 2 * Math.PI}
          cellSize={cellSize}
          progress={progress}
        />
      ))}
      <Animated.View style={[styles.piece, pieceStyle]}>
        <PieceView piece={merge.piece} size={cellSize} />
      </Animated.View>
    </View>
  );
}

export function Board({ board, cellSize, selected, onTapCell, onMove }: BoardProps) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [hoverCell, setHoverCell] = useState<number | null>(null);
  const pressedCell = useRef<number | null>(null);
  const dragging = useRef(false);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const pressCell = useSharedValue(NO_CELL);
  const pressScale = useSharedValue(1);
  const [flights, setFlights] = useState<Spawn[]>([]);
  const [merges, setMerges] = useState<Merge[]>([]);
  const [previousBoard, setPreviousBoard] = useState(board);

  // 在渲染中比對，食材才不會先在目標格閃現一幀才開始飛
  if (board !== previousBoard) {
    setPreviousBoard(board);
    const spawns = findSpawns(previousBoard, board);
    if (spawns.length > 0) setFlights([...flights, ...spawns]);
    const newMerges = findMerges(previousBoard, board);
    if (newMerges.length > 0) setMerges([...merges, ...newMerges]);
  }

  const finishFlight = (id: number) => {
    setFlights((current) => current.filter((flight) => flight.piece.id !== id));
  };

  const finishMerge = (id: number) => {
    setMerges((current) => current.filter((merge) => merge.piece.id !== id));
  };

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
      const pressed = pressedCell.current;
      if (pressed !== null && board[pressed]?.kind === 'generator') {
        pressCell.set(pressed);
        pressScale.set(withTiming(PRESS_SCALE, { duration: PRESS_IN_MS }));
      } else {
        pressCell.set(NO_CELL);
      }
    },
    onActivate: (event) => {
      // 開始拖曳就不算點擊，產生器改由浮動圖層顯示
      pressCell.set(NO_CELL);
      pressScale.set(1);
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
      // 先確實壓到底再回彈，快速連點時才看得到完整的按壓感
      pressScale.set(
        withSequence(
          withTiming(PRESS_SCALE, { duration: PRESS_IN_MS }),
          withSpring(1, PRESS_RELEASE_SPRING)
        )
      );
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
          const column = cell % BALANCE.boardColumns;
          const dark = (row + column) % 2 === 0;
          const lastRow = row === BALANCE.boardRows - 1;
          const lastColumn = column === BALANCE.boardColumns - 1;
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
                row === 0 && column === 0 && styles.cornerTopLeft,
                row === 0 && lastColumn && styles.cornerTopRight,
                lastRow && column === 0 && styles.cornerBottomLeft,
                lastRow && lastColumn && styles.cornerBottomRight,
                // 回彈時會超出格子，要蓋在後面的格子之上
                piece?.kind === 'generator' && styles.cellGenerator,
                cell === selected && styles.cellSelected,
                cell === hoverCell && cell !== dragFrom && styles.cellHover,
                mergeHint && styles.cellMerge,
              ]}>
              {piece && cell !== dragFrom ? (
                <BoardPiece
                  key={piece.id}
                  piece={piece}
                  size={cellSize}
                  cell={cell}
                  flying={[...flights, ...merges].some((effect) => effect.piece.id === piece.id)}
                  pressCell={pressCell}
                  pressScale={pressScale}
                />
              ) : null}
            </View>
          );
        })}
        {flights.map((flight) => (
          <SpawnFlight
            key={flight.piece.id}
            spawn={flight}
            cellSize={cellSize}
            onDone={finishFlight}
          />
        ))}
        {merges.map((merge) => (
          <MergeBurst
            key={merge.piece.id}
            merge={merge}
            cellSize={cellSize}
            onDone={finishMerge}
          />
        ))}
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
  },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 圓角放在四個角的格子上，不用 overflow: hidden，動畫才不會被棋盤邊緣裁掉
  cornerTopLeft: { borderTopLeftRadius: 12 },
  cornerTopRight: { borderTopRightRadius: 12 },
  cornerBottomLeft: { borderBottomLeftRadius: 12 },
  cornerBottomRight: { borderBottomRightRadius: 12 },
  cellGenerator: { zIndex: 1 },
  cellDark: { backgroundColor: '#E8D9BC' },
  cellLight: { backgroundColor: '#F5ECD8' },
  cellSelected: { backgroundColor: '#F2C572' },
  cellHover: { backgroundColor: '#DCC79E' },
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
    borderColor: '#C98A1E',
  },
  hidden: { opacity: 0 },
  burst: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mergeRing: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 999,
    borderWidth: 4,
    borderColor: '#E0A030',
  },
  mergeSpark: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E0A030',
  },
  // 圖片幾乎填滿格子，階數要有底色才看得清楚
  level: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    paddingHorizontal: 3,
    borderRadius: 4,
    overflow: 'hidden',
    color: '#4A3420',
    backgroundColor: '#FFF3D6DD',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
  },
  floating: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 10,
  },
});
