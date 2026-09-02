// 물림(stuck ball) 시간축 — 카드 2 `purpose` 둘째 도해(2026-09-03).
//
// 아웃 오브 플레이 넷 중 둘째: *액티브 플레이 중인 상대 둘 이상 사이에 공이 움직이지 못한 채
// 5초를 넘기면 아웃*(docs/RULES-FIPFA-2025.md:166, Law 9). 그 앞 구간은 전부 인플레이다
// (:170). 산문(`ruleTopics.ts:435` "…5초를 넘기면 그것도 아웃입니다")은 "넘기면"이라는 경계를
// 말로만 말하는데, 경계는 눈으로 보는 편이 빠르다 — 그래서 한 축 위에 채운 구간(인플레이)과
// 빗금+파선 구간(아웃)을 붙여 놓고 사이에 임계선을 세운다. 초 수·눈금 수·구간 폭·임계선 위치는
// 전부 `LAW.stuckBallSec` 에서 파생한다(5 를 손으로 적지 않는다).
//
// 검수(2026-09-03)가 잡은 결함 넷과, 되돌리지 않게 남기는 이유:
// ①아웃 구간의 오른변을 그리지 않는다. 파선으로 닫으면 '5~6초짜리 창'으로 읽혀서 6초에 무슨
//   경계가 있다는 거짓말이 된다 — 아웃은 5초 뒤로 끝없이 이어지므로 위·아래 파선만 축 화살촉
//   직전(X_OUT_EDGE)까지 뻗고 오른쪽은 열어 둔다. 왼변은 임계선이 이미 진다. 그래도 폭을 재는
//   테스트(RuleFigure.test.tsx)를 위해 `data-seg="out"` rect 자체는 stroke/fill 없이 남긴다.
// ②빗금 x 를 손으로 적지 않는다. 구간 폭에서 개수를 뽑고 위아래 2px 안쪽으로 들여 그린다 —
//   파선 테두리와 끝이 겹치면 'ㄱ' 모양 깃발이 생겨 빗금이 아니라 도형으로 보인다.
// ③halo(글자 둘레 파내기)는 선이 실제로 글자를 가로지르는 라벨에만 쓴다. 여기 라벨은 전부
//   선 사이 빈 자리에 앉아 있어서 halo 가 라이트 테마에서 흰 얼룩만 남겼다 — 그래서 없다.
//   되살릴 일이 생기면 색은 var(--panel) 이 아니라 var(--panel-2) 다(도해 바닥은 FigureCard 의
//   panel-2 이므로 panel 을 쓰면 라이트에서 밝은 자국이 뜬다).
// ④의미를 지는 선(구간 테두리·축·번호 원)은 전부 var(--muted) 다. var(--border-strong) 은
//   라이트에서 바탕과 1.3:1 밖에 안 나서 인플레이 상자가 '반만 그린 상자'로 보였다.
//
// 안 그리는 것: ①상대 둘을 원·체어로 그리지 않는다 — two-on-1 카드의 장면 6종이 이미 그 배치를
// 움직여서 보여 주므로 정지 그림이 끼어들면 겹친다. ②3m 반경 같은 거리 수치 금지(이 그림의
// 주장은 시간 하나다). ③물린 뒤 재개 방법 한 획도 금지 — 재개는 카드 4 소관이다.
// '액티브 플레이'의 정의(Law 11, :190)도 여기서 말하지 않고 caption 이 2-on-1 카드로 넘긴다.
import { FigureCard } from './FigureCard.tsx';
import { figureTextFor } from './text.ts';
import { useLocale } from '../../../i18n/useLocale.ts';
import { LAW } from '../ruleConstants.ts';

const VB_W = 420;
const VB_H = 200;

/** 시간축 원점(px)과 오른끝 — 축이 쓰는 가로 길이는 360px 이다. */
const X0 = 30;
const AXIS_SPAN = 360;
/** 축에 담는 초 수 = 임계(5초) + 그 너머 1초. 이 그림 전용 스케일(px/초)이다. */
const SPAN_SEC = LAW.stuckBallSec + 1;
const PX_PER_SEC = AXIS_SPAN / SPAN_SEC;
/** 임계선 x — 인플레이 구간의 오른끝이자 아웃 구간의 왼끝. */
const X_LIMIT = X0 + LAW.stuckBallSec * PX_PER_SEC;
const X_END = X0 + SPAN_SEC * PX_PER_SEC;
/** 아웃 구간의 파선 테두리·빗금이 멈추는 x — 축 화살촉(398~406) 바로 앞. */
const X_OUT_EDGE = 396;

const AXIS_Y = 62;
const BAR_TOP = 40;
const BAR_H = AXIS_Y - BAR_TOP;

const DIM = 'var(--muted)';
const FAINT = 'var(--faint-text)';
const INK = 'var(--text)';

/** 조항 3줄의 기준선. */
const COND_Y = [124, 146, 168];
/** 번호 원의 중심 x — 왼끝이 축 원점 X0 에 맞도록 반지름만큼 민다. */
const NUM_R = 7;
const NUM_CX = X0 + NUM_R;

/** 빗금 — 간격과 기울기(가로 9 : 세로 18)만 정하고 개수는 구간 폭에서 뽑는다. */
const HATCH_GAP = 12;
const HATCH_SLANT = 9;
const HATCH_INSET = 2;

export function StuckBallFigure() {
  const T = figureTextFor(useLocale());
  const sec = LAW.stuckBallSec;
  const ticks = Array.from({ length: SPAN_SEC + 1 }, (_, i) => i);
  // 아웃 구간 빗금 — <pattern> 을 쓰지 않는다. 한 카드에 도해가 여러 장 뜨므로 id 가 부딪힌다
  // (치수선 화살촉을 <marker> 없이 인라인 path 로 그리는 것과 같은 이유).
  const hatchStart = X_LIMIT + 1;
  const hatchCount = Math.floor((X_OUT_EDGE - hatchStart - HATCH_SLANT) / HATCH_GAP) + 1;
  const hatchX = Array.from({ length: Math.max(hatchCount, 0) }, (_, i) => hatchStart + i * HATCH_GAP);

  return (
    <FigureCard title={T.stuckBall.title(sec)} aspect={`${VB_W} / ${VB_H}`} caption={T.stuckBall.caption}>
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        width="100%"
        height="100%"
        role="img"
        aria-label={T.stuckBall.aria(sec)}
      >
        {/* 인플레이 — 채움+실선 테두리가 "이게 기본 상태"를 진다. */}
        <rect
          data-seg="in-play"
          x={X0}
          y={BAR_TOP}
          width={LAW.stuckBallSec * PX_PER_SEC}
          height={BAR_H}
          fill="color-mix(in srgb, var(--accent) 18%, transparent)"
          stroke="none"
        />
        {/* 테두리는 오른변 없는 3변 — 오른변은 임계 파선이 진다. rect 에 stroke 를 두면 같은 x 에서
            파선의 빈칸이 회색 실선으로 메워져 두 색 파선이 된다(2026-09-03 재검수). */}
        <path d={`M ${X_LIMIT} ${BAR_TOP} H ${X0} V ${AXIS_Y} H ${X_LIMIT}`} fill="none" stroke={DIM} strokeWidth={1.6} />
        {/* 아웃 — 폭만 재는 자리표(테두리는 아래 path 가 그린다). 이 rect 를 지우면
            "인플레이 : 아웃 = 5 : 1" 을 재는 테스트가 죽는다. */}
        <rect
          data-seg="out"
          x={X_LIMIT}
          y={BAR_TOP}
          width={PX_PER_SEC}
          height={BAR_H}
          fill="none"
          stroke="none"
        />
        {/* 아웃 테두리 — 위·아래만. 오른쪽은 열려 있고 왼쪽은 임계선이 진다.
            강제색에서 색이 전부 CanvasText 가 돼도 '채움 대 빗금·파선' 이라는 모양 차이가 남는다. */}
        <path
          d={`M ${X_LIMIT} ${BAR_TOP} H ${X_OUT_EDGE} M ${X_LIMIT} ${AXIS_Y} H ${X_OUT_EDGE}`}
          fill="none"
          stroke={DIM}
          strokeWidth={1.6}
          strokeDasharray="7 5"
        />
        {hatchX.map((x) => (
          <line
            key={x}
            x1={x}
            y1={AXIS_Y - HATCH_INSET}
            x2={x + HATCH_SLANT}
            y2={BAR_TOP + HATCH_INSET}
            stroke={FAINT}
            strokeWidth={1.1}
          />
        ))}

        {/* 시간축 — 오른끝 화살촉은 인라인 path(<marker> 미사용). */}
        <line x1={X0} y1={AXIS_Y} x2={400} y2={AXIS_Y} stroke={DIM} strokeWidth={1.4} />
        <path d="M 406 62 L 398 58 L 398 66 Z" fill={DIM} />
        {ticks.map((i) => {
          const x = X0 + i * PX_PER_SEC;
          return (
            <g key={i}>
              <line x1={x} y1={AXIS_Y} x2={x} y2={AXIS_Y + 6} stroke={DIM} strokeWidth={1.2} />
              {/* 단위는 붙이지 않는다 — 임계선의 '5초' 라벨이 축 전체의 단위를 진다. */}
              <text x={x} y={80} textAnchor="middle" fontSize={10.5} fill={FAINT}>
                {i}
              </text>
            </g>
          );
        })}

        {/* 임계선 — 굵은 파선(= 바깥 경계) + 그 위 초 라벨.
            아래끝은 눈금 바닥(AXIS_Y+6)에서 멈춘다. 더 내리면 눈금 숫자 '5' 머리에 닿는다. */}
        <line
          x1={X_LIMIT}
          y1={24}
          x2={X_LIMIT}
          y2={AXIS_Y + 6}
          stroke={INK}
          strokeWidth={2}
          strokeDasharray="7 5"
        />
        <text x={X_LIMIT} y={18} textAnchor="middle" fontSize={14} fontWeight={700} fill={INK}>
          {T.stuckBall.threshold(sec)}
        </text>

        <text
          x={X0 + (LAW.stuckBallSec * PX_PER_SEC) / 2}
          y={96}
          textAnchor="middle"
          fontSize={12.5}
          fontWeight={700}
          fill={INK}
        >
          {T.stuckBall.inPlay}
        </text>
        <text x={(X_LIMIT + X_END) / 2} y={96} textAnchor="middle" fontSize={12.5} fontWeight={700} fill={INK}>
          {T.stuckBall.out}
        </text>

        {/* 조건 셋 — 번호 원 ①②③. 체크박스로 그렸더니 "끄고 켜는 토글"로 읽혔다.
            셋은 고르는 것이 아니라 전부 성립해야 하는 열거이므로 번호가 맞다
            (여기 1·2·3 은 열거 번호일 뿐 규정 수치가 아니다). */}
        {[T.stuckBall.cond1, T.stuckBall.cond2, T.stuckBall.cond3].map((label, i) => {
          const y = COND_Y[i];
          return (
            <g key={label}>
              <circle cx={NUM_CX} cy={y} r={NUM_R} fill="none" stroke={DIM} strokeWidth={1.4} />
              <text x={NUM_CX} y={y + 3.5} textAnchor="middle" fontSize={10} fontWeight={700} fill={DIM}>
                {i + 1}
              </text>
              <text x={52} y={y + 4} fontSize={12} fill={INK}>
                {label}
              </text>
            </g>
          );
        })}

        {/* 중괄호 — 셋을 하나로 묶어 오른쪽 라벨로 넘긴다. 조건 최장 라벨(EN
            'Between 2+ opponents' ≈ 132px) 오른끝에서 12px 띄운 자리에 팔을 세우고, 꼭지는
            라벨 쪽(오른쪽)을 가리키는 '}' 모양이다. 조건 쪽으로 뒤집으면 묶음의 결론이
            어디로 가는지가 사라진다. */}
        <path
          d="M 205 112 q 6 0 6 8 v 18 q 0 8 2 8 q -2 0 -2 8 v 18 q 0 8 -6 8"
          fill="none"
          stroke={DIM}
          strokeWidth={1.4}
        />
        <text x={226} y={150} textAnchor="start" fontSize={12.5} fontWeight={700} fill={INK}>
          {T.stuckBall.allThree}
        </text>
      </svg>
    </FigureCard>
  );
}
