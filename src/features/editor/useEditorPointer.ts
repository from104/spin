// §6.4/§5.11/§5.12 포인터 의미론 — CourtStage(render-stage)가 좌표 변환·포인터 캡처만 하고
// 위임하는 `CourtStagePointerController`(§8 판단 근거: CourtStage.tsx 헤더 주석 "store(Wave3)
// 가 만든 CourtStagePointerController 를 주입받아 위임한다" — 실제로는 이 화면(screen-editor)이
// physics-world 를 의존해 만든다) 를 여기서 조립한다. 히트테스트·물리 드래그·러버밴드·화살표
// 작도·지우개가 전부 여기 한 곳에 모인다.
//
// 개체별 onPointerDown/zoneHandles.onPointerDown/arrowHandles.onPointerDown(CourtStage 가 제공하는
// 선택적 prop)은 쓰지 않는다 — 어느 자식 엘리먼트에서 시작했든 포인터다운은 SVG 루트로 버블링해
// controller.onPointerDown(world, meta) 를 부르고, 그 world 좌표만으로 hitTest(§5.12)가 대상을
// 우선순위대로 스스로 가려낸다(콘/화살표 핸들/존 핸들 모두 좌표 기준 판정이라 DOM 출처가 필요
// 없다) — 두 경로를 다 만들면 이중 처리가 된다.
import { useCallback, useMemo, useRef, useState } from 'react';
import type { Dispatch, RefObject } from 'react';
import type { Vec2 } from '../../core/units.ts';
import { isId, newId } from '../../core/ids.ts';
import type { ArrowId, BallId, CastId, ChairId, ConeId, NoteId } from '../../core/ids.ts';
import { INTERACT, PHYS } from '../../core/constants.ts';
import { hitTest, handlesVisible as computeHandlesVisible } from '../../physics/index.ts';
import type { HitContext, HitResult, PhysicsSnapshot, SceneSnapshot, ToolId, DragHandle } from '../../physics/index.ts';
import type { EditorWorldRef } from '../../store/editor/EditorProvider.tsx';
import type { EditorAction } from '../../store/editor/actions.ts';
import type { Drill, DrillStep } from '../../model/drill.ts';
import { formationSlots } from '../../model/defaults.ts';
import { poseToStored } from '../../model/chair.ts';
import type { ChairPose, DragZone, ZoneConfig } from '../../model/chair.ts';
import type { Arrow, ArrowKind } from '../../model/arrow.ts';
import { defaultCtrl } from '../../model/arrow.ts';
import type { CourtStageHandle, PointerMeta, PointerDownResult, CourtStagePointerController } from '../../render/CourtStage.tsx';
import type { TransformWriter } from '../../render/transformWriter.ts';
import type { SelectionOverlayHandle, SelectionShape } from '../../render/SelectionOverlay.tsx';
import { liveRegion } from '../../ui/LiveRegion.tsx';
import { placeObject } from './placement.ts';
import { snapOnSettle } from './snapOnSettle.ts';

const ZONE_LABEL: Record<DragZone, string> = {
  towRear: '후방 견인',
  translate: '평행 이동',
  spin: '제자리 회전',
  towFront: '전방 견인',
};

const round1 = (n: number): number => Math.round(n * 10) / 10;

/** 손을 뗀 화면 좌표가 트레이 위인가 = 코트에서 빼낼 것인가.
 *
 *  좌표로 찾는 이유: 드래그 중에는 코트 SVG 가 포인터를 캡처하고 있어 이벤트 대상이 언제나
 *  코트다(§6.4). elementFromPoint 는 캡처와 무관하게 기하로 답한다.
 *  pointercancel 은 좌표가 없어 null 로 들어오며, 그때는 빼지 않는다 — 시스템 제스처에
 *  가로채였을 뿐인데 개체가 사라지면 안 된다. */
export function isOverTray(client: { x: number; y: number } | null): boolean {
  if (!client) return false;
  const el = document.elementFromPoint(client.x, client.y);
  return !!el?.closest('[data-tray]');
}

export interface UseEditorPointerOptions {
  drill: Drill;
  step: DrillStep;
  tool: ToolId;
  coneSlot: 0 | 1;
  selection: ReadonlySet<string>;
  dispatch: Dispatch<EditorAction>;
  worldRef: EditorWorldRef;
  /** §4.3 P1-1 — 잡은 개체에 `chip--held` 를 붙이는 유일한 경로. selection 을 props 로 내려
   *  렌더로 표현하면 §6.1 규칙 1 위반이라, 60fps transform 을 쓰는 층에 직접 부탁한다. */
  writer: TransformWriter;
  stageRef: RefObject<CourtStageHandle | null>;
  zones: ZoneConfig;
  ballMax: number;
  pendingPlayerId: ChairId | null;
  onPlayerPlaced(): void;
  showToast(message: string, action?: { label: string; onAction(): void }): void;
  forceHandlesVisible: boolean;
  /** §7.3 "큰 터치 타깃" 설정. 2단 히트(§4.3 P1-2)의 **2차 패스 반경**만 44 → 56 CSS px 로
   *  키운다 — 그 설정 설명문이 버튼에서만 참이고 코트 위에서는 거짓이던 것을 닫는 배선이다. */
  largeTargets: boolean;
}

export interface UseEditorPointerResult {
  controller: CourtStagePointerController;
  selectionOverlayRef: RefObject<SelectionOverlayHandle | null>;
  activeZone: DragZone | null;
  handlesVisibleForSelection: boolean;
  arrowDraft: Arrow | null;
  /** §7.5d 키보드 커서 Enter — pointerdown 과 같은 배치 로직을 재사용한다. */
  placeAtCursor(world: Vec2): void;
}

function shapeOf(kind: HitResult['kind']): SelectionShape | null {
  if (kind === 'chair') return 'chair';
  if (kind === 'ball') return 'ball';
  if (kind === 'cone') return 'cone';
  if (kind === 'note') return 'note';
  return null;
}

function toggleId(sel: ReadonlySet<string>, id: string): string[] {
  const next = new Set(sel);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return Array.from(next);
}

function inRect(p: Vec2, rect: { x: number; y: number; w: number; h: number }): boolean {
  return p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h;
}

export function useEditorPointer(opts: UseEditorPointerOptions): UseEditorPointerResult {
  const ctxRef = useRef(opts);
  ctxRef.current = opts;

  const selectionOverlayRef = useRef<SelectionOverlayHandle | null>(null);
  const [activeZone, setActiveZone] = useState<DragZone | null>(null);
  const [arrowDraft, setArrowDraft] = useState<Arrow | null>(null);
  const [handlesVisibleForSelection, setHandlesVisibleForSelection] = useState(false);

  const dragHandleRef = useRef<DragHandle | null>(null);
  const draggedIdRef = useRef<string | null>(null);
  const dragKindRef = useRef<SelectionShape | null>(null);
  const rubberRef = useRef<{ start: Vec2; additive: boolean } | null>(null);
  const rubberRectRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const arrowSessionRef = useRef<{ kind: ArrowKind; from: Vec2 } | null>(null);
  const noteDragRef = useRef<{ id: NoteId; offset: Vec2 } | null>(null);
  const arrowHandleDragRef = useRef<{ arrowId: ArrowId; which: 'from' | 'ctrl' | 'to' } | null>(null);
  const eraseSessionRef = useRef<{ touched: Set<string>; count: number } | null>(null);
  /** §4.3 P1-2 [A-3] — "선택된 개체 재탭 = 해제" 세션. 2단 히트가 켜지면 붐비는 코트에서
   *  "빈 곳 탭 → 해제"(아래 rubberRef 경로)가 사라지므로, **이미 선택된** 개체를 additive
   *  없이 다시 눌렀다가 탭 임계(INTERACT.tapMaxMoveCssPx) 안에서 손을 떼면 SELECT_CLEAR 로
   *  물러난다. 움직였으면(=드래그) 선택은 그대로다.
   *  350ms/12px 안의 빠른 재탭은 여기 도달하지 않는다 — CourtStage 가 더블클릭 팬 무장으로
   *  먼저 삼킨다(CourtStage.tsx DBL_CLICK_* — 그 계약은 P2-1 이 명시적으로 남긴다). */
  const tapDeselectRef = useRef<{ start: Vec2; moved: boolean } | null>(null);
  const metricsRef = useRef({ pxPerUnit: 1, pointerType: 'mouse' });
  /** 이 드래그가 히스토리 경계(PLACE_BEGIN)를 이미 열었는가. 정착 재커밋은 경계를 다시 열지
   *  않는다 — '드래그 1회 = undo 1회'(§6.7 history.ts:72-80). */
  const boundaryOpenRef = useRef(false);
  /** 정착 완료 통지의 구독 해제 함수(§4.2 P0-2). 일회성이라 받는 즉시 스스로 끊는다. */
  const settleOffRef = useRef<(() => void) | null>(null);

  const buildScene = useCallback((): SceneSnapshot => {
    const ctx = ctxRef.current;
    const snap = ctx.worldRef.current?.read() ?? {};
    const chairs: Array<{ id: ChairId; pose: ChairPose }> = [];
    const balls: Array<{ id: BallId; p: Vec2 }> = [];
    const cones: Array<{ id: ConeId; p: Vec2 }> = [];
    for (const [id, p] of Object.entries(snap)) {
      if (isId(id, 'ch')) chairs.push({ id, pose: { x: p.x, y: p.y, theta: p.theta } });
      else if (isId(id, 'bl')) balls.push({ id, p: { x: p.x, y: p.y } });
      else if (isId(id, 'cn')) cones.push({ id, p: { x: p.x, y: p.y } });
    }
    return {
      chairs,
      balls,
      cones,
      notes: ctx.step.notes.map((n) => ({ id: n.id, p: { x: n.x, y: n.y } })),
      arrows: ctx.step.arrows.map((a) => ({ id: a.id, kind: a.kind, from: a.from, ctrl: a.ctrl, to: a.to })),
    };
  }, []);

  const buildHitContext = useCallback((tool: ToolId): HitContext => {
    const ctx = ctxRef.current;
    const selectedChairId = (Array.from(ctx.selection).find((id) => isId(id, 'ch')) as ChairId | undefined) ?? null;
    const selectedArrowId = (Array.from(ctx.selection).find((id) => isId(id, 'ar')) as ArrowId | undefined) ?? null;
    return {
      zones: ctx.zones,
      pxPerUnit: metricsRef.current.pxPerUnit,
      pointerType: metricsRef.current.pointerType,
      selectedChairId,
      selectedArrowId,
      // 히트 게이트는 **화면에 보이는 것과 같아야** 한다(회귀): 예전에는 여기만
      // computeHandlesVisible(터치 + 많이 축소)로 판정해서, 마우스에서는 핸들이 그려져
      // 있는데도 hitTest 가 zoneHandle 을 절대 돌려주지 않았다 — 특히 차체 밖 앞뒤 핸들은
      // 눌러도 빈 코트로 떨어져 선택만 해제됐다. 렌더가 "선택된 칩이면 표시" 이므로
      // 히트도 같은 조건을 쓴다.
      handlesVisible: selectedChairId !== null,
      tool,
      // [D-4] 2차 패스 반경만 이 값을 쓴다. 1차 패스는 이 값과 무관하다.
      hitCssPx: ctx.largeTargets ? INTERACT.hitTargetLargeCssPx : INTERACT.hitTargetCssPx,
    };
  }, []);

  const commitEraseToast = useCallback(() => {
    const session = eraseSessionRef.current;
    eraseSessionRef.current = null;
    if (!session || session.count === 0) return;
    const ctx = ctxRef.current;
    const n = session.count;
    ctx.showToast(`${n}개 삭제했습니다.`, {
      label: '되돌리기',
      onAction: () => {
        for (let i = 0; i < n; i++) ctx.dispatch({ type: 'UNDO' });
      },
    });
  }, []);

  const eraseAt = useCallback(
    (world: Vec2, thisStepOnly: boolean) => {
      const ctx = ctxRef.current;
      const session = eraseSessionRef.current;
      if (!session) return;
      const hit = hitTest(world, buildScene(), buildHitContext('erase'));
      if (!hit) return;
      const key = `${hit.kind}:${hit.id}`;
      if (session.touched.has(key)) return;
      session.touched.add(key);
      session.count++;
      const scope = thisStepOnly ? 'thisStep' : 'onward';
      if (hit.kind === 'chair') ctx.dispatch({ type: 'OBJECT_REMOVE', id: hit.id as ChairId, scope });
      else if (hit.kind === 'ball') ctx.dispatch({ type: 'OBJECT_REMOVE', id: hit.id as BallId, scope });
      else if (hit.kind === 'cone') ctx.dispatch({ type: 'OBJECT_REMOVE', id: hit.id as ConeId, scope });
      else if (hit.kind === 'note') ctx.dispatch({ type: 'NOTE_REMOVE', id: hit.id as NoteId });
      else if (hit.kind === 'arrow') ctx.dispatch({ type: 'ARROW_REMOVE', id: hit.id as ArrowId });
    },
    [buildScene, buildHitContext],
  );

  /** 배치 도구 공용 — pointerdown 과 §7.5d 키보드 커서 Enter 가 함께 쓴다.
   *  규칙 자체는 placement.ts 가 갖는다(트레이 드래그와 같은 규칙을 써야 한다). */
  const placeAt = useCallback((world: Vec2) => {
    const ctx = ctxRef.current;
    if (ctx.tool !== 'ball' && ctx.tool !== 'cone' && ctx.tool !== 'note' && ctx.tool !== 'player') return;
    placeObject(ctx.tool, world, {
      drill: ctx.drill,
      coneSlot: ctx.coneSlot,
      ballMax: ctx.ballMax,
      pendingPlayerId: ctx.pendingPlayerId,
      dispatch: ctx.dispatch,
      showToast: (m) => ctx.showToast(m),
      onPlayerPlaced: ctx.onPlayerPlaced,
    });
  }, []);

  /** 정착 스냅(§4.3 P1-3)을 이번에 놓은 개체 **하나에만** 적용해 그 좌표를 돌려준다.
   *  스냅되지 않았으면 null. 물리에 되먹이는 것은 호출자 몫이다. */
  const snapSettledPose = useCallback((id: string, snap: PhysicsSnapshot): Vec2 | null => {
    const ctx = ctxRef.current;
    const self = snap[id];
    if (!self) return null;
    // 이웃 = 판 위의 다른 캐스트 개체. 골대(gp_*)는 뺀다 — 원위치는 이미 세트피스 후보다.
    const neighbors: Vec2[] = [];
    for (const [oid, op] of Object.entries(snap)) {
      if (oid === id) continue;
      if (isId(oid, 'ch') || isId(oid, 'bl') || isId(oid, 'cn')) neighbors.push({ x: op.x, y: op.y });
    }
    const out = snapOnSettle(
      { x: self.x, y: self.y },
      {
        mode: ctx.drill.courtMode,
        pxPerUnit: metricsRef.current.pxPerUnit,
        neighbors,
        slots: formationSlots(ctx.drill.courtMode, ctx.drill.formation),
      },
    );
    return out.target === null ? null : { x: out.x, y: out.y };
  }, []);

  /** 물리 좌표를 스텝에 커밋한다. 값이 실제로 바뀐 것만 새 맵을 만든다 — 참조를 그대로
   *  재사용해야 PLACE_COMMIT 리듀서의 무변화 no-op 가드(§6.7)가 작동해서, 그냥 클릭만 해서
   *  잡았다 뗀(이동 없는) 선택도 undo 스택을 더럽히지 않는다.
   *
   *  `snapId` 가 있으면 그 개체에만 정착 스냅을 건다(§4.3 P1-3). **손을 뗀 시점 커밋에서는
   *  절대 넘기지 않는다**(A-6/E-1): 그때 스냅해 봐야 뒤이은 정착 재커밋이 물리 좌표로 덮어써
   *  통째로 무효화된다. 스냅은 이 재커밋 경로 *안에서만* 산다. */
  const commitPoses = useCallback((snap: PhysicsSnapshot, step: DrillStep, snapId: string | null): void => {
    const ctx = ctxRef.current;
    const snapped = snapId ? snapSettledPose(snapId, snap) : null;
    if (snapId && snapped) {
      // 모델만 옮기면 물리 바디가 스냅 전 자리에 남는다 — epoch 을 올리지 않으므로(A-4)
      // world.load 가 고쳐 주지 않는다. 다음 드래그가 낡은 자세를 읽고 칩이 되튄다.
      const cur = snap[snapId]!;
      ctx.worldRef.current?.setPose(snapId as CastId, { x: snapped.x, y: snapped.y, theta: cur.theta });
    }
    const posOf = (id: string, p: { x: number; y: number }): { x: number; y: number } =>
      id === snapId && snapped ? snapped : p;

    let chairs = step.chairs;
    let balls = step.balls;
    let cones = step.cones;
    let changed = false;
    for (const [id, p] of Object.entries(snap)) {
      if (isId(id, 'ch') && id in step.chairs) {
        const q = posOf(id, p);
        const stored = poseToStored({ x: q.x, y: q.y, theta: p.theta });
        const cur = step.chairs[id as ChairId]!;
        if (cur.x !== stored.x || cur.y !== stored.y || cur.angleDeg !== stored.angleDeg) {
          if (chairs === step.chairs) chairs = { ...step.chairs };
          chairs[id as ChairId] = stored;
          changed = true;
        }
      } else if (isId(id, 'bl') && id in step.balls) {
        const q = posOf(id, p);
        const x = round1(q.x);
        const y = round1(q.y);
        const cur = step.balls[id as BallId]!;
        if (cur.x !== x || cur.y !== y) {
          if (balls === step.balls) balls = { ...step.balls };
          balls[id as BallId] = { x, y };
          changed = true;
        }
      } else if (isId(id, 'cn') && id in step.cones) {
        const q = posOf(id, p);
        const x = round1(q.x);
        const y = round1(q.y);
        const cur = step.cones[id as ConeId]!;
        if (cur.x !== x || cur.y !== y) {
          if (cones === step.cones) cones = { ...step.cones };
          cones[id as ConeId] = { x, y };
          changed = true;
        }
      }
    }
    if (changed && !boundaryOpenRef.current) {
      // 히스토리 경계는 이 드래그에서 **한 번만** 연다(드래그 1회 = undo 1회, history.ts:72-80).
      // 손을 뗀 시점에 값이 하나도 안 바뀌었다면(체이스가 아직 갈 길이 남아 있다) 경계는
      // 여기 정착 시점에 열린다 — 어느 쪽이든 이 드래그가 남기는 undo 는 하나다.
      ctx.dispatch({ type: 'PLACE_BEGIN' });
      boundaryOpenRef.current = true;
    }
    if (snapId === null) {
      if (changed) ctx.dispatch({ type: 'PLACE_COMMIT', stepId: step.id, chairs, balls, cones });
    } else {
      // 정착 통지는 **좌표가 안 바뀌었어도** 반드시 디스패치한다 — 자동저장 억제 창을 닫는
      // 것이 이 액션의 두 번째 일이다(A-5). 리듀서는 같은 참조를 받으면 드릴은 그대로 두고
      // 창만 닫는다(§6.7 PLACE_COMMIT 무변화 no-op 가드와 같은 경로).
      ctx.dispatch({ type: 'PLACE_SETTLE', stepId: step.id, chairs, balls, cones });
    }
  }, [snapSettledPose]);

  const commitDragResult = useCallback(() => {
    const ctx = ctxRef.current;
    const snap = ctx.worldRef.current?.read();
    if (!snap) return;
    commitPoses(snap, ctx.step, null);
  }, [commitPoses]);

  /** 새 드래그를 시작할 때 앞선 드래그의 잔재를 끊는다 — 히스토리 경계 플래그와, 아직 오지
   *  않은 정착 통지 구독. 구독을 남겨 두면 이번 드래그의 정착 통지에 옛 개체까지 스냅된다. */
  const resetDragSession = useCallback(() => {
    boundaryOpenRef.current = false;
    settleOffRef.current?.();
    settleOffRef.current = null;
  }, []);

  /** 손을 뗀 뒤 **물리가 다 선 시점**에 한 번 더 커밋한다(§4.2 P0-2).
   *
   *  `handle.end()` 는 릴리스 체이스(최대 4초)를 시작만 한다 — 그 직후 읽은 좌표는 "손 떼던
   *  순간의 자리" 다. 속도 제한이 켜져 있으면 선속 69.4 px/s 라 750 px 코트 횡단에 10초가
   *  걸리므로, 화면에서는 칩이 손을 따라가 멈췄는데 모델에는 출발점 근처가 남는다. 그 상태로
   *  스텝을 넘겼다 돌아오면(world.load 가 모델 좌표로 바디를 재생성) 칩이 옛 자리로 되돌아간다.
   *
   *  구독은 **일회성**이다: 정착 통지는 골대 원위치 복귀 등 드래그가 아닌 이유로도 오므로
   *  (physics/index.ts onSettled 주석), 이번 드래그의 첫 통지만 받고 바로 끊는다. */
  const armSettleRecommit = useCallback(
    (id: string) => {
      const ctx = ctxRef.current;
      const world = ctx.worldRef.current;
      if (!world) return; // 구독할 곳이 없으면 억제 창도 열지 않는다(영영 안 닫힌다)
      const stepId = ctx.step.id;
      settleOffRef.current?.();
      settleOffRef.current = null;
      // 억제 창의 마감 = 체이스 상한 + 정착 상한. 이 안에 통지가 안 오면(스텝 전환으로
      // world.load 가 끼어드는 경우) 자동저장이 스스로 풀린다.
      ctx.dispatch({ type: 'SETTLE_ARM', until: Date.now() + INTERACT.releaseChaseMs + PHYS.settleMaxMs });
      settleOffRef.current = world.onSettled((settled) => {
        settleOffRef.current?.();
        settleOffRef.current = null;
        const c = ctxRef.current;
        // 끌던 **그 스텝에 여전히 머물러 있을 때만** 재커밋한다. 스텝을 넘겼거나 지웠다면
        // EditorProvider 가 이미 world.load 로 바디를 새 스텝 좌표로 갈아 끼웠으므로, 지금
        // 스냅샷은 이 드래그의 결과가 아니다 — 옛 스텝에 쓰면 남의 좌표를 덮어쓴다.
        // 그때는 저장 억제 창만 닫고 조용히 물러난다.
        if (c.step.id !== stepId) {
          c.dispatch({ type: 'SETTLE_ARM', until: 0 });
          return;
        }
        commitPoses(settled, c.step, id);
      });
    },
    [commitPoses],
  );

  const onPointerDown = useCallback(
    (world: Vec2, meta: PointerMeta): PointerDownResult | void => {
      const ctx = ctxRef.current;
      const m = ctx.stageRef.current?.refreshMetrics();
      metricsRef.current = { pxPerUnit: m?.pxPerUnit ?? metricsRef.current.pxPerUnit, pointerType: meta.pointerType };
      tapDeselectRef.current = null; // 재탭 해제 세션은 pointerdown 마다 새로 판정한다

      if (ctx.tool === 'ball' || ctx.tool === 'cone' || ctx.tool === 'note' || ctx.tool === 'player') {
        placeAt(world);
        return;
      }

      if (ctx.tool === 'erase') {
        eraseSessionRef.current = { touched: new Set(), count: 0 };
        eraseAt(world, meta.altKey);
        return;
      }

      if (ctx.tool === 'route' || ctx.tool === 'pass') {
        const scene = buildScene();
        let from = world;
        const centers: Vec2[] = [
          ...scene.chairs.map((c) => c.pose),
          ...scene.balls.map((b) => b.p),
          ...scene.cones.map((c) => c.p),
          ...scene.notes.map((n) => n.p),
        ];
        for (const c of centers) {
          if (Math.hypot(c.x - world.x, c.y - world.y) <= 15) {
            from = c;
            break;
          }
        }
        arrowSessionRef.current = { kind: ctx.tool === 'route' ? 'move' : 'pass', from };
        setArrowDraft({ id: 'ar_draft' as ArrowId, kind: ctx.tool === 'route' ? 'move' : 'pass', from, ctrl: from, to: from });
        return;
      }

      // select
      const additive = meta.shiftKey || meta.metaKey;
      const hit = hitTest(world, buildScene(), buildHitContext('select'));
      if (!hit) {
        rubberRef.current = { start: world, additive };
        rubberRectRef.current = { x: world.x, y: world.y, w: 0, h: 0 };
        selectionOverlayRef.current?.setRubberBand(rubberRectRef.current);
        // 확대해 놓고 선택을 시작하면 화면 밖 개체는 어떤 방법으로도 사각형에 넣을 수 없다 —
        // 손을 떼면 선택이 끝나고, 떼지 않으면 판을 밀 수 없다. 가장자리에서 판이 따라온다.
        return { edgePan: true };
      }
      if (hit.kind === 'zoneHandle') {
        resetDragSession();
        const handle = ctx.worldRef.current?.beginDrag(hit, world) ?? null;
        dragHandleRef.current = handle;
        draggedIdRef.current = hit.id;
        dragKindRef.current = 'chair';
        if (handle) ctx.writer.setHeld(hit.id, true);
        setActiveZone(handle?.zone ?? hit.zone ?? null);
        if (handle?.zone) liveRegion.say(`${ZONE_LABEL[handle.zone]} 잡음`);
        return;
      }
      if (hit.kind === 'arrowHandle') {
        arrowHandleDragRef.current = { arrowId: hit.id as ArrowId, which: hit.which! };
        ctx.dispatch({ type: 'SELECT_SET', ids: [hit.id] });
        return;
      }
      if (hit.kind === 'chair' || hit.kind === 'ball' || hit.kind === 'cone') {
        // [A-3] 이미 선택된 개체의 재탭이면 해제 후보로 문다 — 판정은 up 에서(움직였으면 드래그다).
        // additive 는 아래 toggleId 가 pointerdown 시점에 즉시 빼 주므로 여기 대상이 아니다.
        if (!additive && ctx.selection.has(hit.id)) tapDeselectRef.current = { start: world, moved: false };
        const nextSel = additive ? toggleId(ctx.selection, hit.id) : [hit.id];
        ctx.dispatch({ type: 'SELECT_SET', ids: nextSel });
        resetDragSession();
        const handle = ctx.worldRef.current?.beginDrag(hit, world) ?? null;
        dragHandleRef.current = handle;
        draggedIdRef.current = hit.id;
        dragKindRef.current = shapeOf(hit.kind);
        // 잡힌 개체는 판에서 뜬다(§4.3 P1-1). 실제로 물리 드래그가 시작된 경우에만 —
        // 손을 대기만 하고 잡히지 않았는데 뜨면 그 신호는 거짓말이 된다.
        if (handle) ctx.writer.setHeld(hit.id, true);
        if (hit.kind === 'chair') setActiveZone(handle?.zone ?? null);
        setHandlesVisibleForSelection(computeHandlesVisible(metricsRef.current.pxPerUnit, meta.pointerType, ctx.forceHandlesVisible));
        return;
      }
      // note / arrow
      // [A-3] 메모·화살표도 같은 재탭 해제 계약을 따른다 — 개체 종류가 규칙을 바꾸면 안 된다.
      if (!additive && ctx.selection.has(hit.id)) tapDeselectRef.current = { start: world, moved: false };
      const nextSel = additive ? toggleId(ctx.selection, hit.id) : [hit.id];
      ctx.dispatch({ type: 'SELECT_SET', ids: nextSel });
      if (hit.kind === 'note') {
        const note = ctx.step.notes.find((n) => n.id === hit.id);
        if (note) noteDragRef.current = { id: note.id, offset: { x: world.x - note.x, y: world.y - note.y } };
      }
    },
    [buildScene, buildHitContext, eraseAt, placeAt, resetDragSession],
  );

  const onPointerMove = useCallback(
    (world: Vec2, nowMs: number) => {
      const ctx = ctxRef.current;

      // [A-3] 탭 임계를 넘는 순간 이 세션은 드래그다 — 한 번 넘었으면 되돌아와도 드래그다
      // (러버밴드의 tapPx 판정과 같은 임계·같은 화면 기준 환산).
      const tap = tapDeselectRef.current;
      if (tap && !tap.moved) {
        const tapPx = INTERACT.tapMaxMoveCssPx / metricsRef.current.pxPerUnit;
        if (Math.hypot(world.x - tap.start.x, world.y - tap.start.y) > tapPx) tap.moved = true;
      }

      if (dragHandleRef.current) {
        dragHandleRef.current.move(world, nowMs);
        const id = draggedIdRef.current;
        const kind = dragKindRef.current;
        if (id && kind) {
          const cur = ctx.worldRef.current?.read()?.[id];
          if (cur) {
            // 리시는 **잡은 지점(앵커)** 에서 나가야 한다. 예전에는 피벗(cur)에서 그려서
            // 어느 존을 잡았든 선이 늘 회전축 한가운데에 붙어 보였고, 그래서 조작 자체가
            // 피벗을 끄는 것처럼 읽혔다. 로프는 실제로 앵커에 묶여 있다(§5.5 C).
            const anchor = dragHandleRef.current?.grabPoint ?? { x: cur.x, y: cur.y };
            const d = Math.hypot(anchor.x - world.x, anchor.y - world.y);
            const leashPx = INTERACT.leashVisibleAtPx / metricsRef.current.pxPerUnit;
            if (d > leashPx) {
              selectionOverlayRef.current?.setLeash(anchor, world);
              // 고스트도 "앵커가 포인터에 닿았을 때의 자세" 로 놓는다 — 피벗을 포인터에
              // 두면 앞범퍼를 잡았을 때 차체 한 칸만큼 어긋나 보인다.
              const offX = anchor.x - cur.x;
              const offY = anchor.y - cur.y;
              selectionOverlayRef.current?.setGhost(kind, world.x - offX, world.y - offY, kind === 'chair' ? cur.theta : 0);
            } else {
              selectionOverlayRef.current?.setLeash(null, null);
              selectionOverlayRef.current?.setGhost(null, 0, 0, 0);
            }
          }
        }
        return;
      }

      if (arrowSessionRef.current) {
        const { kind, from } = arrowSessionRef.current;
        setArrowDraft({ id: 'ar_draft' as ArrowId, kind, from, ctrl: defaultCtrl(from, world, 0), to: world });
        return;
      }

      if (eraseSessionRef.current) {
        eraseAt(world, false);
        return;
      }

      if (noteDragRef.current) {
        const { id, offset } = noteDragRef.current;
        const note = ctx.step.notes.find((n) => n.id === id);
        if (note) ctx.dispatch({ type: 'NOTE_SET', note: { ...note, x: world.x - offset.x, y: world.y - offset.y } });
        return;
      }

      if (arrowHandleDragRef.current) {
        const { arrowId, which } = arrowHandleDragRef.current;
        const arrow = ctx.step.arrows.find((a) => a.id === arrowId);
        if (arrow) {
          const next: Arrow = which === 'ctrl' ? { ...arrow, ctrl: world } : { ...arrow, [which]: world };
          ctx.dispatch({ type: 'ARROW_SET', arrow: next });
        }
        return;
      }

      if (rubberRef.current) {
        const { start } = rubberRef.current;
        rubberRectRef.current = { x: Math.min(start.x, world.x), y: Math.min(start.y, world.y), w: Math.abs(world.x - start.x), h: Math.abs(world.y - start.y) };
        selectionOverlayRef.current?.setRubberBand(rubberRectRef.current);
      }
    },
    [eraseAt],
  );

  const onPointerUp = useCallback((client: { x: number; y: number } | null) => {
    const ctx = ctxRef.current;

    // [A-3] 재탭 해제 판정 — 어느 경로로 끝나든 세션은 여기서 소거한다. pointercancel
    // (client=null)은 탭이 아니다: 시스템 제스처에 뺏겼을 뿐인데 선택까지 풀리면 안 된다
    // (isOverTray 가 cancel 에 개체를 지우지 않는 것과 같은 원칙).
    const tapSession = tapDeselectRef.current;
    tapDeselectRef.current = null;
    const tapDeselect = tapSession !== null && !tapSession.moved && client !== null;

    if (dragHandleRef.current) {
      const id = draggedIdRef.current;
      // 트레이 위에 놓았으면 코트에서 빼낸다 — 개체가 "원래 있던 자리"(주차 슬롯·상자)로
      // 돌아가는 동작이다.
      const overTray = isOverTray(client);

      dragHandleRef.current.end(); // §5.11 릴리스 체이스 시작 — 물리가 스스로 정착까지 굴린다
      // 손을 뗐으니 칩을 판에 내려놓는다. 트레이로 빼는 경로보다 **먼저** 해야 한다 —
      // 개체가 사라진 뒤에는 되돌릴 노드가 없어 held 표시가 다음 마운트로 새어 나간다.
      // pointercancel(client=null)도 이 경로로 들어오므로 시스템 제스처에 뺏겨도 풀린다.
      if (id) ctx.writer.setHeld(id, false);
      dragHandleRef.current = null;
      draggedIdRef.current = null;
      dragKindRef.current = null;
      setActiveZone(null);
      selectionOverlayRef.current?.setLeash(null, null);
      selectionOverlayRef.current?.setGhost(null, 0, 0, 0);

      if (overTray && id) {
        // 되돌리기 한 번으로 살아나야 한다 — 커밋을 먼저 하면 "옮김 + 뺌" 두 단계가 쌓인다.
        ctx.dispatch({ type: 'OBJECT_REMOVE', id: id as ChairId | BallId | ConeId, scope: 'onward' });
        ctx.dispatch({ type: 'SELECT_CLEAR' });
        return;
      }
      commitDragResult();
      // 손 떼는 자리는 아직 최종이 아니다 — 물리가 다 선 뒤 한 번 더 커밋한다(§4.2 P0-2).
      // 스냅(§4.3 P1-3)도 그 재커밋 경로 안에서만 걸린다.
      if (id) armSettleRecommit(id);
      // [A-3] 제자리 탭이었다 — 물리 정리(위)는 전부 마치고 선택만 물린다. 이동이 없었으니
      // 커밋은 no-op 가드로 걸러져 undo 스택도 더럽히지 않는다.
      if (tapDeselect) ctx.dispatch({ type: 'SELECT_CLEAR' });
      return;
    }

    if (arrowSessionRef.current) {
      const draft = arrowDraft;
      arrowSessionRef.current = null;
      setArrowDraft(null);
      if (draft && Math.hypot(draft.to.x - draft.from.x, draft.to.y - draft.from.y) >= 12) {
        const arrow: Arrow = { id: newId('ar'), kind: draft.kind, from: draft.from, ctrl: draft.ctrl, to: draft.to };
        ctx.dispatch({ type: 'ARROW_SET', arrow });
        ctx.dispatch({ type: 'SELECT_SET', ids: [arrow.id] });
      }
      return;
    }

    if (eraseSessionRef.current) {
      commitEraseToast();
      return;
    }

    if (noteDragRef.current) {
      noteDragRef.current = null;
      if (tapDeselect) ctx.dispatch({ type: 'SELECT_CLEAR' }); // [A-3] 메모 재탭
      return;
    }
    if (arrowHandleDragRef.current) {
      arrowHandleDragRef.current = null;
      return;
    }

    if (rubberRef.current) {
      const { additive } = rubberRef.current;
      const rect = rubberRectRef.current;
      rubberRef.current = null;
      rubberRectRef.current = null;
      selectionOverlayRef.current?.setRubberBand(null);
      const cur = ctx.stageRef.current?.refreshMetrics();
      const pxPerUnit = cur?.pxPerUnit ?? metricsRef.current.pxPerUnit;
      const tapPx = INTERACT.tapMaxMoveCssPx / pxPerUnit;
      if (!rect || rect.w <= tapPx || rect.h <= tapPx) {
        // 임계 미만 이동 = 빈 코트 탭 → 선택 해제(가산 선택 중엔 유지).
        if (!additive) ctx.dispatch({ type: 'SELECT_CLEAR' });
        return;
      }
      const scene = buildScene();
      const ids: string[] = [];
      for (const c of scene.chairs) if (inRect(c.pose, rect)) ids.push(c.id);
      for (const b of scene.balls) if (inRect(b.p, rect)) ids.push(b.id);
      for (const c of scene.cones) if (inRect(c.p, rect)) ids.push(c.id);
      for (const n of scene.notes) if (inRect(n.p, rect)) ids.push(n.id);
      if (ids.length > 0) {
        ctx.dispatch({ type: 'SELECT_SET', ids: additive ? Array.from(new Set([...ctx.selection, ...ids])) : ids });
      } else if (!additive) {
        ctx.dispatch({ type: 'SELECT_CLEAR' });
      }
      return;
    }

    // [A-3] 화살표 몸통은 어떤 드래그 세션도 만들지 않아 여기까지 흘러온다 — 재탭 해제만 판정.
    if (tapDeselect) ctx.dispatch({ type: 'SELECT_CLEAR' });
  }, [arrowDraft, armSettleRecommit, buildScene, commitDragResult, commitEraseToast]);

  const controller = useMemo<CourtStagePointerController>(() => ({ onPointerDown, onPointerMove, onPointerUp }), [onPointerDown, onPointerMove, onPointerUp]);

  return {
    controller,
    selectionOverlayRef,
    activeZone,
    handlesVisibleForSelection,
    arrowDraft,
    placeAtCursor: placeAt,
  };
}
