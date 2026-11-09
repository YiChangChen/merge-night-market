import { Image } from 'expo-image';
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { BALANCE, CHAIN_IDS, CHAINS } from '@/game/content';
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
const GLIDE_MS = 150;
const DRAG_SCALE = 1.15;
const COLUMNS = BALANCE.boardColumns;
const ROWS = BALANCE.boardRows;

// 手勢的 worklet 與 JS 都會呼叫
function cellAt(x: number, y: number, cellSize: number): number | null {
  'worklet';
  if (x < 0 || y < 0 || x >= cellSize * COLUMNS || y >= cellSize * ROWS) return null;
  return Math.floor(y / cellSize) * COLUMNS + Math.floor(x / cellSize);
}

// 棋子從一個位置滑到另一個位置：放下、被交換，或拖出棋盤後滑回原位
type Glide = {
  key: number;
  piece: Piece;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  fromScale: number;
};

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
      // 預設只有硬碟快取，每次掛載都要非同步讀檔，拖曳開始時棋子會短暫消失
      cachePolicy="memory-disk"
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
  liftedCell,
}: {
  piece: Piece;
  size: number;
  cell: number;
  flying: boolean;
  pressCell: SharedValue<number>;
  pressScale: SharedValue<number>;
  liftedCell: SharedValue<number>;
}) {
  // 手指一動就要隱藏，不能等 JS，否則棋子會同時出現在格子和手指下
  const liftStyle = useAnimatedStyle(() => ({ opacity: liftedCell.value === cell ? 0 : 1 }));
  // 進場動畫只在掛載時決定：飛行或合成中的品項由特效圖層負責出場，結束後不再放大一次
  const [entering] = useState(() => (flying ? undefined : ZoomIn.duration(140)));
  return (
    <Animated.View entering={entering} style={[styles.piece, flying && styles.hidden]}>
      <Animated.View style={[styles.piece, liftStyle]}>
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

function PieceGlide({
  glide,
  cellSize,
  onDone,
}: {
  glide: Glide;
  cellSize: number;
  onDone: (key: number) => void;
}) {
  const progress = useSharedValue(0);
  const { fromX, fromY, toX, toY, fromScale, piece } = glide;

  useEffect(() => {
    progress.set(withTiming(1, { duration: GLIDE_MS, easing: Easing.out(Easing.cubic) }));
    // 用計時器收尾而不是動畫 callback，確保棋子一定會顯示回棋盤上
    const timer = setTimeout(() => onDone(glide.key), GLIDE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 每次滑動只啟動一次
  }, []);

  const glideStyle = useAnimatedStyle(() => {
    const t = progress.value;
    return {
      transform: [
        { translateX: fromX + (toX - fromX) * t },
        { translateY: fromY + (toY - fromY) * t },
        { scale: fromScale + (1 - fromScale) * t },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.floating, { width: cellSize, height: cellSize }, glideStyle]}>
      <View style={[styles.piece, piece.kind === 'generator' && styles.generator]}>
        <PieceView piece={piece} size={cellSize} />
      </View>
    </Animated.View>
  );
}

// 先用實際顯示的尺寸把所有圖片載進記憶體，第一次拖曳或合成時才不會空白
const ArtPreloader = memo(function ArtPreloader({ size }: { size: number }) {
  return (
    <View pointerEvents="none" style={styles.preloader} testID="art-preloader">
      {CHAIN_IDS.flatMap((chain) => [
        <PieceIcon key={chain} piece={{ id: 0, kind: 'generator', chain }} size={size} />,
        ...CHAINS[chain].items.map((_, index) => (
          <PieceIcon
            key={`${chain}-${index}`}
            piece={{ id: 0, kind: 'item', chain, level: index + 1 }}
            size={size}
          />
        )),
      ])}
    </View>
  );
});

type BoardCellProps = {
  piece: Piece | null;
  cell: number;
  cellSize: number;
  flying: boolean;
  selected: boolean;
  hover: boolean;
  mergeHint: boolean;
  pressCell: SharedValue<number>;
  pressScale: SharedValue<number>;
  liftedCell: SharedValue<number>;
};

// 拖曳時每換一格都會重新渲染棋盤，只有狀態真的改變的格子才需要重畫
const BoardCell = memo(function BoardCell({
  piece,
  cell,
  cellSize,
  flying,
  selected,
  hover,
  mergeHint,
  pressCell,
  pressScale,
  liftedCell,
}: BoardCellProps) {
  const row = Math.floor(cell / BALANCE.boardColumns);
  const column = cell % BALANCE.boardColumns;
  const dark = (row + column) % 2 === 0;
  const lastRow = row === BALANCE.boardRows - 1;
  const lastColumn = column === BALANCE.boardColumns - 1;
  return (
    <View
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
        selected && styles.cellSelected,
        hover && styles.cellHover,
        mergeHint && styles.cellMerge,
      ]}>
      {piece ? (
        <BoardPiece
          key={piece.id}
          piece={piece}
          size={cellSize}
          cell={cell}
          flying={flying}
          pressCell={pressCell}
          pressScale={pressScale}
          liftedCell={liftedCell}
        />
      ) : null}
    </View>
  );
});

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
  const [glides, setGlides] = useState<Glide[]>([]);
  const nextGlideKey = useRef(0);
  const lastHover = useSharedValue<number | null>(null);
  const farthest = useSharedValue(0);
  // 按下時就先把浮動圖層準備好，手指一動在 UI 執行緒切換顯示，不必等 JS 渲染
  const [grabbed, setGrabbed] = useState<{ cell: number; piece: Piece } | null>(null);
  const grabbedReady = useSharedValue(NO_CELL);
  const activated = useSharedValue(false);
  const liftedCell = useDerivedValue(() => (activated.value ? grabbedReady.value : NO_CELL));
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

  const finishGlide = (key: number) => {
    setGlides((current) => current.filter((glide) => glide.key !== key));
  };

  const width = cellSize * COLUMNS;
  const height = cellSize * ROWS;

  const cellOrigin = (cell: number) => ({
    x: (cell % COLUMNS) * cellSize,
    y: Math.floor(cell / COLUMNS) * cellSize,
  });

  const beginPress = (cell: number | null) => {
    pressedCell.current = cell;
    const piece = cell !== null ? board[cell] : null;
    setGrabbed(cell !== null && piece ? { cell, piece } : null);
    dragging.current = false;
    if (cell !== null && board[cell]?.kind === 'generator') {
      pressCell.set(cell);
      pressScale.set(withTiming(PRESS_SCALE, { duration: PRESS_IN_MS }));
    } else {
      pressCell.set(NO_CELL);
    }
  };

  const startDrag = () => {
    // 開始拖曳就不算點擊，產生器改由浮動圖層顯示
    pressCell.set(NO_CELL);
    pressScale.set(1);
    const from = pressedCell.current;
    if (from === null || !board[from]) return;
    dragging.current = true;
    activated.set(true);
    setDragFrom(from);
  };

  const dropAt = (x: number, y: number, didSucceed: boolean, traveled: number) => {
    const from = pressedCell.current;
    const source = from !== null ? board[from] : null;
    if (!dragging.current || from === null || !source) return;
    // 手勢被系統取消時，手指不是真的放在這裡，棋子要回原位。
    // 快速拖曳常常放在棋盤邊緣外一點點，半格內都算放在最近的格子。
    const tolerance = cellSize / 2;
    const inReach =
      x >= -tolerance && x < width + tolerance && y >= -tolerance && y < height + tolerance;
    const to =
      didSucceed && inReach
        ? cellAt(
            Math.min(Math.max(x, 0), width - 1),
            Math.min(Math.max(y, 0), height - 1),
            cellSize
          )
        : null;
    const target = to !== null ? board[to] : null;
    // 這次批次更新裡要同時收起浮動圖層，否則它會短暫顯示成被換走的棋子
    setDragFrom(null);
    setGrabbed(null);

    // 手指只是抖了一下就放開，當作點擊，交給 finishGesture 處理。
    // 看的是移動過的最遠距離：拖遠再放回原格是取消，不能算點擊。
    if (to === from && traveled < cellSize / 2) {
      dragging.current = false;
      if (source.kind === 'generator') pressCell.set(from);
      return;
    }

    // 合成由合成特效接手，不必滑動
    if (to !== null && target && canMerge(source, target)) {
      onMove(from, to);
      return;
    }

    const destination = to ?? from;
    const landing = cellOrigin(destination);
    const newGlides: Glide[] = [];
    if (target && to !== null && to !== from) {
      // 被換走的棋子放在前面，畫在放下的棋子底下
      const origin = cellOrigin(to);
      const back = cellOrigin(from);
      newGlides.push({
        key: nextGlideKey.current++,
        piece: target,
        fromX: origin.x,
        fromY: origin.y,
        toX: back.x,
        toY: back.y,
        fromScale: 1,
      });
    }
    newGlides.push({
      key: nextGlideKey.current++,
      piece: source,
      fromX: x - cellSize / 2,
      fromY: y - cellSize / 2,
      toX: landing.x,
      toY: landing.y,
      fromScale: DRAG_SCALE,
    });
    const movingIds = newGlides.map((glide) => glide.piece.id);
    setGlides((current) => [
      ...current.filter((glide) => !movingIds.includes(glide.piece.id)),
      ...newGlides,
    ]);
    if (to !== null && to !== from) onMove(from, to);
  };

  const finishGesture = () => {
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
    setGrabbed(null);
    setHoverCell(null);
  };

  // 浮動圖層真的畫好了才算就緒；收起時要等滑動特效接手後才顯示回格子
  useLayoutEffect(() => {
    grabbedReady.set(grabbed ? grabbed.cell : NO_CELL);
    if (!grabbed) activated.set(false);
  }, [grabbed, grabbedReady, activated]);

  // 手勢設定一換就會重新註冊，拖曳途中發生會中斷觸控。
  // 所以設定只建立一次，透過 ref 呼叫每次渲染最新的處理函式。
  const handlers = useRef({ beginPress, startDrag, dropAt, finishGesture });
  useLayoutEffect(() => {
    handlers.current = { beginPress, startDrag, dropAt, finishGesture };
  });

  const panConfig = useMemo(() => {
    const onPress = (cell: number | null) => handlers.current.beginPress(cell);
    const onStart = () => handlers.current.startDrag();
    const onDrop = (x: number, y: number, didSucceed: boolean, traveled: number) =>
      handlers.current.dropAt(x, y, didSucceed, traveled);
    const onEnd = () => handlers.current.finishGesture();
    const half = cellSize / 2;

    // 棋子位置直接在 UI 執行緒更新，JS 忙碌時也能跟手；
    // 要讀 React 狀態的判定（點擊、拖曳、放下）才交回 JS。
    return {
      // 門檻低才跟手；抖動造成的誤判由 dropAt 當作點擊處理
      minDistance: 3,
      onBegin: (event: { x: number; y: number }) => {
        'worklet';
        lastHover.set(null);
        farthest.set(0);
        activated.set(false);
        grabbedReady.set(NO_CELL);
        dragX.set(event.x - half);
        dragY.set(event.y - half);
        scheduleOnRN(onPress, cellAt(event.x, event.y, cellSize));
      },
      onActivate: (event: { x: number; y: number }) => {
        'worklet';
        dragX.set(event.x - half);
        dragY.set(event.y - half);
        activated.set(true);
        scheduleOnRN(onStart);
      },
      onUpdate: (event: { x: number; y: number; translationX: number; translationY: number }) => {
        'worklet';
        farthest.set(
          Math.max(farthest.get(), Math.hypot(event.translationX, event.translationY))
        );
        dragX.set(event.x - half);
        dragY.set(event.y - half);
        const cell = cellAt(event.x, event.y, cellSize);
        if (cell !== lastHover.get()) {
          lastHover.set(cell);
          scheduleOnRN(setHoverCell, cell);
        }
      },
      onDeactivate: (event: { x: number; y: number; canceled: boolean }) => {
        'worklet';
        scheduleOnRN(onDrop, event.x, event.y, !event.canceled, farthest.get());
      },
      onFinalize: () => {
        'worklet';
        scheduleOnRN(onEnd);
      },
    };
  }, [cellSize, dragX, dragY, farthest, lastHover, activated, grabbedReady]);
  const pan = usePanGesture(panConfig);

  const floatingStyle = useAnimatedStyle(() => ({
    opacity: liftedCell.value === NO_CELL ? 0 : 1,
    transform: [{ translateX: dragX.value }, { translateY: dragY.value }, { scale: DRAG_SCALE }],
  }));

  const dragged = dragFrom !== null ? board[dragFrom] : null;
  const animatingIds = new Set([...flights, ...merges, ...glides].map((effect) => effect.piece.id));

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.board, { width, height }]} testID="board">
        {board.map((piece, cell) => {
          const hover = dragged !== null && cell === hoverCell && cell !== dragFrom;
          return (
            <BoardCell
              key={cell}
              piece={piece}
              cell={cell}
              cellSize={cellSize}
              flying={piece !== null && animatingIds.has(piece.id)}
              selected={cell === selected}
              hover={hover}
              mergeHint={hover && piece !== null && canMerge(dragged, piece)}
              pressCell={pressCell}
              pressScale={pressScale}
              liftedCell={liftedCell}
            />
          );
        })}
        <ArtPreloader size={cellSize} />
        {glides.map((glide) => (
          <PieceGlide key={glide.key} glide={glide} cellSize={cellSize} onDone={finishGlide} />
        ))}
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
        {grabbed ? (
          <Animated.View
            key={grabbed.piece.id}
            pointerEvents="none"
            testID="floating-piece"
            style={[styles.floating, { width: cellSize, height: cellSize }, floatingStyle]}>
            <View style={[styles.piece, grabbed.piece.kind === 'generator' && styles.generator]}>
              <PieceView piece={grabbed.piece} size={cellSize} />
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
  preloader: {
    position: 'absolute',
    opacity: 0,
  },
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
