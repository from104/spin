// 정적 골대 표시 — 받침판 + 기둥. 풀·하프 코트 라인이 **같은 것**을 그리게 하는 한 곳이다.
//
// 편집기에서는 골대가 물리 바디라 여기서 아무것도 안 그린다(§5.4). ObjectLayer → GoalPost.tsx
// 가 writer 로 구동한다 — 같이 그리면 원위치 표시와 실제 골대가 겹쳐 두 개로 보인다.
//
// ── 받침판 (2026-08-30 기현님 실물 사진) ──────────────────────────────────────────────
// 실물 골대는 기둥만 서 있는 것이 아니라 무게추 **사각판** 위에 꽂혀 있고, 그 판은
// *"골라인쪽+사이드라인쪽"*, 즉 경기면 밖 대각으로 비켜 놓인다. 기하는 `model/court.ts` 의
// `goalBaseRect` 하나가 정한다 — 이 파일도, 편집기도, PNG 내보내기도 거기서 받는다.
//
// ⚠️ 판이 **먼저** 온다(기둥보다 아래 층). 기둥은 판에 꽂힌 것이므로 위에 있어야 한다.
import { goalBaseRect } from '../../model/court.ts';
import type { CourtDef } from '../../model/court.ts';

export interface GoalPostMarksProps {
  def: CourtDef;
  /** 'editor' 면 아무것도 안 그린다(위 머리말). */
  variant: string;
  spotR: number;
  /** 변형마다 다르다. 호출부가 이미 spotR 유무로 그릴지 말지를 막고 있으므로, 여기서 임의
   *  기본값을 만들지 않는다 — 만들면 그 계약이 두 곳으로 갈린다. */
  spotSw: number | undefined;
}

/** 받침판 색 — 기둥 테두리와 **같은 주황**이다(같은 장비의 두 부분이라 색이 갈리면 안 된다).
 *  다만 채도를 낮춰 깔아, 기둥이 판 위에서 읽히게 한다. */
const BASE_FILL_OPACITY = 0.3;

export function GoalPostMarks({ def, variant, spotR, spotSw }: GoalPostMarksProps) {
  if (variant === 'editor' || def.goalPosts.length === 0) return null;
  return (
    <g fill="#f5f5f5" stroke="#c2410c" strokeWidth={spotSw}>
      {def.goalPosts.map((p, i) => {
        const b = goalBaseRect(def, i);
        return b === null ? null : (
          <rect key={`base-${p.x},${p.y}`} x={b.x} y={b.y} width={b.w} height={b.h} fill="#c2410c" fillOpacity={BASE_FILL_OPACITY} />
        );
      })}
      {def.goalPosts.map((p) => (
        <circle key={`${p.x},${p.y}`} cx={p.x} cy={p.y} r={spotR} />
      ))}
    </g>
  );
}
