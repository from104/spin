// §7.6 라이브 리전 발표문 — 계획서 2.4.
//
// 개명 전에는 AppShell 이 `say(SCREEN_TITLES[screen] + ' 화면')` 하나로 때웠다. 그래서 자유
// 전술판을 열든 드릴을 열든 화면 키가 같아서(둘 다 board 자리다) **똑같이 "전술판 화면"** 만
// 읽혔다 — 시각장애 코치에게는 방금 무엇이 열렸는지 알 방법이 없다. 화면 키만으로는 말할 수
// 없는 것이라, 무엇이 떠 있는지를 정하는 두 대상(StageTarget·PresentTarget)을 함께 받는다.
//
// 순수 함수로 떼어 둔 이유: 발표문은 눈에 안 보이는 산출물이라 화면을 띄워서는 틀린 것을
// 알아채지 못한다. 여기서 문자열 단위로 단언한다.
import type { PresentTarget, StageTarget } from './AppShell.tsx';
import type { Screen } from './screens.ts';
import type { Locale } from '../i18n/locale.ts';
import { translate } from '../i18n/useT.ts';

export interface AnnounceLookup {
  /** 대상의 제목을 찾아 준다. 아직 목록이 안 읽혔거나 삭제된 드릴이면 undefined —
   *  그때는 제목 없이 무엇을 하는 화면인지만 읽는다("드릴 편집"). 콜론 뒤에 빈 자리를
   *  남기지 않는다. */
  titleOf?(target: StageTarget | PresentTarget): string | undefined;
}

/** i18n C2 — locale 은 필수 인자다(기본값을 두지 않는다: 호출부가 잊으면 조용히 엉뚱한 언어로
 *  읽히는 대신 타입 에러로 바로 드러나야 한다). lookup 만 여전히 선택이다 — "조회기를 안 넘겨도
 *  죽지 않는다" 계약(announce.test.ts)은 그대로 유지된다. */
export function announceFor(screen: Screen, stage: StageTarget, present: PresentTarget | null, locale: Locale, lookup: AnnounceLookup = {}): string {
  const title = (t: StageTarget | PresentTarget) => lookup.titleOf?.(t);
  const t = (key: Parameters<typeof translate>[1], params?: Record<string, string>) => translate(locale, key, params);
  switch (screen) {
    case 'board': {
      if (stage.kind === 'board') return t('app.announce.freeBoard');
      const title_ = title(stage);
      return title_ ? t('app.announce.drillEditTitled', { title: title_ }) : t('app.announce.drillEdit');
    }
    case 'drills':
      return t('app.announce.drillList');
    case 'sessions':
      // C5 — 세션이 1급 화면이 됐다(옛 "드릴 목록, 세션 탭" 문장의 후계).
      return t('app.announce.sessionList');
    case 'present': {
      if (!present) return t('app.announce.presentMode');
      const title_ = title(present);
      return title_ ? t('app.announce.presentTitled', { title: title_ }) : t('app.announce.presentMode');
    }
    case 'settings':
      return t('app.announce.settings');
  }
}
