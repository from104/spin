// 하프 코트 라인. template.html 285–303행(editor)·441–459행(present) 마크업을 좌표 그대로
// 이식하고 굵기만 variant 로 분기한다. 센터점(circle fill white)은 하프 마크업에 없다 — 추가하지 않는다.
// ⚠️ 이 두 번째 줄은 **5.3 이 확인하고 그대로 둔 결정**이다(계획서 §5차 5.3 행: "HalfCourtLines.tsx:2
// 주석은 옳으니 뒤집지 않는다"). 5.3 이 풀 코트에 넣은 **센터 마크(15 cm X)도 여기에는 없다** —
// 하프 코트는 공격 진영만 그리는 훈련용 구획이라 판 위에 하프라인이 없고, 위쪽 변에 X 를 찍으면
// 코치가 경기면의 끝을 중앙으로 읽는다. 되돌리면(= 여기에 X 를 넣으면) 그 오독이 되살아난다.
//
// ── ⚠️ 2026-08-13: 위 문단 중 **"센터 마크는 여기에 없다" 는 기현님 실기 지시로 뒤집혔다** ──
// 위 문단을 지우지 않는 이유는 기록이기 때문이다(누가 언제 왜 그렇게 정했는지). 뒤집은 근거:
//  ① 위 문단의 전제 *"판 위에 하프라인이 없다"* 가 사실이 아니었다. 아래 마크업은 외곽선
//     path(왼쪽·아래·오른쪽 세 변)와 **별도로 위쪽 변을 `<line>` 으로 긋는다** — 그 선이
//     하프라인이다. 그러니 그 선의 중점은 "경기면의 끝" 이 아니라 중앙선의 중점이다.
//  ② 기현님이 판을 직접 보고 *"센터 중앙 x자를 … 하프코트에서도 표시"* 라고 지시하셨다.
//     오독 우려는 판을 쓰는 사람이 아니라 만든 사람의 추측이었다.
// 여전히 없는 것: **흰 센터 점**(circle fill=#ffffff). 그것은 X 를 통째로 덮어 가린다
// (근거·실측은 CourtSurface.tsx 의 `centerMark` 굵기 주석). 넣은 것은 X 하나뿐이다.
// 좌표는 여기서 만들지 않는다 — `COURT_DEFS.half.centerMark` 가 위쪽 변 중점을 계산한다.
//
// 좌표 출처는 COURT_DEFS.half 하나뿐이다(진실 공급원 통일 — 감사 2026-08-08 minor).
import { COURT_DEFS, SPOT_CROSS_HALF_PX } from '../../model/court.ts';
import { COURT_LINE_WEIGHTS, type CourtLineVariant } from '../CourtSurface.tsx';
import { GoalPostMarks } from './GoalPostMarks.tsx';

export interface HalfCourtLinesProps {
  variant: CourtLineVariant;
}

const DEF = COURT_DEFS.half;

export function HalfCourtLines({ variant }: HalfCourtLinesProps) {
  const w = COURT_LINE_WEIGHTS[variant];
  // ★ FullCourtLines 와 같은 이유로 좌표를 COURT_DEFS 에서 파생한다(리터럴 금지).
  const S = DEF.surface;
  const gz = DEF.ruleZones[0]!;

  // 골 십자: spotMarks 중심(250, 312.5)에서 dx=dy=SPOT_CROSS_HALF_PX(3.5)로 벌린 X 표시 하나 —
  // full 과 달리 variant 별 .5px 분기가 마크업에 없다(그대로 보존).
  // ⚠️ 리터럴 3.5 를 여기로 되돌리지 마라 — 센터 마크가 이 값에서 파생된다(court.ts 근거).
  const crossD = DEF.spotMarks.map(({ x, y }) => {
    const x1 = x - SPOT_CROSS_HALF_PX;
    const x2 = x + SPOT_CROSS_HALF_PX;
    const y1 = y - SPOT_CROSS_HALF_PX;
    const y2 = y + SPOT_CROSS_HALF_PX;
    return `M${x1},${y1} L${x2},${y2} M${x2},${y1} L${x1},${y2}`;
  });

  return (
    <>
      <g fill="none" stroke="#ffffff" strokeLinecap="butt">
        <path
          d={`M${S.x},${S.y} L${S.x},${S.y + S.h} L${S.x + S.w},${S.y + S.h} L${S.x + S.w},${S.y}`}
          strokeWidth={w.outline}
        />
        <line x1={S.x} y1={S.y} x2={S.x + S.w} y2={S.y} strokeWidth={w.outline} />
        {/* ⚠️ 여기 있던 **센터 서클 반원**(`A75,75`)을 지웠다 — 5.3/§9 결정 ⑧. 반지름 3 m 원은
            Laws 2025 에 없다(전문 50쪽에 "circle" 0회). 되돌리면 하프 코트 위쪽 변이 다시 일반
            축구의 센터 서클처럼 보인다. (뒷문장이던 "대신 센터 마크는 넣지 않는다" 는
            2026-08-13 기현님 지시로 뒤집혔다 — 아래 centerMark path 와 파일 머리말 참고.
            **반원 삭제는 그대로다**: 지운 것은 원이고, 넣은 것은 X 다.) */}
        {DEF.cornerCuts.map((d) => (
          <path key={d} d={d} strokeWidth={w.outline} />
        ))}
        {/* 5.2 — 인크로치먼트 마크. 골대가 하나뿐이라 **2개**다(풀은 4개). */}
        {DEF.encroachMarks.map((d) => (
          <path key={d} d={d} strokeWidth={w.outline} />
        ))}
        <path
          d={`M${gz.x},${S.y + S.h} L${gz.x},${gz.y} L${gz.x + gz.w},${gz.y} L${gz.x + gz.w},${S.y + S.h}`}
          strokeWidth={w.goalArea}
        />
        {/* 5.3 센터 마크 — **2026-08-13 기현님 실기 지시로 하프에도 그린다**(파일 머리말 근거).
            FullCourtLines 와 **한 글자도 다르지 않은** 식이다: 좌표는 court.ts 가 위쪽 변(=하프
            라인) 중점에서 만들고, 굵기는 variant 표를 그대로 읽는다. 여기서 좌표를 새로 만들면
            판·종이·PNG 가 갈라진다. `!== null` 가드는 flat 과 규약을 맞추려고 남긴다. */}
        {DEF.centerMark !== null && <path d={DEF.centerMark} strokeWidth={w.centerMark} />}
      </g>
      {w.goalCross !== undefined && (
        <g fill="none" stroke="#ffffff" strokeWidth={w.goalCross} strokeLinecap="round">
          {crossD.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      )}
      {w.spotR !== undefined && (
        // 받침판 + 기둥. 편집기 갈래(물리 바디가 그린다)도 그 컴포넌트가 안다.
        <GoalPostMarks def={DEF} variant={variant} spotR={w.spotR} spotSw={w.spotSw} />
      )}
    </>
  );
}
