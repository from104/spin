// §5.2 하단 바 치수 — BoardBar(자유 전술판)와 TransportBar(드릴 편집)가 **같은 세로 리듬**을
// 쓴다. 크롬 예산의 '하단 바' 행은 둘 중 **큰 쪽**이므로(chromeBudget.ts 의 그 행 주석),
// 두 파일이 각자 패딩을 적으면 한쪽만 줄었을 때 예산이 조용히 틀어진다 — 2.10 이전에는 둘 다
// '12px 24px 15px' 였고 트랜스포트에만 라벨줄이 있어 94 였다(예산 표의 '현재' 열이 그 값이다).
//
// 컴포넌트 파일(.tsx)이 아니라 여기 두는 이유는 trayMetrics.ts 와 같다 — 컴포넌트 파일에서
// 함수를 내보내면 react-refresh 경고가 늘고, 예산 테스트가 화면 코드를 정방향으로 import 해
// 대조할 수도 없다.
import { COURT_DEFS } from '../../model/court.ts';
import type { CourtMode } from '../../model/court.ts';

/** 하단 바 안쪽 여백. 위/아래가 다른 것은 아래에 경계선이 없어 시각 무게가 다르기 때문이다
 *  (§5.2 확정: "재생 48 + 패딩 7/8 + border 1 = 64"). */
export const BOTTOM_BAR_PAD_PX = { top: 7, bottom: 8, x: 24 } as const;
/** 바 위쪽 경계선. 높이 계산에서 빠뜨리기 쉬운 1px 이라 상수로 세운다. */
export const BOTTOM_BAR_BORDER_PX = 1;
/** 주 액션(재생)이 이전/다음보다 큰 만큼(§5.4 위계 +4). 트랜스포트 바 높이를 정하는 것이 이 값이다. */
export const PLAY_EXTRA_PX = 4;

export const bottomBarPadCss = (): string => `${BOTTOM_BAR_PAD_PX.top}px ${BOTTOM_BAR_PAD_PX.x}px ${BOTTOM_BAR_PAD_PX.bottom}px`;

/** 바 안내 문구(§3.11 코트 설명 + 잠금 사유) 줄 치수. 행 높이는 버튼(--hit)이 정하므로
 *  **문구 두 줄의 합이 --hit 이하**여야 문구가 바 높이에 영향을 주지 않는다 — 예산 132 의
 *  '하단 바 64' 행이 그 전제 위에 서 있다. 그래서 각 줄은 nowrap+ellipsis 로 한 줄에
 *  고정한다: 폭이 좁아질 때 줄이 접혀 4줄이 되면(≈66px) 바가 조용히 자라 예산이 깨진다. */
export const BAR_HINT_FONT_PX = 11; // = 0.6875rem. BoardBar 의 CSS 문자열과 같은 값이어야 한다
export const BAR_HINT_LINE_HEIGHT = 1.45;
export const BAR_HINT_GAP_PX = 2;
/** 문구 두 줄 스택의 세로 합. 테스트가 이 값 ≤ hit 을 단언한다. */
export const barHintStackPx = (): number => Math.ceil(BAR_HINT_FONT_PX * BAR_HINT_LINE_HEIGHT) * 2 + BAR_HINT_GAP_PX;

const barHeightPx = (contentPx: number): number => BOTTOM_BAR_BORDER_PX + BOTTOM_BAR_PAD_PX.top + contentPx + BOTTOM_BAR_PAD_PX.bottom;

/** 드릴 편집 하단 바. 한 줄 안에서 가장 큰 것이 재생 버튼(--hit + 4)이다. 기본 44 → **64**. */
export const transportBarHeightPx = (hitPx: number): number => barHeightPx(hitPx + PLAY_EXTRA_PX);
/** 자유 전술판 하단 바. 재생이 없어 --hit 이 가장 크다. 기본 44 → 60. */
export const boardBarHeightPx = (hitPx: number): number => barHeightPx(hitPx);

/** 스텝 칩(=판 사진) 가로세로비 = 그 코트 viewBox 의 비.
 *
 *  소수 셋째 자리에서 **한 번만** 끊는다 — CSS `calc()` 는 무한소수를 그대로 쓰고 픽셀 식은
 *  반올림하므로, 각자 자기 방식으로 끊으면 둘이 미세하게 갈라진 채 아무도 못 본다. */
export function stepChipAspect(mode: CourtMode): number {
  const def = COURT_DEFS[mode];
  return Math.round((def.vbW / def.vbH) * 1000) / 1000;
}

/** 칩 상자 픽셀. 높이는 --hit 그대로, 폭은 코트 비율 — 어느 쪽도 --hit(WCAG 하한) 밑으로 안 간다.
 *  풀 코트 44 → 69×44, 하프/플랫 44 → 51×44. 스텝이 몇 장이든 이 크기는 안 줄어든다
 *  (옛 타임라인은 트랙을 n−1 로 나눠 19장부터 노드를 접었다 — 사진 뭉치는 대신 가로로 구른다). */
export function stepChipBoxPx(hitPx: number, mode: CourtMode): { w: number; h: number } {
  return { w: Math.max(hitPx, Math.round(hitPx * stepChipAspect(mode))), h: hitPx };
}

/** 칩 폭 CSS. 값은 브라우저가 --hit 으로 계산하고, **비율만** 위 픽셀 식과 공유한다. */
export const stepChipWidthCss = (mode: CourtMode): string => `calc(var(--hit) * ${stepChipAspect(mode)})`;

/** 끌고 있는 칩이 놓일 자리. `centers` 는 지금 화면에 보이는 순서대로의 칩 중심 x 다.
 *  **자기 자신은 세지 않는다** — 세면 자기 중심을 지나는 순간 옆칸으로 튄다(손을 대자마자 이동). */
export function dropIndexAt(centers: readonly number[], x: number, from: number): number {
  let to = 0;
  for (let i = 0; i < centers.length; i++) {
    if (i === from) continue;
    if (centers[i]! < x) to++;
  }
  return Math.min(Math.max(to, 0), Math.max(centers.length - 1, 0));
}

/** from 에서 to 로 옮긴 새 배열(원본 불변). 드래그 중 **미리보기 순서**를 만든다 — 실제 커밋은
 *  손을 뗄 때 한 번뿐이다(칸을 넘을 때마다 dispatch 하면 되돌리기 한 번에 한 칸씩 되감긴다).
 *  edits.ts 의 `moveStep` 과 **같은 splice 규칙**이어야 미리보기와 커밋 결과가 일치한다 —
 *  bottomBarMetrics.test.ts 가 두 함수의 결과를 직접 대조한다. */
export function movedOrder<T>(items: readonly T[], from: number, to: number): T[] {
  const out = items.slice();
  if (from === to || from < 0 || from >= out.length || to < 0 || to >= out.length) return out;
  const [item] = out.splice(from, 1);
  out.splice(to, 0, item!);
  return out;
}
