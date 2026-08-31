// 제1조(필드) 도해 — 2026-08-21, "1조도 리뉴얼" 지시로 제2·4조에 이어 신설.
//
// 제1조는 이미 보드 장면(`field-tour`)이 있어 "글자만" 은 아니었다 — 골에어리어·페널티
// 마크·골대 간격·코너 트라이앵글은 실제 코트 렌더러 위에 라벨로 이미 떠 있다. 그래서 이
// 도해 두 장은 그 장면과 **겹치지 않는** 두 가지만 다룬다:
//   ① 코트 규격 3단 — Law 1 은 "25~30m·너비 14~18m 범위" 라고만 적는데, 범위는 숫자로는
//      감이 안 온다. 세 규격을 같은 축척으로 겹쳐 그리면 "표준(28×15m)이 왜 농구 코트와
//      같다는 건지" 가 한눈에 보인다.
//   ② 바닥재 — 권장/지양. field-tour 장면은 도형(라인·마크)만 그리지 표면 재질은 안 보여준다.
//      코치가 실제로 체육관 바닥을 고를 때 참고할 실용적인 사실이다.
//
// **수치는 손으로 적지 않는다.** 세 코트의 치수·라벨은 `model/court.ts` 의 `COURT_SIZES`·
// `COURT_SIZE_LABELS`(편집기 코트 크기 선택 UI가 쓰는 바로 그 상수)에서 파생시킨다 — 이
// 도해와 앱의 코트 크기 선택지가 같은 세 값을 가리킨다는 사실이 그림에서 증명된다.
import { COURT_SIZES, COURT_SIZE_LABELS } from '../../../model/court.ts';
import { FigureCard } from './FigureCard.tsx';
import { Callout } from './Callout.tsx';
import { Verdict } from './Verdict.tsx';
import { figureTextFor } from './text.ts';
import { useLocale } from '../../../i18n/useLocale.ts';

const LINE = 'var(--border-strong)';
const DIM = 'var(--muted)';
const FAINT = 'var(--faint-text)';

// ── 도해 ① 코트 규격 3단 ──────────────────────────────────────────────────────────────
const PX_PER_M = 13;
const CT_OX = 285;
const CT_OY = 151;
const CT_VB_W = 610;
const CT_VB_H = 338;

/** `CourtSize` 는 `'30x18'` 처럼 리터럴 문자열이라 숫자를 바로 못 쓴다 — 여기서 한 번만
 *  쪼갠다. 손으로 30·18·28·15·25·14 를 따로 적으면 `COURT_SIZES` 가 넷째 크기를 얻는 날
 *  이 도해만 조용히 낡은 셋을 그린다. */
function halfSizePx(size: (typeof COURT_SIZES)[number]): [number, number] {
  const [lengthM, widthM] = size.split('x').map(Number);
  return [(lengthM! * PX_PER_M) / 2, (widthM! * PX_PER_M) / 2];
}

const [MAX_HW, MAX_HH] = halfSizePx(COURT_SIZES[0]); // '30x18'
const [STD_HW, STD_HH] = halfSizePx(COURT_SIZES[1]); // '28x15'
const [MIN_HW, MIN_HH] = halfSizePx(COURT_SIZES[2]); // '25x14'

function CourtSizeFigure() {
  const labels = COURT_SIZE_LABELS.ko;
  return (
    <svg
      viewBox={`0 0 ${CT_VB_W} ${CT_VB_H}`}
      width="100%"
      height="100%"
      role="img"
      aria-label={`세 코트 규격을 같은 축척으로 겹쳐 그린 비교 그림. ${labels['30x18']}, ${labels['28x15']}, ${labels['25x14']}. 표준 규격은 농구 코트와 같은 크기다.`}
    >
      {/* 최대(30×18) — 범위의 바깥쪽 경계. 굵은 치수 화살표로 한 번 더 못박는다. */}
      <rect x={CT_OX - MAX_HW} y={CT_OY - MAX_HH} width={MAX_HW * 2} height={MAX_HH * 2} fill="none" stroke={DIM} strokeWidth={1.6} strokeDasharray="7 5" />
      <g stroke={DIM} strokeWidth={1.3}>
        <line x1={CT_OX - MAX_HW} y1={CT_OY - MAX_HH - 14} x2={CT_OX + MAX_HW} y2={CT_OY - MAX_HH - 14} />
        <path d={`M ${CT_OX - MAX_HW} ${CT_OY - MAX_HH - 14} l 6 -3.5 l 0 7 Z`} fill={DIM} stroke="none" />
        <path d={`M ${CT_OX + MAX_HW} ${CT_OY - MAX_HH - 14} l -6 -3.5 l 0 7 Z`} fill={DIM} stroke="none" />
        <line x1={CT_OX - MAX_HW - 14} y1={CT_OY - MAX_HH} x2={CT_OX - MAX_HW - 14} y2={CT_OY + MAX_HH} />
        <path d={`M ${CT_OX - MAX_HW - 14} ${CT_OY - MAX_HH} l -3.5 6 l 7 0 Z`} fill={DIM} stroke="none" />
        <path d={`M ${CT_OX - MAX_HW - 14} ${CT_OY + MAX_HH} l -3.5 -6 l 7 0 Z`} fill={DIM} stroke="none" />
      </g>
      <text x={CT_OX} y={CT_OY - MAX_HH - 20} textAnchor="middle" fontSize={12} fontWeight={700} fill={DIM}>
        30m
      </text>
      <text x={CT_OX - MAX_HW - 22} y={CT_OY + 4} textAnchor="middle" fontSize={12} fontWeight={700} fill={DIM}>
        18m
      </text>

      {/* 표준(28×15) — 이 도해의 주인공. 채워서 튀게 하고, 짧은 콜아웃으로 "농구 코트" 를
          한 번 더 못박는다(정식 문구는 아래 범례 가운데 줄이 맡는다 — 콜아웃 자리는 좁아서
          "표준 28 × 15 m (농구 코트)" 전체를 넣으면 그림 밖으로 넘친다). */}
      <rect
        x={CT_OX - STD_HW}
        y={CT_OY - STD_HH}
        width={STD_HW * 2}
        height={STD_HH * 2}
        fill="color-mix(in srgb, var(--accent) 18%, transparent)"
        stroke="var(--accent)"
        strokeWidth={2.2}
      />
      <Callout ax={CT_OX + STD_HW} ay={CT_OY} lx={CT_OX + STD_HW + 66} ly={CT_OY} label="농구 코트" />

      {/* 최소(25×14) — 안쪽 경계. */}
      <rect x={CT_OX - MIN_HW} y={CT_OY - MIN_HH} width={MIN_HW * 2} height={MIN_HH * 2} fill="none" stroke={FAINT} strokeWidth={1.6} strokeDasharray="2 3.5" />

      {/* 중심 마크 — 실제 코트의 센터 마크를 흉내낸다(순수 장식, 축척과 무관). */}
      <path d={`M ${CT_OX - 6} ${CT_OY} l 12 0 M ${CT_OX} ${CT_OY - 6} l 0 12`} stroke="var(--text)" strokeWidth={1.4} />

      {/* 범례 3줄 — 스와치가 각 사각형과 같은 선 스타일이라 그림과 바로 대응된다. 표준 줄만
          채운 정사각 스와치를 쓴다(그 사각형만 채워져 있으므로). 라벨 셋 다 `COURT_SIZE_LABELS`
          원문 그대로다 — 편집기 코트 크기 선택 UI가 쓰는 문구와 여기가 같은 말을 한다는
          증거를 텍스트 자체로 남긴다. */}
      <line x1={14} y1={CT_VB_H - 64} x2={34} y2={CT_VB_H - 64} stroke={DIM} strokeWidth={1.6} strokeDasharray="7 5" />
      <text x={40} y={CT_VB_H - 60} fontSize={11.5} fill="var(--text)">
        {labels['30x18']}
      </text>
      <rect
        x={16}
        y={CT_VB_H - 47}
        width={16}
        height={9}
        fill="color-mix(in srgb, var(--accent) 18%, transparent)"
        stroke="var(--accent)"
        strokeWidth={1.6}
      />
      <text x={40} y={CT_VB_H - 38} fontSize={11.5} fill="var(--text)">
        {labels['28x15']}
      </text>
      <line x1={14} y1={CT_VB_H - 20} x2={34} y2={CT_VB_H - 20} stroke={FAINT} strokeWidth={1.6} strokeDasharray="2 3.5" />
      <text x={40} y={CT_VB_H - 16} fontSize={11.5} fill="var(--text)">
        {labels['25x14']}
      </text>
    </svg>
  );
}

// ── 도해 ② 바닥재 — 권장 vs 지양 ────────────────────────────────────────────────────
const FL_PANEL_W = 200;
const FL_GAP = 20;
const FL_VB_W = FL_PANEL_W * 2 + FL_GAP;
const FL_FLOOR = 100;
const FL_BAND_H = 20;
const FL_VERDICT_DY = 22;
const FL_VB_H = FL_FLOOR + FL_BAND_H + 70;
const WHEEL_R = 15;

/** 목재·인조 마루 — 결(수평선) 몇 가닥. 강제색에서 색이 죽어도 "결이 있는 매끈한 면" 으로
 *  읽히게 선 몇 개로만 그린다(콘크리트의 점 텍스처와 모양으로 구분되도록). */
function WoodTexture({ x0, y0, w }: { x0: number; y0: number; w: number }) {
  return (
    <g stroke={LINE} strokeWidth={1} opacity={0.55}>
      <line x1={x0 + 8} y1={y0 + 5} x2={x0 + w - 8} y2={y0 + 5} />
      <line x1={x0 + 8} y1={y0 + 11} x2={x0 + w - 14} y2={y0 + 11} />
      <line x1={x0 + 14} y1={y0 + 17} x2={x0 + w - 8} y2={y0 + 17} />
    </g>
  );
}

/** 콘크리트·아스팔트 — 골재 점 텍스처(고정 좌표, 흩뿌린 느낌만 낸다). */
function AggregateTexture({ x0, y0 }: { x0: number; y0: number }) {
  const dots: Array<[number, number, number]> = [
    [10, 5, 1.6],
    [28, 12, 1.3],
    [46, 6, 1.8],
    [64, 15, 1.4],
    [82, 4, 1.5],
    [100, 11, 1.7],
    [118, 6, 1.3],
    [136, 14, 1.6],
    [154, 5, 1.4],
    [172, 12, 1.8],
    [20, 16, 1.2],
    [60, 8, 1.2],
    [110, 17, 1.2],
    [160, 8, 1.3],
  ];
  return (
    <g fill={LINE} opacity={0.6}>
      {dots.map(([dx, dy, r], i) => (
        <circle key={i} cx={x0 + dx} cy={y0 + dy} r={r} />
      ))}
    </g>
  );
}

function FloorPanel({ x0, title, wood, ok, head, tail }: { x0: number; title: string; wood: boolean; ok: boolean; head: string; tail: string }) {
  const cx = x0 + FL_PANEL_W / 2;
  return (
    <g>
      <text x={cx} y={18} textAnchor="middle" fontSize={12.5} fontWeight={700} fill="var(--text)">
        {title}
      </text>
      {/* 바퀴 — 접지점이 바닥선(FL_FLOOR)에 정확히 닿는다. */}
      <circle cx={cx} cy={FL_FLOOR - WHEEL_R} r={WHEEL_R} fill="var(--panel)" stroke={LINE} strokeWidth={2} />
      <circle cx={cx} cy={FL_FLOOR - WHEEL_R} r={4.5} fill={LINE} />
      {/* 접지 흔적 — 매끈한 직선 vs 들쭉날쭉한 선. 글로 안 풀어도 "왜" 가 형태로 읽힌다. */}
      {wood ? (
        <line x1={cx - 15} y1={FL_FLOOR} x2={cx + 15} y2={FL_FLOOR} stroke="var(--accent)" strokeWidth={2.4} strokeLinecap="round" />
      ) : (
        <path d={`M ${cx - 15} ${FL_FLOOR} l 5 -3 l 5 5 l 5 -4 l 5 4 l 5 -2`} fill="none" stroke={DIM} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      )}
      <line x1={x0 + 6} y1={FL_FLOOR} x2={x0 + FL_PANEL_W - 6} y2={FL_FLOOR} stroke={LINE} strokeWidth={1.5} />
      <rect x={x0 + 6} y={FL_FLOOR} width={FL_PANEL_W - 12} height={FL_BAND_H} fill="var(--elev)" />
      {wood ? <WoodTexture x0={x0 + 6} y0={FL_FLOOR} w={FL_PANEL_W - 12} /> : <AggregateTexture x0={x0 + 6} y0={FL_FLOOR} />}
      <Verdict cx={cx} cy={FL_FLOOR + FL_BAND_H + FL_VERDICT_DY} ok={ok} head={head} tail={tail} />
    </g>
  );
}

function FloorMaterialFigure() {
  const T = figureTextFor(useLocale());
  const x1 = 0;
  const x2 = FL_PANEL_W + FL_GAP;
  return (
    <svg
      viewBox={`0 0 ${FL_VB_W} ${FL_VB_H}`}
      width="100%"
      height="100%"
      role="img"
      aria-label={T.court.surfaceAria}
    >
      <FloorPanel x0={x1} title="목재·인조 마루" wood ok head="미끄럼 적고 바퀴에 부드럽다" tail="규정이 권장하는 표면" />
      <FloorPanel x0={x2} title="콘크리트·아스팔트" wood={false} ok={false} head="거칠어 타이어가 마모된다" tail="규정이 피하라는 표면" />
    </svg>
  );
}

export function CourtFigure() {
  const T = figureTextFor(useLocale());
  return (
    <>
      <FigureCard
        title={T.court.sizeCardTitle}
        aspect={`${CT_VB_W} / ${CT_VB_H}`}
        caption={`규정 범위는 ${COURT_SIZE_LABELS.ko['30x18']}부터 ${COURT_SIZE_LABELS.ko['25x14']}까지다. 그 사이 ${COURT_SIZE_LABELS.ko['28x15']} — 표준 농구 코트와 정확히 같은 크기라, 새 체육관을 구할 때 "농구 코트가 있는가"만 물으면 된다.`}
      >
        <CourtSizeFigure />
      </FigureCard>
      <FigureCard
        title={T.court.surfaceCardTitle}
        aspect={`${FL_VB_W} / ${FL_VB_H}`}
        caption={T.court.surfaceCardCaption}
      >
        <FloorMaterialFigure />
      </FigureCard>
    </>
  );
}
