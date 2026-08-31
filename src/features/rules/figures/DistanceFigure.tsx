// 재개 거리 개념도 — "아웃 오브 플레이" 주제(2026-08-22 재설계)의 유일한 신규 도해.
//
// 대부분의 재개(킥오프·킥인·코너킥·골킥·프리킥·페널티킥)는 상대가 공에서 5m 밖에 있어야
// 하고, 세트볼만 3m 밖(참여 2명은 오히려 30cm 이내)이다 — 산문만으로는 "5m 대 3m"이 감이
// 안 와서 두 반지름을 겹쳐 그린다. 체어 두 대를 각 링 위에 놓아 사람 스케일로 읽히게 한다.
//
// 좌표는 이 도해 전용 스케일(18px/m)이다 — `ruleScenes.ts` 의 GEO(25px/m)와는 다른 값이다.
// 이 그림은 코트 좌표계 위에 있지 않으므로 맞출 이유가 없다(코트 재현이 아니라 독립 삽화).
import { FigureCard } from './FigureCard.tsx';
import { PowerchairSide } from './PowerchairGlyph.tsx';
import { figureTextFor } from './text.ts';
import { useLocale } from '../../../i18n/useLocale.ts';

const VB_W = 320;
const VB_H = 280;
const CX = 150;
const CY = 140;
const R_5M = 90; // 18px/m × 5m
const R_3M = 54; // 18px/m × 3m

const LINE = 'var(--border-strong)';
const DIM = 'var(--muted)';
const FAINT = 'var(--faint-text)';

function RadialDim({ x1, y1, x2, y2, label, lx, ly }: { x1: number; y1: number; x2: number; y2: number; label: string; lx: number; ly: number }) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const head = 6;
  // 화살촉 — 진행 방향(중심→링) 기준 뒤로 접힌 삼각형(제도 화살표 관례, BallFigure.DimLine 과 결).
  const backX = x2 - ux * head * 1.4;
  const backY = y2 - uy * head * 1.4;
  const perpX = -uy * head * 0.62;
  const perpY = ux * head * 0.62;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={DIM} strokeWidth={1.6} />
      <path d={`M ${x2} ${y2} L ${backX + perpX} ${backY + perpY} L ${backX - perpX} ${backY - perpY} Z`} fill={DIM} />
      <text x={lx} y={ly} textAnchor="middle" fontSize={13} fontWeight={700} fill={DIM}>
        {label}
      </text>
    </g>
  );
}

export function DistanceFigure() {
  const T = figureTextFor(useLocale());
  return (
    <FigureCard
      title={T.distance.title}
      aspect={`${VB_W} / ${VB_H}`}
      caption={T.distance.caption}
    >
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        width="100%"
        height="100%"
        role="img"
        aria-label={T.distance.aria}
      >
        {/* 5m 원 — 대부분의 재개. 실선, draw-in(§4). strokeDashoffset=0 이 최종/기본 상태라
            reduced-motion 이 애니메이션을 꺼도 완성된 원 그대로다. */}
        <circle cx={CX} cy={CY} r={R_5M} fill="none" stroke={LINE} strokeWidth={2} strokeDashoffset={0} className="rules-distance-ring-5m" />
        {/* 3m 원 — 세트볼. 파선, 5m 원 draw-in 뒤에 나타난다. */}
        <circle cx={CX} cy={CY} r={R_3M} fill="none" stroke={DIM} strokeWidth={2} strokeDasharray="6 5" className="rules-distance-ring-3m" />
        {/* 중심 공. */}
        <circle cx={CX} cy={CY} r={7} fill="var(--accent)" stroke="var(--panel)" strokeWidth={1.5} />

        <RadialDim x1={CX} y1={CY} x2={CX + R_5M} y2={CY} label={T.distance.fiveM} lx={CX + R_5M / 2} ly={CY - 12} />
        <RadialDim x1={CX} y1={CY} x2={CX} y2={CY + R_3M} label={T.distance.threeM} lx={CX - 34} ly={CY + R_3M / 2 + 4} />

        {/* 5m 원 위 체어 — 중심을 바라보도록(코 방향 180°). */}
        <PowerchairSide x={CX + R_5M} y={CY} rotate={180} scale={0.5} />
        {/* 3m 원 위 체어 — 위(중심)를 바라보도록(코 방향 270°). */}
        <PowerchairSide x={CX} y={CY + R_3M} rotate={270} scale={0.5} />

        <text x={CX} y={VB_H - 12} textAnchor="middle" fontSize={11} fill={FAINT}>
          {T.distance.note}
        </text>
      </svg>
    </FigureCard>
  );
}
