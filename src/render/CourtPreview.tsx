// 부록 A: `courtPreview()` → `CourtPreview.tsx`, "마크업 그대로 이식". logic.js 146–163행의
// 코트 선택 화면 미니맵 — CourtSurface 와는 별개의 독립 좌표계(축소된 자체 좌표)를 쓴다.
import type { CourtMode } from '../model/court.ts';

export interface CourtPreviewProps {
  mode: CourtMode;
}

const LINE = { fill: 'none', stroke: 'rgba(255,255,255,.95)', strokeWidth: 2.2 } as const;

export function CourtPreview({ mode }: CourtPreviewProps) {
  if (mode === 'full') {
    return (
      <svg viewBox="0 0 200 125" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <rect x={8} y={8} width={184} height={109} {...LINE} />
        <line x1={100} y1={8} x2={100} y2={117} {...LINE} />
        <circle cx={100} cy={62.5} r={18} {...LINE} />
        <path d="M8,38 L38,38 L38,87 L8,87" {...LINE} strokeWidth={1.8} />
        <path d="M192,38 L162,38 L162,87 L192,87" {...LINE} strokeWidth={1.8} />
      </svg>
    );
  }
  if (mode === 'half') {
    return (
      <svg viewBox="0 0 125 150" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <path d="M10,8 L10,142 L115,142 L115,8" {...LINE} />
        <line x1={10} y1={8} x2={115} y2={8} {...LINE} />
        <path d="M44,8 A18.5,18.5 0 0 0 81,8" {...LINE} />
        <path d="M40,142 L40,102 L85,102 L85,142" {...LINE} strokeWidth={1.8} />
        <circle cx={44} cy={142} r={3} fill="#f5f5f5" stroke="#c2410c" strokeWidth={1.2} />
        <circle cx={81} cy={142} r={3} fill="#f5f5f5" stroke="#c2410c" strokeWidth={1.2} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 125 150" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <rect
        x={10}
        y={8}
        width={105}
        height={134}
        rx={6}
        fill="rgba(255,255,255,.14)"
        stroke="rgba(255,255,255,.4)"
        strokeWidth={1.6}
        strokeDasharray="5 5"
      />
    </svg>
  );
}
