// 카드 2 `match-clock` — 한 경기의 시간이 어떻게 흐르는지 한 줄 막대로(2026-09-03 신설).
//
// 산문은 "전반 20분, 하프타임 최대 10분, 후반 20분"을 문장으로 말하지만, 셋의 **길이 관계**는
// 문장으로 안 잡힌다. 그래서 세 칸을 실제 분수에 비례한 폭으로 나란히 눕힌다 — '최대 10분'이
// 20분처럼 보이면 그림이 거짓말을 하는 것이라, 폭은 전부 축척 하나(PX_PER_MIN)에서 파생한다.
//
// 정본: docs/RULES-FIPFA-2025.md:136(전·후반 각 20분, 사전 합의 시 변경 가능)·:137(하프타임
// 최대 10분)·:138(손실 시간은 각 피리어드에 보상)·:142(후반에 진영 교체, Law 8).
//
// 안 그리는 것: 연장전·승패 판정(정본 :143,:182) — 카드 2 범위 밖이고 산문이 맡는다. 코트
// 사각형·골 방향 삼각형도 안 그린다(진영 교체는 화살표 하나로 충분하고, 코트를 그리면 이
// 그림이 코트 도해인 줄 오해된다). 멈춘 시간 꼬리는 **고정 길이**라 축척 밖이다 — 정해진
// 추가 시간이 아니라 "그만큼 더"라는 뜻이므로 막대 폭에 넣지 않는다.
//
// 강제색(Windows 고대비) 대응은 `FigureCard.tsx` 머리말 참고 — 전·후반은 채움+실선, 하프타임은
// 채움 없는 굵은 파선이라 색이 전부 치환돼도 셋이 구분된다.
//
// 2026-09-03 검수 반영 — 되돌리기 쉬운 자리라 이유를 남긴다:
//  · 꼬리는 **파선이 아니라 점 3개 + 열린 화살촉**이다. 13px 남짓한 길이에 파선을 깔면
//    대시가 두어 개밖에 안 들어가 「- ->」 라는 글자 조각처럼 읽힌다. 점열은 길이가 짧아도
//    "이어짐"으로 읽힌다.
//  · 전·후반 테두리는 rect 가 아니라 **안쪽 변이 빠진 3변 path** 다. 세 칸을 맞붙인 rect 로
//    그리면 하프타임 파선 위에 이웃 rect 의 실선이 겹쳐, 하프타임 칸의 좌·우 변만 실선으로
//    보인다(= 상한 규약이 깨진다). 경계는 파선 쪽이 진다. 다만 채움용 rect 는 `data-seg` 를
//    달고 그대로 남긴다 — 검사표가 rect[data-seg] 의 width 로 비율을 재므로 path 로 바꾸면 안 된다.
//  · 킥오프·종료 라벨은 막대 **위** 양끝이다. 아래 줄에 두면 같은 줄의 '+ 멈춘 만큼'과
//    11px 로 맞붙는다(일본어 'キックオフ'/'+ 停止時間'에서 특히).
//  · halo 는 `--panel` 이 아니라 **`--panel-2`** — 도해 바닥은 FigureCard 의 panel-2 라서
//    panel 로 파면 라이트 테마에 흰 얼룩이 남는다. 선이 지나지 않는 라벨에는 halo 를 두지 않는다.
import { LAW } from '../ruleConstants.ts';
import { FigureCard } from './FigureCard.tsx';
import { figureTextFor } from './text.ts';
import { useLocale } from '../../../i18n/useLocale.ts';

const VB_W = 500;
const VB_H = 166;

/** 시간축이 차지하는 가로 폭과 왼쪽 여백 — 라벨(킥오프/종료)이 밖으로 안 튀게 30px 씩 남긴다. */
const AXIS_W = 420; // 2026-09-03 재검수: 440 이면 오른쪽 꼬리 끝이 490 — 좌 30 : 우 10 으로 그림이 오른쪽에 붙는다. 420 이면 좌우 30.
const X0 = 30;

/** 도해 전용 축척. 한 경기의 전체 분(전반+하프타임+후반)을 AXIS_W 에 꽉 채운다.
 *  세 칸의 폭은 전부 여기서 나온다 — 176·88·176 을 손으로 적지 않는다. */
const PX_PER_MIN = AXIS_W / (2 * LAW.halfMin + LAW.halftimeMaxMin);

const W_HALF = LAW.halfMin * PX_PER_MIN;
const W_HALFTIME = LAW.halftimeMaxMin * PX_PER_MIN;

const X_FIRST = X0;
const X_HALFTIME = X_FIRST + W_HALF;
const X_SECOND = X_HALFTIME + W_HALFTIME;
const X_END = X_SECOND + W_HALF;

/** 세로 자리. 위(잉크 시작 ≈23)·아래(≈23) 여백이 같도록 잡은 값들이라 하나만 움직이면 틀어진다.
 *  ROW1/ROW2 는 막대 위 두 줄이고, 하프타임 라벨과 진영 교체 라벨이 **같은 줄**을 쓴다. */
const ROW1_Y = 32;
const ROW2_Y = 47;
/** 진영 교체 화살표는 둘째 줄과 같은 높이 — 하프타임 둘째 줄 옆에 나란히 앉는다. */
const SWAP_Y = 48;
/** 리더 틱이 시작하는 높이 = 막대 위 양끝 라벨의 baseline. 두 줄 아래, 막대 위. */
const LEADER_TOP = 54;
/** 양끝 눈금은 막대 **위쪽만** 짧게 — 막대 아래는 DimLine 의 보조선이 이미 같은 x 를 내려간다. */
const END_TICK_TOP = 58;

const BAR_Y = 66;
const BAR_H = 30;
const BAR_BOTTOM = BAR_Y + BAR_H; // 96
const DIM_Y = 122;
const EXT_TO = 128;
const SUB_Y = 140;

/** 멈춘 시간 꼬리 — 시간 축척과 **무관한** 고정값(치수가 아니다). 점 4개, 화살촉 없음. */
const TAIL_DOTS = 4;
const TAIL_DOT_R = 1.2;
const TAIL_DOT_GAP = 5;

const DIM = 'var(--muted)';
const FAINT = 'var(--faint-text)';
const HALO = 'var(--panel-2)';
const FILL = 'color-mix(in srgb, var(--accent) 18%, transparent)';

/** 진영 교체 묶음의 가로 반폭과 중심. 중심을 후반 칸 한가운데에 두면 화살표 오른끝이 막대 위
 *  '종료' 라벨과 맞닿으므로, 그 라벨 자리를 비워 두고 왼쪽으로 당긴다. */
const SWAP_HALF_W = 30;
const SWAP_GUTTER = 84; // 화살표 오른끝 ~ X_END. 최장 라벨('Full time' 11px ≈ 50px) + 여백 25 — 74 면 en 에서 15px 로 붙어 한 묶음처럼 보였다.
const SWAP_CX = X_END - SWAP_GUTTER - SWAP_HALF_W;

/** 치수선 한 벌 — 양끝 채운 화살촉 + 막대에서 내려오는 보조 실선. `<marker>` 대신 path 로
 *  그린다(한 페이지에 도해가 여럿 뜨면 marker id 가 충돌한다). 보조선은 파선이 아니다 —
 *  하프타임 칸이 이미 파선이라 둘이 엉긴다. `BallFigure.DimLine` 과 같은 구성. */
function DimLine({ x0, x1, y, label }: { x0: number; x1: number; y: number; label: string }) {
  const head = 5.5;
  return (
    <g>
      <line x1={x0} y1={BAR_BOTTOM} x2={x0} y2={EXT_TO} stroke={FAINT} strokeWidth={0.9} opacity={0.55} />
      <line x1={x1} y1={BAR_BOTTOM} x2={x1} y2={EXT_TO} stroke={FAINT} strokeWidth={0.9} opacity={0.55} />
      <line x1={x0} y1={y} x2={x1} y2={y} stroke={DIM} strokeWidth={1.4} />
      <path d={`M ${x0} ${y} l ${head} ${-head * 0.62} l 0 ${head * 1.24} Z`} fill={DIM} />
      <path d={`M ${x1} ${y} l ${-head} ${-head * 0.62} l 0 ${head * 1.24} Z`} fill={DIM} />
      {/* 라벨은 치수선과 두 보조선이 둘러싼 칸 안에 앉는다 — 긴 번역에서는 보조선에 닿으므로
          halo 를 남긴다. 바탕은 FigureCard 의 panel-2 다. */}
      <text
        x={(x0 + x1) / 2}
        y={y - 7}
        textAnchor="middle"
        fontSize={13}
        fontWeight={700}
        fill={DIM}
        stroke={HALO}
        strokeWidth={4}
        strokeLinejoin="round"
        paintOrder="stroke"
      >
        {label}
      </text>
    </g>
  );
}

/** 치수선 오른쪽 끝에 붙는 "+ 멈춘 만큼" 꼬리 — 점 4개뿐이다. 흐린 보조 표시라 faint.
 *  처음엔 파선 + 열린 화살촉(「- ->」), 다음엔 점 3개 + 열린 화살촉(「···>」)이었다. 열린 화살촉을
 *  둔 근거는 "치수선의 채운 화살촉과 달라야 잰 길이가 아님이 읽힌다"였는데, 20px 안에서는 점과
 *  꺾쇠가 한 덩어리로 뭉쳐 '말줄임표 + 부등호' 글자 조각으로 보였다(2026-09-03 재검수). 방향은
 *  바로 아래 "+ 멈춘 만큼" 글이 말하므로 화살촉 없이 점만 남긴다 — 이어짐만 남고 오해는 없다. */
function StoppageTail({ x, y }: { x: number; y: number }) {
  const first = x + 5;
  return (
    <g>
      {Array.from({ length: TAIL_DOTS }, (_, i) => (
        <circle key={i} cx={first + i * TAIL_DOT_GAP} cy={y} r={TAIL_DOT_R} fill={FAINT} />
      ))}
    </g>
  );
}

export function MatchClockFigure() {
  const T = figureTextFor(useLocale());
  const c1 = X_FIRST + W_HALF / 2;
  const c2 = X_SECOND + W_HALF / 2;
  const cHt = X_HALFTIME + W_HALFTIME / 2;
  return (
    <FigureCard title={T.matchClock.title} aspect={`${VB_W} / ${VB_H}`} caption={T.matchClock.caption}>
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        width="100%"
        height="100%"
        role="img"
        aria-label={T.matchClock.aria(LAW.halfMin, LAW.halftimeMaxMin)}
      >
        {/* 채움만 하는 rect(테두리 없음). 검사표가 이 width 로 비율을 재므로 path 로 바꾸지 말 것. */}
        <rect data-seg="first" x={X_FIRST} y={BAR_Y} width={W_HALF} height={BAR_H} fill={FILL} stroke="none" />
        <rect data-seg="second" x={X_SECOND} y={BAR_Y} width={W_HALF} height={BAR_H} fill={FILL} stroke="none" />
        {/* 전·후반 테두리 — 하프타임과 맞닿는 안쪽 변을 뺀 3변. 경계선은 하프타임 파선이 진다. */}
        <path
          d={`M ${X_HALFTIME} ${BAR_Y} L ${X_FIRST} ${BAR_Y} L ${X_FIRST} ${BAR_BOTTOM} L ${X_HALFTIME} ${BAR_BOTTOM}`}
          fill="none"
          stroke={DIM}
          strokeWidth={1.6}
        />
        <path
          d={`M ${X_SECOND} ${BAR_Y} L ${X_END} ${BAR_Y} L ${X_END} ${BAR_BOTTOM} L ${X_SECOND} ${BAR_BOTTOM}`}
          fill="none"
          stroke={DIM}
          strokeWidth={1.6}
        />
        {/* 하프타임 — 채움 없는 굵은 파선 4변(=상한 규약). "최대 10분"이지 "10분"이 아니다. */}
        <rect data-seg="halftime" x={X_HALFTIME} y={BAR_Y} width={W_HALFTIME} height={BAR_H} fill="none" stroke={DIM} strokeWidth={1.6} strokeDasharray="7 5" />

        {/* 양끝 눈금 — 킥오프와 종료의 자리. 막대 위쪽만 짧게. */}
        <line x1={X0} y1={END_TICK_TOP} x2={X0} y2={BAR_Y} stroke={DIM} strokeWidth={1.2} />
        <line x1={X_END} y1={END_TICK_TOP} x2={X_END} y2={BAR_Y} stroke={DIM} strokeWidth={1.2} />

        {/* 킥오프·종료 — 막대 위 양끝. 선이 지나지 않는 자리라 halo 없이 둔다. */}
        <text x={X0} y={LEADER_TOP} textAnchor="start" fontSize={11} fill={FAINT}>
          {T.matchClock.kickoff}
        </text>
        <text x={X_END} y={LEADER_TOP} textAnchor="end" fontSize={11} fill={FAINT}>
          {T.matchClock.fullTime}
        </text>

        {/* 하프타임 라벨은 막대 **위**에 둔다 — 칸 폭이 좁아 안에 넣으면 영어·일본어가 넘친다. */}
        <text x={cHt} y={ROW1_Y} textAnchor="middle" fontSize={12} fontWeight={700} fill={DIM}>
          {T.matchClock.halftimeName}
        </text>
        <text x={cHt} y={ROW2_Y} textAnchor="middle" fontSize={12} fontWeight={700} fill={DIM}>
          {T.matchClock.halftimeMax(LAW.halftimeMaxMin)}
        </text>
        <line x1={cHt} y1={LEADER_TOP} x2={cHt} y2={BAR_Y} stroke={DIM} strokeWidth={1.2} />

        {/* 진영 교체(Law 8) — 후반 칸 위 양방향 화살표. 코트도 골도 그리지 않는다.
            라벨은 하프타임 첫 줄과 같은 baseline, 화살표는 둘째 줄 높이, 리더 틱도 같은 구간. */}
        <text x={SWAP_CX} y={ROW1_Y} textAnchor="middle" fontSize={12} fontWeight={700} fill={DIM}>
          {T.matchClock.endsSwap}
        </text>
        <line x1={SWAP_CX - SWAP_HALF_W} y1={SWAP_Y} x2={SWAP_CX + SWAP_HALF_W} y2={SWAP_Y} stroke={DIM} strokeWidth={1.6} />
        <path d={`M ${SWAP_CX - SWAP_HALF_W} ${SWAP_Y} l 6 -3.7 l 0 7.4 Z`} fill={DIM} />
        <path d={`M ${SWAP_CX + SWAP_HALF_W} ${SWAP_Y} l -6 -3.7 l 0 7.4 Z`} fill={DIM} />
        {/* 리더는 화살표 가로선에서 바로 내려온다 — LEADER_TOP 에서 시작하면 화살표와 6px 끊겨 뜬 선 조각이 된다. */}
        <line x1={SWAP_CX} y1={SWAP_Y} x2={SWAP_CX} y2={BAR_Y} stroke={DIM} strokeWidth={1.2} />

        {/* 전·후반 길이 치수선 + 멈춘 시간 꼬리. */}
        <DimLine x0={X_FIRST} x1={X_HALFTIME} y={DIM_Y} label={T.matchClock.firstHalf(LAW.halfMin)} />
        <StoppageTail x={X_HALFTIME} y={DIM_Y} />
        <DimLine x0={X_SECOND} x1={X_END} y={DIM_Y} label={T.matchClock.secondHalf(LAW.halfMin)} />
        <StoppageTail x={X_END} y={DIM_Y} />

        <text x={c1} y={SUB_Y} textAnchor="middle" fontSize={11} fill={FAINT}>
          {T.matchClock.stoppage}
        </text>
        <text x={c2} y={SUB_Y} textAnchor="middle" fontSize={11} fill={FAINT}>
          {T.matchClock.stoppage}
        </text>
      </svg>
    </FigureCard>
  );
}
