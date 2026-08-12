// §3.11 목록 요약. 저장 시 이 요약만 IDB summaries 스토어에 두고, 본문(Drill)은 필요할 때만 연다.
// 요약 필드 호환 규약: 필드는 추가만 가능 — 제거·의미변경이 필요하면 SUMMARY_BUILD 가 아니라
// DB_VERSION 을 올려 스토어를 새로 만든다.
import type { Drill, TeamSide, TeamStyle, DrillLevel } from './drill.ts';
import type { DrillId } from '../core/ids.ts';
import type { CourtMode } from './court.ts';
import { buildThumb, type ThumbSpec } from './thumb.ts';

/** ★ §7 3.2/3.3 결정 — **교육 필드(목적·코칭 포인트·필요 인원·필요 장비)와 훈련량(반복·세트·
 *  인터벌)은 요약에 싣지 않는다. SUMMARY_BUILD 는 1 그대로다.** 근거 셋:
 *
 *  1. **목록이 안 읽는다.** 요약의 존재 이유는 "본문을 열지 않고 목록을 그리는 것" 인데, 카드가
 *     그리는 것은 제목·카테고리·난이도·소요시간·태그·썸네일뿐이다. 교육 필드를 읽는 첫 소비자는
 *     4차 PDF 인데 그건 스텝이 필요해서 어차피 **본문을 연다**.
 *  2. **`rebuildAllSummaries` 는 호출자가 0 이다**(§7 4.1 B-6 이 함정으로 등록해 둔 그것).
 *     지금 build 를 올리면 이미 저장된 레코드의 요약은 build:1 인 채 새 필드가 없고, 아무도
 *     다시 만들어 주지 않는다 → **같은 화면에서 어떤 드릴은 값이 보이고 어떤 드릴은 빈칸**이 된다.
 *     "아예 안 보인다" 보다 "레코드마다 다르다" 가 나쁘다.
 *  3. `searchKey` 도 같은 이유로 안 건드린다. 목적을 검색어에 넣으면 **최근에 저장한 드릴만**
 *     그 말로 찾히는 검색이 된다 — 사용자는 그것을 "검색이 가끔 안 된다" 로 겪는다.
 *
 *  실을 때가 오면(예: 목록에 "3회×2세트" 배지) 조건은 하나다 — **build 상승과 재구축 경로를
 *  같은 커밋에서** 만들 것. 4차 4.1(backup 봉투 복원)이 그 경로를 명세하기로 돼 있다. */
export const SUMMARY_BUILD = 1;
export interface DrillSummary {
  id: DrillId;
  build: number; // = SUMMARY_BUILD. 레코드별 버전(전역 스윕 금지)
  title: string;
  category: string;
  level: DrillLevel;
  durationMin: number;
  tags: string[];
  courtMode: CourtMode;
  stepCount: number;
  createdAt: number;
  updatedAt: number;
  teams: Record<TeamSide, TeamStyle>; // 썸네일이 색을 여기서 읽는다
  thumb: ThumbSpec;
  searchKey: string;
  corrupt?: true; // 본문이 손상돼 열 수 없는 레코드(§4.4)
}

function buildSearchKey(d: Drill): string {
  return [d.title, d.category, d.formation, ...d.tags].join(' ').toLowerCase();
}

export function buildSummary(d: Drill): DrillSummary {
  return {
    id: d.id,
    build: SUMMARY_BUILD,
    title: d.title,
    category: d.category,
    level: d.level,
    durationMin: d.durationMin,
    tags: d.tags.slice(),
    courtMode: d.courtMode,
    stepCount: d.steps.length,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    teams: structuredClone(d.teams),
    thumb: buildThumb(d),
    searchKey: buildSearchKey(d),
  };
}
