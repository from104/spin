// §6.4/§6.6/§7.5b–d — CourtStage(render-stage)를 편집기 상태에 연결한다. 좌표 변환·포인터
// 캡처·레이어 순서는 CourtStage 소관, 히트테스트·물리 드래그 의미론은 useEditorPointer 소관,
// 이 파일은 그 둘을 조립하고 §7.5 키보드 계약(로빙 tabindex·개체 순회·키보드 배치 커서)만
// 더한다.
import { forwardRef, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react';
import { RAD } from '../../core/angle.ts';
import { isId } from '../../core/ids.ts';
import type { ArrowId, CastId, ChairId } from '../../core/ids.ts';
import type { ToolId } from '../../physics/index.ts';
import type { EditorWorldRef } from '../../store/editor/EditorProvider.tsx';
import { poseFrame } from '../../store/editor/tween.ts';
import type { EditorAction } from '../../store/editor/actions.ts';
import type { Drill, DrillStep, NoteLabel } from '../../model/drill.ts';
import type { ZoneConfig } from '../../model/chair.ts';
import { nudgeArrow } from '../../model/arrow.ts';
import type { Arrow, ArrowHandle, ArrowPart } from '../../model/arrow.ts';
import { COURT_DEFS, gridCellCenter, cellLabelAt, type CourtMode } from '../../model/court.ts';
import { GOAL_ID_PREFIX } from '../../physics/index.ts';
import { CourtStage, type CourtStageHandle } from '../../render/CourtStage.tsx';
import { screenDeltaToWorld } from '../../render/useStageMetrics.ts';
import type { ObjectLayerChair, ObjectLayerCone } from '../../render/ObjectLayer.tsx';
import type { TransformWriter } from '../../render/transformWriter.ts';
import type { RuleOverlayApi, RuleRosterEntry } from '../../render/ruleOverlay.ts';
import { liveRegion } from '../../ui/LiveRegion.tsx';
import { ZONE_CURSOR_DRAGGING } from '../../render/zoneCursors.ts';
import { useEditorPointer } from './useEditorPointer.ts';

export interface EditorStageProps {
  drill: Drill;
  step: DrillStep;
  tool: ToolId;
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
  /** 3.10 — 시점 점프 감지(§6.7 immediate 와 같은 규칙: undo/redo·스텝 추가삭제). 점프에는
   *  트윈과 마찬가지로 등장/퇴장 페이드도 걸지 않는다. */
  epoch?: number;
  /** 이 스텝으로의 전환 시간(ms) — 반드시 stepTransitionMs(tween.ts) 값으로 준다. 트윈(위치·
   *  화살표)과 페이드(등장/퇴장)가 같은 시계로 끝나야 한다. 0/미지정 = 페이드 없음. */
  transitionMs?: number;
}

function nearestCell(mode: CourtMode, p: { x: number; y: number }): { col: number; row: number } {
  const { cols, rows, cellW, cellH, origin } = COURT_DEFS[mode].grid;
  const col = Math.min(cols - 1, Math.max(0, Math.floor((p.x - origin.x) / cellW)));
  const row = Math.min(rows - 1, Math.max(0, Math.floor((p.y - origin.y) / cellH)));
  return { col, row };
}

const PLACEMENT_TOOLS: ReadonlySet<ToolId> = new Set(['ball', 'cone', 'player', 'note']);

/** §4.3 1.11 화살표 조준점 순환 순서. 첫 항목이 기본값이다 — 전술에서 화살표는 '누가
 *  **어디로**'라 조준 대상이 압도적으로 끝점(화살촉)이다. */
const ARROW_AIM_ORDER: readonly ArrowHandle[] = ['to', 'from', 'ctrl'];
const ARROW_AIM_LABEL: Record<ArrowHandle, string> = { to: '끝점', from: '시작점', ctrl: '굽힘점' };

export const EditorStage = forwardRef<CourtStageHandle, EditorStageProps>(function EditorStage(
  { drill, step, tool, coneSlot, selection, dispatch, worldRef, writer, rules, zones, ballMax, pendingPlayerId, onPlayerPlaced, showToast, showGrid, showGridLabels, showRuleZones, largeTargets, twoZone = false, onEraseIds, epoch = 0, transitionMs = 0 },
  stageRef,
) {
  const pointer = useEditorPointer({
    drill,
    step,
    tool,
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
    showToast,
    // 5.5 — 접근성 설정의 2존 토글이 `handlesVisible(…, forced)` 의 `forced` 로 들어가는 자리.
    forceHandlesVisible: twoZone,
    largeTargets,
  });

  const [rovingId, setRovingId] = useState<string | null>(null);
  const [cursor, setCursor] = useState<{ col: number; row: number } | null>(null);
  // Shift+방향키가 옮길 화살표의 점. **화살표 id 와 함께** 들고 있으므로 다른 화살표로
  // 넘어가면 자동으로 기본값(끝점)으로 돌아간다 — 옆 화살표에서 굽힘점이 움직이는 사고를
  // 막는 데 별도의 초기화 effect 가 필요 없다.
  const [arrowAim, setArrowAim] = useState<{ id: string; part: ArrowHandle } | null>(null);
  const aimOf = useCallback((id: string): ArrowHandle => (arrowAim?.id === id ? arrowAim.part : ARROW_AIM_ORDER[0]!), [arrowAim]);

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
    () => COURT_DEFS[drill.courtMode].goalPosts.map((_, i) => `${GOAL_ID_PREFIX}${i}`),
    [drill.courtMode],
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
        // 반경 22 CSS px 핸들 3개의 정밀 드래그뿐이었다(발 마우스·입 젓가락에는 사실상 없는 기능).
        const arrow = step.arrows.find((a) => a.id === id);
        if (arrow) dispatch({ type: 'ARROW_SET', arrow: nudgeArrow(arrow, arrowPart, { x: dx, y: dy }) });
      }
    },
    [dispatch, step.arrows, step.notes, worldRef],
  );

  const handleObjectKeyDown = useCallback(
    (id: string, e: ReactKeyboardEvent<SVGGElement>) => {
      // §4.4 P2-1 — Ctrl/Cmd 가 붙은 키는 개체의 것이 아니다. 아래 분기는 전부
      // stopPropagation 을 걸어 전역(document) 핸들러까지 못 가게 하므로, 수식키를 그냥
      // 흘려보내지 않으면 **개체를 고른 순간 판을 밀 수도(Ctrl+방향키) 지울 수도(Ctrl+Delete)
      // 없는** 상태가 된다. preventDefault 도 하지 않는다 — 판정은 전역이 한다.
      if (e.ctrlKey || e.metaKey) return;
      const small = 2.5;
      const big = 25;
      const isArrow = isId(id, 'ar');
      // 화살표 개체에서만 Shift 의 뜻이 다르다(§4.3 1.11 의 Shift 충돌 해소):
      //   다른 개체 — Shift = 25px 큰 걸음.
      //   화살표   — Shift = **조준점 하나만** 옮기기(걸음은 2.5px 로 고정).
      // 화살표는 '어디로'를 그리는 개체라 큰 걸음보다 끝점 조준이 압도적으로 중요하고,
      // 큰 걸음을 얹을 빈 수식키가 없다(Alt=개체 순회·파괴적 동작, Ctrl=줌·저장 및 §4.4 P2-1
      // 판 팬 예약). 대신 화살표 전체 이동은 2.5px 연타(히스토리 병합)로, 조준점 전환은
      // 아래 `[`/`]` 로 준다.
      const d = e.shiftKey && !isArrow ? big : small;
      // ★ 방향키는 **화면 기준**이다(§7.5). 스테이지가 90° 돌아 있으면 월드 축과 어긋나므로
      //   화면 델타를 월드 델타로 옮겨서 넘긴다 — 안 그러면 세로 화면에서 오른쪽 키가 개체를
      //   아래로 내려보낸다(보이는 것과 손이 어긋난다).
      const rot = (stageRef as RefObject<CourtStageHandle | null>).current?.refreshMetrics()?.rot ?? 0;
      const move = (sx: number, sy: number): void => {
        const w = screenDeltaToWorld({ rot }, sx, sy);
        if (isArrow && e.shiftKey) {
          const part = aimOf(id);
          if (arrowAim?.id !== id) setArrowAim({ id, part }); // 조준점을 화면에도 표시한다
          nudge(id, w.x, w.y, 0, part);
          return;
        }
        nudge(id, w.x, w.y, 0);
      };
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          e.stopPropagation();
          move(-d, 0);
          return;
        case 'ArrowRight':
          e.preventDefault();
          e.stopPropagation();
          move(d, 0);
          return;
        case 'ArrowUp':
          e.preventDefault();
          e.stopPropagation();
          move(0, -d);
          return;
        case 'ArrowDown':
          e.preventDefault();
          e.stopPropagation();
          move(0, d);
          return;
        case '[':
        case ']': {
          const back = e.key === '[';
          if (isId(id, 'ch')) {
            e.preventDefault();
            e.stopPropagation();
            nudge(id, 0, 0, (back ? -1 : 1) * (e.shiftKey ? 15 : 5) * RAD);
            return;
          }
          if (isArrow) {
            // 휠체어에서 `[`/`]` 가 "이 개체의 모양을 바꾸는 키"인 것과 같은 자리다 —
            // 화살표에는 회전이 없으므로 **조준점 전환**을 여기에 둔다(끝점 → 시작점 → 굽힘점).
            e.preventDefault();
            e.stopPropagation();
            const cur = ARROW_AIM_ORDER.indexOf(aimOf(id));
            const next = ARROW_AIM_ORDER[(cur + (back ? ARROW_AIM_ORDER.length - 1 : 1)) % ARROW_AIM_ORDER.length]!;
            setArrowAim({ id, part: next });
            liveRegion.say(`화살표 ${ARROW_AIM_LABEL[next]} 조준 — Shift+방향키로 옮깁니다`);
          }
          return;
        }
        case 'Enter':
        case ' ':
          e.preventDefault();
          e.stopPropagation();
          dispatch({ type: 'SELECT_TOGGLE', id });
          return;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          e.stopPropagation();
          onEraseIds([id], e.altKey ? 'thisStep' : 'onward');
          return;
        default:
          // Alt+←/→(개체 순회), Esc, Alt+숫자 는 컨테이너로 버블링시킨다(stopPropagation 안 함).
          return;
      }
    },
    [aimOf, arrowAim, dispatch, nudge, onEraseIds],
  );

  const handleContainerKeyDown = useCallback(
    (e: ReactKeyboardEvent<SVGSVGElement>) => {
      if (e.key === 'Escape') {
        (stageRef as RefObject<CourtStageHandle | null>).current?.focusContainer();
        dispatch({ type: 'SELECT_CLEAR' });
        return;
      }
      if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        if (order.length === 0) return;
        const cur = Math.max(0, order.indexOf(activeId ?? order[0]!));
        const next = e.key === 'ArrowRight' ? (cur + 1) % order.length : (cur - 1 + order.length) % order.length;
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
        const base = cursor ? gridCellCenter(mode, cursor.col, cursor.row) : gridCellCenter(mode, 0, 0);
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation(); // §7.5d: 전역 스텝 이동(Enter 자체는 무관하나 배치 확정이 다른 리스너로 새지 않게 통일)
          pointer.placeAtCursor(base);
          return;
        }
        if (e.key.startsWith('Arrow')) {
          e.preventDefault();
          e.stopPropagation(); // §7.5d 배치 커서 이동이 useEditorKeyboard 전역 스텝 이동(ArrowLeft/Right)과 이중 발화하지 않도록 차단
          const curRot = (stageRef as RefObject<CourtStageHandle | null>).current?.refreshMetrics()?.rot ?? 0;
          if (e.shiftKey) {
            const step25 = 12.5;
            // 배치 커서도 화면 기준이어야 한다(§7.5) — 위 개체 이동과 같은 규칙.
            const sx = e.key === 'ArrowLeft' ? -step25 : e.key === 'ArrowRight' ? step25 : 0;
            const sy = e.key === 'ArrowUp' ? -step25 : e.key === 'ArrowDown' ? step25 : 0;
            const dw = screenDeltaToWorld({ rot: curRot }, sx, sy);
            const p = { x: base.x + dw.x, y: base.y + dw.y };
            const cell = nearestCell(mode, p);
            setCursor(cell);
            liveRegion.say(cellLabelAt(mode, gridCellCenter(mode, cell.col, cell.row)) ?? '');
            return;
          }
          const cur2 = cursor ?? nearestCell(mode, base);
          const { cols, rows } = COURT_DEFS[mode].grid;
          let { col, row } = cur2;
          // 화면 기준 한 칸을 월드 격자의 (열,행) 증감으로 옮긴다. 회전 시 화면 오른쪽은
          // 월드 −y(= 행 감소)다 — 이 변환이 없으면 세로 화면에서 좌우 키가 위아래로 움직인다.
          const sdx = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
          const sdy = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
          const dcell = screenDeltaToWorld({ rot: curRot }, sdx, sdy);
          col = Math.min(cols - 1, Math.max(0, col + Math.round(dcell.x)));
          row = Math.min(rows - 1, Math.max(0, row + Math.round(dcell.y)));
          setCursor({ col, row });
          liveRegion.say(`${cellLabelAt(mode, gridCellCenter(mode, col, row)) ?? ''} 칸`);
          return;
        }
      }
    },
    [activeId, cursor, dispatch, drill.courtMode, order, pointer, stageRef, tool],
  );

  // 선택된 휠체어 id 만 넘긴다 — 좌표는 ZoneHandles 가 writer 팔로워로 직접 따라간다.
  // 예전에는 여기서 월드 pose 를 useMemo 로 읽어 넘겼는데, deps 가 [selection] 이라
  // 칩을 드래그해도 갱신되지 않아 핸들만 선택 시점 자리에 남았다(= 따로 놀았다).
  const selectedChairId = useMemo(
    () => (Array.from(selection).find((x) => isId(x, 'ch')) as ChairId | undefined) ?? null,
    [selection],
  );

  const selectedArrow = useMemo(() => {
    const id = Array.from(selection).find((x) => isId(x, 'ar')) as ArrowId | undefined;
    return id ? (step.arrows.find((a) => a.id === id) ?? null) : null;
  }, [selection, step.arrows]);

  const cursorWorld = cursor && PLACEMENT_TOOLS.has(tool) ? gridCellCenter(drill.courtMode, cursor.col, cursor.row) : null;
  const cursorLabel = cursorWorld ? cellLabelAt(drill.courtMode, cursorWorld) : null;

  return (
    <CourtStage
      // 선택 도구에서만 이동을 무장한다 — 배치 도구에서는 같은 자리에 콘 두 개를 빨리
      // 찍는 것이 더블클릭으로 읽혀 두 번째가 삼켜진다.
      allowPan={tool === 'select'}
      ref={stageRef}
      mode={drill.courtMode}
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
      ruleOverlay={rules ? { rules, roster: ruleRoster, teams: drill.teams } : undefined}
      // activePart: Shift+방향키가 무엇을 옮길지 눈에 보이게 한다. 조준을 실제로 쓴 뒤에만
      // 켜므로(= arrowAim 이 이 화살표에 걸린 뒤) 마우스만 쓰는 사람에게는 지금 그림 그대로다.
      arrowHandles={{ arrow: selectedArrow, activePart: selectedArrow && arrowAim?.id === selectedArrow.id ? arrowAim.part : null }}
      keyboardCursor={cursorWorld ? { visible: true, x: cursorWorld.x, y: cursorWorld.y, label: cursorLabel } : undefined}
    />
  );
});
