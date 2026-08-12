// §6.3 인쇄 트리가 **정말로 붙어 있을 때만** `window.print()` 를 부른다.
//
// 왜 가드가 필요한가: `window.print()` 는 그 순간의 DOM 을 굽는다. React 의 setState 는
// 비동기라 "인쇄 문서를 상태에 넣고 곧바로 print()" 하면 **아직 아무것도 없는 문서**가 인쇄돼
// 코치 손에 백지가 나온다. 그리고 그 사고는 조용하다 — 예외도, 콘솔 경고도 없다.
// 그래서 진입점(4.7)은 `PrintRoot` 의 `onReady`(useLayoutEffect = 커밋 직후) 안에서 이 함수를
// 부르고, 이 함수는 한 번 더 **페이지 수를 직접 세어** 0장이면 인쇄를 거절한다.
//
// jsdom 의 `window.print` 는 존재하지만 no-op 이라 실제 인쇄는 반증할 수 없다. 반증 가능한
// 것은 "언제 부르고 언제 안 부르는가" 이고, 그것이 여기 전부다.
import { PRINT_PAGE_SELECTOR } from './printDom.ts';

export interface PrintWhenReadyOptions {
  /** 페이지를 찾을 범위. 기본은 문서 전체(인쇄 트리는 body 포털이다). */
  root?: ParentNode;
  /** 테스트가 스파이를 꽂는 자리. */
  win?: Pick<Window, 'print'>;
}

/** 인쇄를 실제로 시작했으면 true. 페이지가 0장이면 **부르지 않고** false 를 돌려준다. */
export function printWhenReady(opts: PrintWhenReadyOptions = {}): boolean {
  const root = opts.root ?? document;
  const win = opts.win ?? window;
  const pages = root.querySelectorAll(PRINT_PAGE_SELECTOR);
  if (pages.length === 0) return false;
  win.print();
  return true;
}
