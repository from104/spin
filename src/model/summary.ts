// §3.11 목록 요약. 저장 시 이 요약만 IDB summaries 스토어에 두고, 본문(Drill)은 필요할 때만 연다.
// 요약 필드 호환 규약: 필드는 추가만 가능 — 제거·의미변경이 필요하면 SUMMARY_BUILD 가 아니라
// DB_VERSION 을 올려 스토어를 새로 만든다.
import type { Drill, TeamSide, TeamStyle, DrillLevel } from './drill.ts';
import type { DrillId } from '../core/ids.ts';
import type { CourtMode, CourtSize } from './court.ts';
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
/** ── 2 (2026-08-17): 썸네일에 **작도 도형·메모**가 들어갔다 ──────────────────────────────
 *  기현님 지시 *"도형, 메모 등도 잡혀야지"*. 위 ⚠️ 가 요구한 조건을 **이번에는 지켜서** 올린다:
 *
 *  · 왜 올려야 하나 — `courtSize` 때와 달리 **"없음 = 참" 이 성립하지 않는다.** 도형은
 *    2026-08-14 에, 메모는 그 전에 생겼으니 옛 요약이 도형·메모를 **가진 드릴의 것일 수 있고**,
 *    그 카드에는 그림이 빠진 채로 남는다. 그러면 정확히 위 2번이 말한 "레코드마다 다르다" 다.
 *  · 재구축 경로 — **같은 커밋에서** `LibraryProvider` 가 목록을 처음 읽을 때 stale 레코드를
 *    보면 `rebuildAllSummaries()` 를 한 번 부르고 목록을 다시 읽는다. 그 함수는 이미
 *    build < SUMMARY_BUILD 인 것만 본문을 열어 다시 만든다(`drillRepo.ts:264`) — 이 커밋이
 *    한 일은 **호출자 0 이던 그 경로에 호출자를 준 것**이다.
 *  · `searchKey` 는 여전히 안 건드린다(3번은 유효하다). */
export const SUMMARY_BUILD = 2;
export interface DrillSummary {
  id: DrillId;
  build: number; // = SUMMARY_BUILD. 레코드별 버전(전역 스윕 금지)
  title: string;
  category: string;
  level: DrillLevel;
  durationMin: number;
  tags: string[];
  courtMode: CourtMode;
  /** §5.1/§6.4 코트 크기 3단. **선택 필드이고, 그래서 SUMMARY_BUILD 를 올리지 않는다.**
   *
   *  위 ⚠️ 가 금지하는 것은 *"새 필드를 필수로 넣고 재구축 경로 없이 두는 것"* 이다 — 그러면
   *  같은 화면에서 어떤 카드는 값이 있고 어떤 카드는 빈칸이 된다. 여기는 그 함정에 안 빠진다:
   *  **없음(undefined) = '30x18'** 이 옛 레코드에 대해 **참**이기 때문이다. 이 필드가 생기기
   *  전에 저장된 드릴은 전부 30×18 이다(크기를 고를 UI 가 §6.4 이전에는 0곳이었고, v2→v3
   *  마이그레이션이 옛 문서에 '30x18' 을 새겨 넣는다 — migrate.ts:46). 즉 옛 요약의 '빈칸'은
   *  정보 부족이 아니라 **기본값 그 자체**이고, `courtDefFor(mode, undefined)` 가 정확히
   *  그 값으로 접는다. 요약은 put/import 마다 buildSummary 로 새로 만들어지므로(drillRepo:128·
   *  166·275, transfer:259) 크기를 고른 드릴은 저장되는 순간 이 필드를 갖는다.
   *
   *  ⚠️ 다음에 요약에 필드를 더할 사람에게: 이 논증은 **"없음이 곧 옳은 기본값"** 일 때만
   *  성립한다. 그렇지 않은 필드(예: 목적·코칭 포인트)는 여전히 build 상승 + 재구축 경로가
   *  같은 커밋에 있어야 한다. */
  courtSize?: CourtSize;
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
    courtSize: d.courtSize,
    stepCount: d.steps.length,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    teams: structuredClone(d.teams),
    thumb: buildThumb(d),
    searchKey: buildSearchKey(d),
  };
}
