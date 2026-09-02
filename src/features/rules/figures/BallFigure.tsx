// 제2조(공) 도해 — 2026-08-21 기현님 지시("2조에서는 공이 주인공이어서 크기나 구조를
// 시각적으로 나타내야 한다")로 신설.
//
// 한 장이다 — 크기. Laws 본문에는 없고 FIPFA 장비 규격에 있는 값(지름 33cm). 숫자만 적으면
// 감이 안 오므로 **축구공 5호와 같은 축척으로 나란히** 세워 눈으로 재게 한다.
//
// 🪦 2026-09-03: 둘째 장(공기압 — 낮음·알맞음·높음 3칸, 체어 옆모습 셋)을 지웠다. 기현 지시
//    *"공기압 어쩌구도 패널 삭제"*. 같은 날 장비 도해·거리 도해의 체어도 같은 판정(조악하다)으로
//    빠졌고, 이로써 체어 옆모습 글리프(PowerchairGlyph)는 호출자가 0이 되어 파일째 지웠다.
//    공기압 조건("지나치게 튀지 않되 체어가 타고 넘지 못할")은 카드 3 [공] 산문이 그대로 말한다.
//
// **수치는 손으로 적지 않는다.** 지름은 `BALL.diameterM`(물리 엔진이 쓰는 바로 그 상수)에서
// 파생시킨다 — 규칙 문서와 시뮬레이션이 같은 공을 가리킨다는 사실이 도해에서 증명된다.
// 비교 대상인 축구공만 외부 수치이고, 출처를 상수 옆에 적어 둔다.
//
// 강제색(Windows 고대비) 대응은 `FigureCard.tsx` 머리말 참고 — 색이 전부 치환돼도 치수선·
// 라벨·모양만으로 읽히게 그렸다.
import { BALL } from '../../../core/constants.ts';
import { BALL_FILL } from '../../../core/colors.ts';
import { FigureCard } from './FigureCard.tsx';
import { figureTextFor } from './text.ts';
import { useLocale } from '../../../i18n/useLocale.ts';

/** 33 — 물리 상수에서 파생. `BALL.diameterM` 이 바뀌면 도해와 캡션이 함께 따라온다.
 *  (0.33 * 100 은 부동소수라 33.000000000000004 다. 반올림이 필수.) */
const BALL_CM = Math.round(BALL.diameterM * 100);
/** 축구공 5호 지름. IFAB Laws of the Game Law 2 는 **둘레** 68~70cm 로 정하므로
 *  지름은 21.7~22.3cm — 그 가운데를 잡아 22 로 적는다(외부 수치, 파생 불가). */
const SOCCER5_CM = 22;

/** 도해 ①의 축척. 33cm 공이 카드 안에서 시원하게 서는 크기로 잡았다. */
const PX_PER_CM = 6.4;

const R_BALL = (BALL_CM * PX_PER_CM) / 2; // 105.6
const R_SOCCER = (SOCCER5_CM * PX_PER_CM) / 2; // 70.4

const FLOOR_Y = 252;
const BALL_CX = 18 + R_BALL;
const BALL_CY = FLOOR_Y - R_BALL;
const SOCCER_CX = BALL_CX + R_BALL + 16 + R_SOCCER;
const SOCCER_CY = FLOOR_Y - R_SOCCER;

const SIZE_VB_W = 400;
const SIZE_VB_H = 306;

const LINE = 'var(--border-strong)';
const DIM = 'var(--muted)';
const FAINT = 'var(--faint-text)';

/** 치수선 한 벌 — 양끝 화살촉 + 보조선. `<marker>` 대신 path 로 그린다(같은 페이지에 도해가
 *  여럿 뜨면 marker id 가 충돌한다). */
function DimLine({ x0, x1, y, label, extendTo }: { x0: number; x1: number; y: number; label: string; extendTo: number }) {
  const head = 5.5;
  return (
    <g>
      {/* 보조선 두 개 — 공의 좌우 접선 위치를 치수선까지 끌어 올린다(제도 관례).
          `extendTo` 는 접점의 y(=공의 중심 높이)다. 파선이 아니라 **가는 실선**이다:
          비교용 축구공을 파선 원으로 그려 뒀는데 보조선까지 파선이면 둘이 엉겨 붙는다. */}
      <line x1={x0} y1={y} x2={x0} y2={extendTo} stroke={FAINT} strokeWidth={0.9} opacity={0.55} />
      <line x1={x1} y1={y} x2={x1} y2={extendTo} stroke={FAINT} strokeWidth={0.9} opacity={0.55} />
      <line x1={x0} y1={y} x2={x1} y2={y} stroke={DIM} strokeWidth={1.4} />
      <path d={`M ${x0} ${y} l ${head} ${-head * 0.62} l 0 ${head * 1.24} Z`} fill={DIM} />
      <path d={`M ${x1} ${y} l ${-head} ${-head * 0.62} l 0 ${head * 1.24} Z`} fill={DIM} />
      <text x={(x0 + x1) / 2} y={y - 8} textAnchor="middle" fontSize={14} fontWeight={700} fill={DIM}>
        {label}
      </text>
    </g>
  );
}

function BallSizeFigure() {
  const T = figureTextFor(useLocale());
  return (
    <svg
      viewBox={`0 0 ${SIZE_VB_W} ${SIZE_VB_H}`}
      width="100%"
      height="100%"
      role="img"
      aria-label={T.ball.sizeAria(BALL_CM, SOCCER5_CM)}
    >
      {/* 바닥선 — 두 공이 같은 바닥에 서 있어야 크기 차이가 눈으로 읽힌다 */}
      <line x1={8} y1={FLOOR_Y} x2={SIZE_VB_W - 8} y2={FLOOR_Y} stroke={LINE} strokeWidth={1.5} />

      {/* 축구공 5호 — 채우지 않고 파선 윤곽으로 둔다. "이건 비교용 참고물이지 경기구가 아니다" */}
      <circle cx={SOCCER_CX} cy={SOCCER_CY} r={R_SOCCER} fill="var(--panel)" stroke={DIM} strokeWidth={1.8} strokeDasharray="6 4" />
      <text x={SOCCER_CX} y={SOCCER_CY - 4} textAnchor="middle" fontSize={13} fontWeight={600} fill={DIM}>
        {T.ball.soccerName}
      </text>
      <text x={SOCCER_CX} y={SOCCER_CY + 15} textAnchor="middle" fontSize={12} fill={FAINT}>
        {T.ball.soccerSize}
      </text>

      {/* 경기구 — 보드 위의 공과 같은 색(BALL_FILL)·같은 흰 테두리라 "판에서 보던 그 공"으로 읽힌다 */}
      <circle cx={BALL_CX} cy={BALL_CY} r={R_BALL} fill={BALL_FILL} stroke="#fff" strokeWidth={2.6} />
      <text x={BALL_CX} y={BALL_CY - 4} textAnchor="middle" fontSize={16} fontWeight={700} fill="#1a1206">
        {T.ball.matchBallName}
      </text>
      <text x={BALL_CX} y={BALL_CY + 18} textAnchor="middle" fontSize={13} fontWeight={600} fill="#1a1206" opacity={0.78}>
        {T.ball.matchBallSub}
      </text>

      <DimLine x0={BALL_CX - R_BALL} x1={BALL_CX + R_BALL} y={28} extendTo={BALL_CY} label={`${BALL_CM}cm`} />
      <DimLine x0={SOCCER_CX - R_SOCCER} x1={SOCCER_CX + R_SOCCER} y={SIZE_VB_H - 14} extendTo={SOCCER_CY} label={T.ball.approx(SOCCER5_CM)} />
    </svg>
  );
}

export function BallFigure() {
  const T = figureTextFor(useLocale());
  return (
    <>
      <FigureCard
        title={T.ball.sizeCardTitle}
        aspect={`${SIZE_VB_W} / ${SIZE_VB_H}`}
        caption={T.ball.sizeCardCaption(BALL_CM, SOCCER5_CM)}
      >
        <BallSizeFigure />
      </FigureCard>
    </>
  );
}
