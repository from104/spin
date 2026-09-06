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
//
// ── 이 표가 **말하지 않는** 두 축, 그리고 그것을 대신 지키는 자리 (2026-09-06) ──────────
// 2026-09-06 경로 대조(편집·시연·PNG·인쇄)에서 나온 어긋남 넷 중 이 표가 잡은 것은 하나
// (`png.gridLabels`)뿐이었다. 나머지 셋은 네 칸이 전부 `draws:true` 인 채로 그림이 갈라져
// 있었다 — 그래서 그 두 축이 어디서 지켜지는지를 여기 적어 둔다:
//   · **층(z) 순서** — 판의 부속(코트면·격자·규칙 존·깃발·규칙 표시·골대)이 어느 순서로
//     쌓이는가. `render/courtFurniture.order.test.tsx` 가 **편집 화면의 순서를 기준으로**
//     나머지 셋을 잰다(그 순서를 여기 숫자로 또 적지 않는다 — 두 벌이 된다).
//     ⚠️ 개체 7종의 순서는 이 축이 아니다: 사용자가 스텝마다 뒤집을 수 있고(`model/zOrder.ts`)
//     그래서 애초에 선언할 수 있는 값이 아니다.
//   · **굵기·크기** — 정본은 `render/CourtSurface.tsx` 의 `COURT_LINE_WEIGHTS`(§6.6 굵기표)다.
//     편집 화면만 가는 선을 쓰는 것은 그 표가 정한 **설계**이지 드리프트가 아니다.
//     (같은 이유로 인쇄만 진한 격자 잉크도 설계다 — `render/gridInk.ts`.)

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
  | 'notes'
  /** 무시된 휠체어의 흐림(`core/constants.ts` 의 `IGNORED_OPACITY`). */
  | 'ignoredDim'
  /** 잠긴 개체의 보라 덮개(`render/objects/LockTint.tsx`). */
  | 'lockTint';
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
  // ⚠️ 2026-09-06 — 여기 아래 다섯 줄의 순서는 **기본층**(`model/zOrder.ts` 의
  // `DEFAULT_TIERS`)이지 고정 z-order 가 아니다. 사용자가 스텝마다 뒤집을 수 있고
  // (`docs/PLAN-Z-ORDER.md`), 이 표는 애초에 *"그 화면이 그것을 그리는가"* 만 말한다 —
  // **순서를 말하는 표가 아니다.** 목록을 기본층 순서로 적어 두는 것은 읽는 사람이 두 벌을
  // 외우지 않게 하려는 것뿐이다(이 배열의 순서를 바꿔도 그리는 순서는 안 바뀐다).
  'shapes',
  // 획은 화살표 **바로 아래** 층이다(그 결정의 근거는 ObjectLayer.tsx 머리말).
  'strokes',
  'arrows',
  'notes',
  // ── 개체의 **상태 표시** 둘 (2026-09-06) ───────────────────────────────────────────
  // 위 열다섯이 "무엇을 그리는가" 라면 이 둘은 "그 개체를 어떻게 그리는가" 다. 표에 올린
  // 이유는 하나다: **아무도 결정하지 않아서 없는 상태를 끝내려고.** 무시·잠김은 둘 다
  // 편집 화면에만 있었고, 어느 파일에도 "정적 경로에는 왜 없는가" 가 적혀 있지 않았다.
  'ignoredDim',
  'lockTint',
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

/** 잠김 표시의 부재 사유 — **판단을 적는다**(2026-09-06).
 *
 *  잠김은 "이 개체는 지금 옮길 수 없다" 는 **편집 중의 상태**다. 시연·종이·그림에는 옮길 손이
 *  없으므로 그 말이 가리킬 대상 자체가 없다 — 선택 링·핸들을 싣지 않는 것과 같은 논법이다
 *  (PrintCourt.tsx 머리말). **무시(`ignoredDim`)와 갈리는 자리**라 나란히 적어 둔다: 무시는
 *  물리 월드에서 빠졌다는 판의 사실이라 네 경로가 다 그린다. 뒤집으려면(= 잠김도 장면의
 *  사실로 보려면) 무시와 같은 방식으로 프레임에 실어 보내면 된다. */
const LOCK_IS_EDITING = no('잠김은 편집 중에만 뜻이 있는 상태다 — 시연·종이·그림에는 옮길 손이 없다(선택 링·핸들과 같은 부류). 무시(ignoredDim)와 갈리는 이유는 그쪽이 물리에서 빠졌다는 장면의 사실이기 때문이다');

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
    ignoredDim: YES, // ObjectLayer 의 껍데기 <g style="opacity"> (IGNORED_OPACITY)
    lockTint: YES,
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
    // 무시는 **장면의 사실**이라 판 밖으로도 나간다 — 그 휠체어는 물리 월드에서 통째로 빠져
    // 있다(model/drill.ts 가 locked·cut 과 같은 부류로 못박는다). 프레임의 opacity 에 실려
    // 온다(model/playback.ts) — 시연·PNG·인쇄가 분기 없이 따라오는 이유다.
    ignoredDim: YES,
    lockTint: LOCK_IS_EDITING,
  },
  png: {
    courtLines: YES,
    goalPosts: YES,
    grid: YES,
    // ⚠️ 2026-09-06 뒤집힘 — 옛 사유를 기록으로 남긴다:
    //    *"PNG 는 <text> 를 한 개도 넣지 않는다(★[A-9]) — 글자는 래스터 어댑터가 캔버스에서
    //      그린다. 격자 번호는 그 경로에 아직 없다"*
    //    앞 문장(★[A-9])은 지금도 참인 계약이지만, 뒷문장은 판단이 아니라 **미구현 고백**이었다.
    //    기현 지시(2026-09-06)가 이것을 버그로 지목했다: *"png 에 격자는 나오는데 격자 번호는
    //    안 나옴"*. 이제 격자 번호는 등번호·메모와 **같은 통로**(캔버스 어댑터)로 나간다 —
    //    `features/export/staticSceneLayout.ts` 의 `buildTextPlacements`.
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
    ignoredDim: YES,
    lockTint: LOCK_IS_EDITING,
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
    ignoredDim: YES,
    lockTint: LOCK_IS_EDITING,
  },
  thumbnail: {
    courtLines: YES, // 코트 자체는 그린다 — 개체만 떠 있으면 무엇의 그림인지 알 수 없다
    // ⚠️ 2026-09-06 정정 — 여기는 `YES` 였지만 **사실이 아니었다.** 썸네일은 골대를 한 번도
    //    그린 적이 없다: `COURT_LINE_WEIGHTS.thumb` 에 `spotR` 이 없어 코트 라인 컴포넌트가
    //    골대 표시를 건너뛰었다(그 칸이 초록이던 것은 증거 토큰 'CourtSurface' 가 코트 라인
    //    때문에 이미 걸려 있었기 때문이다 — 문자열 증거의 한계, renderPaths.test.ts 머리말 ⚠️).
    //    20 px 그림에서 r 4 짜리 원 넷은 얼룩이라 안 그리는 것이 옳다 — 사실대로 적는다.
    goalPosts: no('썸네일은 골대를 안 그린다 — 20 px 그림에서 기둥 원은 얼룩이다(COURT_LINE_WEIGHTS.thumb 에 spotR 이 없는 것이 그 구현이다)'),
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
    // 썸네일은 스텝의 플래그를 아예 받지 않는다(ThumbSpec 에 그 자리가 없다). 20 px 그림에서
    // 32% 흐림은 "안 보이는 칩" 과 구별되지 않기도 한다.
    ignoredDim: THUMB,
    lockTint: THUMB,
  },
};

/** 그 경로가 그 요소를 그리는가. */
export const pathDraws = (path: RenderPathId, el: SceneElementId): boolean => RENDER_PATHS[path][el].draws;

/** 그 요소를 그려야 하는 경로들 — 새 요소를 배선할 때 "어디까지 들러야 하나" 의 답이다. */
export function pathsDrawing(el: SceneElementId): RenderPathId[] {
  return RENDER_PATH_IDS.filter((p) => pathDraws(p, el));
}
