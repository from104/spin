// 하프 코트 라인. template.html 285–303행(editor)·441–459행(present) 마크업을 좌표 그대로
// 이식하고 굵기만 variant 로 분기한다. 센터점(circle fill white)은 하프 마크업에 없다 — 추가하지 않는다.
import { COURT_LINE_WEIGHTS, type CourtLineVariant } from '../CourtSurface.tsx';

export interface HalfCourtLinesProps {
  variant: CourtLineVariant;
}

export function HalfCourtLines({ variant }: HalfCourtLinesProps) {
  const w = COURT_LINE_WEIGHTS[variant];

  return (
    <>
      <g fill="none" stroke="#ffffff" strokeLinecap="butt">
        <path d="M25,25 L25,400 L475,400 L475,25" strokeWidth={w.outline} />
        <line x1={25} y1={25} x2={475} y2={25} strokeWidth={w.outline} />
        <path d="M175,25 A75,75 0 0 0 325,25" strokeWidth={w.outline} />
        <path d="M25,375 L50,400" strokeWidth={w.outline} />
        <path d="M450,400 L475,375" strokeWidth={w.outline} />
        <path d="M150,400 L150,275 L350,275 L350,400" strokeWidth={w.goalArea} />
      </g>
      {w.goalCross !== undefined && (
        <g fill="none" stroke="#ffffff" strokeWidth={w.goalCross} strokeLinecap="round">
          <path d="M246.5,309 L253.5,316 M253.5,309 L246.5,316" />
        </g>
      )}
      {w.spotR !== undefined && (
        <g fill="#f5f5f5" stroke="#c2410c" strokeWidth={w.spotSw}>
          <circle cx={175} cy={400} r={w.spotR} />
          <circle cx={325} cy={400} r={w.spotR} />
        </g>
      )}
    </>
  );
}
