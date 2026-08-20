// 튜토리얼(스포트라이트) 진행 상태 — docs/PLAN-HELP-TUTORIAL.md §C.
//
// 화면 컴포넌트가 `autoStart` 로 "지금이 첫 방문 시도 시점"을 알려주면(데이터 로딩이 끝나
// 화면이 실제로 그려진 뒤), 이 훅이 prefs.tutorialsSeen 을 보고 자동으로 시작할지 정한다.
// `start()` 는 그와 별개로 설정 화면의 [다시 보기]·HelpCenter 의 재시작 버튼이 부르는
// 수동 진입점이다.
//
// ⚠️ **빈 화면 가드**(계획서 §E 위험) — steps 에 적힌 target 이 그 순간 DOM 에 없으면
// (드릴이 0개라 안내할 카드가 없는 등) 그 단계는 걸러진다. 걸러진 뒤 하나도 안 남으면
// 아예 시작하지 않고, 자동 시작이었다면 **플래그도 안 찍는다** — 다음에 데이터가 생겼을 때
// 다시 시도할 기회를 남긴다.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSettings } from '../../store/settings/SettingsProvider.tsx';
import type { TutorialScreenKey } from '../../storage/prefs.ts';
import type { TutorialStep } from './types.ts';

/** 자동 시작 전 "전부 찾았는가" 를 재시도할 상한 프레임 수 — 위 useEffect 주석 참고. */
const AUTOSTART_MAX_FRAMES = 20;

export interface UseTutorialResult {
  active: boolean;
  stepIndex: number;
  totalSteps: number;
  step: TutorialStep | null;
  /** 수동 시작(재시작 포함) — 대상이 하나도 안 보이면 조용히 아무 일도 안 한다. */
  start(): void;
  next(): void;
  prev(): void;
  /** Esc·[건너뛰기]·마지막 단계 [완료] 전부 이 하나로 — 셋 다 "이제 봤다" 는 같은 사실이다. */
  skip(): void;
}

export function useTutorial(screen: TutorialScreenKey, steps: readonly TutorialStep[], autoStart: boolean): UseTutorialResult {
  const { prefs, setPrefs } = useSettings();
  const [active, setActive] = useState(false);
  const [visibleSteps, setVisibleSteps] = useState<TutorialStep[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const startedAutoRef = useRef(false);

  const start = useCallback(() => {
    const found = steps.filter((s) => document.querySelector(`[data-tut="${s.target}"]`) !== null);
    if (found.length === 0) return;
    setVisibleSteps(found);
    setStepIndex(0);
    setActive(true);
  }, [steps]);

  const seen = prefs.tutorialsSeen[screen] === true;
  useEffect(() => {
    if (!autoStart || startedAutoRef.current || seen) return;
    startedAutoRef.current = true;
    // 헤더의 ⓘ·주 액션 버튼(`header-info`·`header-primary`, 여러 화면이 공유)은 화면 컴포넌트가
    // `useAppHeader(config)` 로 **다음 이펙트**에 발행하고 AppHeader 가 그걸 받아 한 틱 늦게
    // 그려낸다(EditorScreen.headerTitle.test.tsx 의 같은 관찰 — "판 커밋보다 한 틱 늦게 뜬다").
    // 이 이펙트가 같은 커밋의 마운트 순간에 그대로 querySelector 를 돌리면 그 두 대상이 아직
    // DOM 에 없어 빈 화면 가드에 걸려 건너뛴다.
    //
    // rAF 한 번으로는 부족할 수 있다 — 부하가 큰 기기(또는 CI 의 전체 스위트 동시 실행)에서는
    // 그 "한 틱"이 여러 프레임에 걸쳐 끝난다(실측: 격리 실행은 항상 통과, 전체 스위트 동시
    // 실행에서만 간헐적으로 6/8 로 시작). 그래서 **전부 찾을 때까지, 최대 AUTOSTART_MAX_FRAMES
    // 프레임까지** rAF 로 재시도한다 — 대부분 1~2 프레임 안에 끝나고, 정말로 없는 대상(빈
    // 서랍)은 이 상한에서 포기해 무한 대기 없이 §E 의 빈 화면 가드로 넘어간다.
    let frame = 0;
    let id: number;
    const tryStart = () => {
      const allFound = steps.every((s) => document.querySelector(`[data-tut="${s.target}"]`) !== null);
      frame += 1;
      if (allFound || frame >= AUTOSTART_MAX_FRAMES) {
        start();
        return;
      }
      id = requestAnimationFrame(tryStart);
    };
    id = requestAnimationFrame(tryStart);
    return () => cancelAnimationFrame(id);
  }, [autoStart, seen, start, steps]);

  const markSeen = useCallback(() => {
    if (prefs.tutorialsSeen[screen] === true) return;
    setPrefs({ tutorialsSeen: { ...prefs.tutorialsSeen, [screen]: true } });
  }, [prefs.tutorialsSeen, screen, setPrefs]);

  const skip = useCallback(() => {
    setActive(false);
    markSeen();
  }, [markSeen]);

  const next = useCallback(() => {
    setStepIndex((i) => {
      if (i + 1 >= visibleSteps.length) {
        setActive(false);
        markSeen();
        return i;
      }
      return i + 1;
    });
  }, [visibleSteps.length, markSeen]);

  const prev = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  return {
    active,
    stepIndex,
    totalSteps: visibleSteps.length,
    step: active ? (visibleSteps[stepIndex] ?? null) : null,
    start,
    next,
    prev,
    skip,
  };
}
