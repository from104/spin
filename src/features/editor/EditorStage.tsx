// §6.4/§6.6/§7.5b–d — CourtStage(render-stage)를 편집기 상태에 연결한다. 좌표 변환·포인터
// 캡처·레이어 순서는 CourtStage 소관, 히트테스트·물리 드래그 의미론은 useEditorPointer 소관,
// 이 파일은 그 둘을 조립하고 §7.5 키보드 계약(로빙 tabindex·개체 순회·키보드 배치 커서)만
// 더한다.
import { forwardRef, useCallback, useMemo, useState } from 'react';
import type { Dispatch, KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react';
import { RAD } from '../../core/angle.ts';
import { isId } from '../../core/ids.ts';
import type { ArrowId, ChairId } from '../../core/ids.ts';
import type { ToolId } from '../../physics/index.ts';
import type { EditorWorldRef } from '../../store/editor/EditorProvider.tsx';
import { poseFrame } from '../../store/editor/tween.ts';
import type { EditorAction } from '../../store/editor/actions.ts';
import type { Drill, DrillStep } from '../../model/drill.ts';
import type { ZoneConfig } from '../../model/chair.ts';
import { COURT_DEFS, gridCellCenter, cellLabelAt, type CourtMode } from '../../model/court.ts';
import { CourtStage, type CourtStageHandle } from '../../render/CourtStage.tsx';
import type { ObjectLayerChair, ObjectLayerCone } from '../../render/ObjectLayer.tsx';
import type { TransformWriter } from '../../render/transformWriter.ts';
import { liveRegion } from '../../ui/LiveRegion.tsx';
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
        return;
      }
      if (isId(id, 'nt')) {
        const note = step.notes.find((n) => n.id === id);
        if (note) dispatch({ type: 'NOTE_SET', note: { ...note, x: note.x + dx, y: note.y + dy } });
      }
    },
    [dispatch, step.notes],
  );

  const handleObjectKeyDown = useCallback(
    (id: string, e: ReactKeyboardEvent<SVGGElement>) => {
      const small = 2.5;
      const big = 25;
      const d = e.shiftKey ? big : small;
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          e.stopPropagation();
          nudge(id, -d, 0, 0);
          return;
        case 'ArrowRight':
          e.preventDefault();
          e.stopPropagation();
          nudge(id, d, 0, 0);
          return;
        case 'ArrowUp':
          e.preventDefault();
          e.stopPropagation();
          nudge(id, 0, -d, 0);
          return;
        case 'ArrowDown':
          e.preventDefault();
          e.stopPropagation();
          nudge(id, 0, d, 0);
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
          if (e.shiftKey) {
            const step25 = 12.5;
            const p = { x: base.x, y: base.y };
            if (e.key === 'ArrowLeft') p.x -= step25;
            else if (e.key === 'ArrowRight') p.x += step25;
            else if (e.key === 'ArrowUp') p.y -= step25;
            else p.y += step25;
            const cell = nearestCell(mode, p);
            setCursor(cell);
            liveRegion.say(cellLabelAt(mode, gridCellCenter(mode, cell.col, cell.row)) ?? '');
            return;
          }
          const cur2 = cursor ?? nearestCell(mode, base);
          const { cols, rows } = COURT_DEFS[mode].grid;
          let { col, row } = cur2;
          if (e.key === 'ArrowLeft') col = Math.max(0, col - 1);
          else if (e.key === 'ArrowRight') col = Math.min(cols - 1, col + 1);
          else if (e.key === 'ArrowUp') row = Math.max(0, row - 1);
          else if (e.key === 'ArrowDown') row = Math.min(rows - 1, row + 1);
          setCursor({ col, row });
          liveRegion.say(`${cellLabelAt(mode, gridCellCenter(mode, col, row)) ?? ''} 칸`);
          return;
        }
      }
    },
    [activeId, cursor, dispatch, drill.courtMode, order, pointer, stageRef, tool],
  );

  const selectedChair = useMemo(() => {
    const id = Array.from(selection).find((x) => isId(x, 'ch')) as ChairId | undefined;
    if (!id) return null;
    const snap = worldRef.current?.read()[id];
    if (!snap) return null;
    return { x: snap.x, y: snap.y, theta: snap.theta };
  }, [selection, worldRef]);

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
      notes={step.notes}
      arrows={arrows}
      selection={selection}
      activeId={activeId}
      initialFrame={initialFrame}
      onObjectKeyDown={handleObjectKeyDown}
      onContainerKeyDown={handleContainerKeyDown}
      selectionOverlayRef={pointer.selectionOverlayRef}
      zoneHandles={{ pose: selectedChair, visible: pointer.handlesVisibleForSelection, activeZone: pointer.activeZone }}
      arrowHandles={{ arrow: selectedArrow }}
      keyboardCursor={cursorWorld ? { visible: true, x: cursorWorld.x, y: cursorWorld.y, label: cursorLabel } : undefined}
    />
  );
});
