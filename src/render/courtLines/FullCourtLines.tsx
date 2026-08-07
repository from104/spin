// 풀 코트 라인. template.html 259–279행(editor)·413–439행(present) 마크업을 좌표 그대로
// 이식하고 굵기만 variant 로 분기한다 — 좌표를 새로 만들지 않는다.
import { COURT_LINE_WEIGHTS, type CourtLineVariant } from '../CourtSurface.tsx';

export interface FullCourtLinesProps {
  variant: CourtLineVariant;
}

export function FullCourtLines({ variant }: FullCourtLinesProps) {
  const w = COURT_LINE_WEIGHTS[variant];
  // 골 십자 좌표는 editor 259행대와 present 413행대에서 .5px 차이가 난다 — 그대로 보존한다.
  const crossD =
    variant === 'present'
      ? ['M109,246.5 L116,253.5 M116,246.5 L109,253.5', 'M684,246.5 L691,253.5 M691,246.5 L684,253.5']
      : ['M109,247 L116,253 M116,247 L109,253', 'M684,247 L691,253 M691,247 L684,253'];

  return (
    <>
      <g fill="none" stroke="#ffffff" strokeLinecap="butt">
        <rect x={25} y={25} width={750} height={450} strokeWidth={w.outline} />
        <line x1={400} y1={25} x2={400} y2={475} strokeWidth={w.outline} />
        <circle cx={400} cy={250} r={75} strokeWidth={w.outline} />
        <path d="M25,50 L50,25" strokeWidth={w.outline} />
        <path d="M750,25 L775,50" strokeWidth={w.outline} />
        <path d="M775,450 L750,475" strokeWidth={w.outline} />
        <path d="M50,475 L25,450" strokeWidth={w.outline} />
        <path d="M25,150 L150,150 L150,350 L25,350" strokeWidth={w.goalArea} />
        <path d="M775,150 L650,150 L650,350 L775,350" strokeWidth={w.goalArea} />
      </g>
      <circle cx={400} cy={250} r={w.centerR} fill="#ffffff" />
      {w.goalCross !== undefined && (
        <g fill="none" stroke="#ffffff" strokeWidth={w.goalCross} strokeLinecap="round">
          <path d={crossD[0]} />
          <path d={crossD[1]} />
        </g>
      )}
      {w.spotR !== undefined && (
        <g fill="#f5f5f5" stroke="#c2410c" strokeWidth={w.spotSw}>
          <circle cx={25} cy={175} r={w.spotR} />
          <circle cx={25} cy={325} r={w.spotR} />
          <circle cx={775} cy={175} r={w.spotR} />
          <circle cx={775} cy={325} r={w.spotR} />
        </g>
      )}
    </>
  );
}
