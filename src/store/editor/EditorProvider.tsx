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
import { CHAIR } from '../../core/constants.ts';
import { easeStandard } from '../../core/geom.ts';
import type { Drill } from '../../model/drill.ts';
import { courtDefFor } from '../../model/court.ts';
import { createPhysicsWorld } from '../../physics/index.ts';
import type { DragLimits } from '../../physics/types.ts';
import type { PhysicsParams } from '../../storage/prefs.ts';
import type { PhysicsWorldApi } from '../../physics/index.ts';
import { createTransformWriter } from '../../render/transformWriter.ts';
import type { TransformWriter } from '../../render/transformWriter.ts';
import { raf } from '../../render/rafLoop.ts';
import { useSettingsState } from '../settings/SettingsProvider.tsx';
import type { EditorAction } from './actions.ts';
import type { EditorState } from './reducer.ts';
import { editorRootReducer, initEditorState, selectStepIndex } from './reducer.ts';
import { effectiveReduceMotion, poseFrame, startTween, stepTransitionMs } from './tween.ts';
import type { TweenHandle } from './tween.ts';

export type EditorWorldRef = MutableRefObject<PhysicsWorldApi | null>;

const EditorStateContext = createContext<EditorState | null>(null);
const EditorDispatchContext = createContext<Dispatch<EditorAction> | null>(null);
const EditorWorldContext = createContext<EditorWorldRef | null>(null);
const EditorWriterContext = createContext<TransformWriter | null>(null);

/** 설정값 → 물리 속도 상한.
 *
 *  speedLimit 을 끄면 상한을 사실상 없앤다. Infinity 를 쓰지 않는 이유: clampMag 가
 *  `len <= m` 비교라 Infinity 여도 동작하지만, 그 값이 clamp 이외의 산술
 *  (§5.5 tow 의 vGrab = vLin + ω·rho)에 들어가면 NaN 을 만든다. 한 프레임에 판을 가로지르고도
 *  남는 큰 유한값이면 목적은 같고 수치는 안전하다. */
const NO_LIMIT_PX_PER_S = 1e6;
const NO_LIMIT_RAD_PER_S = 1e4;

function limitsFrom(p: PhysicsParams): DragLimits {
  if (!p.speedLimit) return { vLinPxPerS: NO_LIMIT_PX_PER_S, omegaRadPerS: NO_LIMIT_RAD_PER_S };
  return {
    vLinPxPerS: kmhToPxPerS(p.linearKmh) * p.editorSpeedMultiplier,
    omegaRadPerS: (kmhToPxPerS(p.bumperKmh) / CHAIR.pivotToFrontPx) * p.editorSpeedMultiplier,
  };
}

/** `init` 은 **이어 여는** 경우에만 준다 — 자유 전술판이 다른 화면에 들렀다 돌아올 때
 *  되돌리기 이력·선택·활성 도구까지 그대로 이어받는 통로다(features/board/boardSession.ts).
 *  드릴 편집기는 안 쓴다: 드릴은 저장소가 원본이고, 이력은 여는 순간부터 새로 시작한다.
 *  지연 초기화라 **첫 렌더에서 한 번만** 읽힌다 — 이후 이 prop 이 바뀌어도 무시된다. */
export function EditorProvider({ drill, init, children }: { drill: Drill; init?: EditorState; children: ReactNode }) {
  const [state, dispatch] = useReducer(editorRootReducer, drill, (d) => init ?? initEditorState(d));
  const { prefs, physics } = useSettingsState();
  const worldRef = useRef<PhysicsWorldApi | null>(null);
  const physicsRef = useRef(physics);
  physicsRef.current = physics;
  const writerRef = useRef<TransformWriter | null>(null);
  if (!writerRef.current) writerRef.current = createTransformWriter();
  const tweenRef = useRef<TweenHandle | null>(null);
  // null = 아직 한 번도 frameSync 를 돌지 않았다(마운트). §6.7 이 명시한 immediate 목록에
  // "드릴 로드·코트 재마운트"가 들어 있다 — 마운트를 트윈(0.6s)으로 돌리면 그 동안 트윈이
  // 마운트 시점 프레임을 매 tick 다시 써서, 마운트 직후 0.6초 안의 화살표·메모 편집을
  // 소리 없이 되돌린다(3.10 실측: 보드 화살표 키보드 테스트가 정확히 이걸 잡았다.
  // 휠체어·공·콘은 물리 펌프가 나중에 구독돼 매 tick 이기므로 이 결함이 안 보였을 뿐이다).
  const prevEpochRef = useRef<number | null>(null);

  // 물리 엔진 인스턴스는 React state 로 들지 않는다(ref) — courtMode 는 드릴 레벨 불변(§3.2)이라
  // DRILL_LOAD 로 코트가 다른 드릴을 불러올 때만 재생성한다. limits 는 생성 시점의 설정값으로
  // 시작하고, 이후 변경은 아래 effect 가 setLimits 로 살아 있는 월드에 밀어 넣는다.
  useEffect(() => {
    const mode = state.present.courtMode;
    // §6.4 — 물리 **벽**의 자리다. 크기를 빼면 25×14 판에서도 벽이 825×525 에 서서
    // 개체가 판 밖(경기면 밖 여백 너머)까지 굴러 나간다.
    const { vbW, vbH } = courtDefFor(mode, state.present.courtSize);
    const limits = limitsFrom(physicsRef.current);
    // ⚠️ 존 경계도 **생성 시점에** 넘긴다. 아래 effect 가 setZones 로 따라붙지만, 코트 전환
    // 직후 첫 드래그는 그 effect 보다 앞설 수 있다 — 그때 기본 존으로 갈리면 사용자는
    // "코트를 바꿨더니 슬라이더가 초기화됐다" 로 겪는다(setLimits 와 같은 이유·같은 모양).
    const world = createPhysicsWorld(vbW, vbH, limits, physicsRef.current.zones);
    worldRef.current = world;
    return () => {
      world.dispose();
      if (worldRef.current === world) worldRef.current = null;
    };
  }, [state.present.courtMode, state.present.courtSize]);

  // 속도 상한을 살아 있는 월드에 즉시 반영한다. 하단 스위치로 껐다 켜는 값이라 다음 월드
  // 재생성(= 코트 전환)까지 기다리게 하면 스위치가 고장 난 것처럼 보인다.
  useEffect(() => {
    worldRef.current?.setLimits(limitsFrom(physics));
    // ⚠️ 2026-08-13 5차 검증 — 이 한 줄이 없던 동안 설정의 물리 존 슬라이더 3종이 **판정에
    // 전혀 반영되지 않았다**. 음영·커서는 EditorWorkspace → EditorStage 로 따로 흘러 슬라이더를
    // 따라갔으므로, 판이 '제자리 회전' 이라 칠한 곳을 잡으면 평행 이동이 되는 상태였다.
    worldRef.current?.setZones(physics.zones);
  }, [physics]);

  // §6.7 물리 재동기화(blocker 수정): 로스터·코트가 바뀔 때 world.load 를 다시 부른다.
  // [state.present] 전체에 걸면 메모 6글자 타이핑에 25바디 월드가 6번 재생성되고, PLACE_COMMIT 이
  // writeFrame 을 강제해 굴러가던 공이 제자리로 스냅된다 — 그래서 present 전체는 deps 에 없다.
  //
  // stepId·epoch 은 반드시 있어야 한다(회귀): 이 둘이 빠져 있던 동안 스텝을 넘기면 화면만
  // 트윈되고 물리 바디는 이전 스텝 위치에 머물렀다. 그 상태에서 개체를 잡으면 beginDrag 가
  // world.chairPose() 로 낡은 자세를 읽어와 개체가 이전 스텝 자리로 튀었다.
  // 두 값은 "편집이 아닌 이유로 표시 자세 집합이 통째로 바뀌었다"는 신호다 —
  // stepId=스텝 전환, epoch=되돌리기/다시하기·스텝 추가삭제 같은 시점 점프.
  // 평범한 자세 편집은 steps 만 바꾸고 이 둘을 건드리지 않으므로 재로드가 일어나지 않는다.
  // 잠김·무시가 바뀌면 **물리를 다시 세워야 한다** (기현 신고 2026-08-15).
  // 이 둘은 화면 표시가 아니라 월드의 구성 자체를 바꾼다 — 무시는 body 를 없애고(공이 통과한다),
  // 잠김은 body 를 static 으로(아무것에도 안 밀린다) 만든다. 그런데 위 deps 는 자세 편집을
  // 걸러 내려고 `steps` 를 통째로 뺐기 때문에, 플래그를 켜도 **다음 스텝 전환이나 되돌리기가
  // 있기 전까지 물리에 한 글자도 안 닿았다.** 메뉴에서 잠갔는데 여전히 밀려나던 것이 이것이다.
  // 배열이 아니라 **문자열 키**로 넘긴다 — `step.locked` 는 편집마다 새 배열이라 참조로는
  // 못 쓰고, 값이 같으면 재로드가 일어나지 않아야 한다(재로드는 굴러가던 공을 멈춘다).
  const idxNow = selectStepIndex(state);
  const stepNow = state.present.steps[idxNow];
  const flagKey = `${(stepNow?.locked ?? []).join(',')}|${(stepNow?.ignored ?? []).join(',')}`;

  useEffect(() => {
    const idx = selectStepIndex(state);
    const currentStep = state.present.steps[idx];
    if (currentStep) worldRef.current?.load(state.present.cast, currentStep, state.present.courtMode, state.present.courtSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.present.cast, state.present.courtMode, state.present.courtSize, state.stepId, state.epoch, flagKey]);

  // §6.7 스텝 전환 트윈(blocker 수정): 진입점 하나에서 트윈/즉시를 분기한다. immediate=true 는
  // 구조 변경·시점 점프(epoch 증가)에만 — 조건 없이 writeFrame 하면 .6s 전환이 사라진다.
  useLayoutEffect(() => {
    const writer = writerRef.current!;
    const idx = selectStepIndex(state);
    const currentStep = state.present.steps[idx];
    if (!currentStep) return;
    const immediate = prevEpochRef.current === null || state.epoch !== prevEpochRef.current;
    prevEpochRef.current = state.epoch;
    tweenRef.current?.cancel();
    const from = writer.snapshot();
    const to = poseFrame(currentStep);
    const ms = stepTransitionMs(currentStep, { immediate, reduceMotion: effectiveReduceMotion(prefs.a11y.reduceMotion) });
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
