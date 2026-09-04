// 인쇄할 문서 2종(§6.3). 컴포넌트 파일(.tsx)이 아니라 여기 두는 이유는 Fast Refresh 다 —
// 컴포넌트 파일에 컴포넌트 아닌 export 를 두면 oxlint `react(only-export-components)` 가
// 경고하고 실제로 새로고침이 깨진다(noteChip.ts 가 같은 이유로 떨어져 나왔다).
import type { Drill } from '../../model/drill.ts';
import type { SessionPlan } from './sessionPlan.ts';

export type PrintDoc =
  /** `stepIndexes` 가 있으면 **그 스텝만** 인쇄한다(2026-08-27, 기현 지시 *"선택한것만, 또는
   *  전체를 고르게 해야함"*). 없으면 전부 — 옛 호출부와 세션 계획서가 그 뜻이다. */
  | { kind: 'drill'; drill: Drill; stepIndexes?: readonly number[] }
  | { kind: 'session'; plan: SessionPlan };
