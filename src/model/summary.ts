// §3.11 목록 요약. 저장 시 이 요약만 IDB summaries 스토어에 두고, 본문(Drill)은 필요할 때만 연다.
// 요약 필드 호환 규약: 필드는 추가만 가능 — 제거·의미변경이 필요하면 SUMMARY_BUILD 가 아니라
// DB_VERSION 을 올려 스토어를 새로 만든다.
import { DRILL_TYPE_LABELS, SITUATION_LABELS } from './drill.ts';
import type { Drill, TeamSide, TeamStyle, DrillLevel, DrillType, DrillSituation } from './drill.ts';
import { SUPPORTED_LOCALES } from '../i18n/locale.ts';
import type { DrillId } from '../core/ids.ts';
import type { CourtMode, CourtSize } from './court.ts';
import { buildThumb, type ThumbSpec } from './thumb.ts';
import { LIMITS } from './validate.ts';

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
/** ── 3 (2026-08-17): **목록 카드 부제로 드릴 짧은 설명(Drill.description)을 싣는다** ──────────
 *  근거는 계획 문서(docs/PLAN-STEP-EDITING.md §텍스트의 소속, 기현님 확정): 드릴 설명은 편집
 *  화면 헤더 인라인(이번 과제 아님 — 손 안 댐)과 목록 카드 부제 두 자리에 쓰인다. 요약이
 *  맡는 건 후자뿐이다. 위 ⚠️ 가 세운 조건을 이번에도 지켜서 올린다:
 *
 *  · 왜 올려야 하나 — description 은 "없음 = 빈 부제"가 자연스러워 보이지만, 옛 요약엔 이
 *    **키 자체가 없다**(courtSize 때와 다르다 — 그때는 "없음 = 30x18"이 옛 레코드에 대해서도
 *    참이었다). 여기선 "옛 레코드에 description 이 없다"는 게 아니라 "옛 *요약*에 그 값을
 *    옮겨 담은 적이 없다"는 뜻이라, build 를 안 올리면 **본문엔 설명이 있는데 카드엔 부제가
 *    안 뜨는 레코드**가 남는다 — 위 2번이 경계한 "레코드마다 다르다"의 재현이다.
 *  · 재구축 경로 — **새로 만들 것 없다.** 이미 같은 저장소(`LibraryProvider.tsx`)에 상주한다
 *    — build 를 2 로 올릴 때 붙인 `s.build < SUMMARY_BUILD` 세션 1회 재구축 호출이 그 자리다.
 *    그 비교는 제네릭해서(부등호일 뿐 "2"를 안 박아 뒀다) 3 에도 그대로 작동한다: build:2 로
 *    저장된 레코드도 여전히 3 미만이라 다음 목록 진입에서 자동으로 다시 만들어진다.
 *  · `searchKey` — 이번엔 **넣는다**(교육 필드 때와 다른 결론). 위 ⚠️ reason①("목록이 안
 *    읽는다")이 description 엔 안 선다 — 이번 커밋이 카드에 부제로 그리게 만드는 바로 그
 *    값이다. reason③(재구축 경로 부재)도 바로 위에서 이미 해소됐다. 반론이 둘 다 무효라
 *    교육 필드처럼 뺄 이유가 없다 — `buildSearchKey` 참조. */
/** ── 4 (2026-08-18, Drill v8): **category → drillType 교체 + situation** ──────────────────
 *  파일 머리말의 호환 규약("필드는 추가만 가능, 제거·의미변경은 DB_VERSION")에 대한 **예외**라
 *  근거를 남긴다. 규약이 막으려던 사고는 "옛 레코드를 읽는 현재 코드가 없는 필드를 밟는 것"
 *  인데, 여기서는 그 창이 닫혀 있다:
 *   ① 소비 전에 재구축이 돈다 — LibraryProvider 가 목록을 읽을 때 `build < SUMMARY_BUILD`
 *     레코드를 보면 `rebuildAllSummaries()` 후 다시 읽는다(build 2 때 개통한 그 경로). 카드가
 *     그리는 시점의 레코드는 전부 build 4 다.
 *   ② 그 경로가 실패해도(IDB degraded) 밟는 것은 좌표가 아니라 **배지 하나다** — drillType
 *     이 없는 옛 레코드는 카드 배지가 회색 fallback 으로 그려질 뿐이다(DrillCard 가 방어).
 *  category 를 optional 로 남겨 두는 대안은 기각 — 죽은 키를 인터페이스에 남기면 "어느 쪽이
 *  진실이냐" 를 읽는 코드가 매번 물어야 한다(§스텝 flags 의 '두 가지 저장 방식' 논법). */
export const SUMMARY_BUILD = 5;
export interface DrillSummary {
  id: DrillId;
  build: number; // = SUMMARY_BUILD. 레코드별 버전(전역 스윕 금지)
  title: string;
  /** 목록 카드 부제(SUMMARY_BUILD 3, PLAN-STEP-EDITING.md §텍스트의 소속). `Drill.description`
   *  의 **첫 줄만**, `summaryDescription()` 이 SUBTITLE_MAX 로 자른 값 — 부제는 카드에서 한 줄
   *  로만 그려지므로 두 번째 줄부터는 애초에 저장하지 않는다(전체 설명이 필요한 화면은 본문을
   *  연다). 빈 문자열이면 **키 자체를 생략**한다(선택, 아래 buildSummary 참조) — validate.ts
   *  121행이 세운 교리와 같은 이유다: `{description: undefined}` 는 structuredClone(IDB)이
   *  키까지 보존하고 JSON(export)이 지워서, 저장·내보내기 왕복마다 문서가 달라지는 걸 막는다. */
  description?: string;
  /** 분류 유형(SUMMARY_BUILD 4, Drill v8). 옛 build 레코드에는 이 키 대신 category 가 있다 —
   *  재구축 전 한 프레임을 위해 소비처(DrillCard 배지)는 없는 값을 fallback 으로 그린다. */
  drillType: DrillType;
  /** 경기 상황(선택). 본문과 같은 교리 — 없으면 키 생략. */
  situation?: DrillSituation;
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
  // description 도 검색어에 넣는다 — SUMMARY_BUILD 3 코멘트가 정리한 결론: 목록이 이제 이 값을
  // 부제로 읽으므로(reason① 무효) 넣지 않을 이유가 없고, 옛 레코드도 세션 1회 재구축으로 따라
  // 잡는다(reason③ 무효). 전체 description(첫 줄로 안 자른 원본)을 넣는다 — 검색은 카드에 안
  // 보이는 둘째 줄 이후의 단어로도 찾혀야 하므로 summaryDescription() 의 절단과는 별개다.
  // 유형·상황(BUILD 4)은 **라벨**로 넣는다 — 사용자가 치는 말은 '세트피스' 지 'set-piece' 가
  // 아니다. 옛 category 태그(v7→v8 이 tags 에 편입)도 같은 줄에 실린다.
  // i18n C4 — 로케일 **하나**가 아니라 **세 언어 전부**를 넣는다. searchKey 는 드릴을 저장한
  // 시점에 한 번 굳는데, 그때 마침 켜져 있던 UI 언어로만 넣으면 나중에 언어를 바꾼 사용자가
  // 그 드릴을 못 찾는다(예: 한국어로 만든 드릴을 영어 UI에서 "technical" 로 검색). 세 언어를
  // 전부 넣으면 검색이 UI 언어와 무관해진다 — SUMMARY_BUILD 를 올려 기존 레코드도 재구축한다.
  return [
    d.title,
    ...SUPPORTED_LOCALES.map((loc) => DRILL_TYPE_LABELS[loc][d.drillType]),
    ...(d.situation !== undefined ? SUPPORTED_LOCALES.map((loc) => SITUATION_LABELS[loc][d.situation!]) : []),
    d.formation,
    d.description ?? '',
    ...d.tags,
  ]
    .join(' ')
    .toLowerCase();
}

/** 카드 부제 한 줄 길이 상한. `LIMITS.titleLen`(80, validate.ts)과 같은 자리 — 제목 바로
 *  아래 얹히는 보조 텍스트라 제목과 같은 규모로 맞춘다. 실제 시각적 잘림은 카드 폭에서 CSS
 *  ellipsis 가 이보다 먼저 하지만, 저장되는 요약 레코드 자체가 원본 설명(최대 400자,
 *  `LIMITS.descriptionLen`)만큼 부풀지 않도록 이 단계에서도 자른다. */
const SUBTITLE_MAX = LIMITS.titleLen;

/** `Drill.description` → 카드 부제. 첫 줄만 취하고 길이를 자른다. 빈 값(undefined·공백뿐인
 *  첫 줄)은 `undefined` 로 돌려줘 호출부가 키를 아예 생략하게 한다. */
function summaryDescription(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const firstLine = raw.split('\n')[0].trim(); // 부제는 한 줄 — 개행 이후는 저장하지 않는다
  if (firstLine.length === 0) return undefined;
  return firstLine.length <= SUBTITLE_MAX ? firstLine : firstLine.slice(0, SUBTITLE_MAX);
}

export function buildSummary(d: Drill): DrillSummary {
  const description = summaryDescription(d.description);
  return {
    id: d.id,
    build: SUMMARY_BUILD,
    title: d.title,
    ...(description !== undefined ? { description } : {}), // 빈 값이면 키 생략 — 위 필드 주석 참조
    drillType: d.drillType,
    ...(d.situation !== undefined ? { situation: d.situation } : {}),
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
