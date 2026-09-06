// §6.6 레이어 구조 — 표준 개체 렌더러. `<g>` 자식에는 transform prop 이 절대 나타나지 않는다
// (§6.1 규칙 1) — 위치는 각 개체가 마운트 시 등록한 ref 에 TransformWriter 가 직접 쓴다.
//
// 주의(계약서와 다른 점): §6.6 의 XML 스케치는 `<g class="arrows">` 를 `<g class="objects">`
// (콘/휠체어/공/메모) **앞**에 두지만, §3.5 가 못박은 표준 z-order("코트면 → 격자 → 규칙존 →
// 콘 → 화살표 → 휠체어 → 공 → 메모")와 이미 커밋된 render-court 의 `CourtThumbnail.tsx`
// 실제 구현(콘 → 화살표 → 휠체어 → 공 순서로 한 그룹에 나열)은 둘 다 화살표가 콘 "다음"·
// 휠체어 "앞"에 오는 단일 순서를 쓴다. §0 원칙("계약서와 실제 코드가 다르면 실제 코드가
// 맞다")에 따라 이 파일도 CourtThumbnail 과 같은 단일 순서(콘→화살표→휠체어→공→메모)를 쓴다.
//
// ── 획은 어디에 끼는가 (2026-09-03) ──────────────────────────────────────────────────
// **콘 → 획 → 화살표 → 휠체어 → 공 → 메모.** 획은 화살표 바로 **아래**다.
//
// 근거는 케이싱이다. 두 선 다 검정 케이싱을 깔고(대비 요건), 케이싱은 자기 아래 지나가는
// 남의 선을 **지운다** — 겹치는 자리에서 한쪽은 반드시 끊긴다. 그러니 "누가 끊겨도 되는가" 를
// 정해야 하는데, 화살표는 어휘가 좁고 뜻이 정해진 전술 표기(경로·패스)이고 획은 그 위에
// 손으로 덧쓰는 자유 필기다. 자유 필기 한 줄이 판을 가로지르며 화살표 여럿을 토막 내는 것이
// 그 반대보다 잃는 것이 크다. 아래에 두어도 획은 도형·콘 위라 묻히지 않는다.
//
// (같은 부류 안에서 앞의 것이 뒤의 것 케이싱에 덮이는 것은 화살표에도 이미 있는 규약이다 —
//  `ArrowPath.tsx`. 여기서 정한 것은 **부류 사이**의 순서뿐이다.)
//
// ── ⚠️ 2026-09-06: 위 순서들은 전부 **기본층**이다 ────────────────────────────────────
// 개체 표시 순서(z-order) 기능이 랜딩하면서(`docs/PLAN-Z-ORDER.md` 결정 2·4) 이 파일은
// **고정 순서를 스스로 정하지 않는다.** 위 두 절이 적은 "콘 → 획 → 화살표 → 휠체어 → 공 →
// 메모" 는 뒤집힌 것이 아니라 `model/zOrder.ts` 의 `DEFAULT_TIERS`(도형이 그 앞에 붙는다)로
// 옮겨 가 **아무도 순서를 손대지 않은 스텝의 자리**로 산다 — 옛 드릴은 한 픽셀도 안 변한다.
//
// 이제 그리는 순서는 `order` prop(= `sceneOrder(step, cast)` 의 결과, 아래→위)이 정하고,
// 이 파일은 그 목록을 돌며 `kind` 로 분기할 뿐이다. ⚠️ **여기서 정렬을 다시 짜지 마라** —
// 그것이 이 저장소에서 네 번 터진 "경로별 드리프트" 의 다섯째 사례가 되는 자리다.
// `order` 가 없는 호출부(테스트·아직 배선 안 된 화면)만 `DEFAULT_TIERS` 로 접힌다.
//
// ⚠️ **도형(`ShapeMark`)도 이 목록 안에서 그린다.** 2026-08-14 지시("도형은 코트보다 높고
// 칩·화살표보다 낮게")는 `DEFAULT_TIERS` 의 첫 칸으로 살아 있다(ShapeLayer.tsx 머리말 참고).
// 골대 유령·`GoalPost` 는 개체가 아니라 판의 부속이라 순서 대상이 아니고, 지금처럼 **목록보다
// 아래**에 그대로 남는다.
import { useLayoutEffect, useRef } from 'react';
import { IGNORED_OPACITY } from '../core/constants.ts';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { BallId, ChairId, ConeId } from '../core/ids.ts';
import type { Arrow } from '../model/arrow.ts';
import type { NoteLabel as NoteLabelData, TeamSide } from '../model/drill.ts';
import type { TransformWriter } from './transformWriter.ts';
import type { RuleOverlayApi } from './ruleOverlay.ts';
import type { ZoneConfig } from '../model/chair.ts';
import { ChairChip } from './objects/ChairChip.tsx';
import { BallDot } from './objects/BallDot.tsx';
import { GoalHomeGhost, GoalPost } from './objects/GoalPost.tsx';
import { ConeMark } from './objects/ConeMark.tsx';
import { NoteLabel } from './objects/NoteLabel.tsx';
import { ArrowPath } from './objects/ArrowPath.tsx';
import { StrokePath } from './objects/StrokePath.tsx';
import type { Stroke } from '../model/stroke.ts';
import type { Shape } from '../model/shape.ts';
import { ShapeMark } from './objects/ShapeMark.tsx';
import { DEFAULT_TIERS, type SceneRef } from '../model/zOrder.ts';
import { useT } from '../i18n/useT.ts';

export interface ObjectLayerChair {
  id: ChairId;
  color: string;
  /** 팀 소속. 4.6 이 더한 **색이 아닌 팀 채널**(테두리 파선·볼가드 톤)의 입력이다.
   *  ⚠️ 필수로 둔다 — 선택으로 내리면 새 호출자가 조용히 빠뜨리고, 그 칩만 색 하나로
   *  갈리는 상태로 돌아간다(흑백 인쇄·색각 이상에서 구분 불가). */
  team: TeamSide;
  number: string;
  ariaLabel: string;
}
export interface ObjectLayerCone {
  id: ConeId;
  colorIndex: 0 | 1;
}

export interface ObjectLayerProps {
  writer: TransformWriter;
  chairs: readonly ObjectLayerChair[];
  balls: readonly BallId[];
  cones: readonly ObjectLayerCone[];
  /** 골대 포스트 id(`gp_0`…). 편집기에서만 넘긴다 — 시연·썸네일은 코트 라인의 정적 표시를 쓴다. */
  goals?: readonly string[];
  /** 그중 **제자리를 벗어난** 것들. 이 골대만 복귀 커서를 얻고 눌린다(GoalPost 머리말). */
  displacedGoals?: ReadonlySet<string>;
  /** 골대의 제자리(코트 정의 좌표). `goals` 와 **같은 순서**다. 밀린 골대에 점선 유령을
   *  남기는 데만 쓴다 — 없으면 유령 없이 강조 링만 뜬다(마우스는 커서로도 안다). */
  goalHomes?: readonly { x: number; y: number }[];
  /** 골대 받침판을 놓을 방향. `goals` 와 **같은 순서**다(2026-08-30 실물 사진). */
  goalBaseDirs?: readonly ({ x: number; y: number } | null)[];
  /** 밀린 골대를 눌렀을 때 — **모든** 골대를 원위치로. 편집기에서만 넘긴다. */
  onGoalReturn?: () => void;
  notes: readonly NoteLabelData[];
  arrows: readonly Arrow[];
  /** 자유 그리기 획(2026-09-03). 화살표 **바로 아래** 층이다(머리말의 z-order 근거).
   *  옵셔널이다 — 획이 생기기 전 호출부(테스트 픽스처 포함)를 전부 고치게 만들 이유가 없다. */
  strokes?: readonly Stroke[];
  /** 작도 도형(2026-08-14). ⚠️ 2026-09-06 부터 **여기**서 그린다 — 도형이 z-order 의 대상이
   *  되면서 다른 개체 사이에 낄 수 있게 됐고, 그러면 별도 층(`ShapeLayer`)으로는 자리를
   *  표현할 수 없다(그 파일 머리말의 ⚠️). 안 넘기면 도형 0개다. */
  shapes?: readonly Shape[];
  /** 도형을 잡았다. 편집기만 넘긴다 — 없으면 도형은 그림일 뿐이라 클릭도 안 받는다. */
  onShapePointerDown?: (id: string, e: ReactPointerEvent<SVGGElement>) => void;
  /** 이 스텝의 표시 순서(**아래→위**) — `model/zOrder.ts` 의 `sceneOrder(step, cast)` 결과를
   *  그대로 받는다.
   *
   *  ⚠️ 없으면 `DEFAULT_TIERS` 기본층으로 접힌다(props 만 가진 호출부 — 테스트·아직 배선
   *  안 된 화면). 목록에 **없는** id 가 props 에 있으면 기본층 순서대로 맨 위에 붙는다:
   *  스텝 전환 중 퇴장(`fades` 의 'out') 개체는 이전 스텝에만 있어 `sceneOrder` 가 모르는데,
   *  그것을 떨어뜨리면 전환 페이드가 **화면에서 통째로 사라진다**(`sceneOrder` 규칙 ③과
   *  같은 처리다 — 모르는 것은 버리지 않고 위로 올린다). */
  order?: readonly SceneRef[];
  /** ArrowMarkers 가 이 SVG 루트에 만든 `useId()` 접두사. */
  markerUid: string;
  selection: ReadonlySet<string>;
  /** 편집기에서만 넘긴다 — 차체 위 4개 존에 존별 마우스 커서를 얹는다. */
  zoneCursors?: ZoneConfig | null;
  /** 로빙 tabindex 대상(§7.5b `aria-activedescendant`). */
  activeId: string | null;
  /** 마운트 첫 페인트에 즉시 확정할 프레임(§6.2 요건 2) — 드릴 재마운트·스텝 점프 직후에도 채운다. */
  initialFrame?: Readonly<Record<string, { x: number; y: number; theta: number }>>;
  /** 3.10 스텝 전환의 등장/퇴장 페이드 — 시연(interpolateSteps)의 opacity 규칙과 같은 그림.
   *  키 = 화살표/메모 id, 값 = 방향. 'out' 은 이전 스텝에만 있던 개체(호출자가 arrows/notes
   *  목록에 함께 실어 보낸다)라 조작 대상이 아니다 — pointer-events 를 CSS 가 끊는다.
   *  움직임 자체는 CSS 애니메이션이 그린다(§6.1 규칙 준수: React 는 프레임을 구동하지 않는다). */
  fades?: Readonly<Record<string, 'in' | 'out'>>;
  /** 잠긴 개체 id — 붉은 테두리를 그린다(2026-08-14 기현 지시). 이동 차단은 편집기 몫이다. */
  locked?: ReadonlySet<string>;
  /** 무시된 휠체어 id — 흐리게 그리고 포인터를 안 받는다. 물리에서는 이미 빠져 있다
   *  (physics/index.ts 의 load). 여기서 흐리게만 하고 body 를 두면 "안 보이는데 부딪히는"
   *  유령이 되므로, 두 곳이 **같은 목록**을 봐야 한다. */
  ignored?: ReadonlySet<string>;
  /** 페이드 지속(ms). stepTransitionMs 와 같은 값이어야 위치 트윈과 한 시계로 끝난다. */
  fadeMs?: number;
  /** 아웃오브플레이(Law 9) 공 채움색 갱신 — 있으면(=규칙 존 스위치가 배선된 화면) 공마다
   *  circle 을 등록해 `rules.write()` 가 매 프레임 직접 fill 을 바꾼다(BallDot.tsx 참고).
   *  옵셔널이다 — 이 값을 안 넘기는 소비처(예: 인쇄 미리보기)는 recolor 가 그냥 없다. */
  rules?: RuleOverlayApi;
  onObjectPointerDown?(id: string, e: ReactPointerEvent<SVGGElement>): void;
  onObjectKeyDown?(id: string, e: ReactKeyboardEvent<SVGGElement>): void;
}

export function ObjectLayer({
  writer,
  chairs,
  balls,
  cones,
  goals,
  displacedGoals,
  goalHomes,
  goalBaseDirs,
  onGoalReturn,
  notes,
  arrows,
  strokes,
  shapes,
  onShapePointerDown,
  order,
  markerUid,
  selection,
  zoneCursors,
  activeId,
  initialFrame,
  fades,
  fadeMs,
  locked,
  ignored,
  rules,
  onObjectPointerDown,
  onObjectKeyDown,
}: ObjectLayerProps) {
  const t = useT();
  // 화살표·메모의 페이드 래퍼 속성. 래퍼 <g> 는 **항상** 두고 클래스만 바꾼다 — 전환 중에만
  // 감쌌다 벗기면 React 가 자식을 재마운트해 포커스가 떨어지고 writer 등록이 한 번 더 돈다.
  /** 무시된 개체의 껍데기 속성 — **흐리게만** 한다.
   *
   *  ⚠️ `pointerEvents:'none'` 을 함께 걸었다가 되돌렸다(기현 신고 2026-08-14: *"무시된
   *  오브젝트의 선택이 안 되거나 오른쪽 클릭이 안 된다"*). 손이 안 닿으면 **무시를 풀 방법이
   *  없다** — 잠김에서 "선택은 막지 않는다" 로 피했던 함정에 무시가 그대로 빠져 있었다.
   *  '상호작용 안 함' 은 **물리**의 이야기다(공이 통과한다). 그것은 physics/index.ts 의 load 가
   *  body 를 안 만드는 것으로 이미 지켜지고, 화면에서 손까지 막을 이유는 없었다. */
  const ghostProps = (id: string): { style?: { opacity: number } } =>
    // ⚠️ 2026-09-06 — 값이 리터럴 0.32 에서 `core/constants.ts` 의 `IGNORED_OPACITY` 로 옮겼다.
    //    시연·PNG·인쇄가 같은 흐림을 써야 해서다(그쪽은 프레임 opacity 에 곱해 온다 —
    //    model/playback.ts). 여기만 고치면 네 경로가 다시 갈린다.
    ignored?.has(id) ? { style: { opacity: IGNORED_OPACITY } } : {};

  const fadeProps = (id: string): { className?: string; style?: { animationDuration: string } } => {
    const dir = fades?.[id];
    if (!dir || !fadeMs) return {};
    return { className: dir === 'in' ? 'court-fade-in' : 'court-fade-out', style: { animationDuration: `${fadeMs}ms` } };
  };
  // §6.2: ObjectLayer 는 마운트/재마운트마다 최초 프레임을 페인트 전에 확정한다 —
  // 안 하면 마운트 첫 페인트에 개체 전부가 viewBox 원점에 겹치고, 아무도 write 하지
  // 않는 경로(시연의 `key={drillId}` 드릴 재마운트)에서는 영구 고착한다.
  const framePinnedRef = useRef<Readonly<Record<string, { x: number; y: number; theta: number }>> | undefined>(
    undefined,
  );
  useLayoutEffect(() => {
    if (initialFrame && initialFrame !== framePinnedRef.current) {
      writer.writeFrame(initialFrame);
      framePinnedRef.current = initialFrame;
    }
    // 마운트 시 1회 + initialFrame 참조가 바뀔 때(재시드)만 — 매 렌더마다 재적용하지 않는다.
  }, [writer, initialFrame]);

  // ── 순서 목록 만들기 ────────────────────────────────────────────────────────────────
  // ⚠️ 정렬 규칙은 여기 없다. `order`(= `sceneOrder` 의 결과)를 그대로 쓰고, 이 파일이 하는
  //    일은 ① 그 목록의 id 를 props 의 개체와 잇는 것과 ② 목록이 모르는 개체를 떨어뜨리지
  //    않는 것뿐이다.
  const chairById = new Map<string, ObjectLayerChair>(chairs.map((c) => [c.id, c]));
  const coneById = new Map<string, ObjectLayerCone>(cones.map((c) => [c.id, c]));
  const noteById = new Map<string, NoteLabelData>(notes.map((n) => [n.id, n]));
  const arrowById = new Map<string, Arrow>(arrows.map((a) => [a.id, a]));
  const strokeById = new Map<string, Stroke>((strokes ?? []).map((s) => [s.id, s]));
  const shapeById = new Map<string, Shape>((shapes ?? []).map((s) => [s.id, s]));
  const ballIds = new Set<string>(balls);
  const has = (r: SceneRef): boolean => {
    switch (r.kind) {
      case 'shape':
        return shapeById.has(r.id);
      case 'cone':
        return coneById.has(r.id);
      case 'stroke':
        return strokeById.has(r.id);
      case 'arrow':
        return arrowById.has(r.id);
      case 'chair':
        return chairById.has(r.id);
      case 'ball':
        return ballIds.has(r.id);
      case 'note':
        return noteById.has(r.id);
    }
  };

  /** props 만으로 세운 기본층 목록. 두 곳에 쓰인다: `order` 가 없는 호출부의 순서 그 자체와,
   *  `order` 가 모르는 개체(전환 중 퇴장 화살표·메모)를 맨 위에 붙일 때의 순서. */
  const tierRefs: SceneRef[] = [];
  for (const kind of DEFAULT_TIERS) {
    switch (kind) {
      case 'shape':
        for (const sh of shapes ?? []) tierRefs.push({ kind, id: sh.id });
        break;
      case 'cone':
        for (const c of cones) tierRefs.push({ kind, id: c.id });
        break;
      case 'stroke':
        for (const st of strokes ?? []) tierRefs.push({ kind, id: st.id });
        break;
      case 'arrow':
        for (const a of arrows) tierRefs.push({ kind, id: a.id });
        break;
      case 'chair':
        for (const c of chairs) tierRefs.push({ kind, id: c.id });
        break;
      case 'ball':
        for (const id of balls) tierRefs.push({ kind, id });
        break;
      case 'note':
        for (const n of notes) tierRefs.push({ kind, id: n.id });
        break;
    }
  }

  const placed = new Set<string>();
  const refs: SceneRef[] = [];
  for (const r of order ?? []) {
    // 이 판에 없는 id(다른 스텝의 고아·중복)는 조용히 뛴다 — `sceneOrder` 와 같은 처리다.
    if (placed.has(r.id) || !has(r)) continue;
    placed.add(r.id);
    refs.push(r);
  }
  for (const r of tierRefs) {
    if (placed.has(r.id)) continue;
    placed.add(r.id);
    refs.push(r);
  }

  const renderRef = (r: SceneRef) => {
    switch (r.kind) {
      case 'shape': {
        const sh = shapeById.get(r.id);
        if (!sh) return null;
        return (
          // ⚠️ 도형 **하나마다** 껍데기 <g> 를 둔다. 층 하나로 묶을 수 없기 때문이다 — 순서가
          //    바뀌면 도형이 목록 안에서 흩어진다(콘과 화살표 사이에 한 장만 낄 수 있다).
          //    `data-shape-layer` 는 그대로 남긴다: 이 이름을 읽는 선택자가 여럿이고, 뜻은
          //    이제 "도형 층 한 칸" 이다. `aria-hidden` 도 옛 층과 같다 — 도형은 접근성
          //    트리에 낼 것이 없다(자리·크기가 전부다).
          //    ⚠️ 이 <g> 에 `opacity` 를 걸지 마라(ShapeLayer.tsx 머리말 ①).
          <g key={sh.id} aria-hidden="true" data-shape-layer="">
            <ShapeMark
              shape={sh}
              selected={selection.has(sh.id)}
              locked={locked?.has(sh.id) ?? false}
              onPointerDown={onShapePointerDown}
            />
          </g>
        );
      }
      case 'cone': {
        const c = coneById.get(r.id);
        if (!c) return null;
        return (
          <ConeMark
            key={c.id}
            id={c.id}
            writer={writer}
            colorIndex={c.colorIndex}
            selected={selection.has(c.id)}
            locked={locked?.has(c.id)}
            active={activeId === c.id}
            ariaLabel={t('present.objects.coneAriaLabel', { color: t(c.colorIndex === 0 ? 'team.colorNames.orange' : 'team.colorNames.blue') })}
            onPointerDown={onObjectPointerDown}
            onKeyDown={onObjectKeyDown}
          />
        );
      }
      case 'stroke': {
        const st = strokeById.get(r.id);
        if (!st) return null;
        return (
          <g key={st.id} {...fadeProps(st.id)}>
            <StrokePath
              stroke={st}
              markerUid={markerUid}
              writer={writer}
              selected={selection.has(st.id)}
              locked={locked?.has(st.id)}
              active={activeId === st.id}
              onPointerDown={onObjectPointerDown}
              onKeyDown={onObjectKeyDown}
            />
          </g>
        );
      }
      case 'arrow': {
        const a = arrowById.get(r.id);
        if (!a) return null;
        return (
          <g key={a.id} {...fadeProps(a.id)}>
            <ArrowPath
              arrow={a}
              markerUid={markerUid}
              writer={writer}
              selected={selection.has(a.id)}
              locked={locked?.has(a.id)}
              active={activeId === a.id}
              onPointerDown={onObjectPointerDown}
              onKeyDown={onObjectKeyDown}
            />
          </g>
        );
      }
      case 'chair': {
        const c = chairById.get(r.id);
        if (!c) return null;
        return (
          // 무시는 **휠체어에만** 있다(기현 지시) — 그래서 껍데기도 여기만 씌운다.
          <g key={c.id} {...ghostProps(c.id)}>
            <ChairChip
              id={c.id}
              writer={writer}
              color={c.color}
              team={c.team}
              number={c.number}
              selected={selection.has(c.id)}
              locked={locked?.has(c.id)}
              active={activeId === c.id}
              ariaLabel={c.ariaLabel}
              zoneCursors={zoneCursors}
              onPointerDown={onObjectPointerDown}
              onKeyDown={onObjectKeyDown}
            />
          </g>
        );
      }
      case 'ball': {
        if (!ballIds.has(r.id)) return null;
        const id = r.id as BallId;
        return (
          <BallDot
            key={id}
            id={id}
            writer={writer}
            selected={selection.has(id)}
            locked={locked?.has(id)}
            active={activeId === id}
            ariaLabel={t('present.objects.ballAriaLabel')}
            rules={rules}
            onPointerDown={onObjectPointerDown}
            onKeyDown={onObjectKeyDown}
          />
        );
      }
      case 'note': {
        const n = noteById.get(r.id);
        if (!n) return null;
        return (
          <g key={n.id} {...fadeProps(n.id)}>
            <NoteLabel
              id={n.id}
              writer={writer}
              text={n.text}
              size={n.size}
              color={n.color}
              align={n.align}
              selected={selection.has(n.id)}
              locked={locked?.has(n.id)}
              active={activeId === n.id}
              ariaLabel={t('objectLayer.noteAriaLabel', { text: n.text })}
              onPointerDown={onObjectPointerDown}
              onKeyDown={onObjectKeyDown}
            />
          </g>
        );
      }
    }
  };

  return (
    <>
      {/* 유령이 **먼저** — 제자리는 밀린 골대와 겹칠 수 있고(막 밀리기 시작한 순간), 그때
          위에 오면 진짜 골대를 가린다. */}
      {(goals ?? []).map((gid, i) => {
        const home = goalHomes?.[i];
        if (!home || !displacedGoals?.has(gid)) return null;
        return <GoalHomeGhost key={`${gid}_home`} x={home.x} y={home.y} />;
      })}
      {(goals ?? []).map((gid, i) => (
        <GoalPost
          key={gid}
          id={gid}
          writer={writer}
          baseDir={goalBaseDirs?.[i] ?? null}
          displaced={displacedGoals?.has(gid) ?? false}
          onReturn={onGoalReturn}
        />
      ))}
      {/* ★ 여기부터가 순서를 갖는 7종이다. 배열 앞 = 먼저 그린다 = 뒤(아래). */}
      {refs.map(renderRef)}
    </>
  );
}
