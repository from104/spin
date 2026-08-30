// §6.3 인쇄 — DOM 계약(클래스·데이터 속성)의 단일 출처.
//
// 왜 상수로 빼는가: 인쇄는 **CSS 와 마크업이 짝을 이뤄야만** 성립한다. `styles/print.css` 는
// 이 이름들로 규칙을 걸고, React 트리는 이 이름들로 마크업을 낸다. 한쪽만 개명하면
// jsdom 테스트는 전부 초록불인 채로 **종이만 빈다** — jsdom 은 CSS 를 적용하지 않기 때문이다.
// 그래서 이름을 여기 한 곳에 두고, `styles/print.test.ts` 가 CSS 원문에서 이 문자열들을
// 직접 찾아 못박는다.

/** 인쇄 트리의 뿌리. 평소 `display:none`, `@media print` 에서만 보인다. */
export const PRINT_ROOT_CLASS = 'spin-print';
/** 한 장. `break-after: page` 가 걸리는 단위다. */
export const PRINT_PAGE_CLASS = 'spin-print-page';
/** 코트 그림 <svg>. 페이지 안에서 높이가 고정돼야 머리글·메모가 다음 장으로 밀리지 않는다. */
export const PRINT_COURT_CLASS = 'spin-print-court';

/** 뿌리를 찾는 선택자. 인쇄 직전 "트리가 정말 붙어 있나" 를 이걸로 확인한다. */
export const PRINT_ROOT_SELECTOR = '[data-print-root]';
/** 페이지를 세는 선택자. 0장이면 `window.print()` 를 부르면 안 된다(빈 종이가 나온다). */
export const PRINT_PAGE_SELECTOR = '[data-print-page]';

// `data-print-page` 가 갖는 값은 'cover'(표지) · 'drill'(세션 계획서의 드릴 장) · 'step'
// (드릴 시트의 스텝 장) 셋이다. 그 목록을 담던 `PRINT_PAGE_KINDS` 배열과 거기서 파생하던
// `PrintPageKind` 타입은 2026-08-31 위생 청소로 뺐다 — 읽는 이가 서로뿐이었다. 인쇄 코드는
// 값을 JSX 에서 직접 문자열로 쓰고, 세는 쪽은 위 `PRINT_PAGE_SELECTOR` 로 종류를 안 가린다.
