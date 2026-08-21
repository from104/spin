// 제2조(공) 도해 — 2026-08-21 기현님 지시("2조에서는 공이 주인공이어서 크기나 구조를
// 시각적으로 나타내야 한다")로 신설.
//
// 두 장이다. 조항이 말하는 것이 둘이기 때문이다:
//   ① 크기 — Laws 본문에는 없고 FIPFA 장비 규격에 있는 값(지름 33cm). 숫자만 적으면 감이
//      안 오므로 **축구공 5호와 같은 축척으로 나란히** 세워 눈으로 재게 한다.
//   ② 공기압 — Laws 본문이 공에 대해 정하는 유일한 조건. "지나치게 튀지 않되 체어가 타고
//      넘지 못할" 은 양쪽 실패를 사이에 둔 문장이라, 낮음·알맞음·높음 3칸으로 그린다.
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
import { CHAIR_NOSE_LOCAL, CHAIR_LEN_LOCAL, PowerchairSide } from './PowerchairGlyph.tsx';

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
  return (
    <svg
      viewBox={`0 0 ${SIZE_VB_W} ${SIZE_VB_H}`}
      width="100%"
      height="100%"
      role="img"
      aria-label={`파워체어풋볼 공(지름 ${BALL_CM}cm)과 축구공 5호(지름 약 ${SOCCER5_CM}cm)를 같은 축척으로 나란히 놓은 크기 비교 그림`}
    >
      {/* 바닥선 — 두 공이 같은 바닥에 서 있어야 크기 차이가 눈으로 읽힌다 */}
      <line x1={8} y1={FLOOR_Y} x2={SIZE_VB_W - 8} y2={FLOOR_Y} stroke={LINE} strokeWidth={1.5} />

      {/* 축구공 5호 — 채우지 않고 파선 윤곽으로 둔다. "이건 비교용 참고물이지 경기구가 아니다" */}
      <circle cx={SOCCER_CX} cy={SOCCER_CY} r={R_SOCCER} fill="var(--panel)" stroke={DIM} strokeWidth={1.8} strokeDasharray="6 4" />
      <text x={SOCCER_CX} y={SOCCER_CY - 4} textAnchor="middle" fontSize={13} fontWeight={600} fill={DIM}>
        축구공
      </text>
      <text x={SOCCER_CX} y={SOCCER_CY + 15} textAnchor="middle" fontSize={12} fill={FAINT}>
        5호
      </text>

      {/* 경기구 — 보드 위의 공과 같은 색(BALL_FILL)·같은 흰 테두리라 "판에서 보던 그 공"으로 읽힌다 */}
      <circle cx={BALL_CX} cy={BALL_CY} r={R_BALL} fill={BALL_FILL} stroke="#fff" strokeWidth={2.6} />
      <text x={BALL_CX} y={BALL_CY - 4} textAnchor="middle" fontSize={16} fontWeight={700} fill="#1a1206">
        파워체어풋볼
      </text>
      <text x={BALL_CX} y={BALL_CY + 18} textAnchor="middle" fontSize={13} fontWeight={600} fill="#1a1206" opacity={0.78}>
        경기구 · 13인치
      </text>

      <DimLine x0={BALL_CX - R_BALL} x1={BALL_CX + R_BALL} y={28} extendTo={BALL_CY} label={`${BALL_CM}cm`} />
      <DimLine x0={SOCCER_CX - R_SOCCER} x1={SOCCER_CX + R_SOCCER} y={SIZE_VB_H - 14} extendTo={SOCCER_CY} label={`약 ${SOCCER5_CM}cm`} />
    </svg>
  );
}

// ── 도해 ② 공기압 ────────────────────────────────────────────────────────────────────
const PANEL_W = 180;
const PANEL_GAP = 10;
const P_FLOOR = 130;
const PRESSURE_VB_W = PANEL_W * 3 + PANEL_GAP * 2;
/** 판정 배지·문구는 바닥선에서 아래로 이만큼씩. 세로 치수를 전부 `P_FLOOR` 기준 상대값으로
 *  적어 두면 바닥 높이 한 줄만 고쳐도 그림 전체가 따라온다 — 처음엔 절대값이라 위쪽에
 *  죽은 공간이 3분의 1이나 남았는데 손댈 자리가 열 군데였다. */
const VERDICT_BADGE_DY = 22;
const VERDICT_HEAD_DY = 52;
const VERDICT_TAIL_DY = 69;
const PRESSURE_VB_H = P_FLOOR + 78;

/** 체어 그림 자체는 `PowerchairGlyph.tsx` 공용 컴포넌트다(제4조 도해와 같은 체어를 쓴다 —
 *  그 파일 머리말 참고). 이 도해가 얹는 것은 **공 크기를 체어에 맞춰 역산하는 계산**뿐이다.
 *
 *  ⚠️ **볼가드가 핵심이다.** 처음엔 앞면에 붙은 짧은 세로 막대로 그렸는데 실물은 그게 아니라
 *  **바닥 가까이로 길게 뻗은 프레임**이다 — 몸통보다 한참 앞까지 나가고, 높이는 마침 공
 *  중심쯤에서 만난다(가드 세로 범위 −20~−8 안에 공 중심 −16 이 들어온다). 이 세 칸의 주장이
 *  전부 "가드가 공을 어떻게 만나는가" 라서, 가드 모양이 틀리면 세 칸이 통째로 거짓말이 된다.
 *
 *  ⚠️ 두 좌표계를 섞지 말 것. `*_LOCAL` 은 `scale()` **안쪽** 값이고 `CHAIR_NOSE`·`P_BALL_R`
 *  은 호출부가 쓰는 **바깥쪽**(스케일 적용 후) 값이다. 안쪽에 바깥쪽 값을 쓰면 배율이 두 번
 *  곱해져 가드만 앞으로 튀어나온다 — 실제로 한 번 그렇게 그려졌다. */
/** 경기 전용 체어의 **어림** 전장(가드 포함). 규정 수치가 아니다 — Law 4 는 전장을 정하지
 *  않는다. 아래 공 크기를 이 값으로 역산하므로 어림값임을 여기서 분명히 해 둔다. */
const CHAIR_LEN_CM = 130;
/** 공 반지름을 체어와 **같은 자로** 잰다. 이래야 이 칸의 크기 비가 도해 ①과 어긋나지 않는다
 *  — 앞에서 "33cm 는 이만큼 크다" 고 해 놓고 여기서 체어만 한 공을 그리면 앞 그림이 죽는다. */
const BALL_R_LOCAL = (CHAIR_LEN_LOCAL / CHAIR_LEN_CM) * (BALL_CM / 2);

const CHAIR_SCALE = 0.88;
const CHAIR_NOSE = CHAIR_NOSE_LOCAL * CHAIR_SCALE;
const P_BALL_R = BALL_R_LOCAL * CHAIR_SCALE;

function Verdict({ cx, ok, head, tail }: { cx: number; ok: boolean; head: string; tail: string }) {
  const color = ok ? 'var(--accent)' : DIM;
  const cy = P_FLOOR + VERDICT_BADGE_DY;
  return (
    <g>
      <circle cx={cx} cy={cy} r={11} fill="none" stroke={color} strokeWidth={2} />
      {ok ? (
        <path d={`M ${cx - 5} ${cy} l 3.6 4 l 6.6 -8`} fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <g stroke={color} strokeWidth={2.4} strokeLinecap="round">
          <line x1={cx - 4.6} y1={cy - 4.6} x2={cx + 4.6} y2={cy + 4.6} />
          <line x1={cx + 4.6} y1={cy - 4.6} x2={cx - 4.6} y2={cy + 4.6} />
        </g>
      )}
      <text x={cx} y={P_FLOOR + VERDICT_HEAD_DY} textAnchor="middle" fontSize={12.5} fontWeight={700} fill={ok ? 'var(--accent-text)' : 'var(--text)'}>
        {head}
      </text>
      <text x={cx} y={P_FLOOR + VERDICT_TAIL_DY} textAnchor="middle" fontSize={11.5} fill={FAINT}>
        {tail}
      </text>
    </g>
  );
}

function PanelFrame({ x0, title }: { x0: number; title: string }) {
  return (
    <g>
      <text x={x0 + PANEL_W / 2} y={18} textAnchor="middle" fontSize={12.5} fontWeight={700} fill="var(--text)">
        {title}
      </text>
      <line x1={x0 + 10} y1={P_FLOOR} x2={x0 + PANEL_W - 10} y2={P_FLOOR} stroke={LINE} strokeWidth={1.5} />
    </g>
  );
}

/** ②번 칸에서 체어를 놓는 자리. 공 위치는 여기서 파생시킨다(가드 앞코에 닿게). */
const P2_CHAIR_X = 46;

function BallPressureFigure() {
  const x1 = 0;
  const x2 = PANEL_W + PANEL_GAP;
  const x3 = (PANEL_W + PANEL_GAP) * 2;
  return (
    <svg
      viewBox={`0 0 ${PRESSURE_VB_W} ${PRESSURE_VB_H}`}
      width="100%"
      height="100%"
      role="img"
      aria-label="공기압 세 경우 비교 그림. 낮으면 눌린 공을 체어가 타고 넘고, 알맞으면 볼가드에 걸려 굴러 나가며, 높으면 공이 지나치게 튄다."
    >
      {/* ① 낮음 — 납작해진 공 위로 앞바퀴가 올라탄다 */}
      <PanelFrame x0={x1} title="공기압이 낮으면" />
      <ellipse cx={x1 + 100} cy={P_FLOOR - 8} rx={22} ry={8} fill={BALL_FILL} stroke="#fff" strokeWidth={2} />
      <PowerchairSide x={x1 + 52} y={P_FLOOR} rotate={-9} scale={CHAIR_SCALE} />
      <path
        d={`M ${x1 + 128} ${P_FLOOR - 30} Q ${x1 + 150} ${P_FLOOR - 44} ${x1 + 166} ${P_FLOOR - 22}`}
        fill="none"
        stroke={DIM}
        strokeWidth={1.4}
        strokeDasharray="4 3"
      />
      <path d={`M ${x1 + 166} ${P_FLOOR - 22} l -1.4 -7.6 l 6.6 2.6 Z`} fill={DIM} />
      <Verdict cx={x1 + PANEL_W / 2} ok={false} head="체어가 타고 넘는다" tail="공이 눌려 굴러가지 않는다" />

      {/* ② 알맞음 — 볼가드가 공을 앞으로 민다 */}
      <PanelFrame x0={x2} title="알맞은 공기압" />
      <PowerchairSide x={x2 + P2_CHAIR_X} y={P_FLOOR} scale={CHAIR_SCALE} />
      {/* 공 자리를 손으로 찍지 않는다 — "가드 앞코가 공에 닿는다" 를 식으로 적으면 체어나
          공 크기를 바꿔도 접촉이 유지된다. 이 칸의 주장이 바로 그 접촉이다. */}
      <circle
        cx={x2 + P2_CHAIR_X + CHAIR_NOSE + P_BALL_R}
        cy={P_FLOOR - P_BALL_R}
        r={P_BALL_R}
        fill={BALL_FILL}
        stroke="#fff"
        strokeWidth={2.2}
      />
      <line x1={x2 + 152} y1={P_FLOOR - P_BALL_R} x2={x2 + 164} y2={P_FLOOR - P_BALL_R} stroke={DIM} strokeWidth={1.6} />
      <path d={`M ${x2 + 172} ${P_FLOOR - P_BALL_R} l -8 -4.2 l 0 8.4 Z`} fill={DIM} />
      <Verdict cx={x2 + PANEL_W / 2} ok head="가드에 걸려 굴러 나간다" tail="규칙이 요구하는 상태" />

      {/* ③ 높음 — 튀어 올라 바닥을 떠난다 */}
      <PanelFrame x0={x3} title="공기압이 높으면" />
      <path
        d={`M ${x3 + 118} ${P_FLOOR} Q ${x3 + 142} ${P_FLOOR - 58} ${x3 + 166} ${P_FLOOR} Q ${x3 + 172} ${P_FLOOR - 22} ${x3 + 178} ${P_FLOOR}`}
        fill="none"
        stroke={DIM}
        strokeWidth={1.4}
        strokeDasharray="4 3"
      />
      <PowerchairSide x={x3 + 42} y={P_FLOOR} scale={CHAIR_SCALE} />
      {/* 첫 포물선 꼭짓점(2차 베지에의 중점 = P_FLOOR−29)에 공을 얹는다 — 가드를 맞고 튀어
          오른 순간이다. 포물선은 공보다 **넓게** 그린다: 폭이 같으면 공이 산을 통째로 가려
          "어디서 튀었는지" 가 안 보인다. */}
      <circle cx={x3 + 142} cy={P_FLOOR - 29 - P_BALL_R} r={P_BALL_R} fill={BALL_FILL} stroke="#fff" strokeWidth={2.2} />
      <Verdict cx={x3 + PANEL_W / 2} ok={false} head="지나치게 튄다" tail="굴리는 경기가 되지 않는다" />
    </svg>
  );
}

export function BallFigure() {
  return (
    <>
      <FigureCard
        title="크기 — 같은 축척 비교"
        aspect={`${SIZE_VB_W} / ${SIZE_VB_H}`}
        caption={`경기구는 지름 ${BALL_CM}cm(13인치)로, 축구공 5호(약 ${SOCCER5_CM}cm)의 1.5배다. 이 치수는 Laws 본문이 아니라 FIPFA 장비 규격에서 온다 — 앱의 물리 상수 BALL.diameterM 도 같은 값이다.`}
      >
        <BallSizeFigure />
      </FigureCard>
      <FigureCard
        title="공기압 — 규칙이 정하는 유일한 조건"
        aspect={`${PRESSURE_VB_W} / ${PRESSURE_VB_H}`}
        caption="규칙 본문이 공에 대해 정하는 것은 지름이 아니라 압력 하나다 — 지나치게 튀지 않으면서, 파워체어가 타고 넘지 못할 만큼. 실물이 저반발·중량형인 이유가 이것이다. 체어는 경기 전용 체어의 옆모습 비례를 따랐고, 공과의 크기 비도 대략 실물이다 — 바닥 가까이 길게 뻗은 볼가드가 공 한가운데를 만난다."
      >
        <BallPressureFigure />
      </FigureCard>
    </>
  );
}
