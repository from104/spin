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
import { NOTE_FILL, NOTE_FOLD_FILL } from '../core/colors.ts';
import { CourtSurface } from './CourtSurface.tsx';
import { ShapeLayer } from './ShapeLayer.tsx';
import {
  NOTE_DEFAULT_SIZE_PX,
  noteChipHeightPx,
  noteChipPathD,
  noteChipWidthPx,
  noteFoldPathD,
  noteLineDy,
  noteLines,
} from './objects/noteChip.ts';

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
  /** 글리프 배수. 기본 1(목록 카드). 더 작은 상자에 그리는 호출부가 키운다 — 스텝 사이드바
   *  카드는 `SIDEBAR_GLYPH_SCALE`. **좌표에는 곱하지 않는다**(THUMB_GLYPH 의 ⚠️). */
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
 *  좌표계여야 한다 — 자리를 같이 부풀리면 썸네일이 다른 배치를 보여주는 그림이 된다.
 *
 *  ⚠️ 값은 **차폭·판 크기의 2배 수준**이다(기현님 지시 2026-08-17 2차: *"2배는 더 커야함"*).
 *  1차(휠체어 r 12)로도 카드에서는 보였지만 칩에서 3.5 px 여서 여전히 '무엇이 어디' 가 아니라
 *  '점이 몇 개' 였다. */
export const THUMB_GLYPH = {
  /** 차폭(`CHAIR.widthPx` 25)의 두 배. 지름 48 = 약 2 m — 실물 차체(1.5×1.0 m)보다 크다. */
  chairR: 24,
  chairStroke: 3.2,
  /** 판의 공 시각 반지름(`BALL.viewRadiusPx` 7)의 두 배 남짓. 공은 가장 작은데 가장 먼저 찾는
   *  개체다 — 칩에서 '공이 어디로 갔나' 가 읽히는 것이 이 값의 목적이다. */
  ballR: 16,
  /** 판의 콘 시각 크기(`CONE.viewWidthPx` 10)의 두 배 이상 — 콘은 먼저 사라지는 쪽이다. */
  coneHalf: 12,
  coneStroke: 2.4,
  /** 판 화살표(`ARROW_STYLE.width` 3.4)의 두 배는 7 이었는데, 134px 카드에서 그건 화면
   *  2.3px 선이라 도형의 밝은 테두리·우윳빛 면 위를 지나면 묻혀 버렸다(기현님 지적
   *  2026-08-18: *"썸네일에서 도형에 화살표가 가려진다"* — z-순서는 판과 같이 화살표가
   *  위인데도 그랬다. 아래 shapeStroke 를 함께 줄였다). 11 이면 카드에서 ≈3.6px — 경로가
   *  선으로 읽힌다. */
  arrowW: 11,
  /** 작도 도형의 획 배수. 도형은 **면이 반투명**이라 덩어리로는 이미 보이고, 안 보이는 것은
   *  테두리(`SHAPE_STROKE_PX` 2 → 카드에서 0.7 px)다. 크기는 못 키운다 — 도형의 크기는
   *  사용자가 그린 구역 그 자체라서, 키우면 **없는 구역을 가르친다**.
   *  3 → 2 (2026-08-18): 배율 2.0 과 곱해지며 테두리가 12유닛(카드 ≈2px 흰 띠)까지 부풀어
   *  화살표(위 arrowW 주석)와 경합했다 — 도형은 조연이다. 8유닛(≈1.3px)이면 구역 경계로
   *  충분히 보인다. */
  shapeStroke: 2,
  /** 메모 글자 배수. 판 기본 14 px × 0.6 ≈ 8.4 → 목록 카드에서 **약 3 px** 이 된다
   *  (기현님 지시: *"메모(글자를 2~3px로) 등도 잡혀야지"*). 다른 글리프처럼 2배로 키우면
   *  쪽지가 코트 절반을 덮는다 — 쪽지 크기는 글자 크기에서 나오기 때문이다(`noteChip.ts`). */
  noteFontScale: 0.6,
} as const;

/** 스텝 사이드바 카드용 배수(2026-08-17 PLAN-STEP-EDITING.md 구현 순서 ② — TransportBar 의
 *  가로 칩 줄이 없어지고 왼쪽 세로 카드 목록이 그 자리를 대신한다).
 *
 *  StepSidebar.tsx 의 카드 폭은 `SIDEBAR_WIDTH_PX`(154) 에서 목록 좌우 패딩(`SIDEBAR_PAD_PX`
 *  10×2)을 뺀 **134 px** 다(2026-08-18 기현님 지시로 200 → 134, 카드 2/3). 기본 배수(1)로
 *  그리면 휠체어 지름이
 *    2 × THUMB_GLYPH.chairR(24) / vbW(825, 풀 코트) × 134 ≈ **7.8 px**
 *  로 줄어든다 — 목록 카드(≈300 px)에서 같은 식은 ≈17.5 px 다. 카드가 줄어든 만큼 배수로
 *  화면 크기를 지킨다: 1.4 시절 200 px 카드의 지름이 ≈15.3 px 였고(기현님이 실기로 승인한
 *  크기), 134 px 에서 같은 화면 크기를 내려면 1.4 × 200/134 ≈ **2.1** 이 필요하다. 2.0 으로
 *  반올림해 붐비는 스텝(여덟 명)에서 원끼리 닿는 여유를 조금 남긴다 — 지름 ≈15.6 px. */
export const SIDEBAR_GLYPH_SCALE = 2.0;

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
      {/* 도형은 **코트 위·개체 아래**다(기현 지시 2026-08-14, `ShapeLayer.tsx` 머리말).
          그리는 코드를 여기 옮겨 적지 않고 그 컴포넌트를 그대로 쓴다 — 반투명 값이 어긋난 날
          '카드만 진한' 판이 나오고, 그건 코트에서야 알게 된다. */}
      {thumb?.shapes && <ShapeLayer shapes={thumb.shapes} strokeScale={THUMB_GLYPH.shapeStroke * g} />}
      {thumb && (
        // §3.5 렌더 레이어 순서: 코트면 → 격자 → 규칙존 → 콘 → 화살표 → 휠체어 → 공 → 메모.
        // 썸네일은 격자·규칙존을 그리지 않으므로 콘 → 화살표 → 휠체어 → 공 → 메모 순서다.
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
          {/* 메모 = 종이 쪽지. 쪽지의 모양·줄바꿈은 `noteChip.ts` 가 판·인쇄·PNG 와 **같은
              함수**로 만든다 — 여기서 상자를 손으로 그리면 글자와 쪽지가 따로 자란다.
              빈 메모도 쪽지를 그린다: "여기 쪽지를 놓았다" 는 판의 사실이다(buildStaticSvg 와
              같은 근거). */}
          {thumb.notes?.map((n, i) => {
            const size = (n.s ?? NOTE_DEFAULT_SIZE_PX) * THUMB_GLYPH.noteFontScale * g;
            const halfW = noteChipWidthPx(n.t, size) / 2;
            const halfH = noteChipHeightPx(n.t, size) / 2;
            const lines = noteLines(n.t, size);
            const align = n.a ?? 'middle';
            const textX = align === 'start' ? -halfW + size * 0.4 : align === 'end' ? halfW - size * 0.4 : 0;
            return (
              <g key={i} transform={`translate(${n.x} ${n.y})`}>
                <path d={noteChipPathD(halfW, halfH)} fill={NOTE_FILL} stroke={OBJ_STROKE} strokeWidth={THUMB_GLYPH.coneStroke * g} strokeLinejoin="round" />
                <path d={noteFoldPathD(halfW, halfH)} fill={NOTE_FOLD_FILL} stroke={OBJ_STROKE} strokeWidth={THUMB_GLYPH.coneStroke * g} strokeLinejoin="round" />
                {lines.map((line, li) => (
                  <text
                    key={li}
                    x={textX}
                    y={noteLineDy(li, lines.length)}
                    // 판(`NoteLabel.tsx`)과 같은 서체·굵기다. 3 px 짜리 글자라도 서체가 달라지면
                    // 폭이 달라지고, 폭이 달라지면 쪽지 크기가 판과 어긋난다.
                    fontFamily="'Pretendard',sans-serif"
                    fontSize={size}
                    fontWeight={600}
                    fill={n.c ?? '#ffffff'}
                    textAnchor={align}
                    dominantBaseline="central"
                  >
                    {line}
                  </text>
                ))}
              </g>
            );
          })}
        </g>
      )}
    </svg>
  );
}
