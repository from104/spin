// 하프 코트 라인. template.html 285–303행(editor)·441–459행(present) 마크업을 좌표 그대로
// 이식하고 굵기만 variant 로 분기한다. 센터점(circle fill white)은 하프 마크업에 없다 — 추가하지 않는다.
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
        <path d="M25,25 L25,400 L475,400 L475,25" strokeWidth={w.outline} />
        <line x1={25} y1={25} x2={475} y2={25} strokeWidth={w.outline} />
        <path d="M175,25 A75,75 0 0 0 325,25" strokeWidth={w.outline} />
        {DEF.cornerCuts.map((d) => (
          <path key={d} d={d} strokeWidth={w.outline} />
        ))}
        <path d="M150,400 L150,275 L350,275 L350,400" strokeWidth={w.goalArea} />
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
