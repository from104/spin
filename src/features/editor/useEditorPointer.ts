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
import type { ArrowId, BallId, ChairId, ConeId, NoteId } from '../../core/ids.ts';
import { INTERACT } from '../../core/constants.ts';
import { hitTest, handlesVisible as computeHandlesVisible } from '../../physics/index.ts';
import type { HitContext, HitResult, SceneSnapshot, ToolId, DragHandle } from '../../physics/index.ts';
import type { EditorWorldRef } from '../../store/editor/EditorProvider.tsx';
import type { EditorAction } from '../../store/editor/actions.ts';
import type { Drill, DrillStep } from '../../model/drill.ts';
import { poseToStored } from '../../model/chair.ts';
import type { ChairPose, DragZone, ZoneConfig } from '../../model/chair.ts';
import type { Arrow, ArrowKind } from '../../model/arrow.ts';
import { defaultCtrl } from '../../model/arrow.ts';
import type { CourtStageHandle, PointerMeta, PointerDownResult, CourtStagePointerController } from '../../render/CourtStage.tsx';
import type { SelectionOverlayHandle, SelectionShape } from '../../render/SelectionOverlay.tsx';
import { liveRegion } from '../../ui/LiveRegion.tsx';
import { placeObject } from './placement.ts';

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
  stageRef: RefObject<CourtStageHandle | null>;
  zones: ZoneConfig;
  ballMax: number;
  pendingPlayerId: ChairId | null;
  onPlayerPlaced(): void;
  showToast(message: string, action?: { label: string; onAction(): void }): void;
  forceHandlesVisible: boolean;
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
  const metricsRef = useRef({ pxPerUnit: 1, pointerType: 'mouse' });

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

  /** 물리 드래그 정착 시점의 위치를 스텝에 커밋한다. 값이 실제로 바뀐 것만 새 맵을 만든다 —
   *  참조를 그대로 재사용해야 PLACE_COMMIT 리듀서의 무변화 no-op 가드(§6.7)가 작동해서, 그냥
   *  클릭만 해서 잡았다 뗀(이동 없는) 선택도 undo 스택을 더럽히지 않는다. */
  const commitDragResult = useCallback(() => {
    const ctx = ctxRef.current;
    const snap = ctx.worldRef.current?.read();
    if (!snap) return;
    const step = ctx.step;
    let chairs = step.chairs;
    let balls = step.balls;
    let cones = step.cones;
    let changed = false;
    for (const [id, p] of Object.entries(snap)) {
      if (isId(id, 'ch') && id in step.chairs) {
        const stored = poseToStored({ x: p.x, y: p.y, theta: p.theta });
        const cur = step.chairs[id as ChairId]!;
        if (cur.x !== stored.x || cur.y !== stored.y || cur.angleDeg !== stored.angleDeg) {
          if (chairs === step.chairs) chairs = { ...step.chairs };
          chairs[id as ChairId] = stored;
          changed = true;
        }
      } else if (isId(id, 'bl') && id in step.balls) {
        const x = round1(p.x);
        const y = round1(p.y);
        const cur = step.balls[id as BallId]!;
        if (cur.x !== x || cur.y !== y) {
          if (balls === step.balls) balls = { ...step.balls };
          balls[id as BallId] = { x, y };
          changed = true;
        }
      } else if (isId(id, 'cn') && id in step.cones) {
        const x = round1(p.x);
        const y = round1(p.y);
        const cur = step.cones[id as ConeId]!;
        if (cur.x !== x || cur.y !== y) {
          if (cones === step.cones) cones = { ...step.cones };
          cones[id as ConeId] = { x, y };
          changed = true;
        }
      }
    }
    if (!changed) return;
    ctx.dispatch({ type: 'PLACE_BEGIN' });
    ctx.dispatch({ type: 'PLACE_COMMIT', stepId: step.id, chairs, balls, cones });
  }, []);

  const onPointerDown = useCallback(
    (world: Vec2, meta: PointerMeta): PointerDownResult | void => {
      const ctx = ctxRef.current;
      const m = ctx.stageRef.current?.refreshMetrics();
      metricsRef.current = { pxPerUnit: m?.pxPerUnit ?? metricsRef.current.pxPerUnit, pointerType: meta.pointerType };

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
        const handle = ctx.worldRef.current?.beginDrag(hit, world) ?? null;
        dragHandleRef.current = handle;
        draggedIdRef.current = hit.id;
        dragKindRef.current = 'chair';
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
        const nextSel = additive ? toggleId(ctx.selection, hit.id) : [hit.id];
        ctx.dispatch({ type: 'SELECT_SET', ids: nextSel });
        const handle = ctx.worldRef.current?.beginDrag(hit, world) ?? null;
        dragHandleRef.current = handle;
        draggedIdRef.current = hit.id;
        dragKindRef.current = shapeOf(hit.kind);
        if (hit.kind === 'chair') setActiveZone(handle?.zone ?? null);
        setHandlesVisibleForSelection(computeHandlesVisible(metricsRef.current.pxPerUnit, meta.pointerType, ctx.forceHandlesVisible));
        return;
      }
      // note / arrow
      const nextSel = additive ? toggleId(ctx.selection, hit.id) : [hit.id];
      ctx.dispatch({ type: 'SELECT_SET', ids: nextSel });
      if (hit.kind === 'note') {
        const note = ctx.step.notes.find((n) => n.id === hit.id);
        if (note) noteDragRef.current = { id: note.id, offset: { x: world.x - note.x, y: world.y - note.y } };
      }
    },
    [buildScene, buildHitContext, eraseAt, placeAt],
  );

  const onPointerMove = useCallback(
    (world: Vec2, nowMs: number) => {
      const ctx = ctxRef.current;

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

    if (dragHandleRef.current) {
      const id = draggedIdRef.current;
      // 트레이 위에 놓았으면 코트에서 빼낸다 — 개체가 "원래 있던 자리"(주차 슬롯·상자)로
      // 돌아가는 동작이다.
      const overTray = isOverTray(client);

      dragHandleRef.current.end(); // §5.11 릴리스 체이스 시작 — 물리가 스스로 정착까지 굴린다
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
    }
  }, [arrowDraft, buildScene, commitDragResult, commitEraseToast]);

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
