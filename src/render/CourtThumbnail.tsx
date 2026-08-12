// §3.11 요약·썸네일. 카드 <svg> 는 COURT_DEFS[mode] 의 viewBox 를 그대로 쓰고
// preserveAspectRatio="xMidYMid meet" — 반응형 스케일은 SVG 자체(viewBox)에 맡기고 별도
// scale()/translate() 계산을 하지 않는다. (프로토타입 176–193행의 320×192 고정 픽셀 마크업이
// 이 방식과 scale(0.4) translate(0,-4) 로 완전히 동일함을 §3.11 이 역산 검증했다 —
// 즉 CourtSurface 를 네이티브 좌표로 그대로 그려도 결과가 같다.) CourtSurface 를 재사용한다.
//
// 색을 굽지 않는다 — thumb 은 ThumbSpec(model/thumb.ts) 의 색 없는 기하 요약만 담고,
// 팀 색은 호출부가 넘긴다(teamColors). model 전체가 아니라 thumb 타입에만 의존하기 위해
// TeamStyle(model/drill.ts)이 아니라 평범한 문자열 색 4개를 받는다.
import { COURT_DEFS, type CourtMode } from '../model/court.ts';
import type { ThumbSpec } from '../model/thumb.ts';
import {
  COURT_BG,
  OBJ_STROKE,
  BALL_FILL,
  CONE_COLORS,
  ARROW_COLORS,
  TEAM_COLOR_CHOICES,
  GK_HOME_COLOR,
  GK_AWAY_COLOR,
} from '../core/colors.ts';
import { CourtSurface } from './CourtSurface.tsx';

export interface ThumbTeamColors {
  home: string;
  away: string;
  homeGk: string;
  awayGk: string;
}

const DEFAULT_TEAM_COLORS: ThumbTeamColors = {
  home: TEAM_COLOR_CHOICES[0],
  away: TEAM_COLOR_CHOICES[1],
  homeGk: GK_HOME_COLOR,
  awayGk: GK_AWAY_COLOR,
};

export interface CourtThumbnailProps {
  mode: CourtMode;
  /** 없으면 빈 코트만 그린다(예: 코트 선택 전 카드 스켈레톤). */
  thumb?: ThumbSpec;
  teamColors?: ThumbTeamColors;
  className?: string;
  /** true 면 부모 상자를 절대배치로 꽉 채운다 — 호출부가 상자를 코트 비율로 잡아 두는
   *  판 걸이 카드(DrillCard, 2026-08-12)용. 기본 false(기존 호출부 무변화). */
  fill?: boolean;
}

const coneTriangle = (x: number, y: number): string => `M${x},${y - 5} L${x + 5},${y + 4} L${x - 5},${y + 4} Z`;

export function CourtThumbnail({ mode, thumb, teamColors = DEFAULT_TEAM_COLORS, className, fill = false }: CourtThumbnailProps) {
  const def = COURT_DEFS[mode];

  return (
    <svg
      viewBox={`0 0 ${def.vbW} ${def.vbH}`}
      preserveAspectRatio="xMidYMid meet"
      className={className}
      style={fill ? { position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' } : undefined}
      role="img"
      aria-label={`${def.label} 미리보기`}
    >
      <rect width={def.vbW} height={def.vbH} rx={14} fill={COURT_BG} />
      <CourtSurface mode={mode} variant="thumb" />
      {thumb && (
        // §3.5 렌더 레이어 순서: 코트면 → 격자 → 규칙존 → 콘 → 화살표 → 휠체어 → 공 → 메모.
        // 썸네일은 격자·규칙존·메모를 그리지 않으므로 콘 → 화살표 → 휠체어 → 공 순서만 지킨다.
        <g>
          {thumb.cones.map(([x, y, c], i) => (
            <path key={i} d={coneTriangle(x, y)} fill={CONE_COLORS[c]} stroke={OBJ_STROKE} strokeWidth={1} />
          ))}
          {thumb.arrows.map((a, i) => (
            <path
              key={i}
              d={`M${a.p[0]},${a.p[1]} Q${a.p[2]},${a.p[3]} ${a.p[4]},${a.p[5]}`}
              fill="none"
              stroke={ARROW_COLORS[a.k]}
              strokeWidth={2}
              strokeLinecap="round"
            />
          ))}
          {thumb.chairs.map((c, i) => (
            <circle
              key={i}
              cx={c.x}
              cy={c.y}
              r={6}
              fill={c.g === 1 ? (c.t === 0 ? teamColors.homeGk : teamColors.awayGk) : c.t === 0 ? teamColors.home : teamColors.away}
              stroke={OBJ_STROKE}
              strokeWidth={1.2}
            />
          ))}
          {thumb.balls.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={4} fill={BALL_FILL} />
          ))}
        </g>
      )}
    </svg>
  );
}
