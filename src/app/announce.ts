// §7.6 라이브 리전 발표문 — 계획서 2.4.
//
// 개명 전에는 AppShell 이 `say(SCREEN_TITLES[screen] + ' 화면')` 하나로 때웠다. 그래서 자유
// 전술판을 열든 드릴을 열든 화면 키가 같아서(둘 다 board 자리다) **똑같이 "전술판 화면"** 만
// 읽혔다 — 시각장애 코치에게는 방금 무엇이 열렸는지 알 방법이 없다. 화면 키만으로는 말할 수
// 없는 것이라, 무엇이 떠 있는지를 정하는 두 대상(StageTarget·PresentTarget)을 함께 받는다.
//
// 순수 함수로 떼어 둔 이유: 발표문은 눈에 안 보이는 산출물이라 화면을 띄워서는 틀린 것을
// 알아채지 못한다. 여기서 문자열 단위로 단언한다.
import type { LibraryTab } from '../features/home/nav.ts';
import type { PresentTarget, StageTarget } from './AppShell.tsx';
import type { Screen } from './screens.ts';

export interface AnnounceLookup {
  /** 대상의 제목을 찾아 준다. 아직 목록이 안 읽혔거나 삭제된 드릴이면 undefined —
   *  그때는 제목 없이 무엇을 하는 화면인지만 읽는다("드릴 편집"). 콜론 뒤에 빈 자리를
   *  남기지 않는다. */
  titleOf?(target: StageTarget | PresentTarget): string | undefined;
  /** 드릴 화면에서 지금 열려 있는 탭. */
  tab?: LibraryTab;
}

const TAB_NAMES: Record<LibraryTab, string> = { drills: '드릴 탭', sessions: '세션 탭' };

export function announceFor(screen: Screen, stage: StageTarget, present: PresentTarget | null, lookup: AnnounceLookup = {}): string {
  const title = (t: StageTarget | PresentTarget) => lookup.titleOf?.(t);
  switch (screen) {
    case 'board': {
      if (stage.kind === 'board') return '자유 전술판';
      const t = title(stage);
      return t ? `드릴 편집: ${t}` : '드릴 편집';
    }
    case 'drills': {
      const tab = lookup.tab;
      return tab ? `드릴 목록, ${TAB_NAMES[tab]}` : '드릴 목록';
    }
    case 'present': {
      if (!present) return '시연 모드';
      const t = title(present);
      return t ? `시연: ${t}` : '시연 모드';
    }
    case 'settings':
      return '설정';
  }
}
