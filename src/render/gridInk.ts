// §3.3 격자의 **잉크와 글자**. 좌표는 여기 없다 — 그것은 `model/grid.ts` 의 `gridGeom` 하나다.
//
// 왜 파일이 따로 있나 (2026-09-06 기현 지시: *"드릴 편집 화면, 시연 화면과 png, 인쇄 화면에
// 객체·코트 요소 … 동일하게 나오는지 철저하게 점검"*):
// 격자를 그리는 곳이 셋이다 — 화면 컴포넌트(`GridOverlay.tsx`), PNG 의 선(`buildStaticSvg` 의
// `gridMarkup`), PNG 의 칸 번호(`features/export/staticSceneLayout.ts` 의 글자 배치). 값이 세
// 자리에 흩어져 있으면 한쪽만 고치는 날이 온다: 실제로 `gridMarkup` 은 불투명도 0.22/0.34 를
// **리터럴로 두 번째 적어** 두고 있었다. 그래서 값은 여기 하나만 두고 셋이 읽는다
// (AGENTS §3 *"도해·컴포넌트에 치수를 리터럴로 적지 않는다. 상수에서 파생한다"*).
//
// 격자 라벨은 장식이다(코트 대비 1.5:1 이하) — 셀 주소의 권위 있는 출처는 인스펙터·aria-live
// 리전이다. 그래서 화면 값은 일부러 흐리다.

/** 라틴 글자만 쓴다(a1…e3 · a~t · 1~17) — 저장소의 Space Grotesk 서브셋(U+0000-00FF) 안이라
 *  PNG 의 캔버스 어댑터에서도 글리프가 빈칸이 되지 않는다(staticSceneLayout ★[A-9]). */
export const GRID_FONT = "'Space Grotesk',sans-serif";

/** 화면 / 종이 두 벌. 짝을 한자리에 두는 이유는 한쪽만 고치는 것을 막기 위해서다.
 *
 *  ⚠️ 종이 값이 화면보다 진한 것은 **의도**다(2026-08-27, 인쇄가 격자를 그리게 되면서).
 *  화면 값은 모니터의 발광 대비를 전제한 것이라 그대로 인쇄하면 잉크 절약 설정에서 격자가
 *  통째로 사라진다. **기하는 한 톨도 안 바뀐다 — 불투명도만 다르다.**
 *  PNG 는 종이가 아니라 화면의 대체물이므로 `screen` 을 쓴다. */
export const GRID_INK = {
  screen: { line: 0.22, major: 0.34, cell: 0.2, axis: 0.28 },
  print: { line: 0.55, major: 0.75, cell: 0.55, axis: 0.65 },
} as const;

/** 칸 번호(a1…)와 축 헤더(a~t / 1~17)의 글자 크기. 축이 작은 것은 flat 코트의 1 m 격자에
 *  붙기 때문이다(한 칸 25×25 px). */
export const GRID_LABEL_SIZE_PX = { cell: 18, axis: 11 } as const;
export const GRID_LABEL_WEIGHT = 600;
export const GRID_LABEL_FILL = '#ffffff';
