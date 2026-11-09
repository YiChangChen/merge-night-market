// 收集 UI 執行緒與 JS 執行緒的幀間隔，量測固定時間後回傳統計。只給 Spike A 使用。
import { useEffect, useRef, useState } from 'react';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';

import { type FrameSummary, summarizeFrames } from './stats';

export const MEASURE_MS = 30_000;

export type RunResult = { ui: FrameSummary; js: FrameSummary };

export function useFrameRecorder() {
  const uiDeltas = useSharedValue<number[]>([]);
  const jsDeltas = useRef<number[]>([]);
  const rafId = useRef<number | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const [runs, setRuns] = useState<RunResult[]>([]);

  // UI 執行緒：每一幀記錄與上一幀的間隔
  const uiFrames = useFrameCallback((frame) => {
    'worklet';
    const delta = frame.timeSincePreviousFrame;
    if (delta === null) return;
    uiDeltas.modify((list) => {
      'worklet';
      list.push(delta);
      return list;
    });
  }, false);

  const stopJsLoop = () => {
    if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    rafId.current = null;
  };

  const finish = () => {
    uiFrames.setActive(false);
    stopJsLoop();
    const result: RunResult = {
      ui: summarizeFrames(uiDeltas.get()),
      js: summarizeFrames(jsDeltas.current),
    };
    setRuns((previous) => [...previous, result]);
    setMeasuring(false);
  };

  const start = () => {
    if (measuring) return;
    uiDeltas.set([]);
    jsDeltas.current = [];
    setMeasuring(true);
    uiFrames.setActive(true);

    // JS 執行緒：用 requestAnimationFrame 量 JS 是否跟得上每一幀
    let last: number | null = null;
    const loop = (time: number) => {
      if (last !== null) jsDeltas.current.push(time - last);
      last = time;
      rafId.current = requestAnimationFrame(loop);
    };
    rafId.current = requestAnimationFrame(loop);

    stopTimer.current = setTimeout(finish, MEASURE_MS);
  };

  useEffect(
    () => () => {
      if (stopTimer.current) clearTimeout(stopTimer.current);
      stopJsLoop();
    },
    []
  );

  return { start, measuring, runs, clearRuns: () => setRuns([]) };
}
