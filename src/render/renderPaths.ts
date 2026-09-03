// §6.x 렌더 경로 레지스트리 — **"어느 화면이 무엇을 그리는가" 의 유일한 선언처**.
//
// ── 왜 이 파일이 생겼나 (2026-08-27 기현 지시) ────────────────────────────────────────────
// *"인쇄 시 원, 공 가로지르는 화살표, 코트 구역 나눔, 구역 번호 안 나옴. 구조적으로 애초에
//  누락 안 되게 만들어라."*
//
// 같은 사고가 **네 번째**였다:
//   ① 2026-08-17 — 시연 화면만 팀 구분을 잃었다
//   ② 2026-08-17 — 그림 내보내기(PNG)에 진영 표시가 빠졌다
//   ③ 2026-08-2x — PNG 에 작도 도형이 안 실렸다
//   ④ 2026-08-27 — 인쇄에 격자·규칙존·링·소유 화살표가 없다
// 네 번 다 **원인이 같다: 요소를 새로 만든 사람이 경로 하나를 안 들렀다.** 그리고 그것을
// 알려 줄 자리가 없었다 — 드리프트 방지 테스트는 있었지만 대부분 *손으로 적은 목록*이라,
// 목록에 행을 안 더한 실패에는 무방비였다(그 실패가 정확히 지금의 실패다).
//
// 인쇄가 특히 오래 조용했던 이유는 기록해 둘 만하다. `PrintCourt.tsx` 에 *"격자·규칙존은
// 종이에 싣지 않는다 — §6.2 의 PNG 포함 목록과 같은 판단이다"* 라는 주석이 있었는데,
// **그 근거가 그 뒤 뒤집혔다**(PNG 는 지금 넷을 전부 굽는다). 근거가 딴 파일에 있으면
// 근거가 바뀐 것을 아무도 모른다 — 그래서 이 표를 **한 곳**에 둔다.
//
// ── 이 표가 누락을 막는 방식 ──────────────────────────────────────────────────────────
//   1. `Record<RenderPathId, Record<SceneElementId, ElementSupport>>` 다. 요소를 하나 더하거나
//      경로를 하나 더하면 **컴파일러가 빈 칸을 전부 채우라고 요구한다.** "몰라서 안 적었다"
//      가 성립하지 않는다.
//   2. 안 그리는 칸은 지우는 것이 아니라 **사유를 적는다**(`{ draws: false, why }`). 부재가
//      의견이 아니라 기록이 되고, 나중에 사람이 그 사유를 읽고 판단할 수 있다.
//   3. `renderPaths.test.ts` 가 이 표와 **실제 소스**를 대조한다. 표는 그린다는데 코드에
//      흔적이 없으면 빨개진다. 반대로 표에 없는 새 경로 파일이 나타나도 빨개진다.
//
// ⚠️ **이 표는 문서가 아니라 계약이다.** 여기를 고치는 것이 곧 "그 화면에 그것을 그리기로
//    정한다" 이고, 코드가 따라오지 않으면 테스트가 막는다. 반대로 코드를 먼저 고쳐도 여기가
//    `false` 면 막힌다. 둘을 같은 커밋에서 움직이라는 뜻이다.

/** 코트를 그리는 화면. 새 경로가 생기면 여기에 더하고 아래 표의 행을 채운다. */
export type RenderPathId = 'editor' | 'present' | 'png' | 'print' | 'thumbnail';
export const RENDER_PATH_IDS = ['editor', 'present', 'png', 'print', 'thumbnail'] as const;

/** 판 위에 실릴 수 있는 것. **화면 전용 장식(선택 링·핸들·존 커서)은 여기 넣지 않는다** —
 *  그것은 편집 도구이지 장면의 내용이 아니라, 다른 경로가 "왜 없지" 를 물을 대상이 아니다. */
export type SceneElementId =
  | 'courtLines'
  | 'goalPosts'
  | 'grid'
  | 'gridLabels'
  | 'ruleZones'
  | 'ballRings'
  | 'ownerArrow'
  | 'sideFlags'
  | 'chairs'
  | 'balls'
  | 'cones'
  | 'shapes'
  | 'strokes'
  | 'arrows'
  | 'notes';
export const SCENE_ELEMENT_IDS = [
  'courtLines',
  'goalPosts',
  'grid',
  'gridLabels',
  'ruleZones',
  'ballRings',
  'ownerArrow',
  'sideFlags',
  'chairs',
  'balls',
  'cones',
  'shapes',
  // 획은 화살표 **바로 아래** 층이다 — 목록 순서를 z-order 와 같이 두어 읽는 사람이 두 벌을
  // 외우지 않게 한다(층 결정의 근거는 ObjectLayer.tsx 머리말).
  'strokes',
  'arrows',
  'notes',
] as const;

/** 그린다 / 안 그린다(사유 필수). 사유는 **판단**을 적는다 — "아직 안 만듦" 도 판단이다. */
export type ElementSupport = { draws: true } | { draws: false; why: string };

const YES: ElementSupport = { draws: true };
const no = (why: string): ElementSupport => ({ draws: false, why });

/** 썸네일의 예외 사유. 기현 지시(2026-08-27): *"휠체어칩, 공, 화살표, 도형만 개략적으로 그린다."*
 *
 *  ⚠️ **허용 목록으로 적는다**(그 넷만 `draws:true`). 거부 목록이었다면 새 요소가 생길 때마다
 *  썸네일에 자동으로 실려, 목록에서 20 px 짜리 그림이 조용히 뭉개졌을 것이다. 도구 고정이
 *  `KEEPS_ANY_LOCK` 을 허용 목록으로 둔 것과 같은 논법이다(store/editor/reducer.ts). */
const THUMB = no('썸네일은 휠체어칩·공·화살표·도형만 개략적으로 그린다(기현 지시 2026-08-27)');

export const RENDER_PATHS: Record<RenderPathId, Record<SceneElementId, ElementSupport>> = {
  editor: {
    courtLines: YES,
    goalPosts: YES, // CourtSurface 가 아니라 물리 바디(ObjectLayer → GoalPost.tsx)가 그린다
    grid: YES,
    gridLabels: YES,
    ruleZones: YES,
    ballRings: YES,
    ownerArrow: YES,
    sideFlags: YES,
    chairs: YES,
    balls: YES,
    cones: YES,
    shapes: YES,
    strokes: YES,
    arrows: YES,
    notes: YES,
  },
  present: {
    courtLines: YES,
    goalPosts: YES,
    grid: YES,
    gridLabels: YES,
    ruleZones: YES,
    ballRings: YES,
    ownerArrow: YES,
    sideFlags: YES,
    chairs: YES,
    balls: YES,
    cones: YES,
    shapes: YES,
    strokes: YES,
    arrows: YES,
    notes: YES,
  },
  png: {
    courtLines: YES,
    goalPosts: YES,
    grid: YES,
    gridLabels: no('PNG 는 <text> 를 한 개도 넣지 않는다(★[A-9]) — 글자는 래스터 어댑터가 캔버스에서 그린다. 격자 번호는 그 경로에 아직 없다'),
    ruleZones: YES,
    ballRings: YES,
    ownerArrow: YES,
    sideFlags: YES,
    chairs: YES,
    balls: YES,
    cones: YES,
    shapes: YES,
    strokes: YES,
    arrows: YES,
    notes: YES,
  },
  print: {
    courtLines: YES,
    goalPosts: YES,
    grid: YES,
    gridLabels: YES, // 인쇄는 문서 컨텍스트라 <text> 를 쓸 수 있다(PNG 와 갈리는 자리)
    ruleZones: YES,
    ballRings: YES,
    ownerArrow: YES,
    sideFlags: YES,
    chairs: YES,
    balls: YES,
    cones: YES,
    shapes: YES,
    strokes: YES,
    arrows: YES,
    notes: YES,
  },
  thumbnail: {
    courtLines: YES, // 코트 자체는 그린다 — 개체만 떠 있으면 무엇의 그림인지 알 수 없다
    goalPosts: YES,
    grid: THUMB,
    gridLabels: THUMB,
    ruleZones: THUMB,
    ballRings: THUMB,
    ownerArrow: THUMB,
    sideFlags: THUMB,
    chairs: YES,
    balls: YES,
    cones: THUMB,
    shapes: YES,
    // 2026-09-03 — 허용 목록이 다섯으로 늘었다. 2026-08-27 지시("휠체어칩, 공, 화살표, 도형만")
    // 이후에 없던 것이 생겼고(자유 그리기), 획은 **코치가 판에 직접 그은 자국**이라 목록에서
    // 그 판을 알아보는 단서가 된다 — 그리는 사람이 그린 것이 요약에서 사라지면 요약이 아니다.
    // 값이 아니라 판단이 바뀐 자리라, 옛 지시의 넷을 지우지 않고 여기에 다섯째를 더해 적는다.
    strokes: YES,
    arrows: YES,
    notes: THUMB,
  },
};

/** 그 경로가 그 요소를 그리는가. */
export const pathDraws = (path: RenderPathId, el: SceneElementId): boolean => RENDER_PATHS[path][el].draws;

/** 그 요소를 그려야 하는 경로들 — 새 요소를 배선할 때 "어디까지 들러야 하나" 의 답이다. */
export function pathsDrawing(el: SceneElementId): RenderPathId[] {
  return RENDER_PATH_IDS.filter((p) => pathDraws(p, el));
}
