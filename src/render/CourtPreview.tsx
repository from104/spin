// 부록 A: `courtPreview()` → `CourtPreview.tsx`, "마크업 그대로 이식". logic.js 146–163행의
// 코트 선택 화면 미니맵 — CourtSurface 와는 별개의 독립 좌표계(축소된 자체 좌표)를 쓴다.
//
// ⚠️ 5.3 이 여기서도 **센터 서클(full 의 r=18 원 · half 의 A18.5 반원)을 지웠다.** 규정에 없는
//    선이고(§9 결정 ⑧), 하필 이 그림은 코치가 "이 코트가 어떻게 생겼나" 를 보고 고르는 자리라
//    잘못 가르치기에 가장 좋은 위치다. 센터 마크는 **대신 넣지 않는다** — 이 미니맵의
//    축척은 184 px : 30 m 라 규격 15 cm 가 0.9 px 이다(코트 라인 굵기 2.2 px 의 1/2 이하). 그릴 수
//    없는 것을 그리면 그것도 거짓말이다. 실제 판(CourtSurface)에는 정상적으로 들어가 있다.
//    ⚠️ 2026-08-13 기현님 실기 지시로 판의 **표시** 크기가 28 cm 로 커졌다(court.ts
//    `CENTER_MARK_HALF_PX`). 이 미니맵 축척으로 환산하면 0.9 px 이 아니라 **약 1.7 px** 이다
//    (0.28 / 30 × 184 = 1.72). 라인 굵기 2.2 px 보다 여전히 작아 **"그릴 수 없다" 는 결론은
//    그대로**지만, 위 문장의 근거 숫자는 이제 규격값 기준이라는 뜻으로 읽어야 한다.
//    (6차 검증관 정정. 판이 더 커지면 이 결론부터 다시 계산하라.)
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
