// 편집기 "재생" 트랜스포트의 실제 동작. §6.9/§6.7 판단 근거(EditorScreen.tsx 상단 참고):
// EditorProvider 는 state.stepId 가 바뀔 때마다 스텝 전환 트윈을 자동으로 돈다(§6.7 blocker
// 수정) — 그러므로 편집기 "재생" 은 sampleDrill 을 다시 구현하지 않고, 일정 간격마다
// STEP_SELECT 를 dispatch 해 다음 스텝으로 넘기기만 하면 된다. 간격은 §6.7/PLAYBACK.stepIntervalMs
// 를 그대로 쓴다(present 와 동일 상수, 값의 의미가 재생 속도 배율이므로 재사용이 맞다).
import { useEffect, useRef } from 'react';
import type { Dispatch } from 'react';
import { PLAYBACK } from '../../core/constants.ts';
import { effectiveStepMs } from '../../model/playback.ts';
import type { Drill } from '../../model/drill.ts';
import type { EditorAction } from '../../store/editor/actions.ts';
import { usePlaybackActions, usePlaybackState } from '../../store/playback/PlaybackProvider.tsx';
import { raf } from '../../render/rafLoop.ts';

export function useStepPlayback(drill: Drill, stepId: string, dispatch: Dispatch<EditorAction>): void {
  const { playing, speed, loop } = usePlaybackState();
  const { pause, advanceMs, resetMs } = usePlaybackActions();

  const drillRef = useRef(drill);
  drillRef.current = drill;
  const stepIdRef = useRef(stepId);
  stepIdRef.current = stepId;

  // 스텝이 바뀌면(자동이든 수동이든) 그 스텝 안에서의 경과를 0 부터 다시 잰다.
  useEffect(() => {
    resetMs();
  }, [stepId, resetMs]);

  useEffect(() => {
    if (!playing) return;
    if (drillRef.current.steps.length < 2) {
      pause();
      return;
    }
    return raf.add((dtMs) => {
      const steps = drillRef.current.steps;
      const idx = steps.findIndex((s) => s.id === stepIdRef.current);
      const cur = steps[idx];
      if (!cur) return;
      const target = effectiveStepMs(cur, PLAYBACK.stepIntervalMs[speed]);
      const elapsed = advanceMs(dtMs);
      if (elapsed < target) return;
      resetMs();
      const nextIdx = idx + 1;
      if (nextIdx < steps.length) {
        dispatch({ type: 'STEP_SELECT', id: steps[nextIdx]!.id });
      } else if (loop) {
        dispatch({ type: 'STEP_SELECT', id: steps[0]!.id });
      } else {
        pause();
      }
    });
  }, [playing, speed, loop, advanceMs, resetMs, pause, dispatch]);
}
