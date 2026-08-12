// §6.8/§6.11 대문·목록 화면이 필요로 하는 내비게이션 계약. §8 "screen-home-library 의존은
// store, render-court, ui-kit, model, storage 뿐" — app-shell(useAppHistory 등)을 직접 import
// 하지 않는다. 대신 이 화면들이 실제로 필요로 하는 좁은 콜백 집합만 여기서 정의하고, app-shell
// 이 `useAppHistory().go` 위에 이 시그니처를 만족하는 어댑터를 얹어 prop 으로 내려준다.
//
// (통합 확인, 2026-08-08: app-shell 이 병렬로 만든 src/app/AppShell.tsx 가 이 파일의 HomeNav를
// 그대로 가져다 어댑터를 구현하고 `<HomeScreen nav={...}/>` `<LibraryScreen nav={...}
// initialTab={...} initialOpenSessionId={...}/>` 로 내려준다 — 아래 시그니처가 그 실제 계약과
// 일치함을 상호 확인했다.)
import type { DrillId, SessionId } from '../../core/ids.ts';

export type LibraryTab = 'drills' | 'sessions';

export interface HomeNav {
  /** 헤더 주 액션 "새 드릴" / 히어로 "새 드릴 만들기" — 코트 선택은 편집기 화면(screen-editor)
   *  소관이라 drillId 없이 편집기로 이동하기만 한다. */
  newDrill(): void;
  openDrill(id: DrillId): void;
  goLibrary(opts?: { tab?: LibraryTab; openSessionId?: SessionId }): void;
  /** §6.11 "카드 전체가 버튼 → go('drills') + 세션 탭 + 해당 드로어 열기"의 축약.
   *  (2026-08-12 개명: 화면 키 'library' → 'drills'. 이 파일의 계약 자체는 안 바뀐다 —
   *  화면 키를 아는 것은 app-shell 쪽 어댑터뿐이다.) */
  openSession(id: SessionId): void;
  presentDrill(id: DrillId): void;
  presentSession(id: SessionId): void;
}

export type LibraryNav = HomeNav;

/** 목록 화면에 **아무 초기 의도 없이** 들어왔을 때 어느 탭이 서는가(계획서 2.9 · 안 2 이식).
 *  세션이 하나도 없으면 [세션] 탭은 빈 상태 안내뿐이라 첫 화면으로 세울 값이 없다 — 그때는
 *  [드릴]이 기본이고, 세션이 하나라도 있으면 "오늘 뭘 하지" 가 먼저이므로 [세션]이 기본이다.
 *  화면 전환을 아는 쪽(app-shell)과 탭을 그리는 쪽(LibraryScreen)이 **같은 규칙**을 써야
 *  뒤로가기가 어긋나지 않으므로, 규칙 자체는 두 쪽이 함께 보는 이 계약 파일에 둔다. */
export function defaultLibraryTab(sessionCount: number): LibraryTab {
  return sessionCount > 0 ? 'sessions' : 'drills';
}
