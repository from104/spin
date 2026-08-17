// §3.11 요약·썸네일. 카드 <svg> 는 courtDefFor(mode, size) 의 viewBox 를 그대로 쓰고
// preserveAspectRatio="xMidYMid meet" — 반응형 스케일은 SVG 자체(viewBox)에 맡기고 별도
// scale()/translate() 계산을 하지 않는다. (프로토타입 176–193행의 320×192 고정 픽셀 마크업이
// 이 방식과 scale(0.4) translate(0,-4) 로 완전히 동일함을 §3.11 이 역산 검증했다 —
// 즉 CourtSurface 를 네이티브 좌표로 그대로 그려도 결과가 같다.) CourtSurface 를 재사용한다.
//
// 색을 굽지 않는다 — thumb 은 ThumbSpec(model/thumb.ts) 의 색 없는 기하 요약만 담고,
// 팀 색은 호출부가 넘긴다(teamColors). model 전체가 아니라 thumb 타입에만 의존하기 위해
// TeamStyle(model/drill.ts)이 아니라 평범한 문자열 색 4개를 받는다.
import { courtDefFor, type CourtMode, type CourtSize } from '../model/court.ts';
import type { ThumbSpec } from '../model/thumb.ts';
import {
  COURT_BG,
  OBJ_STROKE,
  BALL_FILL,
  CONE_COLORS,
  ARROW_COLOR,
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
  /** §6.4 코트 크기 3단. 카드 썸네일·스텝 칩의 **가로세로비가 여기서 결정된다**(1.571 ·
   *  1.722 · 1.647). 빼먹으면 25×14 드릴의 사진만 30×18 비율 상자 안에서 찌그러진다. */
  size?: CourtSize;
  /** 없으면 빈 코트만 그린다(예: 코트 선택 전 카드 스켈레톤). */
  thumb?: ThumbSpec;
  teamColors?: ThumbTeamColors;
  className?: string;
  /** true 면 부모 상자를 절대배치로 꽉 채운다 — 호출부가 상자를 코트 비율로 잡아 두는
   *  판 걸이 카드(DrillCard, 2026-08-12)용. 기본 false(기존 호출부 무변화). */
  fill?: boolean;
  /** 글리프 배수. 기본 1(목록 카드). 더 작은 상자에 그리는 호출부가 키운다 — 스텝 칩은
   *  `CHIP_GLYPH_SCALE`. **좌표에는 곱하지 않는다**(THUMB_GLYPH 의 ⚠️). */
  glyphScale?: number;
}

/** 썸네일 글리프 크기(코트 좌표 단위). **축척이 아니라 읽히기 위한 값이다** — 판에서는 휠체어가
 *  37.5×25 px 차체(`ChairChip`)인데 여기서는 방향 없는 원 하나다. 그 원이 차폭(25)보다 훨씬
 *  작으면 카드에서 점 하나가 되고 44 px 스텝 칩에서는 **1 px 미만**이 된다(옛 값 6 = 지름 12 는
 *  칩에서 1.1 px 였다). 그래서 위치는 실축 그대로 두고 **글리프만 조금 과장한다**
 *  (기현님 지시 2026-08-17: *"섬네일 객체 표현이 약간 과장되어야 가독성이 좋아짐"*).
 *  공의 `viewRadiusPx`(7)가 물리 반지름(4.125)보다 큰 것과 같은 종류의 '의도된 괴리' 다
 *  (`core/constants.ts`).
 *
 *  ⚠️ **좌표는 과장하지 않는다.** 커지는 것은 글리프뿐이고, 개체가 놓인 자리는 판과 같은
 *  좌표계여야 한다 — 자리를 같이 부풀리면 썸네일이 다른 배치를 보여주는 그림이 된다. */
export const THUMB_GLYPH = {
  /** 차폭(`CHAIR.widthPx` 25)의 절반. 지름 24 라 원 하나가 차체 폭만하다. */
  chairR: 12,
  chairStroke: 1.6,
  /** 판의 공 시각 반지름(`BALL.viewRadiusPx` 7)보다 한 뼘 크다 — 공은 셋 중 가장 작은데
   *  가장 먼저 찾는 개체다. 흰색이라 어두운 코트에서 지름 1 px 도 보이긴 하지만, 칩에서
   *  '어디로 갔나' 를 읽으려면 그보다는 커야 한다. */
  ballR: 8,
  /** 판의 콘 시각 크기(`CONE.viewWidthPx` 10)보다 한 뼘 크다 — 콘은 셋 중 가장 작아 먼저 사라진다. */
  coneHalf: 6,
  coneStroke: 1.2,
  arrowW: 3.5,
} as const;

/** 44 px 스텝 칩용 배수. 칩(폭 ≈ 76 px)은 목록 카드(≈ 300 px)보다 4배 가까이 작게 그려지니
 *  같은 글리프를 쓰면 거기서 다시 1 px 대로 내려간다. 칩의 일은 '어느 스텝인가' 를 알려주는
 *  것이므로 겹쳐 보이는 쪽을 택한다 — 안 보이는 것보다 겹치는 것이 낫다. */
export const CHIP_GLYPH_SCALE = 1.6;

const coneTriangle = (x: number, y: number, h: number): string =>
  `M${x},${y - h} L${x + h},${y + h * 0.8} L${x - h},${y + h * 0.8} Z`;

export function CourtThumbnail({
  mode,
  size,
  thumb,
  teamColors = DEFAULT_TEAM_COLORS,
  className,
  fill = false,
  glyphScale = 1,
}: CourtThumbnailProps) {
  const g = glyphScale;
  const def = courtDefFor(mode, size);

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
      <CourtSurface mode={mode} size={size} variant="thumb" />
      {thumb && (
        // §3.5 렌더 레이어 순서: 코트면 → 격자 → 규칙존 → 콘 → 화살표 → 휠체어 → 공 → 메모.
        // 썸네일은 격자·규칙존·메모를 그리지 않으므로 콘 → 화살표 → 휠체어 → 공 순서만 지킨다.
        <g>
          {thumb.cones.map(([x, y, c], i) => (
            <path
              key={i}
              d={coneTriangle(x, y, THUMB_GLYPH.coneHalf * g)}
              fill={CONE_COLORS[c]}
              stroke={OBJ_STROKE}
              strokeWidth={THUMB_GLYPH.coneStroke * g}
            />
          ))}
          {thumb.arrows.map((a, i) => (
            <path
              key={i}
              d={`M${a.p[0]},${a.p[1]} Q${a.p[2]},${a.p[3]} ${a.p[4]},${a.p[5]}`}
              fill="none"
              // 저장된 것은 색이 아니라 첨자다(model/thumb.ts). 범위 밖·없음은 기본색으로
              // 접는다 — 옛 요약(첨자 필드가 생기기 전)이 정확히 그 경우다.
              stroke={ARROW_COLORS[a.c ?? 0] ?? ARROW_COLOR}
              strokeWidth={THUMB_GLYPH.arrowW * g}
              strokeLinecap="round"
            />
          ))}
          {thumb.chairs.map((c, i) => (
            <circle
              key={i}
              cx={c.x}
              cy={c.y}
              r={THUMB_GLYPH.chairR * g}
              fill={c.g === 1 ? (c.t === 0 ? teamColors.homeGk : teamColors.awayGk) : c.t === 0 ? teamColors.home : teamColors.away}
              stroke={OBJ_STROKE}
              strokeWidth={THUMB_GLYPH.chairStroke * g}
            />
          ))}
          {thumb.balls.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={THUMB_GLYPH.ballR * g} fill={BALL_FILL} />
          ))}
        </g>
      )}
    </svg>
  );
}
