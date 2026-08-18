// §6.4/§6.6/§7.5b–d — CourtStage(render-stage)를 편집기 상태에 연결한다. 좌표 변환·포인터
// 캡처·레이어 순서는 CourtStage 소관, 히트테스트·물리 드래그 의미론은 useEditorPointer 소관,
// 이 파일은 그 둘을 조립하고 §7.5 키보드 계약(로빙 tabindex·개체 순회·키보드 배치 커서)만
// 더한다.
import { forwardRef, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ObjectMenu, type ObjectMenuTarget } from './ObjectMenu.tsx';
import { useLongPressMenu } from './useLongPressMenu.ts';
import { sameKindGroup } from './selectSame.ts';
import type { Dispatch, KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react';
import { RAD } from '../../core/angle.ts';
import { isId } from '../../core/ids.ts';
import { eventCode, lookupDef } from '../../core/keymap.ts';
import type { ArrowId, CastId, ChairId, NoteId } from '../../core/ids.ts';
import type { ToolId } from '../../physics/index.ts';
import type { EditorWorldRef } from '../../store/editor/EditorProvider.tsx';
import { poseFrame } from '../../store/editor/tween.ts';
import type { EditorAction } from '../../store/editor/actions.ts';
import type { BallRing, Drill, DrillStep, NoteLabel } from '../../model/drill.ts';
import { ballRingOf } from '../../model/drill.ts';
import type { ZoneConfig } from '../../model/chair.ts';
import { nudgeArrow } from '../../model/arrow.ts';
import type { Arrow, ArrowPart } from '../../model/arrow.ts';
import { courtDefFor, gridCellCenter, cellLabelAt, type CourtMode, type CourtSize } from '../../model/court.ts';
import { GOAL_ID_PREFIX } from '../../physics/index.ts';
import { CourtStage, type CourtStageHandle } from '../../render/CourtStage.tsx';
import { screenDeltaToWorld } from '../../render/useStageMetrics.ts';
import type { StageRot } from '../../render/useStageMetrics.ts';
import type { ObjectLayerChair, ObjectLayerCone } from '../../render/ObjectLayer.tsx';
import type { TransformWriter } from '../../render/transformWriter.ts';
import type { RuleOverlayApi, RuleRosterEntry } from '../../render/ruleOverlay.ts';
import { liveRegion } from '../../ui/LiveRegion.tsx';
import { ZONE_CURSOR_DRAGGING } from '../../render/zoneCursors.ts';
import { useEditorPointer } from './useEditorPointer.ts';

export interface EditorStageProps {
  drill: Drill;
  /** §6.4 표시 회전. **워크스페이스가 창 크기에서 정해 내려보낸다**(2026-08-14 §4.2 —
   *  `useStageRot`). 여기서는 한 톨도 손대지 않고 무대로 넘길 뿐이다: 중간에서 다시 계산하면
   *  그 순간 판정하는 곳이 둘이 되고, 둘이 어긋나면 좌표 변환과 그림이 갈라진다. */
  rot: StageRot;
  step: DrillStep;
  /** 지금 스텝의 인덱스 — 도형 상한(스텝당 40)을 세는 데 쓴다. */
  stepIndex: number;
  tool: ToolId;
  /** 도구가 고정돼 있는가(§6.10a·§6.10b). 무대가 이 값을 쓰는 곳은 **선택 도구일 때 하나**다
   *  — 그때의 고정이 '모아 고르기' 이기 때문이다. 배치 도구의 고정은 도구 칸이 그린다. */
  toolLock?: boolean;
  coneSlot: 0 | 1;
  selection: ReadonlySet<string>;
  dispatch: Dispatch<EditorAction>;
  worldRef: EditorWorldRef;
  writer: TransformWriter;
  /** §4.4 P2-4 규칙 오버레이. 프레임을 흘려보내는 쪽은 usePhysicsRenderLoop 이라 인스턴스는
   *  워크스페이스가 만든다 — 여기서는 명단만 붙여 무대로 내린다. */
  rules?: RuleOverlayApi;
  zones: ZoneConfig;
  ballMax: number;
  pendingPlayerId: ChairId | null;
  onPlayerPlaced(): void;
  showToast(message: string, action?: { label: string; onAction(): void }): void;
  showGrid: boolean;
  showGridLabels: boolean;
  showRuleZones: boolean;
  /** §7.3 "큰 터치 타깃". 2단 히트(§4.3 P1-2)의 2차 패스 반경만 44 → 56 CSS px 로 키운다. */
  largeTargets: boolean;
  /** §9 결정 ④ · 5.5 — **2존 모드**. 켜면 차체 전체가 하나의 '평행 이동' 존이 되고(드래그),
   *  차체 위 존 음영·커서도 한 구간으로 접힌다(그리기). 회전·견인은 차체 밖 앞뒤 가이드 전용.
   *  기본 false. */
  twoZone?: boolean;
  onEraseIds(ids: string[], scope: 'onward' | 'thisStep'): void;
  /** [복제](2026-08-18) — 개체 메뉴가 부른다. 구현이 워크스페이스에 있는 이유는 `onEraseIds`
   *  와 같다: Ctrl/⌘+D(useEditorKeyboard)와 메뉴, 두 입구가 **같은 함수**로 들어와야
   *  오프셋·클램프·상한·사본 선택 규칙이 안 갈린다. */
  onDuplicateIds(ids: string[]): void;
  /** 메모 글 편집 모달을 연다(기현 지시 2026-08-17). 여는 문이 셋이라 — 배치 직후·더블클릭·
   *  개체 메뉴 [수정] — 무대가 셋 다 여기로 모은다. 모달 자체는 EditorWorkspace 가 갖는다:
   *  트레이에서 끌어다 놓는 배치가 그쪽에 있어서, 무대가 갖고 있으면 그 경로만 문이 안 열린다.
   *  `fresh` 는 "방금 놓은 쪽지" 라는 뜻이고, 그때만 취소가 쪽지를 도로 치운다. */
  onEditNote(id: NoteId, fresh: boolean): void;
  /** 3.10 — 시점 점프 감지(§6.7 immediate 와 같은 규칙: undo/redo·스텝 추가삭제). 점프에는
   *  트윈과 마찬가지로 등장/퇴장 페이드도 걸지 않는다. */
  epoch?: number;
  /** 이 스텝으로의 전환 시간(ms) — 반드시 stepTransitionMs(tween.ts) 값으로 준다. 트윈(위치·
   *  화살표)과 페이드(등장/퇴장)가 같은 시계로 끝나야 한다. 0/미지정 = 페이드 없음. */
  transitionMs?: number;
}

function nearestCell(mode: CourtMode, p: { x: number; y: number }, size?: CourtSize): { col: number; row: number } {
  const { cols, rows, cellW, cellH, origin } = courtDefFor(mode, size).grid;
  const col = Math.min(cols - 1, Math.max(0, Math.floor((p.x - origin.x) / cellW)));
  const row = Math.min(rows - 1, Math.max(0, Math.floor((p.y - origin.y) / cellH)));
  return { col, row };
}

// 키보드 커서(§7.5d)가 격자 칸 가운데를 조준하는 도구들. 2026-08-14 에 도형 3종이 합쳤다 —
// 놓는 도구인데 여기 없으면 **키보드로는 못 놓는** 도구가 된다.
const PLACEMENT_TOOLS: ReadonlySet<ToolId> = new Set(['ball', 'cone', 'player', 'note', 'shapeEllipse', 'shapeTriangle', 'shapeRect']);

/** 개체 이동 방향 — `W A S D` 와 방향키가 같은 자리를 가리킨다. 값은 **화면 기준** 단위
 *  벡터이고, 월드 환산은 쓰는 쪽이 스테이지 회전을 물어 한다. */
const OBJ_MOVE_DIR: Record<string, readonly [number, number]> = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

// 2026-08-16 — 화살표 **조준점**(끝점·시작점·굽힘점을 키보드로 갈아 끼우던 개념)이 사라졌다.
// Shift 가 어디서나 '정밀'로 통일되면서 "화살표에서만 Shift = 조준점만 이동" 이라는 세 번째
// 뜻이 설 자리가 없어졌고, 조준점을 돌리던 `[`/`]` 는 개체 순회가 가져갔다. 끝점 조정은
// 포인터(손잡이 끌기)가 맡는다 — 남은 상태·타입 정리는 2단계다.

export const EditorStage = forwardRef<CourtStageHandle, EditorStageProps>(function EditorStage(
  { drill, rot, step, stepIndex, tool, toolLock = false, coneSlot, selection, dispatch, worldRef, writer, rules, zones, ballMax, pendingPlayerId, onPlayerPlaced, showToast, showGrid, showGridLabels, showRuleZones, largeTargets, twoZone = false, onEraseIds, onDuplicateIds, onEditNote, epoch = 0, transitionMs = 0 },
  stageRef,
) {
  // 스텝의 상태 플래그. 포인터(끌기 차단)·렌더(테두리·흐리게)·메뉴가 **같은 집합**을 본다 —
  // 세 곳이 각자 만들면 "테두리는 붉은데 끌리는" 어긋남이 난다.
  const lockedSet = useMemo(() => new Set(step.locked ?? []), [step.locked]);
  // 모아 고르기 = 선택 도구가 고정된 상태(§6.10b). 다른 도구의 고정은 '연속 배치' 라 무대가
  // 볼 일이 없다 — 그래서 toolLock 을 그대로 쓰지 않고 도구까지 함께 본다.
  const gathering = tool === 'select' && toolLock;
  const ignoredSet = useMemo(() => new Set<string>(step.ignored ?? []), [step.ignored]);

  const pointer = useEditorPointer({
    drill,
    step,
    stepIndex,
    locked: lockedSet,
    tool,
    gathering,
    coneSlot,
    selection,
    dispatch,
    worldRef,
    writer,
    stageRef: stageRef as RefObject<CourtStageHandle | null>,
    zones,
    ballMax,
    pendingPlayerId,
    onPlayerPlaced,
    // 탭·키보드 커서로 놓은 빈 메모 — 놓자마자 글 칸이 열린다(fresh: 취소하면 도로 치운다).
    onNotePlaced: (id) => onEditNote(id, true),
    // §6.10c — 트레이에 끌어다 놓아 치우는 길. 개체 메뉴·Delete 와 **같은 함수**다.
    onEraseIds,
    showToast,
    // 5.5 — 접근성 설정의 2존 토글이 `handlesVisible(…, forced)` 의 `forced` 로 들어가는 자리.
    forceHandlesVisible: twoZone,
    largeTargets,
  });

  const [rovingId, setRovingId] = useState<string | null>(null);
  const [cursor, setCursor] = useState<{ col: number; row: number } | null>(null);

  const chairs = useMemo<ObjectLayerChair[]>(() => {
    const out: ObjectLayerChair[] = [];
    for (const def of drill.cast.chairs) {
      if (step.chairs[def.id] === undefined) continue;
      const teamStyle = drill.teams[def.team];
      const color = def.color ?? (def.isGk ? teamStyle.gkColor : teamStyle.color);
      out.push({
        id: def.id,
        color,
        // 팀 소속을 그대로 실어 보낸다 — 색 밖의 팀 표식(4.6)의 입력이다.
        team: def.team,
        number: def.number,
        ariaLabel: `${teamStyle.label} ${def.number}번${def.role ? ` · ${def.role}` : ''}`,
      });
    }
    return out;
  }, [drill.cast.chairs, drill.teams, step.chairs]);

  const balls = useMemo(() => drill.cast.balls.filter((b) => step.balls[b.id] !== undefined).map((b) => b.id), [drill.cast.balls, step.balls]);

  // §4.4 P2-4 규칙 판정용 명단 — **이 스텝에 판 위에 있는** 휠체어만. 위 `chairs` 와 같은
  // 필터를 쓰지만 담는 것이 다르다(저쪽은 색·등번호, 이쪽은 팀·골키퍼).
  const ruleRoster = useMemo<RuleRosterEntry[]>(
    () => drill.cast.chairs.filter((d) => step.chairs[d.id] !== undefined).map((d) => ({ id: d.id, team: d.team, isGk: d.isGk })),
    [drill.cast.chairs, step.chairs],
  );
  // §7 5.2 — 공마다 따로 켠 거리 원. `cast` 에서 온다(스텝이 아니라) — 그래야 스텝을 옮겨도
  // 같은 공이 같은 원을 갖는다. 'none' 인 공은 표에 **넣지 않는다**(없는 id = 'none').
  const ballRings = useMemo(() => {
    const m: Record<string, BallRing> = {};
    for (const b of drill.cast.balls) {
      const r = ballRingOf(b);
      if (r !== 'none') m[b.id] = r;
    }
    return m;
  }, [drill.cast.balls]);
  const cones = useMemo<ObjectLayerCone[]>(
    () => drill.cast.cones.filter((c) => step.cones[c.id] !== undefined).map((c) => ({ id: c.id, colorIndex: c.colorIndex })),
    [drill.cast.cones, step.cones],
  );

  // ── 3.10 스텝 전환 (1) 프레임 소유권 ─────────────────────────────────────────
  // 같은 장 안의 편집(NOTE_SET·ARROW_SET 등)은 이 층이 즉시 다시 쓴다 — 메모·화살표는 물리
  // 바디가 없어 이 재적용만이 DOM 에 닿는 경로다(§4.3 P1-5). 그러나 **스텝 전환의 프레임은
  // frameSync(EditorProvider §6.7)가 소유한다**: 전환에서도 참조를 갈아 끼우면 ObjectLayer 의
  // layout effect(자식이라 부모보다 먼저 돈다)가 도착 프레임을 먼저 써 버려, 트윈 시작점
  // 스냅샷이 from==to 가 되고 .6s 전환이 통째로 사라진다(3.10 실측: 실제로 그렇게 죽어 있었다).
  const ownedFrameRef = useRef<{ stepId: string; step: DrillStep; frame: Record<string, { x: number; y: number; theta: number }> } | null>(null);
  {
    const prev = ownedFrameRef.current;
    if (prev === null || (prev.stepId === step.id && prev.step !== step)) {
      ownedFrameRef.current = { stepId: step.id, step, frame: poseFrame(step) };
    } else if (prev.stepId !== step.id) {
      // 전환 — 프레임 참조를 유지해 ObjectLayer 재적용을 억제한다(트윈이 쓴다).
      ownedFrameRef.current = { stepId: step.id, step, frame: prev.frame };
    }
  }
  const initialFrame = ownedFrameRef.current!.frame;

  // ── 3.10 스텝 전환 (2) 등장/퇴장 페이드 ──────────────────────────────────────
  // 시연(model/playback.ts interpolateSteps)의 opacity 크로스페이드와 같은 그림을 편집기
  // 재생에도 만든다. id 로 짝을 짓고(§3.5 duplicateStep 의 id 보존이 전제), 한쪽에만 있는
  // 화살표·메모를 transitionMs 동안 CSS 애니메이션(a11y.css)으로 거두고/띄운다 — 프레임
  // 구동은 컴포지터 몫이라 §6.1 규칙 1(React 는 프레임을 구동하지 않는다)과 어긋나지 않는다.
  const [fade, setFade] = useState<{ fades: Record<string, 'in' | 'out'>; ms: number; exitArrows: readonly Arrow[]; exitNotes: readonly NoteLabel[] } | null>(null);
  const prevStepRef = useRef(step);
  const prevEpochRef = useRef(epoch);
  const fadeInputRef = useRef({ step, transitionMs });
  fadeInputRef.current = { step, transitionMs };
  // 직전 커밋의 스텝(편집 반영분 포함)을 기억한다 — passive effect 라 아래 layout effect 보다
  // 늦게 돌아, 전환 커밋의 layout effect 는 항상 "이전 스텝의 마지막 내용"을 읽는다.
  useEffect(() => {
    prevStepRef.current = step;
  });
  useLayoutEffect(() => {
    const prevStep = prevStepRef.current;
    const immediate = epoch !== prevEpochRef.current;
    prevEpochRef.current = epoch;
    const { step: cur, transitionMs: ms } = fadeInputRef.current;
    if (prevStep.id === cur.id) return; // 마운트·epoch 단독 변화 — 전환이 아니다
    if (immediate || ms <= 0) {
      setFade(null); // reduce-motion·시점 점프 — 즉시 스냅(트윈의 ms=0 경로와 같은 규칙)
      return;
    }
    const curArrow = new Set(cur.arrows.map((a) => a.id));
    const curNote = new Set(cur.notes.map((n) => n.id));
    const prevArrow = new Set(prevStep.arrows.map((a) => a.id));
    const prevNote = new Set(prevStep.notes.map((n) => n.id));
    const exitArrows = prevStep.arrows.filter((a) => !curArrow.has(a.id));
    const exitNotes = prevStep.notes.filter((n) => !curNote.has(n.id));
    const fades: Record<string, 'in' | 'out'> = {};
    for (const a of cur.arrows) if (!prevArrow.has(a.id)) fades[a.id] = 'in';
    for (const n of cur.notes) if (!prevNote.has(n.id)) fades[n.id] = 'in';
    for (const a of exitArrows) fades[a.id] = 'out';
    for (const n of exitNotes) fades[n.id] = 'out';
    if (Object.keys(fades).length === 0) {
      setFade(null);
      return;
    }
    setFade({ fades, ms, exitArrows, exitNotes });
    const timer = window.setTimeout(() => setFade(null), ms);
    return () => window.clearTimeout(timer);
    // step 내용·transitionMs 는 ref 로 읽는다 — 편집마다 페이드 타이머가 리셋되면 안 된다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id, epoch]);

  // 퇴장 중인 개체는 목록에 남겨 함께 그린다. step.arrows/notes(키보드 순회·히트테스트의
  // 출처)가 아니라 **그리기 목록에만** 넣으므로 조작 대상이 되지는 않는다.
  const arrows = useMemo(() => {
    const base = fade && fade.exitArrows.length > 0 ? [...step.arrows, ...fade.exitArrows] : step.arrows;
    return pointer.arrowDraft ? [...base, pointer.arrowDraft] : base;
  }, [step.arrows, pointer.arrowDraft, fade]);
  const notes = useMemo(
    () => (fade && fade.exitNotes.length > 0 ? [...step.notes, ...fade.exitNotes] : step.notes),
    [step.notes, fade],
  );

  // 골대 포스트 id — 물리(physics/index.load)가 코트 정의에서 같은 순서로 만든다. 드릴에
  // 저장되지 않으므로 여기서 개수만 맞춰 주면 writer 가 위치를 흘려보낸다(§5.4 GOAL).
  const goals = useMemo(
    // §6.4 — 개수만 맞추면 되지만 **크기도 따라야 한다**: 25×14 는 골포스트가 여전히 4개라
    // 개수로는 사고가 안 드러나고, 물리(load)가 courtDefFor 로 세운 자리와 여기 id 목록이
    // 갈라지면 골대가 화면에서 사라진다(writer 가 쓸 노드가 없다).
    () => courtDefFor(drill.courtMode, drill.courtSize).goalPosts.map((_, i) => `${GOAL_ID_PREFIX}${i}`),
    [drill.courtMode, drill.courtSize],
  );

  // §7.5b 순회 순서: 팀A 선수 → 팀B 선수 → 공 → 콘 → 메모 → 화살표.
  const order = useMemo(() => {
    const homeIds = chairs.filter((c) => drill.cast.chairs.find((d) => d.id === c.id)?.team === 'home').map((c) => c.id as string);
    const awayIds = chairs.filter((c) => drill.cast.chairs.find((d) => d.id === c.id)?.team === 'away').map((c) => c.id as string);
    return [...homeIds, ...awayIds, ...balls, ...cones.map((c) => c.id as string), ...step.notes.map((n) => n.id as string), ...step.arrows.map((a) => a.id as string)];
  }, [chairs, drill.cast.chairs, balls, cones, step.notes, step.arrows]);

  const activeId = selection.size > 0 ? (Array.from(selection)[0] ?? null) : (rovingId ?? order[0] ?? null);

  const nudge = useCallback(
    (id: string, dx: number, dy: number, dThetaRad: number, arrowPart: ArrowPart = 'whole') => {
      // ★ 잠긴 개체는 키보드로도 안 움직인다(2026-08-14). 손으로만 막으면 반쪽이다 —
      //   §7.5 접근성 요건상 키보드는 마우스와 **같은 일을 할 수 있어야** 하고, 그 대칭은
      //   "할 수 있는 것" 뿐 아니라 "할 수 없는 것" 에도 걸린다.
      if (lockedSet.has(id)) return;
      // 여럿을 골라 두고 그중 하나에 포커스가 있으면 **통째로 간다**(§6.10b) — 포인터의
      // 덩어리 드래그와 같은 규칙이라, 마우스로 되는 일이 키보드로 안 되는 자리가 없다.
      // 회전(dThetaRad)은 무리에 없다: 무리의 회전축이 무엇인지 답이 하나로 안 나온다
      // (applyGroupNudge 주석). 그래서 회전 키는 언제나 포커스 하나에만 걸린다.
      if (dThetaRad === 0 && selection.size > 1 && selection.has(id)) {
        const ids = Array.from(selection).filter((x) => !lockedSet.has(x) && !ignoredSet.has(x));
        dispatch({ type: 'GROUP_NUDGE', ids, d: { x: dx, y: dy } });
        const cur = worldRef.current?.read();
        if (cur) {
          for (const x of ids) {
            const p = cur[x];
            if (p) worldRef.current?.setPose(x as CastId, { x: p.x + dx, y: p.y + dy, theta: p.theta });
          }
        }
        return;
      }
      if (isId(id, 'ch') || isId(id, 'bl') || isId(id, 'cn')) {
        dispatch({ type: 'OBJECT_NUDGE', id, d: { x: dx, y: dy }, dTheta: dThetaRad });
        // 물리 바디에도 같은 이동을 밀어 넣는다(회귀): 리듀서만 갱신하면 상태와 물리가 어긋나,
        // 키보드로 옮긴 개체를 다음에 마우스로 잡는 순간 beginDrag 가 낡은 자세를 읽어와
        // 옛 자리로 되돌린다. 키보드 조작은 §7.5 접근성 요건이라 이 경로가 특히 중요하다.
        const cur = worldRef.current?.read()[id];
        if (cur) worldRef.current?.setPose(id as CastId, { x: cur.x + dx, y: cur.y + dy, theta: cur.theta + dThetaRad });
        return;
      }
      if (isId(id, 'nt')) {
        // 메모는 물리 바디가 없다(§5.3 캐스트만 바디를 가진다) — 상태만 갱신하면 된다.
        const note = step.notes.find((n) => n.id === id);
        if (note) dispatch({ type: 'NOTE_SET', note: { ...note, x: note.x + dx, y: note.y + dy } });
        return;
      }
      if (isId(id, 'ar')) {
        // 화살표 개체(§4.3 1.11). 메모와 같이 물리 바디가 없다. 여기가 비어 있던 탓에
        // 화살표는 **키보드로 전혀 움직이지 않았다** — 유일한 조작 경로가 12px 드래그와
        // 반경 22 CSS px 핸들 3개의 정밀 드래그뿐이었다 — 정밀 포인팅을 전제하는 조작은
        // 그것이 어려운 입력에는 사실상 없는 기능과 같다.
        const arrow = step.arrows.find((a) => a.id === id);
        if (arrow) dispatch({ type: 'ARROW_SET', arrow: nudgeArrow(arrow, arrowPart, { x: dx, y: dy }) });
      }
    },
    [dispatch, step.arrows, step.notes, worldRef, selection, lockedSet, ignoredSet],
  );

  const handleObjectKeyDown = useCallback(
    (id: string, e: ReactKeyboardEvent<SVGGElement>) => {
      // 개체 층의 키만 여기서 먹는다(`core/keymap.ts` 의 `scope: 'object'`). 표에 없는 키는
      // 그대로 버블링시켜 전역이 받는다 — Ctrl+방향키(판 이동)·Esc·
      // Space(재생)가 그 경로다. 개편 전에는 여기서 수식키를 손으로 걸러야 했는데, 이제
      // 표가 전역과 개체의 겹침을 0으로 보장한다(`keymap.contract` 의 "서로를 삼키지 않는다").
      const def = lookupDef('object', e);
      if (!def) return;

      // Shift 는 **정밀**이다 — 기본이 큰 걸음. 개편 전에는 반대(기본 2.5px, Shift 25px)였고
      // 화살표에서만 또 달랐다. 뜻을 하나로 접으면 개체 종류를 세지 않아도 손이 안다.
      const step = e.shiftKey ? 2.5 : 25;
      const deg = e.shiftKey ? 5 : 15;

      switch (def.id) {
        case 'obj.move': {
          const dir = OBJ_MOVE_DIR[eventCode(e)];
          if (!dir) return;
          e.preventDefault();
          e.stopPropagation();
          // ★ 이동은 **화면 기준**이다(§7.5). 스테이지가 90° 돌아 있으면 월드 축과 어긋나므로
          //   화면 델타를 월드 델타로 옮겨서 넘긴다 — 안 그러면 세로 화면에서 D(오른쪽)가
          //   개체를 아래로 내려보낸다(보이는 것과 손이 어긋난다).
          const rot = (stageRef as RefObject<CourtStageHandle | null>).current?.refreshMetrics()?.rot ?? 0;
          const w = screenDeltaToWorld({ rot }, dir[0] * step, dir[1] * step);
          nudge(id, w.x, w.y, 0);
          return;
        }
        case 'obj.rotate': {
          // 회전이 없는 개체(공·콘·메모·화살표·도형)에서는 조용히 아무 일도 안 한다 —
          // 휠체어만 방향을 가진다.
          if (!isId(id, 'ch')) return;
          e.preventDefault();
          e.stopPropagation();
          nudge(id, 0, 0, (eventCode(e) === 'KeyQ' ? -1 : 1) * deg * RAD);
          return;
        }
        case 'obj.cyclePrev':
        case 'obj.cycleNext':
        case 'obj.cycleExtendPrev':
        case 'obj.cycleExtendNext': {
          e.preventDefault();
          e.stopPropagation();
          if (order.length === 0) return;
          const cur = Math.max(0, order.indexOf(id));
          const forward = def.id === 'obj.cycleNext' || def.id === 'obj.cycleExtendNext';
          const delta = forward ? 1 : order.length - 1;
          const nextId = order[(cur + delta) % order.length]!;
          // Shift 를 쥐고 있으면 **모으면서** 간다(§6.10b) — 지나온 것과 새로 닿은 것을 둘 다
          // 넣는다. 지나온 것까지 넣는 이유: 훑기는 지금 선 자리에서 시작하는데, 그 자리가
          // 선택에 안 들어가면 한 칸 어긋난 무리가 만들어진다(파일 목록의 Shift+↓ 와 같다).
          //
          // 마우스 없이 여럿을 고르는 유일한 길이다. Enter 토글만으로는 한 칸씩 서서 누르는
          // 것뿐이라, 훑어 모으는 손짓 자체가 키보드에 없었다.
          if (def.id === 'obj.cycleExtendPrev' || def.id === 'obj.cycleExtendNext') {
            dispatch({ type: 'SELECT_SET', ids: Array.from(new Set([...selection, id, nextId])) });
          }
          setRovingId(nextId);
          document.getElementById(`obj-${nextId}`)?.focus({ preventScroll: true });
          return;
        }
        case 'obj.toggleSelect':
          // Space 는 여기 없다 — 전역 재생/일시정지로 통일했다(2026-08-16). 개체를 고른 채
          // Space 를 누르면 이 핸들러가 안 먹고 전역까지 버블링해 재생이 걸린다.
          e.preventDefault();
          e.stopPropagation();
          dispatch({ type: 'SELECT_TOGGLE', id });
          return;
        // Delete 는 **하나든 여럿이든 지운다**(기현 지시 2026-08-16). 규모는 손이 수식키로
        // 말하는 것이 아니라 화면에 이미 적혀 있다 — 무엇이 골라져 있는가. 포커스가 고른 것
        // 밖에 있으면(순회만 하고 Enter 를 안 눌렀을 때) 그때는 짚고 있는 것 하나다.
        case 'erase.selection': {
          e.preventDefault();
          e.stopPropagation();
          const target = selection.has(id) ? Array.from(selection) : [id];
          onEraseIds(target, 'onward');
          return;
        }
        default:
          return;
      }
    },
    [dispatch, nudge, onEraseIds, order, stageRef, selection],
  );

  const handleContainerKeyDown = useCallback(
    (e: ReactKeyboardEvent<SVGSVGElement>) => {
      // 합성 사건이 code 를 안 실을 때를 위한 폴백 — 근거는 `core/keymap.ts` 의 eventCode.
      const code = eventCode(e);
      if (code === 'Escape') {
        (stageRef as RefObject<CourtStageHandle | null>).current?.focusContainer();
        dispatch({ type: 'SELECT_CLEAR' });
        return;
      }
      // 개체 순회 — 개체에 포커스가 있을 때는 개체 핸들러가 먹고, 컨테이너에 있을 때가 여기다.
      // 개편 전에는 Alt+←/→ 였는데 Alt 가 보기 토글 전용 채널이 되면서 `[`/`]` 로 옮겼다.
      if (code === 'BracketLeft' || code === 'BracketRight') {
        e.preventDefault();
        if (order.length === 0) return;
        const cur = Math.max(0, order.indexOf(activeId ?? order[0]!));
        const next = code === 'BracketRight' ? (cur + 1) % order.length : (cur - 1 + order.length) % order.length;
        const nextId = order[next]!;
        setRovingId(nextId);
        document.getElementById(`obj-${nextId}`)?.focus({ preventScroll: true });
        return;
      }
      // §4.4 P2-1 — Ctrl/Cmd + 방향키(판 이동)는 배치 커서보다 앞선다. 아래 커서 분기가
      // stopPropagation 을 걸므로 여기서 먼저 물러나지 않으면, 공·콘 도구를 든 동안에는
      // 판이 움직이지 않는다(배치는 화면 밖 자리에도 해야 하므로 그때야말로 팬이 필요하다).
      if (e.ctrlKey || e.metaKey) return;
      // §7.5d 키보드 배치 커서 — 배치 도구가 활성이고 포커스가 컨테이너 자신일 때만.
      if (PLACEMENT_TOOLS.has(tool) && e.target === e.currentTarget) {
        const mode = drill.courtMode;
        const size = drill.courtSize;
        const base = cursor ? gridCellCenter(mode, cursor.col, cursor.row, size) : gridCellCenter(mode, 0, 0, size);
        if (code === 'Enter') {
          e.preventDefault();
          e.stopPropagation(); // §7.5d: 전역 스텝 이동(Enter 자체는 무관하나 배치 확정이 다른 리스너로 새지 않게 통일)
          pointer.placeAtCursor(base);
          return;
        }
        if (code.startsWith('Arrow')) {
          e.preventDefault();
          e.stopPropagation(); // §7.5d 배치 커서 이동이 useEditorKeyboard 전역 스텝 이동(ArrowLeft/Right)과 이중 발화하지 않도록 차단
          const curRot = (stageRef as RefObject<CourtStageHandle | null>).current?.refreshMetrics()?.rot ?? 0;
          if (e.shiftKey) {
            const step25 = 12.5;
            // 배치 커서도 화면 기준이어야 한다(§7.5) — 위 개체 이동과 같은 규칙.
            const sx = code === 'ArrowLeft' ? -step25 : code === 'ArrowRight' ? step25 : 0;
            const sy = code === 'ArrowUp' ? -step25 : code === 'ArrowDown' ? step25 : 0;
            const dw = screenDeltaToWorld({ rot: curRot }, sx, sy);
            const p = { x: base.x + dw.x, y: base.y + dw.y };
            const cell = nearestCell(mode, p, size);
            setCursor(cell);
            liveRegion.say(cellLabelAt(mode, gridCellCenter(mode, cell.col, cell.row, size), size) ?? '');
            return;
          }
          const cur2 = cursor ?? nearestCell(mode, base, size);
          const { cols, rows } = courtDefFor(mode, size).grid;
          let { col, row } = cur2;
          // 화면 기준 한 칸을 월드 격자의 (열,행) 증감으로 옮긴다. 회전 시 화면 오른쪽은
          // 월드 −y(= 행 감소)다 — 이 변환이 없으면 세로 화면에서 좌우 키가 위아래로 움직인다.
          const sdx = code === 'ArrowLeft' ? -1 : code === 'ArrowRight' ? 1 : 0;
          const sdy = code === 'ArrowUp' ? -1 : code === 'ArrowDown' ? 1 : 0;
          const dcell = screenDeltaToWorld({ rot: curRot }, sdx, sdy);
          col = Math.min(cols - 1, Math.max(0, col + Math.round(dcell.x)));
          row = Math.min(rows - 1, Math.max(0, row + Math.round(dcell.y)));
          setCursor({ col, row });
          liveRegion.say(`${cellLabelAt(mode, gridCellCenter(mode, col, row, size), size) ?? ''} 칸`);
          return;
        }
      }
    },
    [activeId, cursor, dispatch, drill.courtMode, drill.courtSize, order, pointer, stageRef, tool],
  );

  // 선택된 휠체어 id 만 넘긴다 — 좌표는 ZoneHandles 가 writer 팔로워로 직접 따라간다.
  // 예전에는 여기서 월드 pose 를 useMemo 로 읽어 넘겼는데, deps 가 [selection] 이라
  // 칩을 드래그해도 갱신되지 않아 핸들만 선택 시점 자리에 남았다(= 따로 놀았다).
  //
  // ⚠️ **정확히 하나일 때만**이다(2026-08-16). 예전에는 `Array.from(selection).find(...)` 라
  //    여럿 고른 채로 집합의 **첫 매치**에 손잡이가 붙었다 — Set 은 순서를 약속하지 않으므로
  //    다섯을 고르면 그중 아무에게나 존 핸들이 떴다. 도형은 이미 `size !== 1` 을 보고 있어서
  //    같은 selection 을 읽는 세 곳의 규칙이 서로 달랐다. 셋을 하나로 맞춘다.
  const selectedChairId = useMemo(
    () => (selection.size === 1 ? ((Array.from(selection).find((x) => isId(x, 'ch')) as ChairId | undefined) ?? null) : null),
    [selection],
  );

  const selectedArrow = useMemo(() => {
    if (selection.size !== 1) return null;
    const id = Array.from(selection).find((x) => isId(x, 'ar')) as ArrowId | undefined;
    return id ? (step.arrows.find((a) => a.id === id) ?? null) : null;
  }, [selection, step.arrows, lockedSet]);

  /** 선택이 정확히 하나이고 그것이 도형일 때만 손잡이를 띄운다 — 여럿을 고른 채로 손잡이를
   *  내면 "무엇의 가로인가" 가 사라진다(화살표 핸들이 간 길과 같다). */
  const selectedShape = useMemo(() => {
    if (selection.size !== 1) return null;
    const id = [...selection][0]!;
    // 잠긴 도형에는 손잡이를 안 낸다 — 끌어도 안 바뀌는 손잡이는 화면이 거짓말하는 것이다.
    // 덮개(보라)가 "이건 잠겼다" 를 이미 말하고, 푸는 문은 메뉴다.
    if (lockedSet.has(id)) return null;
    return step.shapes.find((sh) => sh.id === id) ?? null;
  }, [selection, step.shapes, lockedSet]);

  // ── 개체 메뉴 (2026-08-14 기현 지시) ────────────────────────────────────────────────
  const [menu, setMenu] = useState<ObjectMenuTarget | null>(null);

  /** "같은 것 전부 고르기" 가 훑을 명단. 무대가 이미 들고 있는 조각들을 한 자리에 모은 것뿐이라
   *  따로 계산하는 것이 없다 — 명단이 두 벌이 되면 "메뉴에는 넷인데 화면에는 셋" 이 생긴다. */
  const sameScene = useMemo(
    () => ({
      chairs: chairs.map((c) => ({ id: c.id as string, team: c.team })),
      balls,
      cones: cones.map((c) => c.id as string),
      notes: step.notes.map((n) => n.id as string),
      arrows: step.arrows.map((a) => a.id as string),
      shapes: (step.shapes ?? []).map((s) => s.id as string),
      locked: lockedSet,
    }),
    [chairs, balls, cones, step.notes, step.arrows, step.shapes, lockedSet],
  );

  const openMenu = useCallback(
    (id: string, x: number, y: number) => {
      // ⚠️ 무시된 칩도 **연다**(기현 신고 2026-08-14). 여기서 막았더니 무시를 푸는 유일한
      // 길이 함께 막혔다 — 메뉴가 곧 되돌리는 문이므로, 그 문은 어떤 상태에서도 열려야 한다.
      //
      // **짚은 것이 이미 고른 여럿 중 하나면 메뉴는 그 여럿을 손댄다**(§6.10b). 고른 것 밖을
      // 짚었으면 짚은 것 하나다 — 화면에 파랗게 표시된 것과 메뉴가 손댈 것이 언제나 같다는
      // 뜻이라, 무엇에 걸리는지 되묻지 않아도 된다.
      const ids = selection.size > 1 && selection.has(id) ? Array.from(selection) : [id];
      setMenu({
        ids,
        x,
        y,
        // 섞여 있으면 '잠금'/'무시' 쪽이 뜬다(전부 참일 때만 해제로 뒤집힌다) — ObjectMenu 주석.
        locked: ids.every((i) => lockedSet.has(i)),
        ignored: ids.every((i) => ignoredSet.has(i)),
        // '무시' 는 **휠체어만**이다(기현 지시).
        canIgnore: ids.every((i) => isId(i, 'ch')),
        // [수정]은 메모 하나일 때만이다 — 근거는 ObjectMenuTarget.editable 주석.
        editable: ids.length === 1 && isId(id, 'nt') ? id : null,
        selectSame: ids.length === 1 ? sameKindGroup(id, sameScene) : null,
      });
    },
    [lockedSet, ignoredSet, selection, sameScene],
  );
  const longPress = useLongPressMenu(openMenu);


  const cursorWorld = cursor && PLACEMENT_TOOLS.has(tool) ? gridCellCenter(drill.courtMode, cursor.col, cursor.row, drill.courtSize) : null;
  const cursorLabel = cursorWorld ? cellLabelAt(drill.courtMode, cursorWorld, drill.courtSize) : null;

  return (
    <>
    {/* 몇 개를 골랐는가(§6.10b). 화면에 이 말이 없으면 코치는 판을 기울여 가며 눈으로 세야
        한다 — 특히 터치에서는 손과 손가락이 방금 훑은 자리를 그대로 가린다. `role="status"`
        라서 화면을 못 보는 사람에게도 같은 사실이 읽힌다.
        왼쪽 위인 이유: 오른쪽은 기능 바, 아래·오른쪽은 트레이가 붙는 변이다(EditorWorkspace
        의 trayAxis) — 어느 화면 방향에서도 안 겹치는 구석은 여기 하나다. */}
    {selection.size > 1 && (
      <div
        role="status"
        style={{
          position: 'absolute',
          top: 8,
          left: 8,
          zIndex: 2,
          pointerEvents: 'none',
          padding: '3px 9px',
          borderRadius: 999,
          border: '1px solid var(--accent)',
          background: 'color-mix(in srgb, var(--panel) 88%, transparent)',
          color: 'var(--accent-text)',
          fontSize: '0.75rem',
          fontWeight: 700,
          whiteSpace: 'nowrap',
        }}
      >
        {selection.size}개 선택
      </div>
    )}
    <CourtStage
      // 선택 도구에서만 이동을 무장한다 — 배치 도구에서는 같은 자리에 콘 두 개를 빨리
      // 찍는 것이 더블클릭으로 읽혀 두 번째가 삼켜진다.
      allowPan={tool === 'select'}
      ref={stageRef}
      mode={drill.courtMode}
      size={drill.courtSize}
      rot={rot}
      variant="editor"
      writer={writer}
      controller={pointer.controller}
      showGrid={showGrid}
      showGridLabels={showGridLabels}
      showRuleZones={showRuleZones}
      chairs={chairs}
      balls={balls}
      cones={cones}
      goals={goals}
      notes={notes}
      arrows={arrows}
      shapes={step.shapes}
      // 도형을 잡으면 **선택만** 바꾼다. 지우기는 선택 후 Delete 가 맡는다 — 2026-08-16 에
      // 지우개 도구가 사라지면서 도형만의 예외 분기도 함께 없어졌다.
      onShapeSelect={(id) => dispatch({ type: 'SELECT_SET', ids: [id] })}
      onShapeChange={(next) => dispatch({ type: 'SHAPE_SET', shape: next })}
      shapeHandles={{ shape: selectedShape }}
      locked={lockedSet}
      ignored={ignoredSet}
      onStageContextMenu={(id, e) => {
        // 브라우저 메뉴는 CourtStage 가 **맞히든 안 맞히든** 이미 막았다(거기 머리말 참고).
        // 여기서는 열 것이 있을 때만 연다 — 빈 코트에는 아무 메뉴도 안 뜬다.
        if (!id) return;
        longPress.onContextMenu(id, { preventDefault: () => {}, clientX: e.clientX, clientY: e.clientY });
      }}
      onStagePointerDownRaw={(id, e) => {
        if (id) longPress.onPointerDown(id, e);
        else longPress.cancel();
      }}
      // 더블클릭/더블탭 = **메모 글 열기**(기현 지시 2026-08-17). 지금 뜻이 붙은 개체는 메모뿐이라
      // 다른 id 는 그냥 흘려보낸다 — 뜻이 없는 곳에서 아무 일도 안 일어나는 것이 정직하다.
      // 선택 도구에서만 연다: 배치 도구에서는 같은 자리 빠른 두 번이 곧 개체 둘이고(CourtStage
      // 의 allowPan 주석과 같은 사정), 그 두 번째 개체 위로 모달이 뜨면 판이 거짓말을 한다.
      onStageDoubleClick={(id) => {
        // 배치 도구에서 빠른 두 번은 **개체 둘**이다 — 거기서 글 칸을 열면 두 번째 개체가
        // 모달 뒤에 숨는다. `true` 를 돌려줄 때만 그 손짓이 무대에서 끝난다.
        if (tool !== 'select' || !isId(id, 'nt')) return false;
        onEditNote(id, false);
        return true;
      }}
      selection={selection}
      // 5.5 — 차체 음영·커서도 같은 진실을 말해야 한다. 2존인데 앞 2/3 에 '제자리 회전' 음영이
      // 남아 있으면 판이 거짓말을 한다(잡으면 실제로는 통째로 밀린다). ⚠️ `zones` 를 그대로
      // 넘기지 마라 — 이 값은 드래그 판정과 **같은 스위치**(useEditorPointer 안의
      // handlesVisible 호출)에서 나온다. 되돌리면 그림과 판정이 갈라진다.
      zoneCursors={pointer.zoneCursors}
      activeId={activeId}
      initialFrame={initialFrame}
      fades={fade?.fades}
      fadeMs={fade?.ms}
      onObjectKeyDown={handleObjectKeyDown}
      onContainerKeyDown={handleContainerKeyDown}
      selectionOverlayRef={pointer.selectionOverlayRef}
      dragCursor={pointer.activeZone ? ZONE_CURSOR_DRAGGING[pointer.activeZone] : null}
      zoneHandles={{ chairId: selectedChairId, activeZone: pointer.activeZone }}
      ruleOverlay={rules ? { rules, roster: ruleRoster, teams: drill.teams, teamStyles: drill.teams, defense: drill.defense, ballRings } : undefined}
      arrowHandles={{ arrow: selectedArrow }}
      keyboardCursor={cursorWorld ? { visible: true, x: cursorWorld.x, y: cursorWorld.y, label: cursorLabel } : undefined}
    />
    {/* 개체 메뉴 — 잠김 · 무시 · 빼기/삭제. 무대 **밖**(포털)이라 코트의 overflow·회전에 안 잘린다. */}
    <ObjectMenu
      target={menu}
      onClose={() => setMenu(null)}
      onToggleLock={(ids, on) => dispatch({ type: 'FLAG_SET', flag: 'locked', ids, on })}
      onToggleIgnore={(ids, on) => dispatch({ type: 'FLAG_SET', flag: 'ignored', ids, on })}
      // 치우는 길은 **한 곳뿐**이다(§6.10b). 개편 전에는 메뉴가 종류별로 직접 액션을 쐈고
      // 키보드는 `onEraseIds` 를 탔는데, 그 둘이 달라서 **도형은 키보드로 안 지워졌다** —
      // `eraseIds` 에 'sh' 갈래가 없어 아무 일도 안 나고 토스트도 안 떴다(키가 고장난 것처럼).
      // 소리·토스트·되돌리기 횟수가 한 벌이 되는 것도 같은 통합의 값이다.
      onRemove={(ids) => onEraseIds(ids, 'onward')}
      // 모아 고르기 중이면 **더한다** — 그것이 그 모드의 약속이다. 아니면 갈아끼운다.
      onSelect={(ids) =>
        dispatch({ type: 'SELECT_SET', ids: gathering ? Array.from(new Set([...selection, ...ids])) : ids })
      }
      // 이미 판에 있는 메모라 `fresh` 는 false 다 — 취소해도 쪽지는 그대로 남는다.
      onEdit={(id) => onEditNote(id as NoteId, false)}
      onDuplicate={onDuplicateIds}
    />
    </>
  );
});
