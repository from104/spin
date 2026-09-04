// 카드 2 `goal-height` — 골라인을 **옆에서 자른 단면**(2026-09-03 신설, 같은 날 재작도).
//
// 재작도의 근거 둘.
//  ① 기현님 지시(2026-09-03): *"카드 2에 골 기준 뜬 공 바로 옆에 골대 그림 있어야"*,
//     그리고 골대 실물은 *"경기장 라인 두께의 파이프, 높이 150cm, 아래로부터 50cm 위치에 표시"*.
//     크로스바가 없는 골대에서 **위쪽 경계를 대신 지는 것이 기둥의 그 표시**다. 표시를 안 그리면
//     50.8cm 한계선이 허공에 뜬 눈금이 되어 "무엇의 높이인가"에 답을 못 한다.
//  ② 검수 must — 옛 그림은 ✓(굴러서 골) 공을 골라인 **왼쪽**(138), ✕(떠서 골 아님) 공만 오른쪽
//     (262)에 놓았다. 그러면 그림이 "넘은 쪽에 있는 건 골이 아닌 공뿐"이라고 말해 규칙을 공간적으로
//     뒤집는다. 두 공은 **둘 다 골라인을 넘은 쪽**에 있어야 한다 — 넘었다는 사실은 같고 다른 것은
//     높이뿐이라는 게 Law 10 의 주장이기 때문이다. 지금은 둘 다 기둥 오른쪽에 선다.
//
// 정본: docs/RULES-FIPFA-2025.md:179-180 (Law 10), Law 1 ⬆(골대 규격).
//
// 그림의 주장: "같은 공, 같은 축척, 높이만 다르다." 기둥 높이(150cm)·표시 높이(50cm)·한계선
// (50.8cm)·공 지름(33cm)이 **한 축척(PX_PER_CM)** 에서 나온다. 수치 리터럴은 `LAW.*` ·
// `BALL.diameterM` 에서만 온다(인치는 M_PER_INCH 환산, 반올림은 라벨에서만).
//
// **표시 = 판정 눈금.** 기둥의 표시는 바닥에서 50cm(70px), 한계선은 50.8cm(71.12px) — 화면에서
// 1.1px 차이다. 이 근접은 사고가 아니라 이 그림이 말하려는 바다: 규정이 정한 뜬 공의 한계가 곧
// 심판이 기둥에서 눈으로 읽는 그 표시다. 그래서 한계 파선을 **기둥의 표시에서** 뻗어 나가게 그린다.
//
// 축척을 2 → 1.4 로 낮춘 이유: 기둥 150cm 가 들어가야 한다. 옛 축척이면 기둥만 300px 이라
// 바닥 아래 두 줄(라벨·판정 배지)까지 400px 을 넘어 카드가 세로로 길어진다. 1.4 에서는
// 기둥 210px + 바닥 위 여백 20 + 바닥 아래 94 = 324 로 형제 도해와 같은 높이대에 든다.
//
// 좌표 계산:
//  · 바닥 y=230, 기둥 꼭대기 y=230-210=20. 기둥 x=96 — 왼쪽에 세로 치수선(52)과 그 보조선이 설
//    자리를 두고, 오른쪽에 공 둘 + 판정 배지 두 벌이 들어갈 폭을 남긴 값이다.
//  · 한계선 y=230-71.12=158.88, 기둥 표시 y=230-70=160.
//  · 뜬 공 ✕ — 지시대로 **기둥 바로 옆**. 왼끝이 기둥에서 8px → 중심 96+8+23.1=127.1.
//    밑면은 한계선 위 8px(중심 158.88-23.1-8=127.78) — 닿게 그리면 "걸치면 골?"로 읽힌다.
//  · 굴러가는 공 ✓ — 바닥에 붙어 x=250. 두 공 중심 간격 122.9px 은 판정 배지 두 벌이 안 부딪히는
//    최소값에서 나왔다: 최장 표제 ja '転がって越えれば'(8자×12.5≈100px)가 250 중앙이면 200~300,
//    '浮いて越えれば'(≈88px)가 127.1 중앙이면 83~171 — 29px 벌어진다.
//  · 골라인 라벨(기둥 발치, y=246)과 판정 표제(y=cy+30=292)는 **다른 줄**이다. 배지 원(cy=262,
//    r=11)의 위끝 251 이 11px 라벨의 아래끝(≈247)보다 아래여서 같은 줄에서 부딪히지 않는다.
//
// 안 그리는 것과 이유:
//  · **궤적·포물선·화살표** — 산문은 "공은 띄우기 어렵다"는 쪽인데 날아가는 선을 그리면 뜬 공이
//    흔한 일처럼 보인다. 이 그림은 두 상태의 대비지 동작 묘사가 아니다.
//  · **옛 골라인 파선** — 기둥이 곧 골라인이다. 파선을 남기면 기둥과 두 겹이 되어 "선이 둘"로 읽힌다.
//  · **크로스바** — 없는 것이 규칙의 요지다. 기둥 꼭대기가 열려 있는 그림 자체가 그 말을 한다.
//  · **코트 평면·골 지역·체어·사람** — 평면 판정은 `purpose-goal` 장면 예약분이고, 단면에 체어
//    옆모습을 얹었다 세 번 다 잘렸다(DistanceFigure 묘비 참조).
//  · **Law 9(:168)의 같은 50.8cm** — 위험할 때만 아웃이라는 다른 조항이다. 그림은 Law 10 만 진다.
//
// 선 색 규약: 의미를 지는 바닥선·기둥·한계선·공 테두리는 var(--muted), 기둥의 표시만 var(--text)
// (판정 눈금이라 제일 진하다), 위치만 짚는 라벨은 var(--faint-text). 두 공은 **같은 색**이고
// 위계는 불투명도로 준다 — 고대비 모드에서 muted 와 faint-text 가 같은 색으로 접히기 때문에
// 색으로 나눈 위계는 거기서 사라진다. halo 는 선이 글자를 지나는 라벨에만 쓰는데, 한계 파선은
// '50.8cm' 라벨 아래를 지나므로 여기도 halo 가 없다.
import { FigureCard } from './FigureCard.tsx';
import { Verdict } from './Verdict.tsx';
import { figureTextFor } from './text.ts';
import { useLocale } from '../../../i18n/useLocale.ts';
import { LAW } from '../ruleConstants.ts';
import { BALL } from '../../../core/constants.ts';

/** 이 도해 전용 축척(px/cm). 코트 좌표계(units.ts 의 25px/m)와 무관하다 — 단면은 코트 위가 아니다.
 *  1.4 인 이유는 머리말 참조(기둥 150cm 를 담아야 한다). */
const PX_PER_CM = 1.4;
/** 단위 환산 상수(규정 수치가 아니다). 정본이 50.8cm 와 20in 를 함께 적으므로 라벨도 둘을 문다. */
const M_PER_INCH = 0.0254;

// 표시용 수치 — 반올림은 **라벨에서만** 한다(그림 치수는 아래처럼 원본 미터에서 바로 뽑는다).
const LIMIT_CM = Math.round(LAW.liftedBallM * 1000) / 10;
const LIMIT_IN = Math.round(LAW.liftedBallM / M_PER_INCH);
const BALL_CM = Math.round(BALL.diameterM * 1000) / 10;

/** 그림 치수 — 한 축척에서 나온 네 길이. 앞 둘의 비가 곧 규정의 비다(RuleFigure.test.tsx 가 잰다). */
const LIMIT_H = LAW.liftedBallM * 100 * PX_PER_CM; // 71.12
const BALL_D = BALL.diameterM * 100 * PX_PER_CM; // 46.2
const BALL_R = BALL_D / 2;
const POST_H = LAW.goalPostHeightM * 100 * PX_PER_CM; // 210
const MARK_H = LAW.goalPostMarkM * 100 * PX_PER_CM; // 70

const VB_W = 460;
/** 판정 부제 baseline(309) + 디센더 여유. 바닥 아래 두 줄을 다 담는 높이다. */
const VB_H = 324;

const X_LEFT = 40;
const X_RIGHT = 440;
/** 골라인 = 기둥. 왼쪽에 세로 치수선이 설 자리를 비워 둔다. */
const X_POST = 96;

const FLOOR_Y = 230;
const POST_TOP_Y = FLOOR_Y - POST_H; // 20
const MARK_Y = FLOOR_Y - MARK_H; // 160
const LIMIT_Y = FLOOR_Y - LIMIT_H; // 158.88
/** 기둥을 가로지르는 표시 띠의 반폭. */
const MARK_HALF = 5;
/** 바닥 아래 첫 줄(바닥·골라인 라벨). 둘째 줄은 판정 배지가 쓴다. */
const SUB_LABEL_Y = FLOOR_Y + 16;

/** 뜬 공 — 기둥 바로 옆(왼끝이 기둥에서 8px), 밑면이 한계선 위 8px. */
const BALL_GAP = 8;
const X_BALL_NO = X_POST + BALL_GAP + BALL_R; // 127.1
const Y_BALL_NO = LIMIT_Y - BALL_R - BALL_GAP; // 127.78
/** 굴러가는 공 — 바닥에 붙는다. x 는 판정 배지 두 벌의 간격에서 나온 값(머리말). */
const X_BALL_OK = 250;
const Y_BALL_OK = FLOOR_Y - BALL_R; // 206.9

/** 판정 배지 중심 — 첫 줄 라벨(246) 아래. 표제·부제는 Verdict 기본 간격(30/47)대로 292·309. */
const VERDICT_CY = 262;

/** 세로 치수선의 x — 바닥선 왼끝(40)과 기둥(96) 사이. */
const DIM_X = 52;
const DIM_HEAD = 5.5;

const DIM = 'var(--muted)';
const FAINT = 'var(--faint-text)';
const INK = 'var(--text)';
const FILL = 'color-mix(in srgb, var(--accent) 18%, transparent)';

/** 바닥↔한계선 세로 치수선. `<marker>` 대신 인라인 path 로 화살촉을 그린다(한 카드에 도해가
 *  여럿 뜨면 id 가 충돌한다 — BallFigure.DimLine 과 같은 이유·같은 화살촉 비율).
 *  라벨은 달지 않는다: 글자를 세로로 눕히면 못 읽고, 높이 수치는 한계선 옆 라벨이 이미 진다.
 *  보조선은 **파선**이다 — 실선으로 그으면 한계 파선이 왼쪽으로 이어지는 것처럼 보여, 한계가
 *  골라인 바깥(넘지 않은 쪽)까지 뻗는다는 없는 말을 하게 된다. */
function HeightDim() {
  return (
    <g>
      <line
        x1={DIM_X - 8}
        y1={LIMIT_Y}
        x2={X_POST}
        y2={LIMIT_Y}
        stroke={FAINT}
        strokeWidth={0.9}
        strokeDasharray="2 3"
        opacity={0.55}
      />
      <line x1={DIM_X} y1={LIMIT_Y} x2={DIM_X} y2={FLOOR_Y} stroke={DIM} strokeWidth={1.4} />
      <path
        d={`M ${DIM_X} ${LIMIT_Y} l ${-DIM_HEAD * 0.62} ${DIM_HEAD} l ${DIM_HEAD * 1.24} 0 Z`}
        fill={DIM}
      />
      <path
        d={`M ${DIM_X} ${FLOOR_Y} l ${-DIM_HEAD * 0.62} ${-DIM_HEAD} l ${DIM_HEAD * 1.24} 0 Z`}
        fill={DIM}
      />
    </g>
  );
}

export function GoalHeightFigure() {
  const T = figureTextFor(useLocale()).goalHeight;
  return (
    <FigureCard title={T.title(LIMIT_CM)} aspect={`${VB_W} / ${VB_H}`} caption={T.caption}>
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        width="100%"
        height="100%"
        role="img"
        aria-label={T.aria(LIMIT_CM, BALL_CM)}
      >
        {/* 바닥 — 이 그림의 기준선이라 실선 var(--muted). */}
        <line x1={X_LEFT} y1={FLOOR_Y} x2={X_RIGHT} y2={FLOOR_Y} stroke={DIM} strokeWidth={2} />
        <text x={X_RIGHT} y={SUB_LABEL_Y} textAnchor="end" fontSize={11} fill={FAINT}>
          {T.floor}
        </text>

        {/* 골대 기둥 — 골라인 위에 선 파이프. 굵기를 바닥선과 같게 준 것이 "경기장 라인 두께의
            파이프"라는 규격의 표현이다. 꼭대기가 열려 있는 것이 곧 "크로스바 없음". */}
        <line
          x1={X_POST}
          y1={POST_TOP_Y}
          x2={X_POST}
          y2={FLOOR_Y}
          stroke={DIM}
          strokeWidth={2}
          strokeLinecap="round"
        />
        {/* 기둥의 표시 — 이 그림에서 제일 진한 선. 한계 파선이 여기서 출발한다. */}
        <line
          x1={X_POST - MARK_HALF}
          y1={MARK_Y}
          x2={X_POST + MARK_HALF}
          y2={MARK_Y}
          stroke={INK}
          strokeWidth={3}
        />
        <text x={X_POST} y={SUB_LABEL_Y} textAnchor="middle" fontSize={11} fill={FAINT}>
          {T.goalLine}
        </text>

        {/* 한계선 — 기둥의 표시에서 오른쪽(넘은 쪽)으로만 뻗는 굵은 파선. data-limit-h 는
            검사표가 '한계선 높이 : 공 지름' 을 재는 자리다(RuleFigure.test.tsx). */}
        <line
          data-limit-h={LIMIT_H}
          x1={X_POST}
          y1={LIMIT_Y}
          x2={X_RIGHT}
          y2={LIMIT_Y}
          stroke={DIM}
          strokeWidth={2}
          strokeDasharray="7 5"
        />
        <text x={X_RIGHT - 4} y={LIMIT_Y - 6} textAnchor="end" fontSize={14} fontWeight={700} fill={INK}>
          {T.limit(LIMIT_CM, LIMIT_IN)}
        </text>
        <HeightDim />

        {/* ① 한계선 위로 뜬 공 — 기둥 바로 옆(기현님 지시). 채움 없이 흐리게: 파선으로 그리면
            '없는 공'으로 읽히고, 채우면 ②와 같은 자격처럼 보인다. */}
        <circle
          data-ball="lifted"
          cx={X_BALL_NO}
          cy={Y_BALL_NO}
          r={BALL_R}
          fill="none"
          stroke={DIM}
          strokeWidth={1.6}
          opacity={0.65}
        />

        {/* ② 바닥을 구르는 공 — 같은 지름, 같은 넘은 쪽, 높이만 다르다. 지름 라벨은 원 안 중앙
            (선이 지나지 않아 halo 없음). */}
        <circle
          data-ball="grounded"
          cx={X_BALL_OK}
          cy={Y_BALL_OK}
          r={BALL_R}
          fill={FILL}
          stroke={DIM}
          strokeWidth={1.6}
        />
        <text x={X_BALL_OK} y={Y_BALL_OK + 3.4} textAnchor="middle" fontSize={10} fill={INK}>
          {T.ballDia(BALL_CM)}
        </text>

        <Verdict cx={X_BALL_NO} cy={VERDICT_CY} ok={false} head={T.noHead} tail={T.noTail} />
        <Verdict cx={X_BALL_OK} cy={VERDICT_CY} ok head={T.okHead} tail={T.okTail} />
      </svg>
    </FigureCard>
  );
}
