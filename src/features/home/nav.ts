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
  /** §6.11 "카드 전체가 버튼 → go('library') + 세션 탭 + 해당 드로어 열기"의 축약. */
  openSession(id: SessionId): void;
  presentDrill(id: DrillId): void;
  presentSession(id: SessionId): void;
}

export type LibraryNav = HomeNav;
