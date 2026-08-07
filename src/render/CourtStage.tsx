// §6.4 좌표 변환 · 줌 · 포인터, §6.6 레이어 구조.
//
// 주의(계약서와 다른 점, §8 준수): §8 파일 소유권 표는 render-stage 의 의존을
// "core, court, model, physics(타입만), render-court, ui-kit" 로 못박는다 — physics-kin/
// physics-world 의 런타임 함수(hitTest·beginDrag·stepDrag 등)를 이 파일이 직접 호출하지
// 않는다. §6.4 의사코드는 그 호출들을 CourtStage 안에 직접 예시했지만, 실제로는 store
// (Wave3, physics-world 를 의존)가 만든 `CourtStagePointerController` 를 주입받아 위임한다.
// CourtStage 자신은 (1) 좌표 변환·줌·팬, (2) Pointer Events 통합(캡처·두 번째 포인터 처리·
// 엣지 스와이프 보존·탭 대비 드래그 무장), (3) "물리 호출은 rAF tick 하나에서만" 규칙—
// 이 세 가지만 책임진다. `pointercancel` 은 pointerup 과 동일하게 처리한다(iOS 시스템
// 제스처 가로채기) — 별도 "취소" 경로를 두지 않고 같은 onPointerUp 으로 합류시킨다.
import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, Ref } from 'react';
import type { Vec2 } from '../core/units.ts';
import { COURT_BG } from '../core/colors.ts';
import { COURT_DEFS, type CourtMode } from '../model/court.ts';
import type { ChairPose, DragZone } from '../model/chair.ts';
import type { Arrow } from '../model/arrow.ts';
import { arrowColor } from '../model/arrow.ts';
import type { NoteLabel as NoteLabelData } from '../model/drill.ts';
import type { BallId } from '../core/ids.ts';
import { CourtSurface, type CourtLineVariant } from './CourtSurface.tsx';
import { GridOverlay } from './GridOverlay.tsx';
import { RuleZones } from './RuleZones.tsx';
import { ArrowMarkers } from './ArrowMarkers.tsx';
import { ObjectLayer, type ObjectLayerChair, type ObjectLayerCone } from './ObjectLayer.tsx';
import { SelectionOverlay, type SelectionOverlayHandle } from './SelectionOverlay.tsx';
import { ZoneHandles } from './ZoneHandles.tsx';
import { ArrowHandles } from './ArrowHandles.tsx';
import { KeyboardCursor } from './KeyboardCursor.tsx';
import type { TransformWriter } from './transformWriter.ts';
import { computeMetrics, clientToWorld, zoomAt, type StageView, type StageMetrics } from './useStageMetrics.ts';
import { raf } from './rafLoop.ts';

export interface PointerMeta {
  pointerType: string;
  button: number;
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
}

/** store(Wave3) 가 구현해 주입하는 포인터 의미론 — 히트테스트·물리 드래그·러버밴드 판단은
 *  전부 이 안에서 일어난다. CourtStage 는 좌표만 넘긴다. */
export interface CourtStagePointerController {
  onPointerDown(world: Vec2, meta: PointerMeta): void;
  /** rAF 틱 1회당 정확히 1번 호출된다(§6.4 "물리 호출은 rAF tick 하나에서만"). */
  onPointerMove(world: Vec2, nowMs: number): void;
  /** pointerup·pointercancel·두 번째 포인터의 핀치 전환 — 전부 이 하나로 합류한다. */
  onPointerUp(): void;
}

export interface CourtStageHandle {
  zoomBy(factor: number, focusClient?: { x: number; y: number }): void;
  resetZoom(): void;
  refreshMetrics(): StageMetrics | null;
  /** §7.5c Esc — 코트 컨테이너로 포커스 복귀. */
  focusContainer(): void;
}

export interface CourtStageProps {
  mode: CourtMode;
  variant: CourtLineVariant;
  writer: TransformWriter;
  controller: CourtStagePointerController;
  showGrid: boolean;
  showRuleZones: boolean;
  chairs: readonly ObjectLayerChair[];
  balls: readonly BallId[];
  cones: readonly ObjectLayerCone[];
  notes: readonly NoteLabelData[];
  arrows: readonly Arrow[];
  selection: ReadonlySet<string>;
  /** 로빙 tabindex 대상(§7.5b). */
  activeId: string | null;
  initialFrame?: Readonly<Record<string, { x: number; y: number; theta: number }>>;
  onObjectPointerDown?: (id: string, e: ReactPointerEvent<SVGGElement>) => void;
  onObjectKeyDown?: (id: string, e: ReactKeyboardEvent<SVGGElement>) => void;
  onContainerKeyDown?: (e: ReactKeyboardEvent<SVGSVGElement>) => void;
  ariaDescribedBy?: string;
  selectionOverlayRef?: Ref<SelectionOverlayHandle>;
  zoneHandles?: {
    pose: ChairPose | null;
    visible: boolean;
    activeZone: DragZone | null;
    onPointerDown?: (zone: DragZone, e: ReactPointerEvent<SVGGElement>) => void;
  };
  arrowHandles?: {
    arrow: Arrow | null;
    onPointerDown?: (which: 'from' | 'ctrl' | 'to', e: ReactPointerEvent<SVGGElement>) => void;
  };
  keyboardCursor?: { visible: boolean; x: number; y: number; label?: string | null };
}

const STAGE_STYLE: CSSProperties = { touchAction: 'none', userSelect: 'none', width: '100%', height: '100%', display: 'block' };

export const CourtStage = forwardRef<CourtStageHandle, CourtStageProps>(function CourtStage(
  {
    mode,
    variant,
    writer,
    controller,
    showGrid,
    showRuleZones,
    chairs,
    balls,
    cones,
    notes,
    arrows,
    selection,
    activeId,
    initialFrame,
    onObjectPointerDown,
    onObjectKeyDown,
    onContainerKeyDown,
    ariaDescribedBy = 'court-help',
    selectionOverlayRef,
    zoneHandles: zoneHandlesProps,
    arrowHandles: arrowHandlesProps,
    keyboardCursor,
  },
  ref,
) {
  const def = COURT_DEFS[mode];
  const markerUid = useId();
  const usedColors = useMemo(() => Array.from(new Set(arrows.map((a) => arrowColor(a)))), [arrows]);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [view, setView] = useState<StageView>({ x: 0, y: 0, w: def.vbW, h: def.vbH });
  const viewRef = useRef(view);
  viewRef.current = view;

  // 코트 모드가 바뀌면(전환 불가지만 재마운트 등 방어적으로) 줌을 리셋한다.
  useEffect(() => {
    setView({ x: 0, y: 0, w: def.vbW, h: def.vbH });
  }, [mode, def.vbW, def.vbH]);

  const metricsRef = useRef<StageMetrics | null>(null);
  const refreshMetrics = useCallback((): StageMetrics | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const m = computeMetrics(svg.getBoundingClientRect(), viewRef.current);
    metricsRef.current = m;
    return m;
  }, []);
  useEffect(() => {
    refreshMetrics();
  }, [refreshMetrics, view]);

  // 단일 활성 포인터(드래그) 상태 — ref 로만 들고 다닌다(§6.4: 리렌더를 유발하지 않는다).
  const activePointerId = useRef<number | null>(null);
  const targetRef = useRef<Vec2 | null>(null);
  const rafUnsub = useRef<(() => void) | null>(null);

  // 두 손가락 핀치 상태.
  const pointers = useRef<Map<number, Vec2>>(new Map());
  const pinchStartDist = useRef(1);
  const pinchStartView = useRef<StageView | null>(null);

  const stopRafLoop = useCallback((): void => {
    rafUnsub.current?.();
    rafUnsub.current = null;
  }, []);

  const endInteraction = useCallback((): void => {
    if (activePointerId.current === null) return;
    stopRafLoop();
    activePointerId.current = null;
    targetRef.current = null;
    controller.onPointerUp();
  }, [controller, stopRafLoop]);

  const handlePointerDown = (e: ReactPointerEvent<SVGSVGElement>): void => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2) {
      // ★ 두 번째 포인터가 내려오면 진행 중인 드래그를 취소하고 핀치-줌 모드로 전환한다 —
      // "두 번째 손가락 완전 무시" 규칙의 유일한 예외(§6.4).
      endInteraction();
      const [p0, p1] = Array.from(pointers.current.values()) as [Vec2, Vec2];
      pinchStartDist.current = Math.hypot(p0.x - p1.x, p0.y - p1.y) || 1;
      pinchStartView.current = viewRef.current;
      return;
    }
    if (pointers.current.size > 2) return; // 세 번째 이상은 완전 무시

    if (activePointerId.current !== null) return;

    // 터치 엣지 스와이프(OS 뒤로가기 제스처)는 스테이지가 가로채지 않는다.
    if (e.pointerType === 'touch' && (e.clientX < 20 || e.clientX > window.innerWidth - 20)) {
      pointers.current.delete(e.pointerId);
      return;
    }

    // 드래그 시작 시 rect 를 다시 읽는다 — ResizeObserver 는 위치 이동을 관측하지 않는다(§6.4).
    const m = refreshMetrics();
    if (!m) return;

    activePointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    const world = clientToWorld(m, e.clientX, e.clientY);
    targetRef.current = world;

    controller.onPointerDown(world, {
      pointerType: e.pointerType,
      button: e.button,
      shiftKey: e.shiftKey,
      metaKey: e.metaKey,
      ctrlKey: e.ctrlKey,
      altKey: e.altKey,
    });

    rafUnsub.current = raf.add((_dt, now) => {
      const t = targetRef.current;
      if (t) controller.onPointerMove(t, now); // ★ 물리 호출은 rAF tick 하나에서만(§6.4)
    });
  };

  const handlePointerMove = (e: ReactPointerEvent<SVGSVGElement>): void => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2 && pinchStartView.current) {
      const [p0, p1] = Array.from(pointers.current.values()) as [Vec2, Vec2];
      const dist = Math.hypot(p0.x - p1.x, p0.y - p1.y) || 1;
      const factor = dist / pinchStartDist.current;
      const mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
      const m = metricsRef.current;
      if (m) {
        const focusWorld = clientToWorld(m, mid.x, mid.y);
        setView(zoomAt(pinchStartView.current, def, focusWorld, factor));
      }
      return;
    }

    if (e.pointerId !== activePointerId.current) return;
    const m = metricsRef.current;
    if (!m) return;
    // ★ pointermove 에서 물리를 직접 호출하지 않는다 — ref 에 기록만 한다(§6.4).
    // 120Hz 태블릿의 coalesced 이벤트를 그대로 반영해도 rAF tick 이 한 번만 소비한다.
    targetRef.current = clientToWorld(m, e.clientX, e.clientY);
  };

  const handlePointerEnd = (e: ReactPointerEvent<SVGSVGElement>): void => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStartView.current = null;
    if (e.pointerId !== activePointerId.current) return;
    endInteraction();
  };

  useEffect(() => stopRafLoop, [stopRafLoop]);

  useImperativeHandle(
    ref,
    (): CourtStageHandle => ({
      zoomBy(factor, focusClient) {
        const m = metricsRef.current ?? refreshMetrics();
        const focus: Vec2 =
          focusClient && m
            ? clientToWorld(m, focusClient.x, focusClient.y)
            : { x: def.vbW / 2, y: def.vbH / 2 };
        setView((v) => zoomAt(v, def, focus, factor));
      },
      resetZoom() {
        setView({ x: 0, y: 0, w: def.vbW, h: def.vbH });
      },
      refreshMetrics,
      focusContainer() {
        svgRef.current?.focus({ preventScroll: true });
      },
    }),
    [def, refreshMetrics],
  );

  return (
    <svg
      ref={svgRef}
      viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
      preserveAspectRatio="xMidYMid meet"
      role="application"
      aria-label="코트 편집 영역"
      aria-describedby={ariaDescribedBy}
      tabIndex={0}
      className="stage-svg"
      style={STAGE_STYLE}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onKeyDown={onContainerKeyDown}
    >
      <defs>
        <ArrowMarkers uid={markerUid} colors={usedColors} />
      </defs>
      <rect width={def.vbW} height={def.vbH} rx={14} fill={COURT_BG} />
      <CourtSurface mode={mode} variant={variant} />
      {showGrid && <GridOverlay mode={mode} />}
      <RuleZones mode={mode} visible={showRuleZones} />
      <ObjectLayer
        writer={writer}
        chairs={chairs}
        balls={balls}
        cones={cones}
        notes={notes}
        arrows={arrows}
        markerUid={markerUid}
        selection={selection}
        activeId={activeId}
        initialFrame={initialFrame}
        onObjectPointerDown={onObjectPointerDown}
        onObjectKeyDown={onObjectKeyDown}
      />
      <SelectionOverlay ref={selectionOverlayRef} />
      {zoneHandlesProps && (
        <ZoneHandles
          pose={zoneHandlesProps.pose}
          pxPerUnit={metricsRef.current?.pxPerUnit ?? 1}
          visible={zoneHandlesProps.visible}
          activeZone={zoneHandlesProps.activeZone}
          onPointerDown={zoneHandlesProps.onPointerDown}
        />
      )}
      {arrowHandlesProps && (
        <ArrowHandles arrow={arrowHandlesProps.arrow} pxPerUnit={metricsRef.current?.pxPerUnit ?? 1} onPointerDown={arrowHandlesProps.onPointerDown} />
      )}
      {keyboardCursor && <KeyboardCursor visible={keyboardCursor.visible} x={keyboardCursor.x} y={keyboardCursor.y} label={keyboardCursor.label} />}
    </svg>
  );
});
