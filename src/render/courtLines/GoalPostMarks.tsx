// 정적 골대 표시 — 받침판 + 기둥. 시연·PNG·인쇄가 **같은 것**을 그리게 하는 한 곳이다.
//
// 편집기에서는 골대가 물리 바디라 이 컴포넌트를 아예 부르지 않는다(§5.4). ObjectLayer →
// GoalPost.tsx 가 writer 로 구동한다 — 같이 그리면 원위치 표시와 실제 골대가 겹쳐 두 개로 보인다.
//
// ── ⚠️ 2026-09-06: **부르는 자리가 바뀌었다** (기현 지시: *"골대 밑판 위에 코트 라인이 보임"*) ──
// 그 전에는 `FullCourtLines`/`HalfCourtLines` 의 **끝**에서 불렀다. 그러면 골대가 코트 라인
// 그룹 안, 즉 격자·규칙 존·진영 깃발·규칙 표시보다 **아래** 층에 놓인다 — 그런데 편집 화면은
// 골대를 `ObjectLayer` 가 그려 그 넷보다 **위**에 둔다. 그 차이가 실기에서 이렇게 보였다:
// 골 지역 규칙 존(rect x=37.5, 흰 파선 stroke-width 2)이 받침판(x 21.25~40)의 오른쪽 2.5 px
// 띠를 가로질러, 종이·그림·시연에서만 밑판 위에 선이 얹혔다.
// 그래서 골대는 코트 라인에서 떼어 **규칙 표시 뒤·개체 목록 앞**(= 편집 화면의 자리)에서
// 그린다. 부르는 곳은 셋이다: PresentStage · PrintCourt · buildStaticSvg(goalPostsMarkup).
// 순서를 잡아 주는 검사는 `render/courtFurniture.order.test.tsx` 다.
//
// ── 받침판 (2026-08-30 기현님 실물 사진) ──────────────────────────────────────────────
// 실물 골대는 기둥만 서 있는 것이 아니라 무게추 **사각판** 위에 꽂혀 있고, 그 판은
// *"골라인쪽+사이드라인쪽"*, 즉 경기면 밖 대각으로 비켜 놓인다. 기하는 `model/court.ts` 의
// `goalBaseRect` 하나가 정한다 — 이 파일도, 편집기도, PNG 내보내기도 거기서 받는다.
//
// ⚠️ 판이 **먼저** 온다(기둥보다 아래 층). 기둥은 판에 꽂힌 것이므로 위에 있어야 한다.
// ⚠️ 판에는 **테두리가 없다**(`stroke="none"`). 그룹의 주황 stroke 는 **기둥 원**의 것인데,
//    판이 같은 그룹에 있어 상속으로 딸려 들어가 있었다(2026-09-06 수정) — 편집기의 판
//    (GoalPost.tsx 의 `BasePlate`)은 처음부터 테두리가 없었고, 그 주황 테가 골라인과 겹쳐
//    "밑판 위에 선이 있다" 로 보이던 두 번째 원인이다.
import { GOAL_BASE_FILL, GOAL_POST_EDGE, GOAL_POST_FILL, OBJ_STROKE } from '../../core/colors.ts';
import { goalBaseRect } from '../../model/court.ts';
import type { CourtDef } from '../../model/court.ts';

export interface GoalPostMarksProps {
  def: CourtDef;
  spotR: number;
  /** 변형마다 다르다. 호출부가 이미 spotR 유무로 그릴지 말지를 막고 있으므로, 여기서 임의
   *  기본값을 만들지 않는다 — 만들면 그 계약이 두 곳으로 갈린다. */
  spotSw: number | undefined;
}

export function GoalPostMarks({ def, spotR, spotSw }: GoalPostMarksProps) {
  if (def.goalPosts.length === 0) return null;
  return (
    <g fill={GOAL_POST_FILL} stroke={GOAL_POST_EDGE} strokeWidth={spotSw}>
      {def.goalPosts.map((p, i) => {
        const b = goalBaseRect(def, i);
        return b === null ? null : (
          <rect key={`base-${p.x},${p.y}`} x={b.x} y={b.y} width={b.w} height={b.h} fill={GOAL_BASE_FILL} stroke="none" />
        );
      })}
      {def.goalPosts.map((p) => (
        <circle key={`${p.x},${p.y}`} cx={p.x} cy={p.y} r={spotR} />
      ))}
      {/* 흰 덧테 — 밝은 코트와 어두운 코트를 모두 견디게 하는 얇은 후광. 편집 화면의 골대
          (GoalPost.tsx)가 처음부터 달고 있던 것인데 정적 경로에만 짝이 없었다(2026-09-06).
          정본이 편집 화면이므로 여기에 더한다. 굵기 0.4 도 그쪽과 같은 값이다. */}
      {def.goalPosts.map((p) => (
        <circle key={`halo-${p.x},${p.y}`} cx={p.x} cy={p.y} r={spotR} fill="none" stroke={OBJ_STROKE} strokeWidth={0.4} />
      ))}
    </g>
  );
}
