// §5.4 — 트레이 칩·트레이 폭의 **치수 식**. ToolRail.tsx(화면)와 크롬 예산 테스트가 같은 식을
// 쓰도록 컴포넌트 밖으로 뺀 파일이다(react-refresh 규칙상 컴포넌트 파일은 함수를 내보내지
// 않는다). 여기의 픽셀 함수와 calc 문자열은 **같은 상수로 조립된다** — 둘 중 하나만 고치면
// ToolRail.hit.test.tsx 의 리터럴 대조가 빨간불이 된다.
import { CHAIR } from '../../core/constants.ts';

/** 상자−칩 가로 여백(선택 테두리·drop-shadow 자리). 상자 가로 = 정확히 `--hit`. */
export const CHIP_BOX_PAD_X = 8;
export const CHIP_BOX_PAD_Y = 6;
/** 칩 줄 간격이자 트레이 폭 식의 상수항. */
export const CHIP_ROW_GAP = 5;
/** 칩 세로/가로 비 = 37.5/25 = 1.5. 코트 칩과 어긋나면 같은 말로 안 읽힌다. */
export const CHIP_RATIO = CHAIR.lengthPx / CHAIR.widthPx;

/** 칩 SVG 의 CSS 크기. jsdom 은 calc(var()) 를 계산하지 못하므로 픽셀 검증은 아래 함수가 맡는다. */
export const CHIP_W_CSS = `calc(var(--hit) - ${CHIP_BOX_PAD_X}px)`;
export const CHIP_H_CSS = `calc((var(--hit) - ${CHIP_BOX_PAD_X}px) * ${CHIP_RATIO})`;
export const CHIP_BOX_H_CSS = `calc((var(--hit) - ${CHIP_BOX_PAD_X}px) * ${CHIP_RATIO} + ${CHIP_BOX_PAD_Y}px)`;
export const TRAY_ROW_MAX_CSS = `calc(var(--hit) * 2 + ${CHIP_ROW_GAP}px)`;

/** 칩 상자 크기를 **픽셀로** 계산한다 — 위 calc 문자열과 같은 식이다(상수를 공유한다).
 *  크롬 예산·완료 판정 테스트가 이 함수로 §5.4 의 표(44→44×60·93, 56→56×78·117)를 재현한다. */
export const trayChipBoxPx = (hitPx: number): { w: number; h: number } => ({
  w: hitPx,
  h: (hitPx - CHIP_BOX_PAD_X) * CHIP_RATIO + CHIP_BOX_PAD_Y,
});

/** 세로 트레이의 폭 = 칩 상자 두 개 + 간격. 44 → 93(예산표 wide/narrow), 56 → 117. */
export const trayRailWidthPx = (hitPx: number): number => hitPx * 2 + CHIP_ROW_GAP;
