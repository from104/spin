// 제4조(선수 장비) 도해 — 2026-08-21, 제2조와 같은 지시("같은 퀄리티로")로 신설.
//
// 제2조처럼 두 장이다:
//   ① 규정 장비 라벨 도해 — "기본 장비" 목록을 글로 나열하면 여섯 항목이 그냥 나열된다.
//      실물 위 제자리에 라벨을 붙이면 "왜 거기 있는지" 가 같이 읽힌다.
//   ② 속도 — 전진·후진 대칭. Law 4 는 "전후진 공통 10km/h" 라고만 적는데, 그게 왜 특이한
//      조항인지(보통 휠체어·스쿠터는 후진이 더 느리다)는 비교가 있어야 보인다.
//
// 체어 그림은 `PowerchairGlyph.tsx` 의 공용 컴포넌트다 — 제2조 도해와 **같은 체어**를 쓴다.
// 실물 근거는 스트라이크포스(Power Soccer Shop) 사용설명서
// (https://manuals.plus/ko/power-soccer-shop/strike-force-manual, 2026-08-21 기현님이 링크를 줌):
// 가드 규격·위치 고정, 전도방지 바+캐스터, 전후진 공통 10km/h 상한이 전부 그 문서의 사실이다.
// 정본 문서 쪽 출처 표기는 `docs/RULES-FIPFA-2025.md` Law 4 "실물 예시" 절 참고.
import { FigureCard } from './FigureCard.tsx';
import { CHAIR_NOSE_LOCAL, PowerchairSide } from './PowerchairGlyph.tsx';
import { Callout } from './Callout.tsx';
import { figureTextFor } from './text.ts';
import { useLocale } from '../../../i18n/useLocale.ts';

const LINE = 'var(--border-strong)';
const DIM = 'var(--muted)';
const FAINT = 'var(--faint-text)';

// ── 도해 ① 규정 장비 라벨 ────────────────────────────────────────────────────────────
const EQ_VB_W = 440;
const EQ_VB_H = 380;
/** 체어를 앉히는 자리 — 원점(구동륜 접지)의 화면 좌표 + 확대율. `PowerchairGlyph` 의 로컬
 *  좌표(예: `CHAIR_NOSE_LOCAL`)를 화면 좌표로 바꿀 때 항상 이 두 값을 함께 곱해 쓴다. */
const EQ_OX = 170;
const EQ_OY = 252;
const EQ_SCALE = 1.65;
/** 로컬 좌표 → 화면 좌표. 경계선·말풍선 다리를 체어와 같은 자로 맞추는 유일한 통로다 —
 *  손으로 화면 좌표를 따로 찍으면 체어를 옮길 때마다 전부 다시 계산해야 한다. */
const toScreen = (localX: number, localY: number): [number, number] => [EQ_OX + localX * EQ_SCALE, EQ_OY + localY * EQ_SCALE];

function EquipmentLabelFigure() {
  const T = figureTextFor(useLocale());
  // 가드 라벨 자리는 `CHAIR_NOSE_LOCAL`(볼가드 앞코, 글리프 쪽 진짜 상수)에서 뺀다 — 숫자
  // 48 을 손으로 다시 적으면 글리프가 가드 길이를 바꿀 때 라벨만 따로 논다.
  const guard: [number, number] = toScreen((14 + CHAIR_NOSE_LOCAL) / 2, -14);
  const belt: [number, number] = toScreen(4, -25.5);
  const armrest: [number, number] = toScreen(-4.5, -37);
  const antiTip: [number, number] = toScreen(0, -33);
  const caster: [number, number] = toScreen(-38, -4);
  // 밑판 경계선 — "체어 밑판" 을 섀시(등받이 뒷면~앞 캐스터 앞면)로 잡는다. 가드는 별도
  // 필수 부착물이라 이 선 밖으로 나가도 위반이 아니다(라벨에서 그 예외를 명시한다).
  const boundaryTopY = toScreen(0, -68)[1];
  const boundaryBotY = toScreen(0, 0)[1];
  const [rearX] = toScreen(-24, 0);
  const [frontX] = toScreen(54, 0);

  return (
    <svg
      viewBox={`0 0 ${EQ_VB_W} ${EQ_VB_H}`}
      width="100%"
      height="100%"
      role="img"
      aria-label={T.equipment.chairAria}
    >
      <line x1={40} y1={EQ_OY} x2={EQ_VB_W - 40} y2={EQ_OY} stroke={LINE} strokeWidth={1.5} />

      {/* 밑판 경계선 — 점선 두 줄 + 위쪽 눈금. 체어보다 먼저 그려 체어 밑에 깔리게 한다. */}
      <line x1={rearX} y1={boundaryTopY} x2={rearX} y2={boundaryBotY} stroke={FAINT} strokeWidth={1.2} strokeDasharray="5 4" />
      <line x1={frontX} y1={boundaryTopY} x2={frontX} y2={boundaryBotY} stroke={FAINT} strokeWidth={1.2} strokeDasharray="5 4" />

      <PowerchairSide x={EQ_OX} y={EQ_OY} scale={EQ_SCALE} showAntiTip showBelt showArmrest />

      <Callout ax={guard[0]} ay={guard[1]} lx={372} ly={258} label={T.equipment.frontguard} />
      <Callout ax={belt[0]} ay={belt[1]} lx={78} ly={118} label={T.equipment.seatbelt} />
      <Callout ax={armrest[0]} ay={armrest[1]} lx={230} ly={40} label={T.equipment.sideSupport} />
      <Callout ax={antiTip[0]} ay={antiTip[1]} lx={78} ly={302} label={T.equipment.antiTipBar} />
      <Callout ax={caster[0]} ay={caster[1]} lx={150} ly={345} label={T.equipment.rearCaster} />
      <line x1={rearX} y1={boundaryTopY} x2={330} y2={345} stroke={DIM} strokeWidth={1.1} strokeDasharray="3 3" opacity={0.8} />
      <line x1={frontX} y1={boundaryTopY} x2={330} y2={345} stroke={DIM} strokeWidth={1.1} strokeDasharray="3 3" opacity={0.8} />
      <text x={330} y={345} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--text)">
        {T.equipment.baseLine}
      </text>
      <text x={330} y={361} textAnchor="middle" fontSize={10.5} fill={FAINT}>
        {T.equipment.baseLineExcept}
      </text>
    </svg>
  );
}

// ── 도해 ② 속도 — 전진·후진 대칭 ────────────────────────────────────────────────────
const SPD_VB_W = 380;
const SPD_VB_H = 190;
const SPD_BAR_X = 150;
const SPD_BAR_H = 15;
/** 파워체어풋볼 규정 칸의 두 막대 — **같은 변수**를 두 번 쓴다. 손으로 두 값을 따로 적으면
 *  "전후진 동일" 이라는 그림의 주장이 편집 한 번에 깨질 수 있다. */
const SPD_EQUAL_W = 190;

function SpeedRow({
  y,
  labelLines,
  fwdW,
  revW,
  fwdText,
  revText,
  emphasize,
}: {
  y: number;
  labelLines: readonly string[];
  fwdW: number;
  revW: number;
  fwdText: string;
  revText: string;
  emphasize: boolean;
}) {
  const fill = emphasize ? 'var(--accent)' : DIM;
  const textFill = emphasize ? 'var(--accent-ink)' : 'var(--text)';
  const barGap = 22;
  return (
    <g>
      {labelLines.map((line, i) => (
        <text key={i} x={4} y={y + 10 + i * 14} fontSize={12} fontWeight={600} fill="var(--text)">
          {line}
        </text>
      ))}
      <rect x={SPD_BAR_X} y={y} width={fwdW} height={SPD_BAR_H} rx={4} fill={fill} opacity={emphasize ? 1 : 0.6} />
      <text x={SPD_BAR_X + 8} y={y + SPD_BAR_H - 3.5} fontSize={11} fontWeight={700} fill={textFill}>
        {fwdText}
      </text>
      <rect x={SPD_BAR_X} y={y + barGap} width={revW} height={SPD_BAR_H} rx={4} fill={fill} opacity={emphasize ? 1 : 0.6} />
      <text x={SPD_BAR_X + 8} y={y + barGap + SPD_BAR_H - 3.5} fontSize={11} fontWeight={700} fill={textFill}>
        {revText}
      </text>
    </g>
  );
}

function SpeedSymmetryFigure() {
  const T = figureTextFor(useLocale());
  const rowARevW = 82; // 정성적 비교용 — "더 느리다" 만 주장하므로 정확한 비율을 적지 않는다.
  const rowBY = 118;
  const rowBGap = 22;
  const bracketX = SPD_BAR_X + SPD_EQUAL_W + 10;
  return (
    <svg
      viewBox={`0 0 ${SPD_VB_W} ${SPD_VB_H}`}
      width="100%"
      height="100%"
      role="img"
      aria-label={T.equipment.speedAria}
    >
      <SpeedRow
        y={40}
        labelLines={T.equipment.ordinaryChair}
        fwdW={SPD_EQUAL_W}
        revW={rowARevW}
        fwdText={T.equipment.forward}
        revText={T.equipment.reverseSlower}
        emphasize={false}
      />
      <text x={SPD_BAR_X} y={40 + 22 * 2 + 14} fontSize={10.5} fill={FAINT}>
        {T.equipment.reverseNote}
      </text>

      <line x1={4} y1={100} x2={SPD_VB_W - 4} y2={100} stroke={LINE} strokeWidth={1} opacity={0.5} />

      <SpeedRow
        y={rowBY}
        labelLines={T.equipment.ruleChair}
        fwdW={SPD_EQUAL_W}
        revW={SPD_EQUAL_W}
        fwdText={T.equipment.forwardLimit}
        revText={T.equipment.reverseLimit}
        emphasize
      />
      {/* 두 막대 오른쪽 끝이 같은 x — 눈으로도 "동일" 이 보이도록 대괄호로 한 번 더 묶는다. */}
      <path
        d={`M ${bracketX - 6} ${rowBY} L ${bracketX} ${rowBY} L ${bracketX} ${rowBY + rowBGap + SPD_BAR_H} L ${bracketX - 6} ${rowBY + rowBGap + SPD_BAR_H}`}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.8}
      />
      <text x={bracketX + 10} y={rowBY + (rowBGap + SPD_BAR_H) / 2 + 4} fontSize={12} fontWeight={700} fill="var(--accent-text)">
        {T.equipment.same}
      </text>
    </svg>
  );
}

export function EquipmentFigure() {
  const T = figureTextFor(useLocale());
  return (
    <>
      <FigureCard
        title={T.equipment.chairCardTitle}
        aspect={`${EQ_VB_W} / ${EQ_VB_H}`}
        caption={T.equipment.chairCardCaption}
      >
        <EquipmentLabelFigure />
      </FigureCard>
      <FigureCard
        title={T.equipment.speedCardTitle}
        aspect={`${SPD_VB_W} / ${SPD_VB_H}`}
        caption={T.equipment.speedCardCaption}
      >
        <SpeedSymmetryFigure />
      </FigureCard>
    </>
  );
}
