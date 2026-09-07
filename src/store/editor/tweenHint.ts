// 스텝 전환 트윈이 읽는 재생 힌트(배속의 스텝 간격·루프) — PLAN-STEP-LINK, 2026-09-08 기현 실기
// "편집 화면에서는 멈칫이 있는데?". PlaybackProvider 는 EditorProvider **안쪽**에 있어 프로바이더가
// 훅으로 못 읽는다 — useStepPlayback 이 이 ref 에 써 두고 트윈은 시작 순간에 읽는다(렌더를 안 타는
// 값이라 state 가 아니라 ref). EditorProvider 파일에 두지 않는 이유: 컴포넌트 파일의 비컴포넌트
// export 는 fast refresh 린트(react/only-export-components)에 걸린다(tween.ts 의 effectiveReduceMotion 과 같은 결).
import { createContext, useContext } from 'react';
import type { MutableRefObject } from 'react';

export interface TweenHint {
  baseMs: number;
  loop: boolean;
}

export const EditorTweenHintContext = createContext<MutableRefObject<TweenHint> | null>(null);

/** 재생 훅이 배속·루프를 트윈에 알리는 창구. 프로바이더 밖에서는 null — 재생 훅이 없는 화면은 기본값(1x·루프 없음). */
export function useEditorTweenHint(): MutableRefObject<TweenHint> | null {
  return useContext(EditorTweenHintContext);
}
