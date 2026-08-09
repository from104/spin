// 풀 코트 라인. template.html 259–279행(editor)·413–439행(present) 마크업을 좌표 그대로
// 이식하고 굵기만 variant 로 분기한다 — 좌표를 새로 만들지 않는다.
//
// 좌표 출처는 COURT_DEFS.full 하나뿐이다(진실 공급원 통일 — 감사 2026-08-08 minor). 이전에는
// cornerCuts/goalPosts/spotMarks 와 동일한 좌표가 이 파일에 리터럴로 중복돼 있었다.
import { COURT_DEFS } from '../../model/court.ts';
import { COURT_LINE_WEIGHTS, type CourtLineVariant } from '../CourtSurface.tsx';

export interface FullCourtLinesProps {
  variant: CourtLineVariant;
}

const DEF = COURT_DEFS.full;

export function FullCourtLines({ variant }: FullCourtLinesProps) {
  const w = COURT_LINE_WEIGHTS[variant];
  // 골 십자 좌표는 editor 259행대와 present 413행대에서 .5px 차이가 난다 — 그대로 보존한다.
  // spotMarks 중심(112.5/687.5, 250)에서 dx=3.5, dy=variant 별 3(editor)/3.5(present) 만큼
  // 벌린 X 표시 두 개.
  const crossDy = variant === 'present' ? 3.5 : 3;
  // ★ 외곽선·하프라인·센터서클·골지역을 **COURT_DEFS 에서 파생**한다(리터럴 금지).
  //   2026-08-10 마진을 1.5 m 로 넓히며 COURT_DEFS 좌표를 전부 옮겼는데 여기 리터럴이 옛
  //   자리에 남아, 외곽선만 제자리이고 골대·골지역이 선 밖으로 삐져나왔다(기현 실기 신고).
  //   파일 상단 주석은 진작 "좌표 출처는 COURT_DEFS 하나뿐" 이라고 적혀 있었지만 사실이
  //   아니었다 — minor #7 가드가 goalPosts/cornerCuts/spotMarks 만 봤기 때문이다.
  const S = DEF.surface;
  const [gzL, gzR] = DEF.ruleZones; // 좌·우 골 지역
  const crossD = DEF.spotMarks.map(({ x, y }) => {
    const x1 = x - 3.5;
    const x2 = x + 3.5;
    const y1 = y - crossDy;
    const y2 = y + crossDy;
    return `M${x1},${y1} L${x2},${y2} M${x2},${y1} L${x1},${y2}`;
  });

  return (
    <>
      <g fill="none" stroke="#ffffff" strokeLinecap="butt">
        <rect x={S.x} y={S.y} width={S.w} height={S.h} strokeWidth={w.outline} />
        <line x1={S.x + S.w / 2} y1={S.y} x2={S.x + S.w / 2} y2={S.y + S.h} strokeWidth={w.outline} />
        <circle cx={S.x + S.w / 2} cy={S.y + S.h / 2} r={75} strokeWidth={w.outline} />
        {DEF.cornerCuts.map((d) => (
          <path key={d} d={d} strokeWidth={w.outline} />
        ))}
        <path d={`M${S.x},${gzL!.y} L${gzL!.x + gzL!.w},${gzL!.y} L${gzL!.x + gzL!.w},${gzL!.y + gzL!.h} L${S.x},${gzL!.y + gzL!.h}`} strokeWidth={w.goalArea} />
        <path d={`M${S.x + S.w},${gzR!.y} L${gzR!.x},${gzR!.y} L${gzR!.x},${gzR!.y + gzR!.h} L${S.x + S.w},${gzR!.y + gzR!.h}`} strokeWidth={w.goalArea} />
      </g>
      <circle cx={S.x + S.w / 2} cy={S.y + S.h / 2} r={w.centerR} fill="#ffffff" />
      {w.goalCross !== undefined && (
        <g fill="none" stroke="#ffffff" strokeWidth={w.goalCross} strokeLinecap="round">
          {crossD.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      )}
      {w.spotR !== undefined && (
        <g fill="#f5f5f5" stroke="#c2410c" strokeWidth={w.spotSw}>
          {/* 편집기에서는 골대가 물리 바디라 ObjectLayer 가 그린다(§5.4) — 여기 정적 원을
              같이 그리면 원위치 표시와 실제 골대가 겹쳐 두 개로 보인다. */}
          {(variant === 'editor' ? [] : DEF.goalPosts).map((p) => (
            <circle key={`${p.x},${p.y}`} cx={p.x} cy={p.y} r={w.spotR} />
          ))}
        </g>
      )}
    </>
  );
}
