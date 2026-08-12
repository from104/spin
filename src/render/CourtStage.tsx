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
import { INTERACT } from '../core/constants.ts';
import { COURT_BG } from '../core/colors.ts';
import { COURT_DEFS, type CourtMode } from '../model/court.ts';
import type { DragZone } from '../model/chair.ts';
import type { Arrow, ArrowHandle } from '../model/arrow.ts';
import { arrowColor } from '../model/arrow.ts';
import type { NoteLabel as NoteLabelData, TeamSide } from '../model/drill.ts';
import type { BallId, ChairId } from '../core/ids.ts';
import { CourtSurface, type CourtLineVariant } from './CourtSurface.tsx';
import { GridOverlay } from './GridOverlay.tsx';
import { RuleZones } from './RuleZones.tsx';
import { RuleOverlay } from './RuleOverlay.tsx';
import type { RuleOverlayApi, RuleRosterEntry } from './ruleOverlay.ts';
import { ArrowMarkers } from './ArrowMarkers.tsx';
import { ObjectLayer, type ObjectLayerChair, type ObjectLayerCone } from './ObjectLayer.tsx';
import { SelectionOverlay, type SelectionOverlayHandle } from './SelectionOverlay.tsx';
import { ZoneHandles } from './ZoneHandles.tsx';
import type { ZoneConfig } from '../model/chair.ts';
import { ArrowHandles } from './ArrowHandles.tsx';
import { KeyboardCursor } from './KeyboardCursor.tsx';
import type { TransformWriter } from './transformWriter.ts';
import { StageRotProvider } from './stageRot.tsx';
import { computeMetrics, clientToWorld, rotForFit, zoomAt, panView, panViewByScreen, edgePanVelocity, screenDeltaToWorld, type StageView, type StageMetrics, type StageRot } from './useStageMetrics.ts';
import { raf } from './rafLoop.ts';

/** 더블클릭 판정. OS 기본값(대개 500ms)보다 짧게 잡는다 — 판 위에서는 같은 자리를 두 번
 *  누르는 일이 흔해서, 길면 무심코 이동이 무장된다. */
const DBL_CLICK_MS = 350;
const DBL_CLICK_SLOP_PX = 12;

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
/** pointerdown 이 시작한 드래그의 성격. CourtStage 는 히트테스트를 하지 않아 무엇을 잡았는지
 *  모른다 — 판단은 컨트롤러가 하고, 그 결과만 여기로 돌려준다. */
export interface PointerDownResult {
  /** 포인터가 화면 가장자리로 가면 판을 저절로 밀 것인가(고무줄 선택).
   *  개체를 잡은 드래그에는 켜지 않는다 — 잡은 개체가 화면 밖으로 딸려 나간다. */
  edgePan?: boolean;
  /** 이 손짓은 판을 미는 것이다(§4.4 P2-1 마진 띠 = 판의 프레임).
   *
   *  판정은 컨트롤러가 한다 — 마진 위에 개체가 서 있을 수 있고(킥인·코너 세트피스 D26),
   *  무엇을 잡았는지는 히트테스트를 가진 쪽만 안다. CourtStage 는 좌표만 알 뿐이라
   *  "여기는 마진이다" 를 스스로 판단하면 마진에 놓인 휠체어를 영영 못 잡게 된다.
   *
   *  켜지면 고무줄도 rAF 물리 틱도 열지 않는다 — 이 드래그가 미는 것은 개체가 아니라 판이다. */
  pan?: boolean;
}

export interface CourtStagePointerController {
  onPointerDown(world: Vec2, meta: PointerMeta): PointerDownResult | void;
  /** rAF 틱 1회당 정확히 1번 호출된다(§6.4 "물리 호출은 rAF tick 하나에서만"). */
  onPointerMove(world: Vec2, nowMs: number): void;
  /** pointerup·pointercancel·두 번째 포인터의 핀치 전환 — 전부 이 하나로 합류한다. */
  /** 손을 뗀 화면 좌표. 트레이 위에 놓았는지(=코트에서 빼기) 판정하는 데 쓴다.
   *  pointercancel 은 좌표가 없으므로 null 이다 — 그때는 트레이 판정을 하지 않는다. */
  onPointerUp(client: { x: number; y: number } | null): void;
}

export interface CourtStageHandle {
  zoomBy(factor: number, focusClient?: { x: number; y: number }): void;
  resetZoom(): void;
  /** §4.4 P2-1 키보드 팬 — **화면** CSS px 델타만큼 창을 민다(창이 그 방향으로 간다).
   *  회전·배율 환산은 `panViewByScreen` 이 하므로 호출자는 화면에서 본 방향만 넘기면 된다. */
  panByScreen(dxCssPx: number, dyCssPx: number): void;
  refreshMetrics(): StageMetrics | null;
  /** §7.5c Esc — 코트 컨테이너로 포커스 복귀. */
  focusContainer(): void;
}

export interface CourtStageProps {
  /** 더블클릭으로 판 이동을 무장할 수 있는가. 배치·지우개 도구에서는 꺼야 한다 —
   *  같은 자리에 콘 두 개를 빨리 찍는 것이 더블클릭으로 읽혀 두 번째가 삼켜진다. */
  allowPan?: boolean;
  mode: CourtMode;
  variant: CourtLineVariant;
  writer: TransformWriter;
  controller: CourtStagePointerController;
  showGrid: boolean;
  /** prefs.showGridLabels — showGrid 가 꺼져 있으면 어차피 GridOverlay 자체가 그려지지 않는다. */
  showGridLabels: boolean;
  showRuleZones: boolean;
  chairs: readonly ObjectLayerChair[];
  balls: readonly BallId[];
  cones: readonly ObjectLayerCone[];
  /** 골대 포스트 id. 편집기만 넘긴다(§5.4). */
  goals?: readonly string[];
  notes: readonly NoteLabelData[];
  arrows: readonly Arrow[];
  selection: ReadonlySet<string>;
  /** 편집기에서만 넘긴다 — 차체 위 4개 존에 존별 마우스 커서를 얹는다. */
  zoneCursors?: ZoneConfig | null;
  /** 로빙 tabindex 대상(§7.5b). */
  activeId: string | null;
  initialFrame?: Readonly<Record<string, { x: number; y: number; theta: number }>>;
  onObjectPointerDown?: (id: string, e: ReactPointerEvent<SVGGElement>) => void;
  onObjectKeyDown?: (id: string, e: ReactKeyboardEvent<SVGGElement>) => void;
  onContainerKeyDown?: (e: ReactKeyboardEvent<SVGSVGElement>) => void;
  ariaDescribedBy?: string;
  selectionOverlayRef?: Ref<SelectionOverlayHandle>;
  zoneHandles?: {
    /** 선택된 휠체어 id. null 이면 그리지 않는다. 위치는 writer 팔로워로 따라간다. */
    chairId: ChairId | null;
    activeZone: DragZone | null;
    onPointerDown?: (zone: DragZone, e: ReactPointerEvent<SVGGElement>) => void;
  };
  arrowHandles?: {
    arrow: Arrow | null;
    /** 키보드 조준점(§4.3 1.11) — Shift+방향키가 옮길 점. null 이면 강조하지 않는다. */
    activePart?: ArrowHandle | null;
    onPointerDown?: (which: ArrowHandle, e: ReactPointerEvent<SVGGElement>) => void;
  };
  keyboardCursor?: { visible: boolean; x: number; y: number; label?: string | null };
  /** §4.4 P2-4 규칙 오버레이(3 m 링 + 골 지역 3인). 넘기면 `showRuleZones` 와 **같은 스위치**로
   *  켜진다 — 규칙 존을 감춘 사람에게 규칙 경고만 남기지 않기 위해서다. 시연 화면은 CourtStage 를
   *  쓰지 않으므로(PresentStage.tsx:1) 같은 오버레이를 그쪽에 **따로** 건다. */
  ruleOverlay?: {
    rules: RuleOverlayApi;
    /** 이 스텝의 선수 명단(팀·골키퍼). 좌표는 writer 프레임에서 온다. */
    roster: readonly RuleRosterEntry[];
    teams: Record<TeamSide, { label: string }>;
  };
  /** 드래그 중 스테이지 전체에 거는 커서. 포인터 캡처로 커서가 개체 밖으로 나가도
   *  잡고 있다는 표시가 유지되어야 하므로 컨테이너에 건다. */
  dragCursor?: string | null;
}

const STAGE_STYLE: CSSProperties = { touchAction: 'none', userSelect: 'none', width: '100%', height: '100%', display: 'block' };

export const CourtStage = forwardRef<CourtStageHandle, CourtStageProps>(function CourtStage(
  {
    allowPan = false,
    mode,
    variant,
    writer,
    controller,
    showGrid,
    showGridLabels,
    showRuleZones,
    chairs,
    balls,
    cones,
    goals,
    notes,
    arrows,
    selection,
    zoneCursors,
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
    ruleOverlay,
    dragCursor,
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

  // 표시 회전(§6.4 태블릿). **svg 가 실제로 차지한 상자**로 정한다 — 창이 아니라. 인스펙터가
  // 옆에 있느냐 아래로 내려갔느냐에 따라 같은 창에서도 판단이 달라져야 하기 때문이다.
  const [rot, setRot] = useState<StageRot>(0);
  // ★ 현재 rot 의 사본. refreshMetrics 는 pointerdown·화살표키마다 불리는 **읽기** 함수인데,
  //   여기서 매번 setRot 을 부르면 값이 같아도 React 가 한 번 더 렌더한다. 그 렌더가 다시
  //   ResizeObserver 를 깨우면 서로를 끝없이 밀어 렌더러가 멈춘다(실제로 그렇게 얼었다 —
  //   jsdom 에는 ResizeObserver 가 없어 단위 테스트로는 잡히지 않았다).
  //   값이 **정말 바뀔 때만** 상태를 건드린다.
  const rotRef = useRef<StageRot>(0);
  const metricsRef = useRef<StageMetrics | null>(null);
  const refreshMetrics = useCallback((): StageMetrics | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const nextRot = rotForFit(rect, viewRef.current);
    const m = computeMetrics(rect, viewRef.current, nextRot);
    metricsRef.current = m;
    if (rotRef.current !== nextRot) {
      rotRef.current = nextRot;
      setRot(nextRot);
    }
    return m;
  }, []);
  useEffect(() => {
    refreshMetrics();
  }, [refreshMetrics, view]);

  // 크기가 바뀌면 회전 판정을 다시 한다. 창 리사이즈뿐 아니라 **레이아웃 변경**(세로에서
  // 속성 시트가 열려 코트가 낮아지는 것)도 잡아야 하므로 ResizeObserver 를 쓴다.
  //
  // 콜백은 rAF 로 미룬다: ResizeObserver 콜백 안에서 곧바로 레이아웃을 읽고 상태를 바꾸면
  // 브라우저가 같은 프레임 안에서 관측을 다시 돌려 "ResizeObserver loop" 로 들어간다.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || typeof ResizeObserver === 'undefined') return;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      if (raf) return; // 한 프레임에 한 번만
      raf = requestAnimationFrame(() => {
        raf = 0;
        refreshMetrics();
      });
    });
    ro.observe(svg);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [refreshMetrics]);

  // 단일 활성 포인터(드래그) 상태 — ref 로만 들고 다닌다(§6.4: 리렌더를 유발하지 않는다).
  const activePointerId = useRef<number | null>(null);
  /** 마지막 포인터 화면 좌표. onPointerUp 이벤트에는 좌표가 있지만 endInteraction 은
   *  pointercancel·언마운트 등 여러 경로에서 불려 이벤트가 없을 수 있어 따로 들고 있는다. */
  const lastClientRef = useRef<{ x: number; y: number } | null>(null);
  const targetRef = useRef<Vec2 | null>(null);
  const rafUnsub = useRef<(() => void) | null>(null);
  /** 드래그 중 포인터의 **화면** 좌표. 가장자리 자동 밀기는 판이 움직여도 손은 제자리이므로,
   *  월드 좌표만 들고 있으면 사각형이 자라지 않는다 — 매 프레임 여기서 다시 환산한다. */
  const dragClientRef = useRef<Vec2 | null>(null);
  const edgePanRef = useRef(false);

  // ── 판 이동(더블클릭 후 끌기, 기현 지시 2026-08-11) ──────────────────────────
  //
  // 확대는 되는데 이동이 없어서, 200% 에서 코트 왼쪽 절반은 볼 방법이 없었다.
  //
  // 한 손가락 끌기는 고무줄 선택이, 두 손가락은 핀치 줌이 이미 쓴다. 남은 손짓 중
  // **더블클릭 후 끌기**를 쓴다 — 모드 버튼을 하나 더 만들지 않아도 되고, 잘못 눌러도
  // 손을 떼면 끝난다. 무장한 동안 커서는 십자가다(터치에는 커서가 없어 무장 자체가
  // 그 손짓 안에 들어 있다: 더블탭한 손가락을 떼지 않고 그대로 끌면 바로 밀린다).
  const [panArmed, setPanArmed] = useState(false);
  const panArmedRef = useRef(false);
  const setArmed = useCallback((v: boolean): void => {
    panArmedRef.current = v;
    setPanArmed(v);
  }, []);
  /** 직전 pointerdown 의 시각·좌표. 더블클릭 판정용. */
  const lastDownRef = useRef<{ t: number; x: number; y: number } | null>(null);
  /** 이동 중인 포인터의 직전 화면 좌표. null 이면 이동 중이 아니다. */
  const panFromRef = useRef<Vec2 | null>(null);
  /** 이 이동 제스처에서 판이 실제로 밀렸는가 — 제자리 더블클릭은 무장만 하고 끝난다. */
  const panMovedRef = useRef(false);
  /** 이 이동이 **컨트롤러 판정**(§4.4 P2-1 마진 띠)에서 시작됐는가.
   *  더블클릭 무장 이동과 달리 컨트롤러에 pointerdown 을 이미 전달했으므로 pointerup 도
   *  짝을 맞춰 돌려줘야 한다 — 안 그러면 "down 은 갔는데 up 은 안 온" 세션이 남는다. */
  const framePanRef = useRef(false);

  // 두 손가락 핀치 상태.
  const pointers = useRef<Map<number, Vec2>>(new Map());
  const pinchStartDist = useRef(1);
  const pinchStartView = useRef<StageView | null>(null);

  const stopRafLoop = useCallback((): void => {
    rafUnsub.current?.();
    rafUnsub.current = null;
  }, []);

  /** 고무줄 선택 중 포인터가 가장자리 띠에 들어가 있으면 판을 그만큼 민다.
   *
   *  민 뒤에는 **같은 화면 좌표를 다시 월드로 환산한다** — 손은 제자리인데 판이 움직였으므로
   *  포인터 아래의 월드 좌표가 달라졌다. 이걸 빠뜨리면 판만 흐르고 사각형은 그 자리에 멈춘다.
   *
   *  환산에 쓰는 view 는 **직전 프레임 것**이다(setView 는 다음 렌더에 반영된다). 최고 속도에서
   *  한 프레임 = 15px 이라 사각형이 그만큼 뒤따르는데, 개체 히트 반경보다 작아 실사용에서
   *  드러나지 않는다. setView 의 함수형 갱신을 포기하면 정확해지지만, 렌더가 한 프레임
   *  밀릴 때 이동이 통째로 멎는다 — 15px 뒤처지는 쪽이 낫다.
   *  pxPerUnit·offX·offY 는 배율이 그대로라 바뀌지 않는다. view 만 갈아 끼우면 된다. */
  const stepEdgePan = useCallback(
    (dtMs: number): void => {
      const client = dragClientRef.current;
      const m = metricsRef.current;
      if (!client || !m) return;
      const v = edgePanVelocity(m.rect, client, INTERACT.edgePanBandPx, INTERACT.edgePanMaxPxPerS);
      if (v.x === 0 && v.y === 0) return;
      const dt = Math.min(dtMs, 50) / 1000; // 탭 전환으로 프레임이 밀려도 한 번에 튀지 않게
      setView((prev) => {
        // 키보드 팬과 **같은 환산**을 쓴다(§4.4 P2-1) — 두 경로가 각자 회전을 다루면
        // 세로 태블릿에서 한쪽만 축이 어긋난다.
        const next = panViewByScreen(prev, def, m, v.x * dt, v.y * dt);
        if (next.x === prev.x && next.y === prev.y) return prev; // 끝까지 갔다 — 헛돌지 않게
        return next;
      });
      targetRef.current = clientToWorld({ ...m, view: viewRef.current }, client.x, client.y);
    },
    [def, metricsRef],
  );

  const endInteraction = useCallback((): void => {
    if (activePointerId.current === null) return;
    stopRafLoop();
    activePointerId.current = null;
    targetRef.current = null;
    dragClientRef.current = null;
    edgePanRef.current = false;
    // 이동 세션도 여기서 끊는다. 두 번째 손가락이 내려와 핀치로 전환될 때 이 함수가 불리는데,
    // 그때 `panFromRef` 를 남겨 두면 활성 포인터만 사라진 채 이동 세션이 영영 살아 있어
    // **다음 드래그가 선택 대신 이동이 된다**(손을 뗄 때 그 세션을 지울 주인이 없다).
    panFromRef.current = null;
    framePanRef.current = false;
    controller.onPointerUp(lastClientRef.current);
    lastClientRef.current = null;
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

    // 더블클릭이면 이동을 무장한다. 이미 무장돼 있으면 그대로 이동을 시작한다 —
    // "더블클릭하고 손을 뗀 뒤 끌기" 와 "더블클릭한 채로 끌기" 가 둘 다 통한다.
    const prev = lastDownRef.current;
    const isDouble =
      !!prev &&
      e.timeStamp - prev.t < DBL_CLICK_MS &&
      Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < DBL_CLICK_SLOP_PX;
    lastDownRef.current = { t: e.timeStamp, x: e.clientX, y: e.clientY };

    if (allowPan && (isDouble || panArmedRef.current)) {
      if (isDouble) setArmed(true);
      panFromRef.current = { x: e.clientX, y: e.clientY };
      panMovedRef.current = false;
      activePointerId.current = e.pointerId;
      e.currentTarget.setPointerCapture(e.pointerId);
      // 컨트롤러에는 알리지 않는다 — 알리면 같은 손짓이 고무줄 선택도 함께 시작한다.
      return;
    }

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

    dragClientRef.current = { x: e.clientX, y: e.clientY };
    const res = controller.onPointerDown(world, {
      pointerType: e.pointerType,
      button: e.button,
      shiftKey: e.shiftKey,
      metaKey: e.metaKey,
      ctrlKey: e.ctrlKey,
      altKey: e.altKey,
    });
    if (res?.pan) {
      // §4.4 P2-1 — 컨트롤러가 "여기는 경기면 밖(판의 프레임)이고 잡을 개체도 없다" 고 판정했다.
      // 더블클릭 무장과 **같은 이동 세션**으로 합류시킨다: 미는 코드가 두 벌이 되면 부호·클램프가
      // 언젠가 갈라진다. 무장(panArmed)은 건드리지 않는다 — 마진을 한 번 끌었다고 코트 안까지
      // 이동 모드가 되면 다음 선택이 통째로 사라진다.
      framePanRef.current = true;
      panFromRef.current = { x: e.clientX, y: e.clientY };
      panMovedRef.current = false;
      // 고무줄도 물리 틱도 열지 않는다. targetRef 를 비워 두지 않으면 rAF 가 없어도
      // 다음 세션이 낡은 목표를 물려받는다.
      targetRef.current = null;
      dragClientRef.current = null;
      return;
    }
    edgePanRef.current = !!res?.edgePan;

    rafUnsub.current = raf.add((dtMs, now) => {
      if (edgePanRef.current) stepEdgePan(dtMs);
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

    if (panFromRef.current) {
      const m0 = metricsRef.current;
      if (!m0) return;
      const from = panFromRef.current;
      // 손이 잡은 것은 **판**이다 — 오른쪽으로 끌면 창은 왼쪽으로 간다(부호 반전).
      const d = screenDeltaToWorld(m0, (from.x - e.clientX) / m0.pxPerUnit, (from.y - e.clientY) / m0.pxPerUnit);
      panFromRef.current = { x: e.clientX, y: e.clientY };
      if (d.x !== 0 || d.y !== 0) panMovedRef.current = true;
      setView((v) => panView(v, def, d));
      return;
    }

    const m = metricsRef.current;
    if (!m) return;
    // ★ pointermove 에서 물리를 직접 호출하지 않는다 — ref 에 기록만 한다(§6.4).
    // 120Hz 태블릿의 coalesced 이벤트를 그대로 반영해도 rAF tick 이 한 번만 소비한다.
    dragClientRef.current = { x: e.clientX, y: e.clientY };
    targetRef.current = clientToWorld(m, e.clientX, e.clientY);
  };

  const handlePointerEnd = (e: ReactPointerEvent<SVGSVGElement>): void => {
    if (e.pointerId === activePointerId.current && e.type !== 'pointercancel') {
      lastClientRef.current = { x: e.clientX, y: e.clientY };
    }
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStartView.current = null;
    if (e.pointerId !== activePointerId.current) return;

    if (panFromRef.current) {
      panFromRef.current = null;
      activePointerId.current = null;
      // 실제로 민 뒤에는 무장을 푼다. 제자리 더블클릭(아직 끌지 않음)이면 무장을 유지해
      // 다음 끌기가 곧 이동이 되게 한다 — 커서 십자가가 그동안 상태를 알려 준다.
      if (panMovedRef.current) setArmed(false);
      if (framePanRef.current) {
        framePanRef.current = false;
        // 컨트롤러에 down 을 전달했으면 up 도 전달한다(§4.4 P2-1). 판을 **실제로 민** 뒤에는
        // 좌표를 넘기지 않는다 — client===null 은 이 저장소에서 이미 "손을 뗐지만 탭이 아니다"
        // 라는 뜻이고(pointercancel), 그래야 마진을 끌고 나서 선택이 풀리지 않는다.
        // 제자리에서 톡 친 경우에만 좌표가 가고, 컨트롤러가 빈 곳 탭과 똑같이 선택을 푼다.
        controller.onPointerUp(panMovedRef.current ? null : lastClientRef.current);
      }
      lastClientRef.current = null;
      return;
    }
    endInteraction();
  };

  useEffect(() => stopRafLoop, [stopRafLoop]);

  // 무장한 채로 잊어버리면 다음 끌기가 선택 대신 이동이 되어 "선택이 안 된다" 가 된다.
  // Esc 로 풀 수 있어야 하고, 도구를 바꾸면(allowPan 이 꺼지면) 저절로 풀려야 한다.
  useEffect(() => {
    if (!allowPan) setArmed(false);
  }, [allowPan, setArmed]);
  useEffect(() => {
    if (!panArmed) return;
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key === 'Escape') setArmed(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panArmed, setArmed]);

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
      panByScreen(dxCssPx, dyCssPx) {
        // 회전은 창 크기에 따라 바뀌므로 **누를 때마다** 다시 잰다 — 캐시된 rot 으로 밀면
        // 인스펙터가 열려 판이 돌아간 직후 첫 입력이 반대로 간다.
        const m = refreshMetrics() ?? metricsRef.current;
        if (!m) return;
        setView((v) => panViewByScreen(v, def, m, dxCssPx, dyCssPx));
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
      viewBox={rot === 90 ? `0 0 ${view.h} ${view.w}` : `${view.x} ${view.y} ${view.w} ${view.h}`}
      preserveAspectRatio="xMidYMid meet"
      role="application"
      aria-label="코트 편집 영역"
      aria-describedby={ariaDescribedBy}
      tabIndex={0}
      className="stage-svg"
      style={
        panArmed
          ? { ...STAGE_STYLE, cursor: 'crosshair' }
          : dragCursor
            ? { ...STAGE_STYLE, cursor: dragCursor }
            : STAGE_STYLE
      }
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onKeyDown={onContainerKeyDown}
    >
      <defs>
        <ArrowMarkers uid={markerUid} colors={usedColors} />
      </defs>
      {/* ★ 표시 회전(§6.4 태블릿). 월드 콘텐츠 전체를 이 하나로 돌린다 — 아래 자식들은
          회전을 전혀 모른다. 좌표·물리·모델은 그대로이고 바라보는 각도만 바뀐다.
          시계방향 90°: 월드 (x,y) → 상자 (view.y+view.h−y, x−view.x). viewBox 가 이미
          상자 원점이라 view 오프셋을 여기서 함께 상쇄한다. */}
      <StageRotProvider rot={rot}>
      <g transform={rot === 90 ? `translate(${view.y + view.h} ${-view.x}) rotate(90)` : undefined}>
        <rect width={def.vbW} height={def.vbH} rx={14} fill={COURT_BG} />
        <CourtSurface mode={mode} variant={variant} />
        {showGrid && <GridOverlay mode={mode} showLabels={showGridLabels} />}
        <RuleZones mode={mode} visible={showRuleZones} />
        {/* 개체 **아래**에 둔다 — 링은 공 주위 3 m 를 덮으므로 위에 깔면 칩을 가린다. */}
        {ruleOverlay && (
          <RuleOverlay
            mode={mode}
            visible={showRuleZones}
            writer={writer}
            rules={ruleOverlay.rules}
            ballIds={balls}
            roster={ruleOverlay.roster}
            teams={ruleOverlay.teams}
          />
        )}
        <ObjectLayer
          writer={writer}
          chairs={chairs}
          balls={balls}
          cones={cones}
          goals={goals}
          notes={notes}
          arrows={arrows}
          markerUid={markerUid}
          selection={selection}
          zoneCursors={zoneCursors}
          activeId={activeId}
          initialFrame={initialFrame}
          onObjectPointerDown={onObjectPointerDown}
          onObjectKeyDown={onObjectKeyDown}
        />
        <SelectionOverlay ref={selectionOverlayRef} />
        {zoneHandlesProps && (
          <ZoneHandles
            chairId={zoneHandlesProps.chairId}
            writer={writer}
            pxPerUnit={metricsRef.current?.pxPerUnit ?? 1}
            activeZone={zoneHandlesProps.activeZone}
            onPointerDown={zoneHandlesProps.onPointerDown}
          />
        )}
        {arrowHandlesProps && (
          <ArrowHandles
            arrow={arrowHandlesProps.arrow}
            pxPerUnit={metricsRef.current?.pxPerUnit ?? 1}
            activePart={arrowHandlesProps.activePart ?? null}
            onPointerDown={arrowHandlesProps.onPointerDown}
          />
        )}
        {keyboardCursor && <KeyboardCursor visible={keyboardCursor.visible} x={keyboardCursor.x} y={keyboardCursor.y} label={keyboardCursor.label} />}
      </g>
      </StageRotProvider>
    </svg>
  );
});
