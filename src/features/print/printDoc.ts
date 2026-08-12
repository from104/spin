// 인쇄할 문서 2종(§6.3). 컴포넌트 파일(.tsx)이 아니라 여기 두는 이유는 Fast Refresh 다 —
// 컴포넌트 파일에 컴포넌트 아닌 export 를 두면 oxlint `react(only-export-components)` 가
// 경고하고 실제로 새로고침이 깨진다(noteChip.ts 가 같은 이유로 떨어져 나왔다).
import type { Drill } from '../../model/drill.ts';
import type { SessionPlan } from './sessionPlan.ts';

export type PrintDoc = { kind: 'drill'; drill: Drill } | { kind: 'session'; plan: SessionPlan };
