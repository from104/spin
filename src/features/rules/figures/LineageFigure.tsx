// 규칙 계보 도해 — "이 화면의 규칙은 어디서 왔나"(카드 1 intro).
//
// 2005-01 르셰네 회의의 최우선 과제는 따로 자란 **네** 변종(프랑스식·캐나다/미국식·일본식·
// 영국식)을 한 벌로 병합하는 것이었고(uspsa-history.md:48 · README.md:57), 2005-10 코임브라에서
// **영국 규칙이 템플릿으로 만장일치 채택**되어(README.md:58 · england-wfa.md:12-14) 그대로 몸통이
// 됐다. 그래서 영국 갈래만 몸통 높이에 실선·굵게 놓고 나머지 셋은 파선·가늘게 흡수시킨다 —
// 강제색에서 색이 다 날아가도 실선/파선·굵기·라벨이 구분을 진다.
//
// 🪦 기각: "두 갈래가 Y 자로 합류" 안. 정본은 두 갈래가 아니라 넷이고 그중 하나가 표준이 된
// 것이라(README.md:57-58), Y 자는 사실을 왜곡한다. 되살리지 말 것.
//
// 안 그리는 것: 국기·인물·트로피·지도(도식이지 삽화가 아니다), 그리고 프랑스 1970년대·캐나다
// 1979~80 같은 **시작 연도** — 산문 블록 6(ruleTopics.ts)이 이미 말하고, 여기서 연대 위치를
// 지어내면 거짓 축척이 된다. 갈래 시작 x 를 전부 같게 두고 각주가 "연대 비례 아님"을 못 박는다.
//
// 세로 배치(2026-09 검수 반영): 잉크는 y 22~109 에 모이고 각주만 144 다. 예전엔 몸통이 95,
// 각주가 172, viewBox 가 190 이라 그림 아래가 위보다 두 배 넘게 비었다 — 모든 y 를 28 끌어
// 올리고 VB_H 를 160 으로 줄여 위아래 여백을 맞췄다. 값을 다시 늘리지 말 것.
import { FigureCard } from './FigureCard.tsx';
import { figureTextFor } from './text.ts';
import { useLocale } from '../../../i18n/useLocale.ts';
import { LINEAGE, type LineageVariant } from '../ruleConstants.ts';

const VB_W = 500;
const VB_H = 160;

// 위계: 몸통(영국 갈래·몸통·화살촉·점 테두리)이 그림에서 가장 진해야 하고 흡수되는 셋이 그보다
// 흐려야 한다. 예전엔 몸통이 --border-strong, 파선이 --muted 라 위계가 뒤집혀 있었다 —
// --border-strong 은 라이트에서 바탕과 1.3:1 밖에 안 나오는 **장식 테두리 색**이라 의미를 지는
// 선에 쓰면 안 된다. 그래서 의미선은 --muted, 보조선·각주는 --faint-text 로 간다.
const INK = 'var(--muted)';
const FAINT = 'var(--faint-text)';
/** 글자 둘레를 파내는 halo. 도해 바닥은 FigureCard 의 --panel-2 이지 --panel 이 아니다
 *  — --panel 로 파면 라이트 테마에서 글자마다 흰 얼룩이 뜬다. */
const HALO = 'var(--panel-2)';

const TRUNK_W = 2.4;
const BRANCH_W = 1.4;

/** 갈래 라벨 오른끝 / 갈래 시작 / 합류점 / 몸통 끝. */
const LABEL_X = 104; // 2026-09-03 재검수: 96 이면 ja 'カナダ・米国式' 왼끝이 x≈17 — 좌우 여백을 맞춰 8 민다.
const BRANCH_X = 112;
const MERGE_X = 215;
const TRUNK_END_X = 468;

/** 갈래별 세로 위치. `LineageVariant` 로 키를 묶어 두어 상수에 변종이 늘면 여기서 컴파일이 막힌다.
 *  영국(en)만 몸통 높이 — 템플릿이 된 갈래가 그대로 몸통이 되는 형태다. */
const BRANCH_Y: Record<LineageVariant, number> = {
  fr: 22,
  'ca-us': 44,
  en: 67,
  jp: 90,
};
const TRUNK_Y = BRANCH_Y.en;

/** 흡수되는 갈래의 1차 제어점 x. 셋이 공유한다 — 출발부의 수평 도입부는 같아야 한 무리로 읽힌다. */
const CURVE_C1_X = 166;

/** 흡수되는 갈래의 2차 제어점 x · **끝 높이** · 파선 위상.
 *  1차 수정(제어점만 145/160/178 로 벌림)은 세 선이 서로 겹치는 것만 풀었고, 셋 다 몸통 높이
 *  (TRUNK_Y)로 끝나 마지막 15~20 단위를 몸통 위에 눕는 것은 그대로였다 — 확대하면 몸통 위아래로
 *  파선 토막이 삐져나온 술 장식이 되고, 눈에 보이는 합류가 원보다 30px 앞에서 끝났다. 그래서
 *  갈래는 **몸통에 닿지 않고** 서로 다른 높이에서 합류점 원 2~3 단위 앞(ABSORB_END_X)에 멎는다.
 *  몸통 중심까지 최소 3.5 단위(반굵기 1.2 의 3배), 세 선 사이 최소 2.5 단위 — 겹치는 구간 0. */
const ABSORB_END_X = 207;
const ABSORBED_CURVE: Record<Exclude<LineageVariant, 'en'>, { c2x: number; endY: number; dashOffset: number }> = {
  fr: { c2x: 188, endY: 61, dashOffset: 0 },
  'ca-us': { c2x: 188, endY: 63.5, dashOffset: 2 },
  jp: { c2x: 188, endY: 73, dashOffset: 4 },
};

const FIPFA_X = 330;
const EDITION_X = 440;

/** 점 반지름은 의미 순서로: 지금 이 화면이 쓰는 현행판 > 규칙이 하나로 합쳐진 합류점 > 개명. */
const DOT_R = { edition: 7, merge: 6, fipfa: 5 };

/** 연도 표기는 로케일 중립(`2005.10`) — text.ts 에 수치를 적지 않기 위한 지역 헬퍼.
 *  월은 0 을 채운다: `2006.7` 이면 세 스탬프의 글자 폭이 달라져 한 줄에 늘어놓은 연표가
 *  들쭉날쭉해 보인다. */
function ym({ y, m }: { y: number; m: number }) {
  return `${y}.${String(m).padStart(2, '0')}`;
}

/** 지그재그 라벨 한 덩이(연도 + 설명).
 *  halo(글자 둘레를 바탕색으로 파내는 장치)는 두지 않는다 — 세 스탬프 모두 선이 지나지 않는
 *  자리에 선다(아래 둘은 몸통에서 27 단위, FIPFA 는 원 위끝에서 6 단위 — 글자 밑을 지나는
 *  선이 없다). 2026-09-03 재검수까지 FIPFA 에만 켜 두었으나 죽은 값이었다. 다시 켤 일이
 *  생기면 색은 HALO(--panel-2)다. */
function Stamp({
  x,
  yYear,
  ySub,
  year,
  sub,
}: {
  x: number;
  yYear: number;
  ySub: number;
  year: string;
  sub: string;
}) {
  return (
    <g>
      <text x={x} y={yYear} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--text)">
        {year}
      </text>
      <text x={x} y={ySub} textAnchor="middle" fontSize={11} fill={FAINT}>
        {sub}
      </text>
    </g>
  );
}

export function LineageFigure() {
  const T = figureTextFor(useLocale());
  const coimbra = ym(LINEAGE.coimbra);
  const edition = ym(LINEAGE.edition);

  return (
    <FigureCard title={T.lineage.title} aspect={`${VB_W} / ${VB_H}`} caption={T.lineage.caption}>
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" height="100%" role="img" aria-label={T.lineage.aria(coimbra, edition)}>
        {LINEAGE.variants.map((id) => {
          const y = BRANCH_Y[id];
          return (
            <g key={id}>
              <text x={LABEL_X} y={y + 4} textAnchor="end" fontSize={11.5} fill={INK}>
                {T.lineage.variants[id]}
              </text>
              {id === 'en' ? (
                <line x1={BRANCH_X} y1={y} x2={MERGE_X} y2={TRUNK_Y} stroke={INK} strokeWidth={TRUNK_W} />
              ) : (
                <path
                  d={`M ${BRANCH_X} ${y} C ${CURVE_C1_X} ${y}, ${ABSORBED_CURVE[id].c2x} ${ABSORBED_CURVE[id].endY}, ${ABSORB_END_X} ${ABSORBED_CURVE[id].endY}`}
                  fill="none"
                  stroke={FAINT}
                  strokeWidth={BRANCH_W}
                  strokeDasharray="4 3"
                  strokeDashoffset={ABSORBED_CURVE[id].dashOffset}
                />
              )}
            </g>
          );
        })}

        {/* 몸통 — 코임브라에서 갈라지지 않는 한 줄기가 되어 현행판까지 간다. */}
        <line x1={MERGE_X} y1={TRUNK_Y} x2={TRUNK_END_X} y2={TRUNK_Y} stroke={INK} strokeWidth={TRUNK_W} />
        {/* 화살촉은 <marker> 가 아니라 인라인 path — 한 화면에 도해가 여럿이라 marker id 가 충돌한다.
            길이 9 · 폭 10 으로 몸통 굵기에 맞춘다(더 크면 촉이 줄기를 이긴다). */}
        <path
          d={`M ${TRUNK_END_X + 7} ${TRUNK_Y} L ${TRUNK_END_X - 2} ${TRUNK_Y - 5} L ${TRUNK_END_X - 2} ${TRUNK_Y + 5} Z`}
          fill={INK}
        />

        {/* 합류점 · FIPFA · 현행판. 채움이 있는 점은 하나뿐 — 지금 이 화면이 쓰는 판이다. */}
        <circle cx={MERGE_X} cy={TRUNK_Y} r={DOT_R.merge} fill={HALO} stroke={INK} strokeWidth={2} />
        <circle cx={FIPFA_X} cy={TRUNK_Y} r={DOT_R.fipfa} fill={HALO} stroke={INK} strokeWidth={1.8} />
        <circle cx={EDITION_X} cy={TRUNK_Y} r={DOT_R.edition} fill="var(--accent)" stroke={INK} strokeWidth={2} />

        <Stamp x={MERGE_X} yYear={94} ySub={109} year={coimbra} sub={T.lineage.coimbra} />
        {/* FIPFA 스탬프는 제 점에 바짝 붙인다. 예전엔 원에서 20 넘게 떠 있어 왼쪽 갈래 라벨 행과
            나란해지는 바람에 다섯째 갈래처럼 읽혔다. 연도 baseline 이 원 위끝에서 5~6 — 몸통
            아래 두 스탬프와 대칭이다. */}
        <Stamp x={FIPFA_X} yYear={56} ySub={40} year={ym(LINEAGE.fipfa)} sub={T.lineage.fipfa} />
        <Stamp x={EDITION_X} yYear={94} ySub={109} year={edition} sub={T.lineage.current} />

        {/* 각주는 viewBox 중앙(250)이 아니라 잉크 중앙에 건다 — 그림은 왼쪽 라벨 열 때문에
            viewBox 중앙보다 오른쪽에 몰려 있어 250 에 두면 왼쪽으로 밀린 것처럼 보인다. */}
        <text x={(BRANCH_X + TRUNK_END_X) / 2} y={144} textAnchor="middle" fontSize={11} fill={FAINT}>
          {T.lineage.note}
        </text>
      </svg>
    </FigureCard>
  );
}
