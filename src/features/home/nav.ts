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
import type { LegalDoc } from '../settings/legalContent.ts';

export type LibraryTab = 'drills' | 'sessions';

export interface HomeNav {
  /** 헤더 주 액션 "새 드릴" / 빈 상태 "새 드릴 만들기" — **화면을 옮기지 않는다.** 이름과 코트를
   *  묻는 다이얼로그를 열고, 거기서 드릴이 태어나면 그때 `openDrill` 로 이어진다
   *  (2026-08-28 기현 지시, app-shell 이 다이얼로그를 세운다 — NewDrillDialog.tsx 머리말).
   *  부르는 쪽은 여전히 "무엇이 뜰지" 를 모른다 — 이 계약이 좁은 콜백인 이유 그대로다. */
  newDrill(): void;
  openDrill(id: DrillId): void;
  goLibrary(opts?: { tab?: LibraryTab; openSessionId?: SessionId }): void;
  /** §6.11 "카드 전체가 버튼 → go('drills') + 세션 탭 + 해당 드로어 열기"의 축약.
   *  (2026-08-12 개명: 화면 키 'library' → 'drills'. 이 파일의 계약 자체는 안 바뀐다 —
   *  화면 키를 아는 것은 app-shell 쪽 어댑터뿐이다.) */
  openSession(id: SessionId): void;
  presentDrill(id: DrillId): void;
  presentSession(id: SessionId): void;
  /** 규칙 화면의 카드 홈↔주제 상세 이동(2026-08-22 주제별 재설계). 생략하면 카드 홈으로 —
   *  세션의 `goLibrary()`(대상 없으면 목록)와 같은 모양이다. */
  openRuleTopic(key?: string): void;
  /** 설정 화면 안의 법적 고지 문서 열기(PLAN-LEGAL-PAGES 결정 1·2). 생략하면 설정으로 —
   *  헤더의 [← 설정으로] 가 이 인자 없는 호출이다. 규칙의 `openRuleTopic()`(생략 시 카드 홈)과
   *  같은 모양이라, 부르는 쪽은 여전히 화면 키도 주소 꼴도 모른다.
   *  브라우저 back 이 아니라 **제자리로 되접기**인 이유: 문서에 직접 착지(`/privacy/`)했을 때
   *  뒤로가기는 앱 밖으로 나간다(결정 4 — 그 주소가 공개 색인용이다). */
  openLegal(doc?: LegalDoc): void;
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
