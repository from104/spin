// 카드 1 `goal-posts` — 골대를 정면에서 본 그림(2026-09-03 신설, 같은 날 실물 규격으로 재제작).
//
// 산문은 "골대에는 크로스바도 그물도 없습니다"라고 **없는 것**을 말한다. 없는 것은 문장으로는
// 흘러가고 그림으로는 남는다 — 축구 골대를 아는 눈은 기둥 둘만 봐도 머릿속에서 크로스바와
// 그물을 채워 넣기 때문에, 그 두 자리를 **비운 채로 ✕ 로 못 박는** 것이 이 그림의 절반이다.
// 나머지 절반은 기둥 자체의 실물 규격이다: 라인 굵기의 **파이프**, 높이 150cm, 바닥에서 50cm
// 지점의 **표시**.
//
// 정본과 출처:
//  · docs/RULES-FIPFA-2025.md:58(Law 1 — 골대는 골라인 중앙, 기둥 2개, 기둥 간격 6m) · :181
//    (골대가 없어도 공 과반이 골 표시 안쪽을 통과하면 득점 — 기둥은 경기를 막는 구조물이 아니라
//    **표시**라는 근거).
//  · 기둥의 실물 규격(파이프·150cm·50cm 표시)은 **Laws 본문에 없다**. 기현님(파워체어풋볼 국제
//    활동가)이 2026-09-03 에 실물 기준으로 확인해 준 것이고, 같은 날 정본 Law 1 에 ⬆ 항목으로
//    받아 적었다. 그림은 그 값을 `LAW.goalPostHeightM`·`LAW.goalPostMarkM` 에서만 읽는다.
//  · 바닥에서 50cm 인 그 표시는 장식이 아니라 **판정 눈금**이다 — 카드 2 `goal-height` 가 그리는
//    50.8cm(Law 10, 뜬 공은 골이 아니다)를 심판이 코트에서 눈으로 재는 자리가 여기다. 그래서
//    표시는 색이 아니라 **모양**(기둥을 가로지르는 짧고 굵은 띠)으로 읽히게 그린다. 강제색
//    테마에서 색이 전부 CanvasText 로 치환돼도 띠는 살아남는다.
//  · 기둥을 **바닥선(골라인)과 같은 stroke(2)** 로 긋는 이유: 정본에는 라인 굵기의 수치가 없고
//    기현님의 규격도 "경기장 라인 두께의 파이프"라는 **비교**로만 주어졌다. 숫자가 없는 것을
//    숫자로 옮기면 거짓 정밀이 되므로, 그림도 비교를 그대로 옮겨 두 선의 굵기를 같게 둔다.
//
// 안 그리는 것:
//  ①공 — 크기·높이 이야기는 카드 2 의 `ball`·`goal-height` 도해 몫이다. 여기에 공을 놓으면
//    "얼마나 높이 넘으면 골인가"로 읽혀 두 도해가 같은 말을 다르게 한다.
//  ②축구 골대(직사각 프레임+그물) 대비 그림 — 없는 것을 크게 그려 놓고 ✕ 를 치면 눈은 먼저
//    **있는 것**으로 읽는다. 파선 + ✕ 배지 한 벌이면 족하다(§11.5 규약).
//  ③득점 판정 화살표(공이 지나는 방향) — 정본 :181 은 '통과'를 말하지만 그 판정은 카드
//    `purpose` 가 맡고, 여기에 화살표를 넣으면 그림의 주장이 둘이 된다.
//  ④코트 라인 연장·골에어리어 — `field-tour` 장면이 이미 코트 평면을 움직여 보여 준다.
//    이 그림은 **정면도**라 평면 요소를 섞으면 시점이 깨진다.
//  ⑤높이 치수선 — 6m 치수선 한 벌이 이 그림이 감당할 수 있는 '재는 선'의 전부다. 세로에도
//    화살촉을 세우면 표시 띠가 치수 보조선에 묻힌다. 높이는 라벨 한 줄로만 말한다.
//
// 좌표 근거(2026-09-03 재계산 — 기둥이 사다리꼴 80px 에서 파이프 60px 로 낮아지며 전부 다시 잡음):
//  · 축척은 그대로 40px/m(PX_PER_M_FIG). 코트 좌표계(units.ts 의 25px/m)와 **무관한** 이 그림
//    전용 값이다 — 기둥 간격 6m 가 240px, 높이 1.5m 가 60px, 표시 0.5m 가 20px 로, 이제 가로도
//    세로도 같은 자로 읽힌다(옛 그림은 세로가 2m 로 읽혀 카드 2 의 50.8cm 와 어긋났다).
//  · 세로 스택은 위에서부터: 배지 원 꼭대기 12 → 배지 cy 23 → 표제 53 · 부제 70 → 크로스바
//    파선 = 기둥 꼭대기 84 → 표시 124 → 바닥선 144 → 골라인 라벨 160 · 치수 라벨 161 →
//    치수선 168 → 보조선 끝 174 → viewBox 186. 위 여백 12 · 아래 여백 12 로 맞췄다.
//  · 배지 두 벌이 **입구 안에 못 들어간다**: 배지 한 벌의 먹선 높이는 원(22) + 표제(12.5) +
//    부제(11.5) + 줄 간격 = cy-11 에서 cy+50 까지 61px 인데 입구는 60px 다. 오프셋을 줄여
//    (headDy 28·tailDy 44) 우겨넣어도 부제 baseline 이 바닥선 3px 위에 서고, 표제 baseline 은
//    하필 표시 높이(124)에 앉는다. 그래서 배지 둘을 **골대 위 한 줄**에 나란히 세웠다
//    (cx = CX∓70 = 150·290, cy 23). 최장 표제 ja 'クロスバー'(5자×12.5 ≈ 63, 반폭 32)와
//    'ネット'(반폭 19)를 놓으면 왼쪽 118~182 · 오른쪽 271~309 로 89px 벌어지고, 오른쪽 끝 309 는
//    높이 라벨이 시작하는 346 과 37px 떨어진다. 아래(입구·바닥선·치수선)는 건드리지 않는다.
//  · 높이 라벨은 기둥 오른쪽 6px(x=346, start), 표시 라벨은 기둥 왼쪽 6px(x=94, end). 최장은
//    en '150cm tall'(10자×6.6 ≈ 66) → 오른끝 412 < 440, ko '50cm 표시'(≈58) → 왼끝 36 > 0.
//    둘 다 파선·격자·치수선이 지나지 않는 바깥 여백에 앉으므로 halo 를 쓰지 않는다.
//  · 그물 격자의 가로줄은 **표시 높이(124) 아래로 내려가지 않는다** — 표시와 같은 높이를 파선이
//    가로지르면 두 표시를 잇는 '가로대'로 읽혀 이 그림이 반드시 피해야 할 오독을 만든다. 그래서
//    가로 2줄은 크로스바 파선(84)과 표시 높이(124) 사이를 3등분한 자리(97.3·110.7)에만 둔다.
//    세로 5줄은 입구를 6등분(38px 간격)해 아래까지 내려가므로 격자는 그대로 닫힌다. 배지가
//    입구 밖으로 나가면서 옛 그림이 비워 두던 가운데 띠(BAND_HALF)는 필요가 없어져 없앴다
//    — 격자가 입구 전폭을 덮게 되어 비로소 '그물'로 읽힌다.
//  · 골라인 라벨만 11px 이 아니라 10px 이다. ja 'ゴールライン'(6자)이 11px 이면 오른끝 88 로
//    왼쪽 치수 보조선(x=100)과 12px 밖에 안 벌어진다(2026-09-03 검수 지적). 10px 면 18px.
//
// 선 색(§11.5): 의미를 지는 선(바닥선·기둥·치수선)은 var(--muted), 없는 것을 가리키는 파선과
// 보조선은 var(--faint-text), 표시 띠만 var(--text) 다 — 그림에서 유일하게 '읽어야 하는 눈금'이라
// 한 단계 진하다. var(--border-strong) 은 라이트에서 바탕과 1.3:1 이라 안 쓴다. halo 는 선이 글자를
// 지나는 라벨에만 쓰는데 여기엔 그런 라벨이 없어서 한 군데도 쓰지 않는다.
import { FigureCard } from './FigureCard.tsx';
import { Verdict } from './Verdict.tsx';
import { figureTextFor } from './text.ts';
import { useLocale } from '../../../i18n/useLocale.ts';
import { LAW } from '../ruleConstants.ts';
import { GOAL_HALF_PX } from '../../../model/court.ts';
import { PX_PER_M } from '../../../core/units.ts';

const VB_W = 440;
const CX = VB_W / 2;

/** 규정에서 파생 — 이 그림이 치수선으로 재는 유일한 수치. */
const GOAL_WIDTH_M = (GOAL_HALF_PX * 2) / PX_PER_M;
/** 도해 전용 축척(px/m). 코트 좌표계와 무관하다. 가로·세로 모두 이 자를 쓴다. */
const PX_PER_M_FIG = 40;
const POST_SPAN = GOAL_WIDTH_M * PX_PER_M_FIG; // 240

const POST_L = CX - POST_SPAN / 2; // 100
const POST_R = CX + POST_SPAN / 2; // 340

/** 기둥 높이와 표시 높이 — 규정 상수에서만 온다(60px · 20px). */
const POST_H = LAW.goalPostHeightM * PX_PER_M_FIG;
const MARK_H = LAW.goalPostMarkM * PX_PER_M_FIG;
// 표시용 수치 — 반올림은 라벨에서만.
const HEIGHT_CM = Math.round(LAW.goalPostHeightM * 100);
const MARK_CM = Math.round(LAW.goalPostMarkM * 100);

/** 배지 한 줄(골대 위). cy 는 원 중심, 먹선은 cy-11 에서 부제 baseline cy+47 까지. */
const VERDICT_CY = 23;
const VERDICT_DX = 70;

/** 기둥 꼭대기 = 크로스바 파선 자리. 배지 부제(70) 아래 14px. */
const POST_TOP_Y = 84;
/** 골라인 정면 단면. 좌우 여백을 같게 두어 기둥 두 개가 선 한가운데 선다. */
const GROUND_Y = POST_TOP_Y + POST_H; // 144
const GROUND_X0 = 20;
const GROUND_X1 = VB_W - GROUND_X0;

/** 바닥에서 50cm — 카드 2 의 50.8cm 를 코트에서 눈으로 재는 눈금. */
const MARK_Y = GROUND_Y - MARK_H; // 124
const MARK_HALF = 5;
/** 라벨은 기둥 바깥 6px. */
const LABEL_GAP = 6;

/** 치수선과 그 보조 수직선(바닥선 아래). */
const DIM_Y = GROUND_Y + 24;
const DIM_EXT_TO = GROUND_Y + 30;
const VB_H = DIM_EXT_TO + 12; // 186

/** 그물 격자가 쓰는 골 입구 안쪽 범위. 배지가 밖으로 나가 비워 둘 띠가 없다. */
const MOUTH_L = POST_L + 6;
const MOUTH_R = POST_R - 6;
const GRID_INSET = 4;

const DIM = 'var(--muted)';
const FAINT = 'var(--faint-text)';
const TEXT = 'var(--text)';
/** 없는 것(크로스바·그물)은 전부 이 파선으로 — 굵기만 다르다. */
const ABSENT_DASH = '7 5';
const GRID_DASH = '2 3.5';

/** 격자 가로 2줄 — 크로스바 파선과 표시 높이 사이를 3등분한 자리. 표시 높이 아래로는 없다. */
const GRID_SPAN = MARK_Y - POST_TOP_Y;
const GRID_ROWS = [POST_TOP_Y + GRID_SPAN / 3, POST_TOP_Y + (GRID_SPAN * 2) / 3];
/** 격자 세로 5줄 — 입구를 6등분. 아래까지 내려가 격자를 닫는다. */
const GRID_COLS = [1, 2, 3, 4, 5].map((i) => MOUTH_L + ((MOUTH_R - MOUTH_L) * i) / 6);

/** 치수선 한 벌 — 양끝 채운 화살촉 + 바닥선에서 내려오는 보조 수직선. `<marker>` 를 쓰지 않는
 *  이유는 한 카드에 도해가 여러 장 떠서 id 가 부딪히기 때문(BallFigure.DimLine 과 같은 구성).
 *  라벨은 치수선 위 빈 자리에 앉아 아무 선도 가리지 않으므로 halo 를 두지 않는다. */
function DimLine({ x0, x1, label }: { x0: number; x1: number; label: string }) {
  const head = 5.5;
  return (
    <g>
      <line x1={x0} y1={GROUND_Y} x2={x0} y2={DIM_EXT_TO} stroke={FAINT} strokeWidth={0.9} opacity={0.55} />
      <line x1={x1} y1={GROUND_Y} x2={x1} y2={DIM_EXT_TO} stroke={FAINT} strokeWidth={0.9} opacity={0.55} />
      <line x1={x0} y1={DIM_Y} x2={x1} y2={DIM_Y} stroke={DIM} strokeWidth={1.4} />
      <path d={`M ${x0} ${DIM_Y} l ${head} ${-head * 0.62} l 0 ${head * 1.24} Z`} fill={DIM} />
      <path d={`M ${x1} ${DIM_Y} l ${-head} ${-head * 0.62} l 0 ${head * 1.24} Z`} fill={DIM} />
      <text
        data-dim="goal-width"
        x={(x0 + x1) / 2}
        y={DIM_Y - 7}
        textAnchor="middle"
        fontSize={14}
        fontWeight={700}
        fill={DIM}
      >
        {label}
      </text>
    </g>
  );
}

/** 기둥 하나 — 바닥선과 같은 굵기의 파이프. 그 위에 표시 띠 하나. */
function Post({ cx }: { cx: number }) {
  return (
    <g>
      <line
        data-post=""
        x1={cx}
        y1={GROUND_Y}
        x2={cx}
        y2={POST_TOP_Y}
        stroke={DIM}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <line
        data-mark=""
        x1={cx - MARK_HALF}
        y1={MARK_Y}
        x2={cx + MARK_HALF}
        y2={MARK_Y}
        stroke={TEXT}
        strokeWidth={3}
        strokeLinecap="round"
      />
    </g>
  );
}

export function GoalPostsFigure() {
  const T = figureTextFor(useLocale()).goalPosts;
  return (
    <FigureCard title={T.title(GOAL_WIDTH_M)} aspect={`${VB_W} / ${VB_H}`} caption={T.caption}>
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" height="100%" role="img" aria-label={T.aria(GOAL_WIDTH_M)}>
        {/* 그물 자리 — 옅은 파선 격자. 촘촘하게 깔면 강제색(색이 전부 CanvasText 로 치환)에서
            한 덩어리로 뭉치므로 성기게. 가로줄은 표시 높이 위에서 멈춘다(머리말 참조). */}
        <g stroke={FAINT} strokeWidth={1} strokeDasharray={GRID_DASH} opacity={0.7}>
          {GRID_ROWS.map((y) => (
            <line key={y} x1={MOUTH_L} y1={y} x2={MOUTH_R} y2={y} />
          ))}
          {GRID_COLS.map((x) => (
            <line key={x} x1={x} y1={POST_TOP_Y + GRID_INSET} x2={x} y2={GROUND_Y - GRID_INSET} />
          ))}
        </g>

        {/* 크로스바 자리 — 기둥 꼭대기를 잇는 파선. 실선으로 그으면 '있는데 얇은 것'이 된다. */}
        <line
          x1={POST_L}
          y1={POST_TOP_Y}
          x2={POST_R}
          y2={POST_TOP_Y}
          stroke={FAINT}
          strokeWidth={1.4}
          strokeDasharray={ABSENT_DASH}
        />

        {/* 바닥선 = 골라인의 정면 단면. 기둥이 서는 바닥이자 이 그림의 유일한 실선 기준선. */}
        <line x1={GROUND_X0} y1={GROUND_Y} x2={GROUND_X1} y2={GROUND_Y} stroke={DIM} strokeWidth={2} />
        <text x={GROUND_X0 + 2} y={GROUND_Y + 16} textAnchor="start" fontSize={10} fill={FAINT}>
          {T.goalLine}
        </text>

        <Post cx={POST_L} />
        <Post cx={POST_R} />

        {/* 기둥 바깥 라벨 둘 — 왼쪽은 표시 높이에, 오른쪽은 기둥 꼭대기에. */}
        <text x={POST_L - LABEL_GAP} y={MARK_Y + 4} textAnchor="end" fontSize={11} fill={FAINT}>
          {T.mark(MARK_CM)}
        </text>
        <text x={POST_R + LABEL_GAP} y={POST_TOP_Y + 4} textAnchor="start" fontSize={11} fill={FAINT}>
          {T.postHeight(HEIGHT_CM)}
        </text>

        {/* 없는 것 둘 — 파선만 두면 '있는데 흐린 것'으로 읽히므로 반드시 ✕ 배지를 겹친다(§11.5).
            입구(60px)가 배지(61px)보다 낮아 골대 위 한 줄에 나란히 세운다(머리말 참조). */}
        <Verdict cx={CX - VERDICT_DX} cy={VERDICT_CY} ok={false} head={T.noCrossbarHead} tail={T.noCrossbarTail} />
        <Verdict cx={CX + VERDICT_DX} cy={VERDICT_CY} ok={false} head={T.noNetHead} tail={T.noNetTail} />

        {/* 기둥 **중심** 사이 치수 — 정본이 재는 것이 기둥 간격이므로 파이프 바깥이 아니라 중심이다. */}
        <DimLine x0={POST_L} x1={POST_R} label={T.width(GOAL_WIDTH_M)} />
      </svg>
    </FigureCard>
  );
}
