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
import { useId } from 'react';
import { CHAIR, BALL, NOTE } from '../../core/constants.ts';
import { COURT_BG, OBJ_STROKE, BALL_FILL, CONE_COLORS, ARROW_CASING, NOTE_FILL, NOTE_FOLD_FILL, NOTE_PLACEHOLDER_FILL } from '../../core/colors.ts';
import { COURT_DEFS } from '../../model/court.ts';
import { ARROW_STYLES, arrowColor, arrowPath } from '../../model/arrow.ts';
import type { Drill, DrillStep } from '../../model/drill.ts';
import { CourtSurface } from '../../render/CourtSurface.tsx';
import { ArrowMarkers } from '../../render/ArrowMarkers.tsx';
import { NOTE_PLACEHOLDER, noteChipPathD, noteChipWidthPx, noteFoldPathD } from '../../render/objects/noteChip.ts';
import { teamMarkFor } from '../../render/teamMark.ts';
import { PRINT_COURT_CLASS } from './printDom.ts';

const HALF_W = CHAIR.widthPx / 2;
/** ChairChip 과 같은 유도식(원래 20, 2026-08-11 기현 지시로 2/3). 값만 옮기면 근거가 사라진다. */
const LABEL_FONT_PX = (20 * 2) / 3;
const NUM_FONT = "'Space Grotesk',sans-serif";
const TEXT_FONT = "'Pretendard',sans-serif";

export interface PrintCourtProps {
  drill: Pick<Drill, 'courtMode' | 'cast' | 'teams'>;
  step: DrillStep;
  /** 그림 설명. 스크린리더가 아니라 **인쇄 미리보기의 대체 텍스트**를 위한 것이기도 하다. */
  ariaLabel: string;
}

export function PrintCourt({ drill, step, ariaLabel }: PrintCourtProps) {
  const def = COURT_DEFS[drill.courtMode];
  // 마커 id 는 SVG 루트마다 유일해야 한다(§6.6). 한 문서에 60장이 동시에 있으므로 여기서
  // 고정 id 를 쓰면 url(#…) 이 전부 첫 장을 가리켜 2장부터 화살촉이 사라진다.
  const uid = useId().replace(/:/g, '');
  const usedColors = Array.from(new Set(step.arrows.map((a) => arrowColor(a))));

  return (
    <svg
      className={PRINT_COURT_CLASS}
      viewBox={`0 0 ${def.vbW} ${def.vbH}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={ariaLabel}
    >
      <defs>
        <ArrowMarkers uid={uid} colors={usedColors} />
      </defs>
      <rect width={def.vbW} height={def.vbH} rx={10} fill={COURT_BG} />
      <CourtSurface mode={drill.courtMode} variant="present" />

      {/* §3.5 렌더 레이어 순서: 코트면 → 콘 → 화살표 → 휠체어 → 공 → 메모.
          (격자·규칙존·선택 링은 종이에 싣지 않는다 — §6.2 의 PNG 포함 목록과 같은 판단이다.) */}
      {drill.cast.cones.map((c) => {
        const p = step.cones[c.id];
        if (!p) return null;
        return (
          <g key={c.id} data-print-cone={c.id} transform={`translate(${p.x} ${p.y})`}>
            <path d="M0,-5 L5,4 L-5,4 Z" fill={CONE_COLORS[c.colorIndex]} stroke={OBJ_STROKE} strokeWidth={1.6} />
            {c.colorIndex === 1 && <path d="M-6,4.5 H6 V6.5 H-6 Z" fill={CONE_COLORS[c.colorIndex]} stroke={OBJ_STROKE} strokeWidth={1.6} />}
          </g>
        );
      })}

      {step.arrows.map((a) => {
        const d = arrowPath(a);
        const style = ARROW_STYLES[a.kind];
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
              strokeDasharray={style.dash || undefined}
              markerEnd={`url(#${uid}-${color.slice(1)})`}
            />
          </g>
        );
      })}

      {drill.cast.chairs.map((c) => {
        const pose = step.chairs[c.id];
        if (!pose) return null;
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
              stroke={OBJ_STROKE}
              strokeWidth={1.4}
            />
            <circle cx={0} cy={0} r={4.2} fill={OBJ_STROKE} />
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
      })}

      {drill.cast.balls.map((b) => {
        const p = step.balls[b.id];
        if (!p) return null;
        return <circle key={b.id} data-print-ball={b.id} cx={p.x} cy={p.y} r={BALL.viewRadiusPx} fill={BALL_FILL} stroke="#fff" strokeWidth={2.4} />;
      })}

      {step.notes.map((n) => {
        const size = n.size ?? 14;
        const align = n.align ?? 'middle';
        const halfW = noteChipWidthPx(n.text, size) / 2;
        const empty = n.text.length === 0;
        // NoteLabel.tsx 와 같은 규약: align 은 글 정렬이자 **앵커 기준 칩의 위치**다.
        const textX = align === 'start' ? -halfW + NOTE.chipPadXPx : align === 'end' ? halfW - NOTE.chipPadXPx : 0;
        return (
          <g key={n.id} data-print-note={n.id} transform={`translate(${n.x} ${n.y})`}>
            <path d={noteChipPathD(halfW)} fill={NOTE_FILL} stroke={OBJ_STROKE} strokeWidth={1.4} strokeLinejoin="round" />
            <path d={noteFoldPathD(halfW)} fill={NOTE_FOLD_FILL} stroke={OBJ_STROKE} strokeWidth={1.4} strokeLinejoin="round" />
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
              {empty ? NOTE_PLACEHOLDER : n.text}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
