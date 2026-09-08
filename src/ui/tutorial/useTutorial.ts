// 튜토리얼(스포트라이트) 진행 상태 — docs/PLAN-HELP-TUTORIAL.md §C.
//
// 화면 컴포넌트가 `autoStart` 로 "지금이 첫 방문 시도 시점"을 알려주면(데이터 로딩이 끝나
// 화면이 실제로 그려진 뒤), 이 훅이 prefs.tutorialsSeen 을 보고 자동으로 시작할지 정한다.
// `start()` 는 그와 별개로 설정 화면의 [다시 보기]·HelpCenter 의 재시작 버튼이 부르는
// 수동 진입점이다.
//
// 2026-09-08(docs/PLAN-HELP-OVERHAUL.md 결정 11) — "보기만 하는" 투어로는 초보자가 익히지
// 못한다는 판정으로 둘이 붙었다: **실습형 단계**(`advanceOnClick` — 대상을 실제로 누르면 다음)
// 와 **[자세한 도움말]**(`options.onOpenHelp` — 마지막 말풍선에서 도움말로 갈아탄다). 둘 다
// 기존 계약을 안 건드린다: 단계 필터·플래그 형식(결정 13)·자동 시작 게이트 그대로다.
//
// ⚠️ **빈 화면 가드**(계획서 §E 위험) — steps 에 적힌 target 이 그 순간 DOM 에 없으면
// (드릴이 0개라 안내할 카드가 없는 등) 그 단계는 걸러진다. 걸러진 뒤 하나도 안 남으면
// 아예 시작하지 않고, 자동 시작이었다면 **플래그도 안 찍는다** — 다음에 데이터가 생겼을 때
// 다시 시도할 기회를 남긴다.
//
// ── ⚠️ 2026-09-09: 위 필터는 «시작 때 한 번» 이 아니게 됐다(docs/PLAN-TEAM.md 결정 23) ──
// 팀 투어는 **목록과 상세를 가로지른다**: step1·2 의 앵커는 목록에, step3~5 의 앵커는 상세에
// 있고 상세는 step2([새 팀])를 눌러야 열린다. 필터가 시작 때 한 번뿐이면 그 세 단계는 영원히
// 걸러진 채로 남아 투어가 «2/2» 로 끝난다 — 계획서가 ★실습으로 지목한 «선수 추가» 에 도달조차
// 못 한다(2026-09-09 헤드리스 관문에서 실측: 말풍선이 실제로 «1/2 단계» 로 떴다).
// 그래서 **실습형 단계를 떠날 때만** 뒤 단계의 앵커가 생기는지 몇 프레임 지켜보고, 실제로
// 생긴 것만 뒤에 붙인다(`stepsAfter` + `LATE_STEP_MAX_FRAMES`). 빈 화면 가드 자체는 그대로다 —
// 앵커가 끝내 안 나타나면 예전처럼 그 단계들 없이 끝난다.
// ⚠️ 2026-09-09(검수 뒤 보탬): 꼬리는 **나눠서 도착할 수 있다.** 그래서 «앞에서부터 이어지는
// 만큼만» 붙이고 남은 것이 있으면 계속 기다린다 — 뒤엣것 하나가 먼저 섰다고 대기를 끝내면 그
// 사이의 단계가 영영 안 붙는다(아래 tick 의 §부분 도착).
//
// ── 자동 시작 게이트 (docs/PLAN-0-6-3-LOADER-NOTICE.md 결정 30·31) ──────────
// 2026-09-04 에 화면 로더(오버레이)와 작은 화면 안내 모달이 들어오면서 첫 실행에 셋이 같은
// 1~2초를 놓고 겹치게 됐다. 겹치면 두 가지가 실제로 깨진다: ① `TutorialOverlay` 는 z-index
// 300/301 이라 로더(z 220)를 **뚫고 나온다** — 화면을 덮는 로더 위에 그 화면을 가리키는
// 스포트라이트가 서는 그림이다 ② 안내 모달과 튜토리얼 오버레이가 `aria-modal="true"` 를 **둘**
// 세워, 보조기술이 무엇이 지금 유일한 대화상자인지 판정할 수 없게 된다.
// 그래서 자동 시작에만 `useTutorialGate()` 를 AND 로 건다(수동 시작은 무관 — 사람이 직접
// 누른 시점에는 겹칠 상대가 이미 사라졌다). ready 는 나중에 true 가 되므로 effect 의존성에
// 넣어, 로더·안내가 걷힌 **그때** 자동 시작이 이어지게 한다.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSettings } from '../../store/settings/SettingsProvider.tsx';
import type { TutorialScreenKey } from '../../storage/prefs.ts';
import { useTutorialGate } from './tutorialGate.tsx';
import type { TutorialStep } from './types.ts';

/** 자동 시작 전 "전부 찾았는가" 를 재시도할 상한 프레임 수 — 위 useEffect 주석 참고. */
const AUTOSTART_MAX_FRAMES = 20;

/** 실습형 단계를 떠난 뒤 «아직 안 나타난 앵커» 를 기다릴 상한 프레임 수(§뒤늦게 오는 단계).
 *  AUTOSTART_MAX_FRAMES 보다 넉넉한 이유: 저 위의 재시도는 **같은 화면**이 한두 틱 늦게
 *  그려지는 것을 기다리지만, 여기서 기다리는 것은 저장(IDB 쓰기)과 화면 전환이 끝나는 시간이다. */
const LATE_STEP_MAX_FRAMES = 60;

/** 그 순간 DOM 에 앵커가 있는가. `start()` 의 필터와 아래 «뒤늦게 오는 단계» 가 같은 판정을
 *  써야 한다 — 두 곳이 갈라지면 시작 때 걸러진 단계가 다른 규칙으로 되살아난다. */
function anchorPresent(s: TutorialStep): boolean {
  return document.querySelector(`[data-tut="${s.target}"]`) !== null;
}

/** `visible` 의 마지막 단계보다 **뒤에** 있는 원본 단계들. 시작 시점에 앵커가 없어 걸러진
 *  꼬리다(원본 배열의 객체를 그대로 담으므로 `indexOf` 로 자리를 찾는다). */
function stepsAfter(all: readonly TutorialStep[], visible: readonly TutorialStep[]): TutorialStep[] {
  const last = visible[visible.length - 1];
  if (last === undefined) return [];
  const at = all.indexOf(last);
  return at < 0 ? [] : all.slice(at + 1);
}

/** 훅의 선택 인자. **객체 하나로 받는다** — 위치 인자 넷째 자리를 boolean·함수로 계속 늘리면
 *  호출부에서 무엇이 무엇인지 못 읽는다. 기존 3인자 호출은 그대로 산다. */
export interface UseTutorialOptions {
  /** 마지막 말풍선의 [자세한 도움말] — 있으면 버튼이 그려지고, 없으면 안 그려진다
   *  (docs/PLAN-HELP-OVERHAUL.md 결정 11c). 화면이 자기 HelpCenter 를 여는 함수를 준다.
   *  ⚠️ **렌더마다 새로 만든 인라인 함수를 넘기지 마라** — 아래 `openHelp` 의 정체성이
   *  매 렌더 바뀌어 오버레이 props 가 쓸데없이 흔들린다. 화면들이 이미 쥐고 있는
   *  `showHelp`(useCallback) 를 그대로 넘기는 것이 정석이다. */
  onOpenHelp?: () => void;
}

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
  /** [자세한 도움말] — `options.onOpenHelp` 를 준 화면에서만 정의된다(안 준 화면은 undefined
   *  라 오버레이가 버튼 자체를 안 그린다). 투어를 **끝낸 것으로 치고**(skip 과 같은 플래그)
   *  닫은 뒤 도움말을 연다: 도움말로 갈아탄 사람에게 다음 방문에 같은 투어를 또 세우면
   *  "봤다" 는 사실을 앱이 두 번 묻는 것이 된다. */
  openHelp?: () => void;
}

export function useTutorial(
  screen: TutorialScreenKey,
  steps: readonly TutorialStep[],
  autoStart: boolean,
  options?: UseTutorialOptions,
): UseTutorialResult {
  const { prefs, setPrefs } = useSettings();
  const onOpenHelp = options?.onOpenHelp;
  const gateReady = useTutorialGate(); // Provider 밖에서는 true — 게이트가 없던 때와 같다
  const [active, setActive] = useState(false);
  const [visibleSteps, setVisibleSteps] = useState<TutorialStep[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  // 실습형 단계를 떠난 직후, 뒤 단계의 앵커가 나타나기를 기다리는 중인가(아래 §뒤늦게 오는 단계).
  const [waitingLate, setWaitingLate] = useState(false);
  /** 이번 대기에서 «다음 칸으로» 를 이미 밀었는가. 꼬리가 **여러 번 나눠 도착**할 수 있으므로
   *  (아래 §부분 도착) 붙일 때마다 index 를 올리면 사용자가 안 누른 칸을 건너뛴다. */
  const lateAdvancedRef = useRef(false);
  const startedAutoRef = useRef(false);

  const start = useCallback(() => {
    const found = steps.filter(anchorPresent);
    if (found.length === 0) return;
    setVisibleSteps(found);
    setStepIndex(0);
    setWaitingLate(false);
    lateAdvancedRef.current = false;
    setActive(true);
  }, [steps]);

  const seen = prefs.tutorialsSeen[screen] === true;
  useEffect(() => {
    // ★ gateReady 는 자동 시작에만 건다 — 위 머리말 「자동 시작 게이트」. false 면 아무것도
    // 하지 않고(ref 도 안 찍고) 물러나, 나중에 true 가 될 때 이 effect 가 다시 돌아 이어받는다.
    if (!autoStart || !gateReady || startedAutoRef.current || seen) return;
    startedAutoRef.current = true;
    // 기능 바의 [정보]·헤더 주 액션 버튼(`drill-info`·`header-primary`, 여러 화면이 공유)은 화면 컴포넌트가
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
    return () => {
      cancelAnimationFrame(id);
      // React.StrictMode(개발 서버)는 마운트 직후 effect→cleanup→effect 를 한 번 더 돌린다.
      // 첫 실행이 재시도 루프 도중에 취소되면 이 ref 를 되돌려 두 번째 실행이 다시 시작할 수
      // 있게 해야 한다 — 되돌리지 않으면 "이미 시도했음" 판정에 걸려 첫 진입 자동 시작이
      // 조용히 증발한다(실기 신고: 2026-08-20, 도움말의 수동 재시작은 이 ref 를 안 타서 멀쩡했다).
      startedAutoRef.current = false;
    };
  }, [autoStart, gateReady, seen, start, steps]);

  const markSeen = useCallback(() => {
    if (prefs.tutorialsSeen[screen] === true) return;
    setPrefs({ tutorialsSeen: { ...prefs.tutorialsSeen, [screen]: true } });
  }, [prefs.tutorialsSeen, screen, setPrefs]);

  const skip = useCallback(() => {
    setActive(false);
    setWaitingLate(false);
    markSeen();
  }, [markSeen]);

  const next = useCallback(() => {
    if (stepIndex + 1 < visibleSteps.length) {
      setStepIndex(stepIndex + 1);
      return;
    }
    // ── 뒤늦게 오는 단계 (2026-09-09, docs/PLAN-TEAM.md 결정 23) ──────────────────────
    // 여기는 «보이는» 마지막 단계다. 방금 떠나는 단계가 실습형(advanceOnClick)이면 그 조작이
    // **다른 화면을 열었을 수 있고**, 시작 시점에 앵커가 없어 걸러졌던 뒤 단계가 그제야
    // 생긴다 — 팀 투어가 정확히 그 모양이다(목록에서 [새 팀] 을 누르면 상세가 열리고 거기에
    // 선수 추가·라인업·내보내기 앵커가 있다). 필터가 시작 때 한 번뿐이면 그 세 단계는
    // 영원히 안 보이고 투어가 «2/2» 로 끝난다(2026-09-09 헤드리스 관문에서 실측).
    // ⚠️ **없던 단계를 지어내지 않는다.** 아래 이펙트는 앵커가 실제로 나타난 단계만 붙인다 —
    // 빈 서랍(드릴 0개)의 투어는 여전히 그 단계들 없이 끝난다(§E 빈 화면 가드 그대로).
    const leaving = visibleSteps[stepIndex];
    if (leaving?.advanceOnClick === true && stepsAfter(steps, visibleSteps).length > 0) {
      // ★ 기다리는 동안에도 플래그는 **지금** 찍는다. 실습형 조작이 화면을 갈아 치우면 이 훅이
      // 통째로 언마운트돼 «끝났다» 를 적을 자리가 사라진다(드릴 목록 [새 드릴] → 편집기).
      // 그러면 다음 방문에 같은 투어가 또 서는데, 사용자 입장에서는 이미 끝까지 누른 투어다.
      markSeen();
      lateAdvancedRef.current = false;
      setWaitingLate(true);
      return;
    }
    setActive(false);
    markSeen();
  }, [stepIndex, visibleSteps, steps, markSeen]);

  useEffect(() => {
    if (!waitingLate || !active) return;
    let frame = 0;
    let id: number;
    const tick = () => {
      frame += 1;
      const remaining = stepsAfter(steps, visibleSteps);
      // ── 부분 도착 (⚠️ 2026-09-09 검수) ────────────────────────────────────────────
      // 옛 코드는 `remaining.filter(anchorPresent)` 로 «보이는 것 전부» 를 한 번에 붙이고 즉시
      // 대기를 끝냈다. 그러면 꼬리가 한 프레임에 다 서지 않는 기기에서 **뒤엣것이 먼저 서는**
      // 순간 그 사이의 단계가 영영 안 붙는다(팀 투어의 꼬리는 셋이다 — 선수 추가·라인업·
      // 내보내기). 그래서 **앞에서부터 끊기지 않고 이어지는 만큼만** 붙이고, 남은 것이 있으면
      // 대기를 유지한다. 이 이펙트는 visibleSteps 가 바뀌며 다시 돌므로 다음 조각을 이어받는다.
      let n = 0;
      while (n < remaining.length && anchorPresent(remaining[n]!)) n += 1;
      if (n > 0) {
        setVisibleSteps((v) => [...v, ...remaining.slice(0, n)]);
        if (!lateAdvancedRef.current) {
          lateAdvancedRef.current = true;
          setStepIndex((i) => i + 1);
        }
        if (n === remaining.length) setWaitingLate(false);
        return;
      }
      if (frame >= LATE_STEP_MAX_FRAMES) {
        // 안 나타났다 = 그 조작이 화면을 열지 않았다(또는 열 것이 없었다).
        setWaitingLate(false);
        // ★ 이미 몇 개를 붙였다면 투어를 **죽이지 않는다** — 사용자는 지금 그 단계를 보고 있다.
        //   붙인 것이 하나도 없을 때만 원래대로 끝낸다(빈 화면 가드 그대로).
        if (lateAdvancedRef.current) return;
        setActive(false);
        markSeen();
        return;
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [waitingLate, active, steps, visibleSteps, markSeen]);

  const prev = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const step = active ? (visibleSteps[stepIndex] ?? null) : null;

  // ── 실습형 단계(advanceOnClick) ────────────────────────────────────────────────
  // 대상을 진짜 누르면 그 자체가 [다음]이다. 구현에서 조심할 것 셋:
  //  ① **요소를 붙잡아 두지 않는다.** 효과가 도는 순간의 노드를 ref 에 넣어 두면 그 사이의
  //     리렌더로 노드가 갈리는 순간 리스너가 유령 노드에 남는다. 그래서 document 에서 듣고
  //     `closest()` 로 "이 사건이 그 앵커 **안에서** 났나" 를 판정한다 — 앵커가 컨테이너든
  //     버튼이든 같은 코드로 맞는다.
  //  ② **capture 로 듣는다.** 대상이 자기 핸들러에서 stopPropagation 을 하더라도(메뉴 버튼이
  //     흔히 그런다) 캡처 단계는 그보다 먼저 지나간다.
  //  ③ **pointerup 과 click 을 둘 다 듣고, 한 단계에 한 번만 넘긴다.** 누르는 순간 대상이
  //     사라지는 버튼(다이얼로그를 여는 [새 드릴] 같은)에서는 뒤이을 click 이 아예 안 날 수
  //     있고, 반대로 둘 다 나면 두 칸이 넘어간다. `fired` 플래그가 그 둘을 하나로 접는다.
  const advanceTarget = step?.advanceOnClick === true ? step.target : null;
  useEffect(() => {
    if (advanceTarget === null) return;
    let fired = false;
    const onHit = (e: Event) => {
      if (fired) return;
      const el = e.target;
      if (!(el instanceof Element) || el.closest(`[data-tut="${advanceTarget}"]`) === null) return;
      fired = true;
      next();
    };
    document.addEventListener('pointerup', onHit, true);
    document.addEventListener('click', onHit, true);
    return () => {
      document.removeEventListener('pointerup', onHit, true);
      document.removeEventListener('click', onHit, true);
    };
  }, [advanceTarget, next]);

  const openHelp = useCallback(() => {
    setActive(false);
    setWaitingLate(false);
    markSeen();
    onOpenHelp?.();
  }, [markSeen, onOpenHelp]);

  return {
    active,
    stepIndex,
    totalSteps: visibleSteps.length,
    step,
    start,
    next,
    prev,
    skip,
    openHelp: onOpenHelp ? openHelp : undefined,
  };
}
