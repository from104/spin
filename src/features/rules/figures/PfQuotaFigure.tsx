// 등급 정원 도해 — "코트 위 네 자리 가운데 PF2 는 둘까지"(Law 18, 2026-09-03).
//
// 산문은 "PF2 를 2명 넘게 출전시킬 수 없다"고만 말한다. 정원은 **자리의 개수** 이야기라
// 문장보다 칸이 빠르다: 네 칸을 늘어놓고 둘은 채움+실선(PF1), 둘은 파선(PF2 상한), 다섯째
// 칸은 ✕ 로 잘라 "셋째 PF2 는 없다"를 한눈에 보인다.
// 정본: docs/RULES-FIPFA-2025.md:89(Law 3, 한 팀 최대 4명) · :343-347(Law 18, 등급과 PF2 상한)
// · :348-350(위반 시 한 명 적은 채로 경기 — 그래서 캡션이 "4명이 뛸 때"를 전제로 못 박는다).
//
// 안 그리는 것: ①코트 사각형·라인·골대 — 이 그림은 정원이지 배치가 아니고, 2×2 로 놓으면
// intro 카드의 `lineup` 장면과 오독된다(그래서 반드시 가로 일렬). ②휠체어·사람 형태 —
// 도해에서 실루엣은 세 번 다 잘렸다(조악함+라벨 가림, DistanceFigure 묘비 참조). ③"등급은
// 잘하고 못하고가 아니다" 주석 — 바로 위 산문이 말하므로 도해가 반복하지 않는다.
//
// 칸 수는 `LAW` 에서 파생한다 — 4·2 를 여기 적지 않는다. 좌표(70·14·17)는 이 도해 전용
// 배치값이지 규정 치수가 아니다(코트 GEO 와 무관). viewBox 폭도 칸 수에서 파생한다 —
// 상한이 늘면 440 이라는 숫자만 옛 칸 수에 맞아 그림이 잘린다.
//
// 선 색(2026-09-03 검수): 칸 테두리의 실선/파선 구분은 **의미를 진다**(PF1 대표값 : PF2 상한).
// 의미를 지는 선은 var(--muted) 로 긋는다 — var(--border-strong) 은 라이트에서 바탕과 1.3:1
// 이라 파선의 끊김이 안 보인다. 장식 테두리에만 border-strong 을 쓴다. 정원 밖 칸은
// "읽히되 뒤로 물러나야" 하므로 var(--faint-text) 그대로 둔다.
import { FigureCard } from './FigureCard.tsx';
import { Verdict } from './Verdict.tsx';
import { figureTextFor } from './text.ts';
import { LAW } from '../ruleConstants.ts';
import { useLocale } from '../../../i18n/useLocale.ts';

// 도해 전용 배치 상수(치수 아님).
const X0 = 17;
const SLOT_W = 70;
const SLOT_H = 56;
const GAP = 14;
const SLOT_Y = 68;
const PITCH = SLOT_W + GAP;

// 규정에서 파생 — 상한이 바뀌면 칸 구성이 따라 바뀐다.
const PF2_SLOTS = LAW.pf2MaxOnCourt;
const PF1_SLOTS = LAW.teamMaxOnCourt - LAW.pf2MaxOnCourt;
const SLOT_IS = Array.from({ length: LAW.teamMaxOnCourt }, (_, i) => i);
/** 다섯째(=정원 밖) 칸 — 불허를 보이는 자리라 data-slot 을 달지 않는다. */
const DENIED_I = LAW.teamMaxOnCourt;

/** 정원 칸 + 정원 밖 칸 한 개, 좌우 여백은 X0 로 같게. */
/** 정원 밖 칸의 표제(ja 'PF2をもう1人' ≈ 84px)가 칸 폭 70 을 넘어 양옆으로 번진다 — 그 여유.
 *  없으면 오른쪽 여백이 12 만 남아 조금 긴 번역이 오면 svg 가 조용히 잘라 먹는다(2026-09-03 재검수). */
const LABEL_BLEED = 12;
const VB_W = X0 + LABEL_BLEED + (LAW.teamMaxOnCourt + 1) * SLOT_W + LAW.teamMaxOnCourt * GAP + LABEL_BLEED + X0;
/** 칸 바닥선(124) 아래로 정원 밖 칸의 표제·부제가 두 줄 서는 만큼 높다 — VERDICT_*_DY 참조. */
const VB_H = 176;

/** i 번째 칸의 왼쪽 x. 칸이 늘면 오른쪽으로 자란다. */
const slotX = (i: number) => X0 + LABEL_BLEED + i * PITCH;

const LINE = 'var(--muted)';
const FAINT = 'var(--faint-text)';
/** 상한(=범위의 바깥)은 굵은 파선, 대표값은 실선+채움 — 도해 공통 규약. */
const MAX_DASH = '7 5';

const BRACKET_Y = 56;
/** 꺾쇠 중앙 위 틱의 길이. */
const TICK = 6;
/** 라벨 마지막 줄 baseline 과 위 틱 끝 사이 간격 — 줄 수와 무관하게 이 값이 유지된다. */
const LABEL_GAP = 10;
const LABEL_LEADING = 16;

/** 제도 꺾쇠: 수평선 + 양끝 아래 틱 + 중앙 위 틱. 라벨은 범위 중앙 위에 얹는다. */
function Bracket({ from, to, lines }: { from: number; to: number; lines: readonly string[] }) {
  const x1 = slotX(from);
  const x2 = slotX(to) + SLOT_W;
  const cx = (x1 + x2) / 2;
  const y = BRACKET_Y;
  // 마지막 줄을 틱 끝에서 LABEL_GAP 만큼 띄우고 위로 쌓는다 — 1줄(한국어)이든 2줄(영·일)이든
  // 꺾쇠 위 간격이 같다. baseline 을 상수로 못 박으면 꺾쇠를 옮길 때 라벨만 제자리에 남는다.
  const lastBaseline = y - TICK - LABEL_GAP;
  return (
    <g>
      <g stroke={LINE} strokeWidth={1.4} fill="none" strokeLinecap="round">
        <line x1={x1} y1={y} x2={x2} y2={y} />
        <line x1={x1} y1={y} x2={x1} y2={y + TICK} />
        <line x1={x2} y1={y} x2={x2} y2={y + TICK} />
        <line x1={cx} y1={y} x2={cx} y2={y - TICK} />
      </g>
      {/* halo 없음: 라벨은 꺾쇠 **위** 빈 공간에 앉아 아무 선도 가리지 않는다. 가릴 것이 없는
          자리에 halo 를 두면 라이트에서 글자 둘레만 옅게 뜬다(2026-09-03 검수). */}
      <text x={cx} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--text)">
        {lines.map((line, i) => (
          <tspan key={line} x={cx} y={lastBaseline - (lines.length - 1 - i) * LABEL_LEADING}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

/** 정원 밖 칸의 배지는 칸 **안**에 서므로 글이 칸 바닥선(SLOT_Y+SLOT_H=124) 아래로 나가야 한다.
 *  Verdict 기본값(30/47)이면 표제가 바닥선을 관통해 취소선처럼 읽힌다(4로케일 전부). */
const VERDICT_CY = 96;
const VERDICT_HEAD_DY = 44;
const VERDICT_TAIL_DY = 61;

export function PfQuotaFigure() {
  const T = figureTextFor(useLocale()).pfQuota;
  const max = LAW.teamMaxOnCourt;
  const pf2 = LAW.pf2MaxOnCourt;
  return (
    <FigureCard title={T.title(max, pf2)} aspect={`${VB_W} / ${VB_H}`} caption={T.caption(max)}>
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" height="100%" role="img" aria-label={T.aria(max, pf2)}>
        {SLOT_IS.map((i) => {
          const isPf1 = i < PF1_SLOTS;
          const x = slotX(i);
          return (
            <g key={i}>
              <rect
                data-slot={isPf1 ? 'pf1' : 'pf2'}
                x={x}
                y={SLOT_Y}
                width={SLOT_W}
                height={SLOT_H}
                rx={8}
                fill={isPf1 ? 'color-mix(in srgb, var(--accent) 18%, transparent)' : 'none'}
                stroke={LINE}
                strokeWidth={1.6}
                strokeDasharray={isPf1 ? undefined : MAX_DASH}
              />
              {/* 1차 구분자는 이 글자와 실선/파선이다 — 강제색에서 채움색이 날아가도 읽힌다. */}
              <text x={x + SLOT_W / 2} y={101} textAnchor="middle" fontSize={16} fontWeight={700} fill="var(--text)">
                {isPf1 ? T.slotPf1 : T.slotPf2}
              </text>
            </g>
          );
        })}

        {/* 정원 밖 칸 — 가늘고 흐린 파선(빈자리조차 아니라는 뜻)에 ✕ 배지만 앉힌다. */}
        <rect
          x={slotX(DENIED_I)}
          y={SLOT_Y}
          width={SLOT_W}
          height={SLOT_H}
          rx={8}
          fill="none"
          stroke={FAINT}
          strokeWidth={1.2}
          strokeDasharray={MAX_DASH}
          opacity={0.8}
        />
        <Verdict
          cx={slotX(DENIED_I) + SLOT_W / 2}
          cy={VERDICT_CY}
          ok={false}
          head={T.extraHead}
          tail={T.extraTail}
          headDy={VERDICT_HEAD_DY}
          tailDy={VERDICT_TAIL_DY}
        />

        <Bracket from={0} to={PF1_SLOTS - 1} lines={T.bracketPf1(PF1_SLOTS)} />
        <Bracket from={PF1_SLOTS} to={PF1_SLOTS + PF2_SLOTS - 1} lines={T.bracketPf2(PF2_SLOTS)} />
      </svg>
    </FigureCard>
  );
}
