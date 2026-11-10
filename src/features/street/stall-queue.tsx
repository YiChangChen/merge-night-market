import { Image } from 'expo-image';
import { memo, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeInRight,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { CHAIN_IDS, type ChainId, CUSTOMERS } from '@/game/content';
import { distributeQueue } from '@/game/queue';
import { useGameStore } from '@/game/store';

// 每攤最多畫 4 個頭像（S1.3 結論），其餘顯示「+k」（FR43）
export const MAX_STALL_AVATARS = 4;
const AVATAR_SIZE = 34;
export const STALL_QUEUE_HEIGHT = AVATAR_SIZE + 8;
// 新一波時客人一個接一個入列
const ENTER_STAGGER_MS = 140;
const ENTER_MS = 260;
const LEAVE_MS = 200;
const BOB_MS = 700;

type QueueAvatarProps = {
  source: number;
  index: number;
  animate: boolean;
};

/** 排隊的一位客人：輕輕上下晃動，相位依位置錯開；夜市街失焦時停止並歸位。 */
function QueueAvatar({ source, index, animate }: QueueAvatarProps) {
  const bob = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(bob);
    if (!animate) {
      bob.set(0);
      return;
    }
    bob.set(
      withDelay(
        index * 180,
        withRepeat(withTiming(1, { duration: BOB_MS, easing: Easing.inOut(Easing.sin) }), -1, true)
      )
    );
    return () => cancelAnimation(bob);
  }, [animate, bob, index]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: -3 * bob.get() }] }));

  return (
    <Animated.View style={style}>
      <Image
        source={source}
        contentFit="cover"
        contentPosition="top"
        cachePolicy="memory-disk"
        style={styles.avatar}
      />
    </Animated.View>
  );
}

type StallQueueProps = {
  chain: ChainId;
  /** 夜市街在前景時才播放循環動畫 */
  animate: boolean;
};

/**
 * 攤位前的排隊頭像（S2.3、FR43）。只訂閱這一攤分到的人數與波次（都是數字），拖曳棋子不會重繪。
 * 人數為 0（鐵捲門、冷卻中）時保留同樣高度，5 個攤位的底部才會對齊。
 */
export const StallQueue = memo(function StallQueue({ chain, animate }: StallQueueProps) {
  const count = useGameStore((store) => (store.state ? distributeQueue(store.state)[chain] : 0));
  const wave = useGameStore((store) => store.state?.queue.wave ?? 1);
  const visible = Math.min(count, MAX_STALL_AVATARS);
  const overflow = count - visible;
  const stallIndex = CHAIN_IDS.indexOf(chain);

  return (
    <View
      testID={`stall-${chain}-queue`}
      accessibilityLabel={count > 0 ? `排隊 ${count} 人` : '沒有人排隊'}
      style={styles.queue}>
      {Array.from({ length: visible }, (_, index) => (
        <Animated.View
          key={`${wave}-${index}`}
          testID={`stall-${chain}-queue-avatar`}
          entering={FadeInRight.delay(index * ENTER_STAGGER_MS).duration(ENTER_MS)}
          exiting={FadeOut.duration(LEAVE_MS)}
          layout={LinearTransition.duration(ENTER_MS)}>
          <QueueAvatar
            source={CUSTOMERS[(wave * 5 + stallIndex * 3 + index) % CUSTOMERS.length].art}
            index={index}
            animate={animate}
          />
        </Animated.View>
      ))}
      {overflow > 0 ? (
        <Text testID={`stall-${chain}-queue-overflow`} style={styles.overflow}>
          +{overflow}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  queue: {
    height: STALL_QUEUE_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2,
    borderColor: '#FFF3D6',
    backgroundColor: '#1E2550',
  },
  overflow: {
    color: '#FFF3D6',
    fontSize: 14,
    fontWeight: '800',
    textShadowColor: '#000000',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 1 },
  },
});
