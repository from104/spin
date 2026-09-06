// §6.3 인쇄용 코트 그림 — **정적** SVG 한 장. 스텝 하나의 좌표를 props 로 받아 그대로 그린다.
//
// 왜 편집기·시연의 개체 컴포넌트(ChairChip/BallDot/ConeMark/ArrowPath)를 그대로 쓰지 않는가:
//  ① 저것들은 위치를 `TransformWriter` 가 DOM 에 직접 쓴다(§6.1 규칙 1). 인쇄 트리에는 rAF
//     루프가 없으므로 writer 를 붙여도 아무도 write 하지 않고, **전 개체가 원점(0,0)에 겹쳐**
//     찍힌다. 프레임마다 setState 하는 경로를 새로 만드는 것은 규칙 1 위반이다.
//  ② 저것들은 `id={`obj-${id}`}` 를 단다. 60스텝 드릴 시트는 같은 개체를 60장에 그리므로
//     **같은 DOM id 가 60번** 생긴다(화살표 id 는 스텝 사이에 유지된다 — 트윈이 그렇게 쓴다).
//  ③ `focus-ind-*`·선택 링·존 커서는 종이에 필요 없다.
// 그래서 `PresentObjects.tsx` 가 문서화한 "좌표를 props 로 받는 전용 정적 렌더러" 패턴을
// 따르되, 코트 라인은 `CourtSurface` 를, 색·기하는 core 상수를, 팀 표식(색 + 4.6 이 더한
// 파선·가드 톤)은 `render/teamMark.ts` 를, 메모 칩 모양은 `noteChip.ts` 를 **그대로 재사용**한다
// — 숫자를 새로 만들지 않는다.
//
// 4.4 의 `buildStaticSvg`(PNG 직렬화용)와 겹치는 부분이 생기면 4.7 이 통합을 판단한다.
// 다만 둘의 요구가 같지 않다는 것은 미리 적어 둔다: PNG 는 스타일시트 없는 SVG 라 `var(--)`
// 와 `class=` 를 하나도 못 쓰지만(§6.2), 인쇄는 **문서 컨텍스트**라 Pretendard·Space Grotesk
// 가 그대로 먹는다. 여기서 색을 토큰(`var(--…)`)이 아니라 리터럴로 쓰는 이유도 그것과는
// 별개다 — 다크 테마 사용자가 인쇄해도 **종이는 언제나 같아야** 하기 때문이다.
import { useId, useMemo } from 'react';
import { CHAIR, BALL, NOTE } from '../../core/constants.ts';
import { COURT_BG, OBJ_STROKE, BALL_FILL, CONE_COLORS, ARROW_CASING, NOTE_FILL, NOTE_FOLD_FILL, NOTE_PLACEHOLDER_FILL } from '../../core/colors.ts';
import { courtDefFor } from '../../model/court.ts';
import { ARROW_STYLE, arrowColor, arrowPath, headFromOf, headToOf } from '../../model/arrow.ts';
import type { Drill, DrillStep } from '../../model/drill.ts';
import { CourtSurface } from '../../render/CourtSurface.tsx';
import { GridOverlay } from '../../render/GridOverlay.tsx';
import { RuleZones } from '../../render/RuleZones.tsx';
import { staticFrameOf } from '../../model/playback.ts';
import { sceneOrder, type SceneRef } from '../../model/zOrder.ts';
import { ruleMarkup } from '../../features/export/buildStaticSvg.ts';
import { ArrowMarkers } from '../../render/ArrowMarkers.tsx';
import { STROKE_CASING_PAD, arrowMarkerId } from '../../render/arrowHeadGeom.ts';
import { strokeColor, strokeHeadFrom, strokeHeadTo, strokePath, strokeWidthOf } from '../../model/stroke.ts';
import { ShapeMark } from '../../render/objects/ShapeMark.tsx';
import { SideMarks } from '../../render/SideMarks.tsx';
import {
  NOTE_DEFAULT_SIZE_PX,
  NOTE_PLACEHOLDER,
  noteChipHeightPx,
  noteChipPathD,
  noteChipWidthPx,
  noteFoldPathD,
  noteLineDy,
  noteLineHeightPx,
  noteLines,
} from '../../render/objects/noteChip.ts';
import { teamMarkFor } from '../../render/teamMark.ts';
import { PRINT_COURT_CLASS } from './printDom.ts';
import { useLocale } from '../../i18n/useLocale.ts';

const HALF_W = CHAIR.widthPx / 2;
/** ChairChip 과 같은 유도식(원래 20, 2026-08-11 기현 지시로 2/3). 값만 옮기면 근거가 사라진다. */
const LABEL_FONT_PX = (20 * 2) / 3;
const NUM_FONT = "'Space Grotesk',sans-serif";
const TEXT_FONT = "'Pretendard',sans-serif";

export interface PrintCourtProps {
  drill: Pick<Drill, 'courtMode' | 'courtSize' | 'cast' | 'teams' | 'defense'>;
  step: DrillStep;
  /** 그림 설명. 스크린리더가 아니라 **인쇄 미리보기의 대체 텍스트**를 위한 것이기도 하다. */
  ariaLabel: string;
  /** 표시 스위치 — 화면·PNG 와 **같은 값**을 받는다(prefs.showGrid / showGridLabels /
   *  showRuleZones).
   *
   *  ⚠️ **기본값을 주지 않는다.** 옵셔널이면 배선을 빠뜨려도 조용히 컴파일되는데, 그것이
   *  2026-08-27 사고의 정확한 메커니즘이었다(인쇄만 6가지를 안 그리는데 아무도 몰랐다 —
   *  render/renderPaths.ts 머리말). 호출부가 반드시 값을 정하게 한다. */
  view: { showGrid: boolean; showGridLabels: boolean; showRuleZones: boolean };
}

export function PrintCourt({ drill, step, ariaLabel, view }: PrintCourtProps) {
  // §6.4 — 종이도 판과 같은 코트여야 한다. 인쇄는 '나가서 쓰는' 마지막 단계라 여기서
  // 크기가 갈라지면 코치는 실제 체육관 바닥과 다른 판을 들고 나간다.
  const def = courtDefFor(drill.courtMode, drill.courtSize);
  // 마커 id 는 SVG 루트마다 유일해야 한다(§6.6). 한 문서에 60장이 동시에 있으므로 여기서
  // 고정 id 를 쓰면 url(#…) 이 전부 첫 장을 가리켜 2장부터 화살촉이 사라진다.
  const uid = useId().replace(/:/g, '');
  // 규칙 오버레이는 **판정을 거쳐야** 그려진다(위반이면 붉은 실선, 아니면 흰 파선). 그 판정
  // 함수들은 프레임(좌표 + 차체 각도)을 요구하므로 스텝을 정적 프레임으로 한 번 편다 —
  // `staticFrameOf` 가 그 어댑터이고, PNG 도 같은 자료형을 쓴다.
  const ruleSvg = useMemo(() => {
    const frame = staticFrameOf(drill, step);
    // `teams` 는 `StaticSceneOpts` 의 필수 필드지만 ruleMarkup 은 안 읽는다(규칙 표시는 팀
    // 색이 아니라 판정 색으로 말한다) — 그래도 타입을 우회하지 않고 진짜 값을 넘긴다.
    return ruleMarkup(frame, {
      mode: drill.courtMode,
      size: drill.courtSize,
      teams: drill.teams,
      defense: drill.defense,
      showRuleZones: view.showRuleZones,
    });
  }, [drill, step, view.showRuleZones]);
  // 마커는 (색 × 굵기)마다 하나다 — 색은 화살표·획을 합쳐서, 굵기 축은 획만 갖는다
  // (render/arrowHeadGeom.ts). 여기서 획의 색을 빠뜨리면 촉을 켠 획만 종이에서 촉을 잃는다.
  const usedColors = Array.from(new Set([...step.arrows.map((a) => arrowColor(a)), ...(step.strokes ?? []).map((s) => strokeColor(s))]));
  const usedWidths = Array.from(new Set((step.strokes ?? []).map((s) => strokeWidthOf(s))));
  const locale = useLocale();
  // 개체 표시 순서(z-order, 2026-09-06 · PLAN-Z-ORDER 결정 12) — 판·시연·PNG 와 **같은 함수**다.
  // ⚠️ 여기서 종류별로 다시 늘어놓지 마라. 종이가 판과 다른 순서를 쓰면 코치가 판에서 본
  //    그림과 손에 든 종이가 달라진다(그 사고가 이 저장소에서 네 번 났다 — renderPaths.ts).
  //    (키 없는 옛 스텝 객체의 방어는 `sceneOrder` 자신이 한다 — 2026-09-06 검수에서 모델로 옮겼다.)
  const order = useMemo<readonly SceneRef[]>(() => sceneOrder(step, drill.cast), [step, drill.cast]);
  const chairDefById = new Map(drill.cast.chairs.map((c) => [c.id as string, c]));
  const ballPosById = new Map(drill.cast.balls.map((b) => [b.id as string, step.balls[b.id]] as const));
  const coneDefById = new Map(drill.cast.cones.map((c) => [c.id as string, c]));
  const shapeById = new Map((step.shapes ?? []).map((sh) => [sh.id as string, sh]));
  const strokeById = new Map((step.strokes ?? []).map((st) => [st.id as string, st]));
  const arrowById = new Map(step.arrows.map((a) => [a.id as string, a]));
  const noteById = new Map(step.notes.map((n) => [n.id as string, n]));

  return (
    <svg
      className={PRINT_COURT_CLASS}
      viewBox={`0 0 ${def.vbW} ${def.vbH}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={ariaLabel}
    >
      <defs>
        <ArrowMarkers uid={uid} colors={usedColors} widths={usedWidths} />
      </defs>
      <rect width={def.vbW} height={def.vbH} rx={10} fill={COURT_BG} />
      <CourtSurface mode={drill.courtMode} size={drill.courtSize} variant="present" />

      {/* 진영 표시 — 어느 골을 어느 팀이 지키는지. 종이에 이게 없으면 **코트를 어느 쪽으로 놓고
          읽어야 하는지**가 사라져, 화면에서 정한 공수 방향이 체육관에서 뒤집힌다.
          (2026-08-17 기현님 신고 — 그림 내보내기에서 빠져 있던 것과 같은 층이다.)
          화면·PNG 와 **같은 함수**(render/sideFlags.ts)가 좌표를 준다. */}
      <SideMarks mode={drill.courtMode} size={drill.courtSize} teams={drill.teams} defense={drill.defense} />

      {/* 격자·규칙 존 — 화면과 **같은 컴포넌트**다(둘 다 순수 memo 라 writer 없이 선다).
          2026-08-27 이전에는 여기 없었고, 그 근거로 적힌 것이 *"§6.2 의 PNG 포함 목록과 같은
          판단"* 이었다. **그 근거가 그 뒤 뒤집혔다** — PNG 는 지금 넷을 전부 굽는다. 근거가
          딴 파일에 있으면 근거가 바뀐 것을 아무도 모른다. 그래서 이제 판단은
          `render/renderPaths.ts` 한 곳에 있고, 테스트가 표와 코드를 대조한다. */}
      {view.showGrid && <GridOverlay mode={drill.courtMode} size={drill.courtSize} showLabels={view.showGridLabels} forPrint />}
      <RuleZones mode={drill.courtMode} size={drill.courtSize} visible={view.showRuleZones} />

      {/* 공 거리 링 · 세트피스 소유 화살표 · 존 위반 표시 — **PNG 와 같은 함수**(ruleMarkup)가
          굽는다. 화면의 `RuleOverlay` 를 쓸 수 없는 이유는 이 파일 머리말 ①과 같다: 좌표를
          rAF writer 가 DOM 에 직접 쓰는 구조라 정적 트리에서는 링이 전부 원점에 겹친다.
          문자열을 삼키는 것이 못생겼지만, 기하를 여기 다시 적는 것보다 **훨씬 낫다** — 그
          중복이 곧 종이만 다른 그림이 되는 자리다(renderPaths.ts 의 네 번째 사고).

          ⚠️ 2026-09-06 — 자리를 **개체 블록 앞**으로 옮겼다. 그 전에는 콘과 도형 사이에
             끼어 있어서 종이에서만 콘이 도형 아래로 갔다(판은 도형이 콘 아래다). 화면
             (CourtStage: RuleZones → SideMarks → RuleOverlay → ObjectLayer)과 같은 자리로
             맞춘 것이고, 이 한 줄이 그 옛 드리프트를 함께 지운다. */}
      {ruleSvg !== '' && <g dangerouslySetInnerHTML={{ __html: ruleSvg }} />}

      {/* §3.5 렌더 레이어 순서: 코트면 → 진영 → 격자·규칙존 → 규칙 표시 → **개체 목록**.
          ── ⚠️ 2026-09-06 ────────────────────────────────────────────────────────────────
          개체 7종의 순서는 이제 고정이 아니라 `sceneOrder(step, cast)` 가 정한다(위 `order`).
          아무도 손대지 않은 스텝에서는 여전히 도형 → 콘 → 획 → 화살표 → 휠체어 → 공 → 메모다
          (획이 화살표 아래인 근거는 render/ObjectLayer.tsx 머리말 — 케이싱이 남의 선을
          지우므로 누가 끊겨도 되는지를 정해야 한다).
          (선택 링·핸들은 편집 도구라 종이에 없다 — 장면의 내용이 아니다.) */}
      {order.map((r) => {
        switch (r.kind) {
          case 'shape': {
            const sh = shapeById.get(r.id);
            // 도형 — 화면과 **같은 컴포넌트**다. 인쇄만 따로 그리면 반투명 값이 어긋나는 날
            // 종이에서만 진한 판이 나오고, 그건 코트에서야 알게 된다.
            return sh ? <ShapeMark key={sh.id} shape={sh} /> : null;
          }
          case 'cone': {
            const c = coneDefById.get(r.id);
            const p = c ? step.cones[c.id] : undefined;
            if (!c || !p) return null;
            return (
              <g key={c.id} data-print-cone={c.id} transform={`translate(${p.x} ${p.y})`}>
                <path d="M0,-5 L5,4 L-5,4 Z" fill={CONE_COLORS[c.colorIndex]} stroke={OBJ_STROKE} strokeWidth={1.6} />
                {c.colorIndex === 1 && <path d="M-6,4.5 H6 V6.5 H-6 Z" fill={CONE_COLORS[c.colorIndex]} stroke={OBJ_STROKE} strokeWidth={1.6} />}
              </g>
            );
          }
          case 'stroke': {
            // 자유 그리기 획 — 화살표와 **같은 층 구조**(케이싱 먼저, 본선 뒤에). 다른 것은
            // 굵기가 획마다 다르다는 것뿐이고, 케이싱 여유·마커 id 는 화면과 같은 상수·같은
            // 함수에서 온다.
            // ⚠️ `StrokePath` 를 그대로 쓰지 않는 이유는 이 파일 머리말 ①과 같다 — 그쪽은
            //    writer 등록·포커스 링·잠김 덮개를 달고 있어 종이에 필요 없는 것이 함께 실린다.
            const st = strokeById.get(r.id);
            if (!st) return null;
            const d = strokePath(st);
            const w = strokeWidthOf(st);
            const color = strokeColor(st);
            const hFrom = strokeHeadFrom(st);
            const hTo = strokeHeadTo(st);
            return (
              <g key={st.id} data-print-stroke={st.id}>
                <path d={d} fill="none" stroke={ARROW_CASING} strokeWidth={w + STROKE_CASING_PAD} strokeLinecap="round" strokeLinejoin="round" />
                <path
                  d={d}
                  fill="none"
                  stroke={color}
                  strokeWidth={w}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  markerStart={hFrom === 'none' ? undefined : `url(#${arrowMarkerId(uid, color, hFrom, w)})`}
                  markerEnd={hTo === 'none' ? undefined : `url(#${arrowMarkerId(uid, color, hTo, w)})`}
                />
              </g>
            );
          }
          case 'arrow': {
            const a = arrowById.get(r.id);
            if (!a) return null;
            const d = arrowPath(a);
            const style = ARROW_STYLE;
            const color = arrowColor(a);
            return (
              <g key={a.id} data-print-arrow={a.id}>
                {/* 케이싱(halo). #38bdf8 는 코트 대비 2.49:1 이라 검정 밑선(3.93:1)이 없으면
                    컬러 인쇄에서도 화살표가 코트에 녹는다(§6.6 과 같은 근거). */}
                <path d={d} fill="none" stroke={ARROW_CASING} strokeWidth={style.width + 2.4} strokeLinecap="round" />
                <path
                  d={d}
                  fill="none"
                  stroke={color}
                  strokeWidth={style.width}
                  strokeLinecap="round"
                  markerStart={headFromOf(a) === 'none' ? undefined : `url(#${uid}-${color.slice(1)}-${headFromOf(a)})`}
                  markerEnd={headToOf(a) === 'none' ? undefined : `url(#${uid}-${color.slice(1)}-${headToOf(a)})`}
                />
              </g>
            );
          }
          case 'chair': {
            const c = chairDefById.get(r.id);
            const pose = c ? step.chairs[c.id] : undefined;
            if (!c || !pose) return null;
            // 4.6 — 팀 구분은 여기서 **색 하나로 갈리지 않는다.** `teamMarkFor` 가 채움색과 함께
            // 테두리 파선(주 채널)·볼가드 톤(보조 채널)까지 준다. 이 그림은 흑백 레이저로 뽑히는
            // 것이 정상 경로라, ⚠️ strokeDasharray 나 guardFill 을 리터럴로 되돌리면 종이 위에서
            // 두 팀이 확정적으로 같아진다(근거·크기 검산은 src/render/teamMark.ts 머리말).
            const mark = teamMarkFor(c, drill.teams);
            return (
              <g key={c.id} data-print-chair={c.id} transform={`translate(${pose.x} ${pose.y}) rotate(${pose.angleDeg})`}>
                <rect
                  x={-CHAIR.pivotToRearPx}
                  y={-HALF_W}
                  width={CHAIR.lengthPx}
                  height={CHAIR.widthPx}
                  rx={5}
                  fill={mark.fill}
                  // ⚠️ 6.5 — 여기가 OBJ_STROKE 리터럴이면 **종이만** 밝은 차체에서 파선을 잃는다
                  // (PNG 는 이미 m.stroke 를 쓰고 있었다 — 실제로 갈라져 있던 자리다).
                  stroke={mark.stroke}
                  strokeWidth={2.2}
                  strokeDasharray={mark.strokeDash}
                />
                <rect
                  x={CHAIR.pivotToFrontPx - CHAIR.guardPx}
                  y={-HALF_W}
                  width={CHAIR.guardPx}
                  height={CHAIR.widthPx}
                  rx={2}
                  fill={mark.guardFill}
                  stroke={mark.stroke}
                  strokeWidth={1.4}
                />
                <circle cx={0} cy={0} r={4.2} fill={mark.stroke} />
                <g transform={`translate(${CHAIR.centroidOffsetPx} 0)`}>
                  {/* 등번호는 절대 회전하지 않는다(§3.4). 화면에서는 writer 가 rotate(-θ) 를 쓰고,
                      종이에서는 각도가 고정이므로 그 값을 그대로 마크업에 적는다. */}
                  <g transform={`rotate(${-pose.angleDeg})`}>
                    <text
                      x={0}
                      y={0}
                      fontFamily={NUM_FONT}
                      fontSize={LABEL_FONT_PX}
                      fontWeight={700}
                      fill={mark.ink}
                      textAnchor="middle"
                      dominantBaseline="central"
                    >
                      {c.number}
                    </text>
                  </g>
                </g>
              </g>
            );
          }
          case 'ball': {
            const p = ballPosById.get(r.id);
            if (!p) return null;
            return <circle key={r.id} data-print-ball={r.id} cx={p.x} cy={p.y} r={BALL.viewRadiusPx} fill={BALL_FILL} stroke="#fff" strokeWidth={2.4} />;
          }
          case 'note': {
            const n = noteById.get(r.id);
            if (!n) return null;
            const size = n.size ?? NOTE_DEFAULT_SIZE_PX;
            const align = n.align ?? 'middle';
            const halfW = noteChipWidthPx(n.text, size) / 2;
            const halfH = noteChipHeightPx(n.text, size) / 2;
            const lines = noteLines(n.text, size);
            const empty = n.text.length === 0;
            // NoteLabel.tsx 와 같은 규약: align 은 글 정렬이자 **앵커 기준 칩의 위치**다.
            const textX = align === 'start' ? -halfW + NOTE.chipPadXPx : align === 'end' ? halfW - NOTE.chipPadXPx : 0;
            return (
              <g key={n.id} data-print-note={n.id} transform={`translate(${n.x} ${n.y})`}>
                <path d={noteChipPathD(halfW, halfH)} fill={NOTE_FILL} stroke={OBJ_STROKE} strokeWidth={1.4} strokeLinejoin="round" />
                <path d={noteFoldPathD(halfW, halfH)} fill={NOTE_FOLD_FILL} stroke={OBJ_STROKE} strokeWidth={1.4} strokeLinejoin="round" />
                <text
                  x={empty ? 0 : textX}
                  y={0}
                  fontFamily={TEXT_FONT}
                  fontSize={empty ? NOTE.placeholderSizePx : size}
                  fontWeight={600}
                  fill={empty ? NOTE_PLACEHOLDER_FILL : (n.color ?? '#ffffff')}
                  textAnchor={empty ? 'middle' : align}
                  dominantBaseline="central"
                >
                  {/* 줄 나눔은 화면과 **같은 함수**가 정한다 — 종이가 화면보다 한 줄 적게 나오면
                      코치는 종이를 못 믿는다. tspan 마다 x 를 다시 주는 이유는 NoteLabel 과 같다. */}
                  {empty
                    ? NOTE_PLACEHOLDER[locale]
                    : lines.map((line, i) => (
                        <tspan key={i} x={textX} dy={i === 0 ? noteLineDy(0, lines.length, size) : noteLineHeightPx(size)}>
                          {line}
                        </tspan>
                      ))}
                </text>
              </g>
            );
          }
        }
      })}
    </svg>
  );
}
