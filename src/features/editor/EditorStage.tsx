// §6.4/§6.6/§7.5b–d — CourtStage(render-stage)를 편집기 상태에 연결한다. 좌표 변환·포인터
// 캡처·레이어 순서는 CourtStage 소관, 히트테스트·물리 드래그 의미론은 useEditorPointer 소관,
// 이 파일은 그 둘을 조립하고 §7.5 키보드 계약(로빙 tabindex·개체 순회·키보드 배치 커서)만
// 더한다.
import { forwardRef, useCallback, useMemo, useState } from 'react';
import type { Dispatch, KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react';
import { RAD } from '../../core/angle.ts';
import { isId } from '../../core/ids.ts';
import type { ArrowId, CastId, ChairId } from '../../core/ids.ts';
import type { ToolId } from '../../physics/index.ts';
import type { EditorWorldRef } from '../../store/editor/EditorProvider.tsx';
import { poseFrame } from '../../store/editor/tween.ts';
import type { EditorAction } from '../../store/editor/actions.ts';
import type { Drill, DrillStep } from '../../model/drill.ts';
import type { ZoneConfig } from '../../model/chair.ts';
import { COURT_DEFS, gridCellCenter, cellLabelAt, type CourtMode } from '../../model/court.ts';
import { GOAL_ID_PREFIX } from '../../physics/index.ts';
import { CourtStage, type CourtStageHandle } from '../../render/CourtStage.tsx';
import { screenDeltaToWorld } from '../../render/useStageMetrics.ts';
import type { ObjectLayerChair, ObjectLayerCone } from '../../render/ObjectLayer.tsx';
import type { TransformWriter } from '../../render/transformWriter.ts';
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
  zones: ZoneConfig;
  ballMax: number;
  pendingPlayerId: ChairId | null;
  onPlayerPlaced(): void;
  showToast(message: string, action?: { label: string; onAction(): void }): void;
  showGrid: boolean;
  showGridLabels: boolean;
  showRuleZones: boolean;
  onEraseIds(ids: string[], scope: 'onward' | 'thisStep'): void;
}

function nearestCell(mode: CourtMode, p: { x: number; y: number }): { col: number; row: number } {
  const { cols, rows, cellW, cellH, origin } = COURT_DEFS[mode].grid;
  const col = Math.min(cols - 1, Math.max(0, Math.floor((p.x - origin.x) / cellW)));
  const row = Math.min(rows - 1, Math.max(0, Math.floor((p.y - origin.y) / cellH)));
  return { col, row };
}

const PLACEMENT_TOOLS: ReadonlySet<ToolId> = new Set(['ball', 'cone', 'player', 'note']);

export const EditorStage = forwardRef<CourtStageHandle, EditorStageProps>(function EditorStage(
  { drill, step, tool, coneSlot, selection, dispatch, worldRef, writer, zones, ballMax, pendingPlayerId, onPlayerPlaced, showToast, showGrid, showGridLabels, showRuleZones, onEraseIds },
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
    stageRef: stageRef as RefObject<CourtStageHandle | null>,
    zones,
    ballMax,
    pendingPlayerId,
    onPlayerPlaced,
    showToast,
    forceHandlesVisible: false,
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
        number: def.number,
        ariaLabel: `${teamStyle.label} ${def.number}번${def.role ? ` · ${def.role}` : ''}`,
      });
    }
    return out;
  }, [drill.cast.chairs, drill.teams, step.chairs]);

  const balls = useMemo(() => drill.cast.balls.filter((b) => step.balls[b.id] !== undefined).map((b) => b.id), [drill.cast.balls, step.balls]);
  const cones = useMemo<ObjectLayerCone[]>(
    () => drill.cast.cones.filter((c) => step.cones[c.id] !== undefined).map((c) => ({ id: c.id, colorIndex: c.colorIndex })),
    [drill.cast.cones, step.cones],
  );

  const arrows = useMemo(() => (pointer.arrowDraft ? [...step.arrows, pointer.arrowDraft] : step.arrows), [step.arrows, pointer.arrowDraft]);

  const initialFrame = useMemo(() => poseFrame(step), [step]);

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
    (id: string, dx: number, dy: number, dThetaRad: number) => {
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
      }
    },
    [dispatch, step.notes, worldRef],
  );

  const handleObjectKeyDown = useCallback(
    (id: string, e: ReactKeyboardEvent<SVGGElement>) => {
      const small = 2.5;
      const big = 25;
      const d = e.shiftKey ? big : small;
      // ★ 화살표는 **화면 기준**이다(§7.5). 스테이지가 90° 돌아 있으면 월드 축과 어긋나므로
      //   화면 델타를 월드 델타로 옮겨서 넘긴다 — 안 그러면 세로 화면에서 오른쪽 키가 개체를
      //   아래로 내려보낸다(보이는 것과 손이 어긋난다).
      const rot = (stageRef as RefObject<CourtStageHandle | null>).current?.refreshMetrics()?.rot ?? 0;
      const move = (sx: number, sy: number): void => {
        const w = screenDeltaToWorld({ rot }, sx, sy);
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
          if (isId(id, 'ch')) {
            e.preventDefault();
            e.stopPropagation();
            nudge(id, 0, 0, -(e.shiftKey ? 15 : 5) * RAD);
          }
          return;
        case ']':
          if (isId(id, 'ch')) {
            e.preventDefault();
            e.stopPropagation();
            nudge(id, 0, 0, (e.shiftKey ? 15 : 5) * RAD);
          }
          return;
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
    [dispatch, nudge, onEraseIds],
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
      notes={step.notes}
      arrows={arrows}
      selection={selection}
      zoneCursors={zones}
      activeId={activeId}
      initialFrame={initialFrame}
      onObjectKeyDown={handleObjectKeyDown}
      onContainerKeyDown={handleContainerKeyDown}
      selectionOverlayRef={pointer.selectionOverlayRef}
      dragCursor={pointer.activeZone ? ZONE_CURSOR_DRAGGING[pointer.activeZone] : null}
      zoneHandles={{ chairId: selectedChairId, activeZone: pointer.activeZone }}
      arrowHandles={{ arrow: selectedArrow }}
      keyboardCursor={cursorWorld ? { visible: true, x: cursorWorld.x, y: cursorWorld.y, label: cursorLabel } : undefined}
    />
  );
});
