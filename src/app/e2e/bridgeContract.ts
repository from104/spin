// 시험 다리 `window.__spinE2E` 의 **모양** — 앱(installE2EBridge.ts)과 시험(e2e/drivers)이 함께 읽는 계약.
// docs/PLAN-TEST-SUITE.md §3·§4.
//
// 따로 떼어 둔 이유: 시험 쪽 tsconfig(tsconfig.e2e.json)는 JSX 를 모른다. 설치 모듈은 편집기 상태·
// 렌더 계층을 타고 .tsx 까지 끌고 오므로, 모양만 담은 이 파일을 타입으로만 import 하게 한다.
// ⚠️ 여기에 값(함수·상수)을 두지 마라 — 시험이 이 파일을 통해 앱 코드를 실행하게 된다.
import type { TeamSide } from '../../model/drill.ts';

export interface E2EObject {
  id: string;
  kind: 'chair' | 'ball' | 'cone';
  team?: TeamSide;
  /** 월드(viewBox) 좌표 */
  x: number;
  y: number;
  /** 저장 각도(StoredChairPose.angleDeg). 공·콘은 0 */
  angleDeg: number;
}

export type E2EAutosave = 'saved' | 'pending' | 'saving' | 'conflict' | 'error';

export interface SpinE2EBridge {
  /** 판 위에 떠 있는 것 — 자유 전술판인가 드릴 편집인가 */
  readonly surface: 'board' | 'drill';
  objects(): E2EObject[];
  readonly stepIndex: number;
  readonly stepCount: number;
  readonly playing: boolean;
  readonly busy: boolean;
  readonly autosave: E2EAutosave;
}

declare global {
  interface Window {
    __spinE2E?: SpinE2EBridge;
  }
}
