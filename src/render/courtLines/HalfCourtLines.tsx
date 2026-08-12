// 하프 코트 라인. template.html 285–303행(editor)·441–459행(present) 마크업을 좌표 그대로
// 이식하고 굵기만 variant 로 분기한다. 센터점(circle fill white)은 하프 마크업에 없다 — 추가하지 않는다.
// ⚠️ 이 두 번째 줄은 **5.3 이 확인하고 그대로 둔 결정**이다(계획서 §5차 5.3 행: "HalfCourtLines.tsx:2
// 주석은 옳으니 뒤집지 않는다"). 5.3 이 풀 코트에 넣은 **센터 마크(15 cm X)도 여기에는 없다** —
// 하프 코트는 공격 진영만 그리는 훈련용 구획이라 판 위에 하프라인이 없고, 위쪽 변에 X 를 찍으면
// 코치가 경기면의 끝을 중앙으로 읽는다. 되돌리면(= 여기에 X 를 넣으면) 그 오독이 되살아난다.
//
// 좌표 출처는 COURT_DEFS.half 하나뿐이다(진실 공급원 통일 — 감사 2026-08-08 minor).
import { COURT_DEFS } from '../../model/court.ts';
import { COURT_LINE_WEIGHTS, type CourtLineVariant } from '../CourtSurface.tsx';

export interface HalfCourtLinesProps {
  variant: CourtLineVariant;
}

const DEF = COURT_DEFS.half;

export function HalfCourtLines({ variant }: HalfCourtLinesProps) {
  const w = COURT_LINE_WEIGHTS[variant];
  // ★ FullCourtLines 와 같은 이유로 좌표를 COURT_DEFS 에서 파생한다(리터럴 금지).
  const S = DEF.surface;
  const gz = DEF.ruleZones[0]!;

  // 골 십자: spotMarks 중심(250, 312.5)에서 dx=dy=3.5 로 벌린 X 표시 하나 — full 과 달리
  // variant 별 .5px 분기가 마크업에 없다(그대로 보존).
  const crossD = DEF.spotMarks.map(({ x, y }) => {
    const x1 = x - 3.5;
    const x2 = x + 3.5;
    const y1 = y - 3.5;
    const y2 = y + 3.5;
    return `M${x1},${y1} L${x2},${y2} M${x2},${y1} L${x1},${y2}`;
  });

  return (
    <>
      <g fill="none" stroke="#ffffff" strokeLinecap="butt">
        <path
          d={`M${S.x},${S.y} L${S.x},${S.y + S.h} L${S.x + S.w},${S.y + S.h} L${S.x + S.w},${S.y}`}
          strokeWidth={w.outline}
        />
        <line x1={S.x} y1={S.y} x2={S.x + S.w} y2={S.y} strokeWidth={w.outline} />
        {/* ⚠️ 여기 있던 **센터 서클 반원**(`A75,75`)을 지웠다 — 5.3/§9 결정 ⑧. 반지름 3 m 원은
            Laws 2025 에 없다(전문 50쪽에 "circle" 0회). 되돌리면 하프 코트 위쪽 변이 다시 일반
            축구의 센터 서클처럼 보인다. 대신 **센터 마크는 넣지 않는다** — 이 판에는 하프라인이
            없다(파일 머리말과 court.ts 의 `half.centerMark: null` 이 같은 근거를 적어 뒀다). */}
        {DEF.cornerCuts.map((d) => (
          <path key={d} d={d} strokeWidth={w.outline} />
        ))}
        {/* 5.2 — 인크로치먼트 마크. 골대가 하나뿐이라 **2개**다(풀은 4개). */}
        {DEF.encroachMarks.map((d) => (
          <path key={d} d={d} strokeWidth={w.outline} />
        ))}
        <path
          d={`M${gz.x},${S.y + S.h} L${gz.x},${gz.y} L${gz.x + gz.w},${gz.y} L${gz.x + gz.w},${S.y + S.h}`}
          strokeWidth={w.goalArea}
        />
      </g>
      {w.goalCross !== undefined && (
        <g fill="none" stroke="#ffffff" strokeWidth={w.goalCross} strokeLinecap="round">
          {crossD.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      )}
      {w.spotR !== undefined && (
        <g fill="#f5f5f5" stroke="#c2410c" strokeWidth={w.spotSw}>
          {/* 편집기에서는 골대가 물리 바디라 ObjectLayer 가 그린다(§5.4) — 여기 정적 원을
              같이 그리면 원위치 표시와 실제 골대가 겹쳐 두 개로 보인다. */}
          {(variant === 'editor' ? [] : DEF.goalPosts).map((p) => (
            <circle key={`${p.x},${p.y}`} cx={p.x} cy={p.y} r={w.spotR} />
          ))}
        </g>
      )}
    </>
  );
}
