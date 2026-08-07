// §6.7 EditorProvider — "Drill + 편집 UI 상태 + history + WorldHandles ref + TransformWriter".
// render-stage(같은 Wave 3 형제 모듈)의 TransformWriter/raf 가 이제 존재하므로(§6.2/§6.3) 여기서
// 소유한다 — createTransformWriter() 는 DOM 엘리먼트 없이도 만들 수 있고(register 는 나중에 실제
// SVGGElement 가 붙을 때 호출된다), CourtStage(render-stage)는 `writer` 를 props 로 받게 설계돼
// 있다(그 파일 헤더 주석). 스텝 전환 트윈(§6.7 "블로커 수정")은 tween.ts 의 순수 조각
// (poseFrame/startTween)을 실제 writer/raf 에 연결해 여기서 완성한다.
//
// 판단 근거(계약서 pseudocode 가 비워 둔 부분): §6.7 예시의 `stepMs`/`immediate` 출처가 문서에
// 명시돼 있지 않다 — `stepMs` 는 재생 속도 1배 기준 기본 간격(PLAYBACK.stepIntervalMs[1])에
// 스텝별 durationMs override(model/playback.ts effectiveStepMs)를 적용한 값으로, `immediate` 는
// "epoch 가 바로 전 렌더와 달라졌는가"로 근사했다(UNDO/REDO/DRILL_LOAD/STEP_* 등 §6.7 이 명시한
// epoch 증가 액션 전부를 즉시 스냅으로 처리 — 명시된 부분집합(undo/redo/드릴 로드/코트 재마운트)
// 보다 넓지만, "구조 변경엔 트윈하지 않는다"는 의도와 어긋나지 않는다).
import { createContext, useContext, useEffect, useLayoutEffect, useReducer, useRef } from 'react';
import type { Dispatch, MutableRefObject, ReactNode } from 'react';
import { kmhToPxPerS } from '../../core/units.ts';
import { CHAIR, PLAYBACK } from '../../core/constants.ts';
import { easeStandard } from '../../core/geom.ts';
import type { Drill } from '../../model/drill.ts';
import { COURT_DEFS } from '../../model/court.ts';
import { effectiveStepMs } from '../../model/playback.ts';
import { createPhysicsWorld } from '../../physics/index.ts';
import type { PhysicsWorldApi } from '../../physics/index.ts';
import { createTransformWriter } from '../../render/transformWriter.ts';
import type { TransformWriter } from '../../render/transformWriter.ts';
import { raf } from '../../render/rafLoop.ts';
import { useSettingsState } from '../settings/SettingsProvider.tsx';
import type { EditorAction } from './actions.ts';
import type { EditorState } from './reducer.ts';
import { editorRootReducer, initEditorState, selectStepIndex } from './reducer.ts';
import { poseFrame, startTween } from './tween.ts';
import type { TweenHandle } from './tween.ts';

export type EditorWorldRef = MutableRefObject<PhysicsWorldApi | null>;

const EditorStateContext = createContext<EditorState | null>(null);
const EditorDispatchContext = createContext<Dispatch<EditorAction> | null>(null);
const EditorWorldContext = createContext<EditorWorldRef | null>(null);
const EditorWriterContext = createContext<TransformWriter | null>(null);

function effectiveReduceMotion(setting: 'system' | 'always'): boolean {
  if (setting === 'always') return true;
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function EditorProvider({ drill, children }: { drill: Drill; children: ReactNode }) {
  const [state, dispatch] = useReducer(editorRootReducer, drill, initEditorState);
  const { prefs, physics } = useSettingsState();
  const worldRef = useRef<PhysicsWorldApi | null>(null);
  const physicsRef = useRef(physics);
  physicsRef.current = physics;
  const writerRef = useRef<TransformWriter | null>(null);
  if (!writerRef.current) writerRef.current = createTransformWriter();
  const tweenRef = useRef<TweenHandle | null>(null);
  const prevEpochRef = useRef(state.epoch);

  // 물리 엔진 인스턴스는 React state 로 들지 않는다(ref) — courtMode 는 드릴 레벨 불변(§3.2)이라
  // DRILL_LOAD 로 코트가 다른 드릴을 불러올 때만 재생성한다. limits 는 재생성 시점의 설정값을
  // 스냅샷으로 읽는다(편집 도중 설정 화면에서 배수를 바꿔도 이번 세션 물리에는 즉시 반영되지
  // 않는다 — 살아있는 드래그 세션 도중 vLin/ω 가 바뀌면 §5.11 릴리스 체이스 계산이 뒤틀린다).
  useEffect(() => {
    const mode = state.present.courtMode;
    const { vbW, vbH } = COURT_DEFS[mode];
    const p = physicsRef.current;
    const limits = {
      vLinPxPerS: kmhToPxPerS(p.linearKmh) * p.editorSpeedMultiplier,
      omegaRadPerS: (kmhToPxPerS(p.bumperKmh) / CHAIR.pivotToFrontPx) * p.editorSpeedMultiplier,
    };
    const world = createPhysicsWorld(vbW, vbH, limits);
    worldRef.current = world;
    return () => {
      world.dispose();
      if (worldRef.current === world) worldRef.current = null;
    };
  }, [state.present.courtMode]);

  // §6.7 물리 재동기화(blocker 수정): 로스터·코트가 바뀔 때만 world.load 를 다시 부른다.
  // [state.present] 전체에 걸면 메모 6글자 타이핑에 25바디 월드가 6번 재생성되고, PLACE_COMMIT 이
  // writeFrame 을 강제해 굴러가던 공이 제자리로 스냅된다. stepId 는 의도적으로 deps 밖이다.
  useEffect(() => {
    const idx = selectStepIndex(state);
    const currentStep = state.present.steps[idx];
    if (currentStep) worldRef.current?.load(state.present.cast, currentStep, state.present.courtMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.present.cast, state.present.courtMode]);

  // §6.7 스텝 전환 트윈(blocker 수정): 진입점 하나에서 트윈/즉시를 분기한다. immediate=true 는
  // 구조 변경·시점 점프(epoch 증가)에만 — 조건 없이 writeFrame 하면 .6s 전환이 사라진다.
  useLayoutEffect(() => {
    const writer = writerRef.current!;
    const idx = selectStepIndex(state);
    const currentStep = state.present.steps[idx];
    if (!currentStep) return;
    const immediate = state.epoch !== prevEpochRef.current;
    prevEpochRef.current = state.epoch;
    tweenRef.current?.cancel();
    const from = writer.snapshot();
    const to = poseFrame(currentStep);
    const reduce = effectiveReduceMotion(prefs.a11y.reduceMotion);
    const baseMs = effectiveStepMs(currentStep, PLAYBACK.stepIntervalMs[1]);
    const ms = immediate || reduce ? 0 : PLAYBACK.transitionMsFor(baseMs);
    tweenRef.current = startTween(from, to, ms, easeStandard, raf.add, writer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.stepId, state.epoch]);

  useEffect(
    () => () => {
      tweenRef.current?.cancel();
      writerRef.current?.clear();
    },
    [],
  );

  return (
    <EditorWorldContext.Provider value={worldRef}>
      <EditorWriterContext.Provider value={writerRef.current}>
        <EditorDispatchContext.Provider value={dispatch}>
          <EditorStateContext.Provider value={state}>{children}</EditorStateContext.Provider>
        </EditorDispatchContext.Provider>
      </EditorWriterContext.Provider>
    </EditorWorldContext.Provider>
  );
}

export function useEditorState(): EditorState {
  const v = useContext(EditorStateContext);
  if (!v) throw new Error('useEditorState 는 EditorProvider 안에서만 쓸 수 있다');
  return v;
}
export function useEditorDispatch(): Dispatch<EditorAction> {
  const v = useContext(EditorDispatchContext);
  if (!v) throw new Error('useEditorDispatch 는 EditorProvider 안에서만 쓸 수 있다');
  return v;
}
/** render-stage(CourtStage) 가 PhysicsWorldApi 를 직접 다루는 통로(§6.7 WorldHandles ref). */
export function useEditorWorld(): EditorWorldRef {
  const v = useContext(EditorWorldContext);
  if (!v) throw new Error('useEditorWorld 는 EditorProvider 안에서만 쓸 수 있다');
  return v;
}
/** `<CourtStage writer={...}>` 에 그대로 넘긴다(§6.2). */
export function useEditorWriter(): TransformWriter {
  const v = useContext(EditorWriterContext);
  if (!v) throw new Error('useEditorWriter 는 EditorProvider 안에서만 쓸 수 있다');
  return v;
}
