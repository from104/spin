// §4.3 P1-5 "메모 = 종이 쪽지" 의 **기하**. 컴포넌트(NoteLabel.tsx)에서 떼어 둔 이유는 두 가지다:
// ① 순수 함수라 컴포넌트를 마운트하지 않고 잴 수 있다, ② 컴포넌트 파일에 컴포넌트 아닌 export 를
// 두면 Fast Refresh 가 깨진다(oxlint `react(only-export-components)`).
//
// 숫자의 출처는 전부 `core/constants.ts` 의 `NOTE` 다 — 히트 반경(physics/hitTest.ts)·선택 링
// (render/SelectionOverlay.tsx)과 같은 곳에서 와야 "보이는데 안 잡힌다" 가 다시 생기지 않는다.
import { NOTE } from '../../core/constants.ts';

/** 빈 메모에 얹는 흐린 안내. "여기 쪽지가 놓였고, 글은 인스펙터에서 쓴다" 를 뜻한다.
 *  인라인 편집은 만들지 않는다 — SVG 위 HTML 오버레이는 §6.4 판 회전과 좌표 변환을 둘 다
 *  따라가야 해서 비싸다. 텍스트 입력은 InspectorPanel 의 [개체] 탭에 이미 있다. */
export const NOTE_PLACEHOLDER = '메모';

/** 한글·전각 글자. 폭 어림에서 1 em 으로 세는 범위다(한글 자모·완성형·CJK·전각 기호). */
const WIDE_CHAR = /[ᄀ-ᇿ⺀-꓏ꥠ-꥿가-퟿豈-﫿︰-﹏＀-｠￠-￦]/;

/** 칩의 가로 크기(월드 px). 글이 길면 늘어나고, 빈 메모는 정확히 `NOTE.chipMinWPx` 다.
 *
 *  왜 실측하지 않는가: `getComputedTextLength()` 는 레이아웃 왕복이라 렌더마다 부르면 §6.1 이
 *  막는 비용이 생기고, 마운트 **전에는** 값 자체가 없어 첫 페인트에 칩이 헛크기로 뜬다.
 *  그래서 넉넉한 쪽으로 어림한다 — 좁게 어림하면 글이 칩 밖으로 새고, 넓게 어림하면 여백만
 *  조금 늘어난다. */
export function noteChipWidthPx(text: string, size: number): number {
  let w = 0;
  for (const ch of text) w += WIDE_CHAR.test(ch) ? size : size * 0.55;
  return Math.max(NOTE.chipMinWPx, w + NOTE.chipPadXPx * 2);
}

/** 오른쪽 위 모서리를 잘라낸 쪽지 본체. 세로는 상수다(`NOTE` 머리말: 히트 반경이 상수라서). */
export function noteChipPathD(halfW: number): string {
  const halfH = NOTE.chipHPx / 2;
  const f = NOTE.foldPx;
  return `M${-halfW},${-halfH} H${halfW - f} L${halfW},${-halfH + f} V${halfH} H${-halfW} Z`;
}

/** 잘라낸 자리에 얹는 접힘 삼각형 — 이것이 "쪽지" 를 읽히게 하는 유일한 형태 신호다. */
export function noteFoldPathD(halfW: number): string {
  const halfH = NOTE.chipHPx / 2;
  const f = NOTE.foldPx;
  return `M${halfW - f},${-halfH} L${halfW},${-halfH + f} H${halfW - f} Z`;
}
