// 튜토리얼 자동 시작 게이트 — docs/PLAN-0-6-3-LOADER-NOTICE.md 결정 30·31.
//
// 첫 실행에는 화면 로더 · 작은 화면 안내 모달 · 화면 투어 셋이 같은 1~2초를 놓고 겹친다.
// 계획서가 못박은 순서는 **로더 걷힘 → 안내 모달 닫힘 → 튜토리얼 시작** 이고, 이 파일은 그
// 순서에서 마지막 칸의 열쇠 하나만 맡는다: "지금 튜토리얼을 자동으로 시작해도 되는가".
//
// ⚠️ 게이트를 화면 7곳이 아니라 훅(`useTutorial`) 안에 두는 이유 — `useTutorial(screen, steps,
// autoStart)` 호출부(LibraryScreen·SessionsScreen·SessionEditorScreen·EditorWorkspace·
// PresentRunner·RulesScreen)를 한 줄도 안 건드리려는 것이다. 여기에 조건을 하나 더 얹고 싶어
// 지면 호출부가 아니라 Provider 가 발행하는 `ready` 를 고친다.
//
// ⚠️ 기본값이 `true` 인 것이 계약이다 — Provider 밖(단위 테스트, 화면 단독 마운트)에서는
// 게이트가 없는 것과 똑같이 움직여야 한다. 기본을 false 로 뒤집으면 Provider 를 안 세운 모든
// 트리에서 자동 시작이 **조용히 증발**한다.
import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

/** 기본 true — 위 머리말의 "Provider 밖에서는 게이트가 없는 것과 같다" 계약. */
const TutorialGateContext = createContext<boolean>(true);

/** `ready` 를 발행한다 — 발행처는 AppShell 이다. 값이 나중에 true 로 바뀌면 그때 자동 시작이
 *  이어진다(`useTutorial` 의 effect 의존성).
 *
 *  처음 적었던 발행식은 `!로더.visible && !안내모달.open` 이었다.
 *  ⚠️ 2026-09-04 같은 날 뒤집혔다 — 헤드리스 크롬 프레임에서 로더의 **퇴장 페이드 도중** 말풍선이
 *  거의 불투명한 판 위에 떠 있는 것이 잡혔다. `visible` 은 최소 표시 시간이 끝나는 순간 꺼지지만 판은
 *  EXIT_MS 만큼 더 살아 있고, 안내 모달은 그 뒤 effect 에서 열려 한 커밋의 틈이 있었다. 지금 값은
 *  `coverSettled && noticeDecided && !noticeOpen` 이다(AppShell.tsx 게이트 앞 주석 · 계획서 §10.7):
 *  "로더 걷힘" 은 퇴장 **완료**(`AppLoaderOverlay.onExited`)이고, 안내 모달은 "열지 않기로 판정한 것"
 *  까지 기다린다. 이 파일은 그 식을 모른다 — 발행식을 바꾸는 자리는 AppShell 이고, 여기서 값을 다시
 *  조립하면 두 벌이 된다. */
export function TutorialGateProvider({ ready, children }: { ready: boolean; children: ReactNode }) {
  return <TutorialGateContext.Provider value={ready}>{children}</TutorialGateContext.Provider>;
}

/** 자동 시작을 해도 되는가. 수동 시작([이 화면 투어 다시 보기])은 이 값을 보지 않는다 —
 *  사람이 직접 누른 것은 겹칠 상대가 이미 사라진 뒤라는 뜻이다. */
export function useTutorialGate(): boolean {
  return useContext(TutorialGateContext);
}
