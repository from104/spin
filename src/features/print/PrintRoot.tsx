// §6.3 인쇄 트리의 뿌리. 화면 트리와 **완전히 분리된** 문서를 body 에 포털로 건다.
//
// 왜 포털인가: `styles/print.css` 는 인쇄 시 `#root { display:none }` 으로 **앱 셸을 통째로**
// 접는다(하단 바·시트 같은 고정 위치 요소가 장마다 겹쳐 찍히는 것을 막는 가장 확실한 수단이다).
// 인쇄 트리가 `#root` 안에 있으면 그 규칙에 같이 접혀 백지가 나온다. 포털로 body 직속에 두면
// 인쇄 트리가 React 트리의 **어디서 렌더되든** 무관해진다 — 진입점(4.7)이 자유로워진다.
//
// 평소에는 `.spin-print { display:none }` 이라 화면에 아무 영향이 없다(레이아웃도, 포커스
// 순서도 먹지 않는다). `aria-hidden` 은 그 CSS 가 어떤 이유로든 빠졌을 때의 2중 안전장치다 —
// 60장짜리 사본을 스크린리더가 다시 읽는 사고를 막는다.
import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { PrintDrillSheet } from './PrintDrillSheet.tsx';
import { PrintSessionPlan } from './PrintSessionPlan.tsx';
import { PRINT_ROOT_CLASS } from './printDom.ts';
import type { PrintDoc } from './printDoc.ts';

export interface PrintRootProps {
  /** null 이면 아무것도 렌더하지 않는다 — 평소 상태다. */
  doc: PrintDoc | null;
  /** 페이지가 **DOM 에 붙은 뒤** 문서당 정확히 1회. 여기서 `printWhenReady()` 를 부른다. */
  onReady?: () => void;
  /** 포털 대상. 기본 `document.body`. */
  container?: Element;
}

export function PrintRoot({ doc, onReady, container }: PrintRootProps) {
  // ⚠️ StrictMode 는 effect 를 mount→unmount→mount 로 두 번 돌린다. 그대로 두면 개발 모드에서
  // 인쇄 대화상자가 **두 번** 뜬다(같은 인스턴스라 ref 는 살아남으므로 이 가드가 먹는다).
  const readyFor = useRef<PrintDoc | null>(null);
  useLayoutEffect(() => {
    if (!doc) {
      // 같은 문서를 닫았다가 다시 열면 또 인쇄되어야 한다.
      readyFor.current = null;
      return;
    }
    if (readyFor.current === doc) return;
    readyFor.current = doc;
    onReady?.();
  }, [doc, onReady]);

  if (!doc) return null;

  return createPortal(
    <div className={PRINT_ROOT_CLASS} data-print-root="" aria-hidden="true">
      {doc.kind === 'drill' ? <PrintDrillSheet drill={doc.drill} /> : <PrintSessionPlan plan={doc.plan} />}
    </div>,
    container ?? document.body,
  );
}
