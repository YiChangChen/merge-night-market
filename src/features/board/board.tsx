import { Image } from 'expo-image';
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { BALANCE, CHAIN_IDS, CHAINS, RECIPES, RECIPES_BY_ID } from '@/game/content';
import {
  canMerge,
  findMerges,
  findSpawns,
  type Piece,
  type Spawn,
} from '@/game/engine';
import type { DropResult } from '@/game/drop';

import { releasePlan } from './release-plan';

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
// 組錯（reject）：先在放開處左右搖頭，再滑回原格（UX-DR6）
const SHAKE_GLIDE_MS = 440;
const SHAKE_PORTION = 0.55;
// 冒熱氣（UX-DR9）：整個棋盤共用一個時鐘，各格只用相位差
const STEAM_CYCLE_MS = 1800;
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
  /** 組錯：滑回之前先搖頭 */
  shake?: boolean;
};

type BoardProps = {
  board: (Piece | null)[];
  cellSize: number;
  selected: number | null;
  onTapCell: (cell: number) => void;
  onMove: (from: number, to: number) => void;
  /**
   * 放開時查詢規則層的判定（resolveDrop），決定播放哪種動畫（S3.3）。
   * 沒有提供時退回舊的判斷（只分合成與交換）。
   */
  previewDrop?: (from: number, to: number) => DropResult | null;
  /** 棋盤在前景時才播放循環動畫（冒熱氣） */
  animate?: boolean;
};

/** 棋子的圖示：產生器、品項、發明菜 */
function pieceArt(piece: Piece): number {
  if (piece.kind === 'dish') return RECIPES_BY_ID[piece.recipe].art;
  const chain = CHAINS[piece.chain];
  return piece.kind === 'generator' ? chain.generatorArt : chain.items[piece.level - 1].art;
}

export function PieceIcon({ piece, size }: { piece: Piece; size: number }) {
  const isGenerator = piece.kind === 'generator';
  const iconSize = size * (isGenerator ? 0.88 : 0.84);
  return (
    <Image
      source={pieceArt(piece)}
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
      {/* 發明菜的份數（FR23）：2、3 份時才顯示，底色和品項階數不同 */}
      {piece.kind === 'dish' && piece.count > 1 ? (
        <Text style={styles.dishCount}>×{piece.count}</Text>
      ) : null}
    </>
  );
}

/** L4 以上的品項與發明菜會冒熱氣（UX-DR9） */
function hasSteam(piece: Piece): boolean {
  return piece.kind === 'dish' || (piece.kind === 'item' && piece.level >= 4);
}

function SteamWisp({
  clock,
  phase,
  size,
  left,
}: {
  clock: SharedValue<number>;
  phase: number;
  size: number;
  left: number;
}) {
  const style = useAnimatedStyle(() => {
    const p = (clock.get() + phase) % 1;
    return {
      opacity: Math.sin(Math.PI * p) * 0.75,
      transform: [{ translateY: -p * size * 0.32 }, { scale: 0.6 + 0.6 * p }],
    };
  });
  return (
    <Animated.View
      style={[
        styles.steam,
        { left, top: size * 0.06, width: size * 0.1, height: size * 0.22 },
        style,
      ]}
    />
  );
}

/**
 * 兩縷白煙往上飄並淡出；相位依格子錯開。整個棋盤共用同一個時鐘（只有一個 withRepeat），
 * 但每縷煙仍有自己的 animated style，每幀都會更新：棋盤被演出或面板擋住時要暫停（animate = false）。
 */
function Steam({ clock, cell, size }: { clock: SharedValue<number>; cell: number; size: number }) {
  const phase = (cell * 0.137) % 1;
  return (
    <View pointerEvents="none" testID="steam" style={StyleSheet.absoluteFill}>
      <SteamWisp clock={clock} phase={phase} size={size} left={size * 0.36} />
      <SteamWisp clock={clock} phase={(phase + 0.5) % 1} size={size} left={size * 0.54} />
    </View>
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
  steamClock,
  animate,
}: {
  piece: Piece;
  size: number;
  cell: number;
  flying: boolean;
  pressCell: SharedValue<number>;
  pressScale: SharedValue<number>;
  liftedCell: SharedValue<number>;
  steamClock: SharedValue<number>;
  animate: boolean;
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
        {animate && hasSteam(piece) ? <Steam clock={steamClock} cell={cell} size={size} /> : null}
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
  merge: Burst;
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
      testID="merge-burst"
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
  const { fromX, fromY, toX, toY, fromScale, piece, shake = false } = glide;
  const duration = shake ? SHAKE_GLIDE_MS : GLIDE_MS;
  const wobble = cellSize * 0.12;

  useEffect(() => {
    progress.set(
      withTiming(1, { duration, easing: shake ? Easing.linear : Easing.out(Easing.cubic) })
    );
    // 用計時器收尾而不是動畫 callback，確保棋子一定會顯示回棋盤上
    const timer = setTimeout(() => onDone(glide.key), duration);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 每次滑動只啟動一次
  }, []);

  const glideStyle = useAnimatedStyle(() => {
    if (shake) {
      // 前段在放開處左右搖頭（幅度漸小），後段才滑回原格
      const t = progress.get();
      const s = Math.min(t / SHAKE_PORTION, 1);
      const m = t <= SHAKE_PORTION ? 0 : (t - SHAKE_PORTION) / (1 - SHAKE_PORTION);
      const eased = 1 - (1 - m) ** 3;
      const offset = t < SHAKE_PORTION ? Math.sin(s * Math.PI * 6) * wobble * (1 - s) : 0;
      return {
        transform: [
          { translateX: fromX + (toX - fromX) * eased + offset },
          { translateY: fromY + (toY - fromY) * eased },
          { scale: fromScale + (1 - fromScale) * eased },
        ],
      };
    }
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
/** 合成或發明時播放特效的棋子（合成是新的高一階品項，發明是新的發明菜） */
type Burst = { piece: Piece; cell: number };

/** 比對前後棋盤，找出剛發明出來的發明菜（新的 id）；疊加保留原 id，移動與交換也不會被算進來 */
function findNewDishes(before: (Piece | null)[], after: (Piece | null)[]): Burst[] {
  const beforeIds = new Set(before.map((piece) => piece?.id));
  const bursts: Burst[] = [];
  after.forEach((piece, cell) => {
    if (piece?.kind === 'dish' && !beforeIds.has(piece.id)) bursts.push({ piece, cell });
  });
  return bursts;
}

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
      {/* 發明菜圖示也先載入，第一次出現或拖曳時才不會閃一下空白（code review 2026-11-11） */}
      {RECIPES.map((recipe) => (
        <PieceIcon
          key={recipe.id}
          piece={{ id: 0, kind: 'dish', recipe: recipe.id, count: 1 }}
          size={size}
        />
      ))}
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
  steamClock: SharedValue<number>;
  animate: boolean;
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
  steamClock,
  animate,
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
          steamClock={steamClock}
          animate={animate}
        />
      ) : null}
    </View>
  );
});

export function Board({
  board,
  cellSize,
  selected,
  onTapCell,
  onMove,
  previewDrop,
  animate = true,
}: BoardProps) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [hoverCell, setHoverCell] = useState<number | null>(null);
  const pressedCell = useRef<number | null>(null);
  const dragging = useRef(false);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const pressCell = useSharedValue(NO_CELL);
  const pressScale = useSharedValue(1);
  const [flights, setFlights] = useState<Spawn[]>([]);
  const [merges, setMerges] = useState<Burst[]>([]);
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
  // 冒熱氣的共用時鐘：棋盤失焦時停止
  const steamClock = useSharedValue(0);
  useEffect(() => {
    if (!animate) {
      cancelAnimation(steamClock);
      steamClock.set(0);
      return;
    }
    steamClock.set(
      withRepeat(withTiming(1, { duration: STEAM_CYCLE_MS, easing: Easing.linear }), -1)
    );
    return () => cancelAnimation(steamClock);
  }, [animate, steamClock]);

  // 在渲染中比對，食材才不會先在目標格閃現一幀才開始飛
  if (board !== previousBoard) {
    setPreviousBoard(board);
    const spawns = findSpawns(previousBoard, board);
    if (spawns.length > 0) setFlights([...flights, ...spawns]);
    // 合成與發明都播放同一個特效（發明時目標品項當幀消失，需要一點回饋，code review 2026-11-11）
    const newBursts = [...findMerges(previousBoard, board), ...findNewDishes(previousBoard, board)];
    if (newBursts.length > 0) setMerges([...merges, ...newBursts]);
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

    // 放開後播什麼動畫由規則層的判定決定（S3.3）：合成交給合成特效、組錯搖頭彈回、交換才把目標滑回來
    const moving = to !== null && to !== from;
    const result: DropResult | null = moving
      ? (previewDrop?.(from, to) ?? {
          kind: target && canMerge(source, target) ? 'merge' : target ? 'swap' : 'move',
        } as DropResult)
      : null;
    const plan = result ? releasePlan(result.kind) : null;
    if (plan?.source === 'none') {
      onMove(from, to as number);
      return;
    }

    const destination = plan?.source === 'target' && to !== null ? to : from;
    const landing = cellOrigin(destination);
    const newGlides: Glide[] = [];
    if (plan?.swapBack && target && to !== null) {
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
    // 部分疊加（例如 ×3 疊到 ×2 只移過去 1 份）：只滑一個「移過去的份數」的複本，
    // 複本用負數 id，留在原格的那幾份不會被藏起來（code review 2026-11-11）
    const partialStack =
      result?.kind === 'stack' && source.kind === 'dish' && result.moved < source.count;
    const gliding: Piece = partialStack
      ? { ...source, id: -1 - nextGlideKey.current, count: result.moved as 1 | 2 }
      : source;
    newGlides.push({
      key: nextGlideKey.current++,
      piece: gliding,
      fromX: x - cellSize / 2,
      fromY: y - cellSize / 2,
      toX: landing.x,
      toY: landing.y,
      fromScale: DRAG_SCALE,
      shake: plan?.shake ?? false,
    });
    const movingIds = newGlides.map((glide) => glide.piece.id);
    setGlides((current) => [
      ...current.filter((glide) => !movingIds.includes(glide.piece.id)),
      ...newGlides,
    ]);
    // 組錯也要交給規則層：state 不變，但會送出 invent_rejected（阿嬤保底）
    if (moving) onMove(from, to as number);
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
              steamClock={steamClock}
              animate={animate}
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
  // 發明菜的份數：和品項階數同一個位置（右下角），用醒目的底色區分
  dishCount: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    paddingHorizontal: 4,
    borderRadius: 6,
    overflow: 'hidden',
    color: '#FFFFFF',
    backgroundColor: '#C2410C',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  steam: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  floating: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 10,
  },
});
