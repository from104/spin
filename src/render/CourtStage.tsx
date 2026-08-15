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
import { courtDefFor, type CourtMode, type CourtSize } from '../model/court.ts';
import type { DragZone } from '../model/chair.ts';
import type { Arrow, ArrowHandle } from '../model/arrow.ts';
import { arrowColor } from '../model/arrow.ts';
import type { BallRing, NoteLabel as NoteLabelData, TeamSide, TeamStyle } from '../model/drill.ts';
import type { BallId, ChairId } from '../core/ids.ts';
import { CourtSurface, type CourtLineVariant } from './CourtSurface.tsx';
import { GridOverlay } from './GridOverlay.tsx';
import { RuleZones } from './RuleZones.tsx';
import { SideMarks } from './SideMarks.tsx';
import { RuleOverlay } from './RuleOverlay.tsx';
import type { RuleOverlayApi, RuleRosterEntry } from './ruleOverlay.ts';
import { ArrowMarkers } from './ArrowMarkers.tsx';
import { ObjectLayer, type ObjectLayerChair, type ObjectLayerCone } from './ObjectLayer.tsx';
import { ShapeLayer } from './ShapeLayer.tsx';
import { ShapeHandles } from './ShapeHandles.tsx';
import { dragShapeHandle } from '../model/shape.ts';
import type { Shape, ShapeHandle } from '../model/shape.ts';
import { SelectionOverlay, type SelectionOverlayHandle } from './SelectionOverlay.tsx';
import { ZoneHandles } from './ZoneHandles.tsx';
import type { ZoneConfig } from '../model/chair.ts';
import { ArrowHandles } from './ArrowHandles.tsx';
import { KeyboardCursor } from './KeyboardCursor.tsx';
import type { TransformWriter } from './transformWriter.ts';
import { StageRotProvider } from './stageRot.tsx';
import { computeMetrics, clientToWorld, zoomAt, wheelZoomFactor, panView, panViewByScreen, edgePanVelocity, screenDeltaToWorld, type StageView, type StageMetrics, type StageRot } from './useStageMetrics.ts';
import { raf } from './rafLoop.ts';

/** 더블클릭 판정. OS 기본값(대개 500ms)보다 짧게 잡는다 — 판 위에서는 같은 자리를 두 번
 *  누르는 일이 흔해서, 길면 무심코 이동이 무장된다. */
const DBL_CLICK_MS = 350;
const DBL_CLICK_SLOP_PX = 12;

/** 마우스의 **보조 버튼**(오른쪽·가운데)인가 — 판 조작은 여기서 걸러진다(2026-08-15).
 *
 *  ⚠️ `button !== 0` 만으로 판단하면 안 된다. 터치·펜의 첫 접촉도 `button` 은 0 이라 지금은
 *  통과하지만, 그것은 **우연히** 맞는 것이다. 손짓의 의미가 갈리는 곳은 마우스뿐이므로
 *  (마우스에만 오른쪽 버튼이 있다) 입력 종류를 먼저 묻는다. */
export function isSecondaryButton(e: { pointerType: string; button: number }): boolean {
  return e.pointerType === 'mouse' && e.button !== 0;
}

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
  /** §5.1/§6.4 코트 크기 3단. **viewBox 가 통째로 달라진다**(825×525 · 775×450 · 700×425) —
   *  빼먹으면 28×15 드릴을 열어도 판은 30×18 로 그려지고, 그 순간 판이 거짓말을 시작한다. */
  size?: CourtSize;
  /** §6.4 표시 회전. **위에서 내려온다**(2026-08-14 §4.2 — 아래 rot 상태 주석의 경위 참고).
   *
   *  ⚠️ 선택 prop 으로 만들지 마라. 기본값 0 을 두면 배선이 끊겨도 화면이 "안 돌아간 판" 으로
   *  조용히 그려져, 세로 태블릿에서 축척이 23% 작아진 것을 아무도 빨간불로 못 만난다. 필수
   *  prop 이면 tsc 가 EditorWorkspace → EditorStage → CourtStage 사슬 전체를 대신 지켜 준다. */
  rot: StageRot;
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
  /** 작도 도형(2026-08-14). **코트 위·칩 아래** 층이라 렌더 순서가 곧 계약이다 —
   *  아래 JSX 에서 RuleOverlay 와 ObjectLayer **사이**에 있다. */
  shapes?: readonly Shape[];
  /** 도형을 잡았다 — 선택만 바꾼다. 끌기는 아래 `onShapeChange` 가 진다. */
  onShapeSelect?: (id: string) => void;
  /** 끌고 있는 동안 매 프레임 불린다. **월드 좌표 산수는 이 파일이 진다** — metrics(회전·배율·
   *  오프셋)를 쥔 곳이 여기뿐이라, 좌표 변환을 밖으로 내보내면 판이 돌아간 상태에서 두 곳이
   *  갈라진다(panByScreen 이 rect 를 매번 다시 재는 것과 같은 이유). */
  onShapeChange?: (next: Shape) => void;
  arrows: readonly Arrow[];
  selection: ReadonlySet<string>;
  /** 편집기에서만 넘긴다 — 차체 위 4개 존에 존별 마우스 커서를 얹는다. */
  zoneCursors?: ZoneConfig | null;
  /** 로빙 tabindex 대상(§7.5b). */
  activeId: string | null;
  initialFrame?: Readonly<Record<string, { x: number; y: number; theta: number }>>;
  /** 3.10 스텝 전환 등장/퇴장 페이드 — ObjectLayer 로 그대로 내린다. */
  fades?: Readonly<Record<string, 'in' | 'out'>>;
  fadeMs?: number;
  onObjectPointerDown?: (id: string, e: ReactPointerEvent<SVGGElement>) => void;
  /** 무대 어디서든 오른쪽 클릭. **대상은 DOM 이 말한다** — 개체는 `id="obj-…"`, 도형은
   *  `data-shape-id` 를 이미 달고 있어서, 히트테스트를 한 벌 더 만들 이유가 없다(2026-08-14).
   *  개체 위가 아니면 `null` 이 간다. */
  /** 잠긴 개체 id — ObjectLayer 로 그대로 내려간다(보라 반투명 덮개). */
  locked?: ReadonlySet<string>;
  /** 무시된 휠체어 id — 흐리게 + 포인터 차단. 물리에서는 이미 빠져 있다. */
  ignored?: ReadonlySet<string>;
  onStageContextMenu?: (id: string | null, e: ReactPointerEvent<SVGSVGElement> | React.MouseEvent<SVGSVGElement>) => void;
  /** 무대 pointerdown 을 **가로채지 않고** 곁에서 본다(긴 터치 타이머용). 기존 드래그 배선은
   *  그대로 흐른다 — 여기서 stopPropagation 하면 판 전체가 죽는다. */
  onStagePointerDownRaw?: (id: string | null, e: ReactPointerEvent<SVGSVGElement>) => void;
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
  /** 선택된 도형의 손잡이 셋(가로·세로·회전). 화살표 핸들과 같은 모양의 prop 이다. */
  shapeHandles?: { shape: Shape | null };
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
    /** 진영 표시(SideMarks)가 쓰는 팀 **색**. `teams` 는 발화 문구용 라벨만 갖는다. */
    teamStyles: Record<TeamSide, TeamStyle>;
    /** 진영 — `ruleZones[0]` 을 지키는 팀(`Drill.defense`). 골 지역 3인이 **수비 팀만** 세므로
     *  안 넘기면 편집 화면만 다른 팀을 붉게 칠한다(2026-08-15). */
    defense?: TeamSide;
    /** §7 5.2 공마다 따로 켜는 거리 원(공 id → 없음/3 m/5 m). 없는 id 는 'none' 이다.
     *  안 넘기면 링이 하나도 안 그려진다 — 초기값이 '없음' 이기 때문이다. */
    ballRings?: Readonly<Record<string, BallRing>>;
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
    size,
    rot,
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
    fades,
    fadeMs,
    onObjectPointerDown,
    locked,
    ignored,
    onStageContextMenu,
    onStagePointerDownRaw,
    onObjectKeyDown,
    onContainerKeyDown,
    ariaDescribedBy = 'court-help',
    selectionOverlayRef,
    shapes = [],
    onShapeSelect,
    onShapeChange,
    zoneHandles: zoneHandlesProps,
    shapeHandles: shapeHandlesProps,
    arrowHandles: arrowHandlesProps,
    keyboardCursor,
    ruleOverlay,
    dragCursor,
  },
  ref,
) {
  const def = courtDefFor(mode, size);
  const markerUid = useId();
  const usedColors = useMemo(() => Array.from(new Set(arrows.map((a) => arrowColor(a)))), [arrows]);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [view, setView] = useState<StageView>({ x: 0, y: 0, w: def.vbW, h: def.vbH });
  const viewRef = useRef(view);
  viewRef.current = view;

  // 코트 모드가 바뀌면(전환 불가지만 재마운트 등 방어적으로) 줌을 리셋한다.
  useEffect(() => {
    setView({ x: 0, y: 0, w: def.vbW, h: def.vbH });
  }, [mode, size, def.vbW, def.vbH]);

  // 표시 회전(§6.4 태블릿)은 **prop 으로 내려온다**(2026-08-14 §4.2, 기현님 재설계).
  //
  // 2026-08-11 까지는 여기서 `rotForFit(svg.getBoundingClientRect(), view)` 로 **svg 가 실제로
  // 차지한 상자**를 재서 정했다 — "인스펙터가 폭을 먹느냐 아래로 내려갔느냐에 따라 같은 창에서도
  // 판단이 달라져야 한다" 는 이유였다. **그 이유는 지금도 맞고, 답도 같다**: 인스펙터 모드는
  // 크롬 예산의 한 행이라 `useStageRot` 이 창 크기와 함께 그것까지 넣고 계산한다(chromeBudget).
  // 뒤집은 것은 *어디서 재는가* 하나다. 재설계 P3 가 코트 칸을 rot 에 맞춰 자기 종횡비로
  // 줄이는 순간 "rect → rot → rect" 고리가 닫히고, 그 고리는 **쌍안정**이라 0 과 90 이 둘 다
  // 자기모순 없이 안정하다(7인치 세로 456×592 에서 px/u 0.5527 vs 0.7176 — 23% 차이가 창을
  // 줄인 순서에 따라 갈린다). 근거와 숫자는 useStageRot.ts 머리말에 있다.
  //
  // ★ 옛 rotRef 주석이 기록한 사고도 여기서 원인째 사라진다: refreshMetrics 는 pointerdown·
  //   화살표키마다 불리는 **읽기** 함수인데 그 안에서 setRot 을 부르면, 값이 같아도 React 가 한 번
  //   더 렌더하고 그 렌더가 ResizeObserver 를 깨워 서로를 끝없이 밀어 렌더러가 멈췄다(jsdom 에는
  //   ResizeObserver 가 없어 단위 테스트로는 안 잡혔다). 이제 이 함수는 상태를 아예 안 건드린다.
  const rotRef = useRef<StageRot>(rot);
  rotRef.current = rot;
  const metricsRef = useRef<StageMetrics | null>(null);
  const refreshMetrics = useCallback((): StageMetrics | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const m = computeMetrics(rect, viewRef.current, rotRef.current);
    metricsRef.current = m;
    return m;
  }, []);
  useEffect(() => {
    refreshMetrics();
    // rot 이 뒤집히면 offX/offY 가 함께 뒤집힌다 — 낡은 metrics 로 첫 포인터를 받으면 좌표가 어긋난다.
  }, [refreshMetrics, view, rot]);

  /** 화면 좌표 한 점을 **제자리에 붙든 채** 배율만 곱한다. 좌표를 안 주면 판 한가운데다.
   *  줌 버튼(`zoomBy`)과 휠이 같은 이 한 경로를 쓴다 — 두 벌이면 회전(rot)이 걸린 상태에서
   *  한쪽만 어긋나고, 그것이 이 파일에서 가장 재현하기 어려운 종류의 버그다. */
  const zoomAtClient = useCallback(
    (factor: number, focusClient?: { x: number; y: number }) => {
      const m = metricsRef.current ?? refreshMetrics();
      const focus: Vec2 =
        focusClient && m ? clientToWorld(m, focusClient.x, focusClient.y) : { x: def.vbW / 2, y: def.vbH / 2 };
      setView((v) => zoomAt(v, def, focus, factor));
    },
    [def, refreshMetrics],
  );

  // ── 휠 줌(기현 지시 2026-08-14: *"코트에 마우스 두고 휠 버튼 움직이면 줌"*) ───────────────
  //
  // ⚠️ **React 의 `onWheel` 로는 못 한다.** React 는 `wheel` 을 루트에 **passive** 로 걸기
  // 때문에 그 안에서 부른 `preventDefault()` 가 무시된다 — 판은 확대되면서 페이지도 함께
  // 스크롤되는(또는 브라우저가 경고를 뱉는) 상태가 된다. 그래서 svg 에 직접, `passive:false`
  // 로 단다. 이 앱에서 코트는 스크롤 대상이 아니므로 기본 동작을 통째로 막는 것이 맞다.
  //
  // Ctrl/⌘ 를 누른 휠은 **넘긴다** — 그것은 브라우저 자체 확대이고, 화면 전체를 키우는 것은
  // 저시력 사용자의 경로다. 판만 키우려고 그 경로를 뺏지 않는다.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent): void => {
      if (e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      if (e.deltaY === 0) return;
      // 커서 밑의 점을 붙든다 — 확대하려던 자리가 화면 밖으로 달아나면 발 마우스로는 다시 못 찾는다.
      zoomAtClient(wheelZoomFactor(e.deltaY, e.deltaMode), { x: e.clientX, y: e.clientY });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [zoomAtClient]);

  // 크기가 바뀌면 실측 rect 를 다시 읽는다. 창 리사이즈뿐 아니라 **레이아웃 변경**(세로에서
  // 속성 시트가 열려 코트가 낮아지는 것)도 잡아야 하므로 ResizeObserver 를 쓴다.
  // 이제 이 경로는 상태를 하나도 바꾸지 않는다(metricsRef 만 갱신) — 되먹임 고리가 없다.
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

  /** 이벤트가 난 자리의 개체 id. 개체는 `id="obj-…"`, 도형은 `data-shape-id` 다.
   *  ⚠️ `e.target` 은 링·글자 같은 **자식**일 수 있으므로 반드시 `closest` 로 올라간다. */
  const objectIdAt = (e: { target: EventTarget | null }): string | null => {
    const el = e.target instanceof Element ? e.target : null;
    if (!el) return null;
    const shape = el.closest('[data-shape-id]');
    if (shape) return shape.getAttribute('data-shape-id');
    const obj = el.closest('[id^="obj-"]');
    return obj ? obj.id.slice('obj-'.length) : null;
  };

  /** 코트 위의 오른쪽 클릭 · 안드로이드 긴 누름 — **브라우저 메뉴는 언제나 막는다**
   *  (기현 신고 2026-08-14: *"오른쪽 버튼 클릭을 하면 크롬 메뉴가 나온다"*).
   *
   *  ⚠️ 전에는 개체를 맞혔을 때만 막았다. 빈 코트에서는 브라우저 메뉴를 "그대로 두는 것" 이
   *  예의라고 봤는데, 실기로 쓰면 그 판단이 틀렸다. 코트는 **직접 조작하는 표면**이다 —
   *  판 위에서 [뒤로]·[새로고침]·[이미지를 다른 이름으로 저장] 이 뜰 자리가 아니고, 개체는
   *  작아서 오른쪽 클릭이 빗나가는 일이 오히려 흔하다. 발 마우스 사용자에게는 잘못 뜬 메뉴를
   *  닫는 정밀 클릭 한 번이 그대로 비용이다.
   *
   *  덤으로 **안드로이드 크롬의 긴 누름**도 여기서 죽는다. 긴 누름은 `contextmenu` 로 오므로,
   *  안 막으면 우리 메뉴와 브라우저 메뉴가 **함께** 뜬다.
   *
   *  ⚠️ 콜백이 없어도 이 배선은 산다 — 시연·인쇄 화면에도 코트는 코트다. */
  const handleContextMenu = (e: React.MouseEvent<SVGSVGElement>): void => {
    e.preventDefault();
    onStageContextMenu?.(objectIdAt(e), e);
  };

  const handlePointerDown = (e: ReactPointerEvent<SVGSVGElement>): void => {
    // ★ 오른쪽·가운데 버튼은 판을 **건드리지 않는다** (기현 신고 2026-08-15:
    // *"칩들에게는 왼쪽, 오른쪽 마우스 버튼 동작이 똑같다"*).
    //
    // 여기서 안 막으면 오른쪽 클릭이 왼쪽 클릭이 하는 일을 **그대로 한 번 더** 한다 —
    // 개체를 고르고, 물리 드래그를 열고, 포인터를 캡처한다. 배치 도구에서는 개체를 하나
    // **놓고**, 지우개에서는 **지운다**. 그 위에 메뉴가 뜨니 "둘이 똑같다" 로 보인다.
    // 발 마우스는 누른 채 미세하게 흔들리므로, 메뉴를 열려던 클릭이 칩을 옮겨 놓는다.
    //
    // ⚠️ 터치·펜을 함께 막지 않도록 `pointerType` 을 본다 — 손가락의 첫 접촉도 `button` 은
    // 0 이지만, 마우스가 아닌 입력에서 button 을 신뢰하는 순간 긴 누름 경로가 통째로 죽는다.
    if (isSecondaryButton(e)) return;
    onStagePointerDownRaw?.(objectIdAt(e), e);
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

  // ── 도형 끌기(이동 · 크기 · 회전) ────────────────────────────────────────────────────
  // 개체(칩·공·콘)와 달리 컨트롤러를 안 지난다: 도형은 물리 바디가 아니라 **표시**라
  // hitTest 에 분기를 더할 이유가 없고, SVG 이벤트가 이미 정확한 히트를 준다.
  // 규칙 계산은 전부 `dragShapeHandle`(순수)이 지고, 여기는 좌표 변환과 캡처만 한다.
  const shapeDragRef = useRef<{ id: string; which: ShapeHandle | 'body'; grab: Vec2; start: Shape } | null>(null);

  const worldOf = useCallback(
    (e: { clientX: number; clientY: number }): Vec2 | null => {
      const m = metricsRef.current ?? refreshMetrics();
      return m ? clientToWorld(m, e.clientX, e.clientY) : null;
    },
    [refreshMetrics],
  );

  const onShapeBodyDown = useCallback(
    (id: string, e: ReactPointerEvent<SVGGElement>) => {
      // 오른쪽 클릭은 도형도 안 건드린다 — 여기서 안 막으면 지우개로 오른쪽 클릭했을 때
      // `onShapeSelect` 가 그 자리에서 **지운다**(EditorStage 의 지우개 규칙).
      if (isSecondaryButton(e)) return;
      onShapeSelect?.(id);
      const shape = shapes.find((s) => s.id === id);
      const w = worldOf(e);
      if (!shape || !w) return;
      // 잠긴 도형은 **못 끈다**(개체와 같은 규칙, 2026-08-14). 고르기는 위에서 이미 끝났다 —
      // 못 고르면 잠금을 풀 길이 없다는 그 규율이 도형에도 그대로 걸린다.
      if (locked?.has(id)) return;
      // 두 번째 포인터(핀치)는 무시한다 — 개체 드래그가 간 길과 같다.
      if (shapeDragRef.current) return;
      e.stopPropagation();
      (e.currentTarget as unknown as { setPointerCapture(id: number): void }).setPointerCapture?.(e.pointerId);
      shapeDragRef.current = { id, which: 'body', grab: w, start: shape };
    },
    [onShapeSelect, shapes, worldOf, locked],
  );

  const onShapeHandleDown = useCallback(
    (which: ShapeHandle, e: ReactPointerEvent<SVGGElement>) => {
      if (isSecondaryButton(e)) return; // 손잡이도 마찬가지 — 오른쪽 클릭으로 크기가 바뀌면 안 된다
      const shape = shapeHandlesProps?.shape ?? null;
      const w = worldOf(e);
      if (!shape || !w) return;
      if (locked?.has(shape.id)) return; // 잠긴 도형은 크기·회전도 못 바꾼다

      e.stopPropagation();
      (e.currentTarget as unknown as { setPointerCapture(id: number): void }).setPointerCapture?.(e.pointerId);
      shapeDragRef.current = { id: shape.id, which, grab: w, start: shape };
    },
    [shapeHandlesProps, worldOf, locked],
  );

  // 끌기는 **window** 에서 받는다. 손이 도형 밖으로 나가도 이어져야 하는데, SVG 자식에만
  // 달면 포인터가 다른 요소 위로 가는 순간 끊긴다(useTrayDrag 가 같은 이유로 같은 선택을 했다).
  useEffect(() => {
    if (!onShapeChange) return;
    const move = (ev: PointerEvent): void => {
      const d = shapeDragRef.current;
      if (!d) return;
      const w = worldOf(ev);
      if (!w) return;
      if (d.which === 'body') {
        onShapeChange({ ...d.start, x: d.start.x + (w.x - d.grab.x), y: d.start.y + (w.y - d.grab.y) });
      } else {
        onShapeChange(dragShapeHandle(d.start, d.which, w));
      }
    };
    const up = (): void => {
      shapeDragRef.current = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [onShapeChange, worldOf]);

  useImperativeHandle(
    ref,
    (): CourtStageHandle => ({
      zoomBy(factor, focusClient) {
        zoomAtClient(factor, focusClient);
      },
      resetZoom() {
        setView({ x: 0, y: 0, w: def.vbW, h: def.vbH });
      },
      panByScreen(dxCssPx, dyCssPx) {
        // **누를 때마다** 다시 잰다 — 캐시된 metrics 로 밀면 인스펙터가 열려 판이 돌아간 직후
        // 첫 입력이 반대로 간다. (2026-08-14: 회전 자체는 이제 prop 이라 늘 최신이고, 여기서
        // 다시 읽는 것은 **rect** 다 — ResizeObserver 가 위치 이동은 관측하지 않는다.)
        const m = refreshMetrics() ?? metricsRef.current;
        if (!m) return;
        setView((v) => panViewByScreen(v, def, m, dxCssPx, dyCssPx));
      },
      refreshMetrics,
      focusContainer() {
        svgRef.current?.focus({ preventScroll: true });
      },
    }),
    [def, refreshMetrics, zoomAtClient],
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
      onContextMenu={handleContextMenu}
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
        <CourtSurface mode={mode} size={size} variant={variant} />
        {showGrid && <GridOverlay mode={mode} size={size} showLabels={showGridLabels} />}
        <RuleZones mode={mode} size={size} visible={showRuleZones} />
        {/* 진영 표시 — 골라인 뒤 점 둘. **규칙 존 스위치와 무관하게 언제나 보인다**: 골 지역
            3인 반칙이 어느 팀에 걸리는지를 정하는 값이라, 존을 감춰도 코치는 진영을 알아야
            한다(그리고 이 표시가 곧 진영 버튼이 무엇을 바꾸는지의 설명이다). */}
        {ruleOverlay && <SideMarks mode={mode} size={size} teams={ruleOverlay.teamStyles} defense={ruleOverlay.defense} />}
        {/* 개체 **아래**에 둔다 — 링은 공 주위 3 m 를 덮으므로 위에 깔면 칩을 가린다. */}
        {ruleOverlay && (
          <RuleOverlay
            mode={mode}
            size={size}
            visible={showRuleZones}
            writer={writer}
            rules={ruleOverlay.rules}
            ballIds={balls}
            ballRings={ruleOverlay.ballRings}
            roster={ruleOverlay.roster}
            defense={ruleOverlay.defense}
            teams={ruleOverlay.teams}
          />
        )}
        {/* ★ 작도 도형 — **여기가 자리다**(기현 지시 2026-08-14: *"레이어는 코트보다는 높고
            칩, 화살표들보다는 낮게"*). 위로는 RuleOverlay, 아래로는 ObjectLayer 다.
            이 두 줄 사이를 벗어나면 요구가 깨진다: 위로 올리면 도형이 칩을 덮고, 아래로
            내리면 격자·골 지역 가이드에 묻힌다. */}
        <ShapeLayer shapes={shapes} selected={selection} locked={locked} onPointerDown={onShapeSelect ? onShapeBodyDown : undefined} />
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
          fades={fades}
          fadeMs={fadeMs}
          locked={locked}
          ignored={ignored}
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
        {shapeHandlesProps && (
          <ShapeHandles
            shape={shapeHandlesProps.shape}
            pxPerUnit={metricsRef.current?.pxPerUnit ?? 1}
            onPointerDown={onShapeHandleDown}
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
