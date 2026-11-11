import { Image } from 'expo-image';
import { useIsFocused } from 'expo-router';
import { useBottomTabBarHeight } from 'expo-router/js-tabs';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInRight, LinearTransition, ZoomOut } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/shallow';

import { Board, InfoBar } from '@/features/board';
import { SaveErrorScreen } from '@/features/errors';
import { customerArtSize, CustomerTray } from '@/features/orders';
import { useOverlayStore } from '@/features/overlays';
import { QUEUE_METER_HEIGHT, QueueMeter } from '@/features/queue-meter';
import { BALANCE, BOARD_BACKGROUND, CHAINS, RECIPES_BY_ID } from '@/game/content';
import { applyDrop, resolveDrop } from '@/game/drop';
import {
  completeOrder,
  customerForOrder,
  findOrderCells,
  getSpawnBlocker,
  msUntilNextEnergy,
  sellPiece,
  tapGenerator,
  xpToNextLevel,
} from '@/game/engine';
import { useGameStore } from '@/game/store';
import { useTabSwitchTiming } from '@/features/tabs';
import { retryLoadGame, startOverAfterSaveFailure } from '@/services/game-session';

const MAX_BOARD_WIDTH = 480;
const SCREEN_PADDING = 12;
// 棋盤以外的 HUD、資訊列與間距總高，不含訂單與客流計量條
const NON_BOARD_HEIGHT = 106;
// 客流計量條（S2.2）的高度加上它下方的間距（content 的 gap）
const QUEUE_METER_SPACE = QUEUE_METER_HEIGHT + 10;
const ORDER_GAP = 8;
// 訂單人物圖下方的品名與獎勵標籤
const ORDER_LABEL_HEIGHT = 42;
const TOAST_MS = 1800;
const ORDER_SHIFT_MS = 260;
const ORDER_ENTER_MS = 260;
const ORDER_EXIT_MS = 160;
// 背景圖的寬高比（768×1376）
const BACKGROUND_ASPECT = 768 / 1376;

function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function Hud() {
  const state = useGameStore(
    useShallow((store) =>
      store.state
        ? {
            level: store.state.level,
            xp: store.state.xp,
            coins: store.state.coins,
            energy: store.state.energy,
            energyUpdatedAt: store.state.energyUpdatedAt,
          }
        : null
    )
  );
  // 除錯面板快轉時，倒數也要用同一個時間
  const timeOffsetMs = useGameStore((store) => store.timeOffsetMs);
  // 倒數只影響這裡，計時放在 Hud 裡，每秒才不會重畫整個畫面
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (!state) return null;
  const untilNext = msUntilNextEnergy(state, now + timeOffsetMs);
  return (
    <View style={styles.hud}>
      <Text style={styles.hudText}>
        ⭐ Lv.{state.level}（{state.xp}/{xpToNextLevel(state.level)}）
      </Text>
      <Text style={styles.hudText}>🪙 {state.coins}</Text>
      <Text style={styles.hudText} testID="energy">
        ⚡ {state.energy}/{BALANCE.maxEnergy}
        {untilNext !== null ? ` · ${formatCountdown(untilNext)}` : ''}
      </Text>
    </View>
  );
}

function Orders({
  artSize,
  onComplete,
}: {
  artSize: { width: number; height: number };
  onComplete: (id: number) => void;
}) {
  const orders = useGameStore((store) => store.state?.orders);
  const board = useGameStore((store) => store.state?.board);
  if (!orders || !board) return null;
  return (
    // 高度和棋盤版面計算時預留的一致（客人圖 + 品名標籤），不依賴子元件撐開
    <View style={[styles.orders, { height: artSize.height + ORDER_LABEL_HEIGHT }]}>
      {orders.map((order) => {
        const ready = findOrderCells({ board }, order) !== null;
        return (
          <Animated.View
            key={order.id}
            // 等其他卡片讓出位置才進場，避免疊在一起
            entering={FadeInRight.delay(ORDER_SHIFT_MS).duration(ORDER_ENTER_MS)}
            exiting={ZoomOut.duration(ORDER_EXIT_MS)}
            layout={LinearTransition.duration(ORDER_SHIFT_MS)}
            style={styles.orderSlot}>
            <Pressable
              testID="order"
              disabled={!ready}
              onPress={() => onComplete(order.id)}
              style={styles.order}>
              <CustomerTray
                customer={customerForOrder(order)}
                requirements={order.requirements}
                width={artSize.width}
                height={artSize.height}
              />
              <View style={[styles.orderLabel, ready && styles.orderLabelReady]}>
                <Text style={[styles.orderName, ready && styles.orderTextReady]} numberOfLines={1}>
                  {/* 貴客單沒有品項需求，改顯示指定的發明菜（S4.1；正式的貴客卡在 S4.3） */}
                  {order.kind === 'vip' && order.recipe !== undefined
                    ? `貴客：${RECIPES_BY_ID[order.recipe].name}`
                    : order.requirements
                        .map(
                          (requirement) =>
                            CHAINS[requirement.chain].items[requirement.level - 1].name
                        )
                        .join('、')}
                </Text>
                <Text
                  style={[styles.orderReward, ready && styles.orderTextReady]}
                  numberOfLines={1}>
                  {ready ? '點我出餐！' : `🪙${order.coins} ⚡${order.energy}`}
                </Text>
              </View>
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

export default function GameScreen() {
  const board = useGameStore((store) => store.state?.board);
  const loadFailure = useGameStore((store) =>
    store.status.kind === 'failed' ? store.status.reason : null
  );
  const apply = useGameStore((store) => store.apply);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // 底部分頁列（含安全區）佔掉的高度；棋盤高度要扣掉它
  const tabBarHeight = useBottomTabBarHeight();
  useTabSwitchTiming('index');
  // 分頁失焦時暫停棋盤的循環動畫（冒熱氣）
  const focused = useIsFocused();
  // 選取記住「哪一格的哪一個棋子」：賣掉、升級用掉、或待放的產生器補進同一格時，
  // id 不同就自動取消，選取不會跳到別的棋子上（code review 2026-11-11、RC-6）
  const [selection, setSelection] = useState<{ cell: number; id: number } | null>(null);
  // 演出或攤位面板蓋住棋盤時，暫停棋盤的循環動畫（冒熱氣）
  const overlayBlocking = useOverlayStore(
    (store) => store.stallPanel !== null || store.sellout !== null || store.invention !== null
  );
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  if (loadFailure) {
    return (
      <SaveErrorScreen
        reason={loadFailure}
        onRetry={retryLoadGame}
        onStartOver={startOverAfterSaveFailure}
      />
    );
  }
  if (!board) return <View style={styles.screen} />;

  const selected =
    selection !== null && board[selection.cell]?.id === selection.id ? selection.cell : null;

  const boardWidth = Math.min(windowWidth - SCREEN_PADDING * 2, MAX_BOARD_WIDTH);
  const artSize = customerArtSize((boardWidth + ORDER_GAP) / BALANCE.orderSlots);
  const boardHeight =
    windowHeight -
    insets.top -
    tabBarHeight -
    NON_BOARD_HEIGHT -
    QUEUE_METER_SPACE -
    artSize.height -
    ORDER_LABEL_HEIGHT;
  const cellSize = Math.floor(
    Math.min(boardWidth / BALANCE.boardColumns, boardHeight / BALANCE.boardRows)
  );

  // 背景維持直式比例：手機填滿寬度，寬螢幕置中，兩側露出與夜空相近的底色
  const backgroundWidth = Math.min(
    windowWidth,
    Math.max(windowHeight * BACKGROUND_ASPECT, boardWidth + SCREEN_PADDING * 2)
  );

  const handleTapCell = (cell: number) => {
    // 事件當下才讀最新的 state，不必為了這裡訂閱整個 state
    const state = useGameStore.getState().state;
    if (!state) return;
    const piece = state.board[cell];
    setSelection(piece ? { cell, id: piece.id } : null);
    if (piece?.kind !== 'generator') return;
    const blocker = getSpawnBlocker(state);
    if (blocker === 'no-energy') setToast('體力不足，稍等一下再來');
    if (blocker === 'board-full') setToast('棋盤滿了，先合成或賣掉一些');
    apply((current) => tapGenerator(current, cell));
  };

  // 放開時才查一次判定，決定播哪種動畫（不訂閱 store，拖曳時不會重繪）
  const previewDrop = (from: number, to: number) => {
    const state = useGameStore.getState().state;
    return state ? resolveDrop(state, from, to) : null;
  };

  const handleMove = (from: number, to: number) => {
    setSelection(null);
    // 落子的判定一律交給規則層（RC-4、NP-1）；時間由 apply 傳入
    apply((current, now) => applyDrop(current, from, to, now));
  };

  const handleSell = (cell: number) => {
    // 發明菜還有剩（一次只賣 1 份）時同一個棋子還在，保持選取方便連續賣；
    // 賣完或換成別的棋子（例如補進來的產生器）時，下面的 selected 會自動變成 null（RC-6）
    apply((current) => sellPiece(current, cell));
  };

  const handleCompleteOrder = (id: number) => {
    setSelection(null);
    apply((current, now) => completeOrder(current, id, now));
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <Image
        source={BOARD_BACKGROUND}
        contentFit="cover"
        contentPosition="bottom"
        draggable={false}
        style={[
          styles.background,
          { width: backgroundWidth, left: (windowWidth - backgroundWidth) / 2 },
        ]}
      />
      <View style={[styles.content, { width: boardWidth }]}>
        <Hud />
        <QueueMeter />
        <Orders artSize={artSize} onComplete={handleCompleteOrder} />
        <InfoBar selected={selected} onSell={handleSell} />
        <View style={styles.boardArea}>
          <Board
            board={board}
            cellSize={cellSize}
            selected={selected}
            onTapCell={handleTapCell}
            onMove={handleMove}
            previewDrop={previewDrop}
            animate={focused && !overlayBlocking}
          />
        </View>
        {toast ? (
          <View pointerEvents="none" style={styles.toast}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#0A1E3D',
    // 網頁版靠長按與拖曳操作，不能觸發文字選取
    userSelect: 'none',
  },
  background: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  content: {
    flex: 1,
    gap: 10,
    paddingTop: 8,
  },
  boardArea: {
    alignItems: 'center',
  },
  hud: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  hudText: {
    color: '#FFF3D6',
    fontSize: 14,
    fontWeight: '600',
  },
  orders: {
    flexDirection: 'row',
    gap: ORDER_GAP,
  },
  orderSlot: {
    flex: 1,
  },
  // 不要設 flex: 1：外層格子沒有固定高度，flex: 1 會讓卡片高度塌成 0（客人圖被資訊列蓋住）
  order: {
    alignItems: 'center',
    gap: 2,
  },
  // 少了卡片底色，文字要有深色底才看得清楚
  orderLabel: {
    alignSelf: 'stretch',
    height: ORDER_LABEL_HEIGHT - 2,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000AA',
  },
  orderLabelReady: {
    backgroundColor: '#F2C572',
  },
  orderName: {
    color: '#FFF3D6',
    fontSize: 12,
  },
  orderReward: {
    color: '#FFF3D6',
    fontSize: 12,
    fontWeight: '600',
  },
  orderTextReady: {
    color: '#4A3420',
  },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 24,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#000000CC',
  },
  toastText: {
    color: '#FFF3D6',
    fontSize: 14,
  },
});
