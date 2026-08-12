// §6.3 인쇄(=PDF)의 **공개 면**. 진입점(4.7)이 이 파일 하나만 보면 되도록 모아 둔다.
//
// 쓰는 법 — 버튼은 4.7 이 단다(여기서는 달지 않는다):
//   const [doc, setDoc] = useState<PrintDoc | null>(null);
//   …
//   <PrintRoot doc={doc} onReady={() => { printWhenReady(); setDoc(null); }} />
//   // 드릴 시트:   setDoc({ kind: 'drill', drill })
//   // 세션 계획서: setDoc({ kind: 'session', plan: buildSessionPlan(resolved, drillMap) })
//
// `onReady` 는 페이지가 DOM 에 붙은 **뒤**(useLayoutEffect)에 문서당 1회 불린다. 상태에 넣고
// 곧바로 `window.print()` 를 부르면 아직 아무것도 없는 문서가 인쇄된다 — 그 사고는 조용하다.
export { PrintRoot } from './PrintRoot.tsx';
export type { PrintRootProps } from './PrintRoot.tsx';
export type { PrintDoc } from './printDoc.ts';
export { printWhenReady } from './printWhenReady.ts';
export { PrintDrillSheet } from './PrintDrillSheet.tsx';
export { PrintSessionPlan } from './PrintSessionPlan.tsx';
export { PrintCourt } from './PrintCourt.tsx';
export { buildSessionPlan, planDrillEntries, formatPlanWhen } from './sessionPlan.ts';
export type { SessionPlan, PlanEntry } from './sessionPlan.ts';
export { prepFor, maxPrep, prepLine } from './prep.ts';
export type { PrepList, PrepCounts } from './prep.ts';
export { PRINT_ROOT_SELECTOR, PRINT_PAGE_SELECTOR } from './printDom.ts';
