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
// 팀시트만 features/print 밖(features/team)에 산다 — 팀 화면이 소유하는 문서이고, 여기 두면
// 인쇄 트리가 팀 모델까지 지고 다니게 된다. 뿌리(포털·onReady·print.css 계약)만 공유한다.
import { TeamPrintSheet } from '../team/TeamPrintSheet.tsx';
import { PRINT_ROOT_CLASS } from './printDom.ts';
import type { PrintDoc } from './printDoc.ts';

export interface PrintRootProps {
  /** null 이면 아무것도 렌더하지 않는다 — 평소 상태다. */
  doc: PrintDoc | null;
  /** 페이지가 **DOM 에 붙은 뒤** 문서당 정확히 1회. 여기서 `printWhenReady()` 를 부른다. */
  onReady?: () => void;
  /** 포털 대상. 기본 `document.body`. */
  container?: Element;
  /** 표시 스위치 — 화면·PNG 와 같은 값을 종이까지 내린다. **필수다**: 옵셔널이면 배선을
   *  빠뜨려도 조용히 컴파일되고, 그것이 2026-08-27 사고의 메커니즘이었다
   *  (render/renderPaths.ts 머리말). */
  view: PrintViewSwitches;
}

/** 종이에 무엇을 실을지 정하는 스위치 묶음. 화면 설정(prefs)에서 그대로 온다 — 종이만
 *  다른 규칙을 두지 않는다는 뜻이다. */
export interface PrintViewSwitches {
  showGrid: boolean;
  showGridLabels: boolean;
  showRuleZones: boolean;
}

export function PrintRoot({ doc, onReady, container, view }: PrintRootProps) {
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
      {doc.kind === 'drill' ? (
        <PrintDrillSheet drill={doc.drill} stepIndexes={doc.stepIndexes} view={view} />
      ) : doc.kind === 'session' ? (
        <PrintSessionPlan plan={doc.plan} view={view} />
      ) : (
        // ⚠️ 팀시트는 `view`(격자·규칙 존) 스위치를 **안 받는다** — 코트를 안 그리므로 켤 것이 없다.
        <TeamPrintSheet team={doc.team} stripClass={doc.stripClass} />
      )}
    </div>,
    container ?? document.body,
  );
}
