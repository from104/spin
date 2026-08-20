// [투어 다시 보기]가 **다른 화면**(예: 세션 목록에서 여는 도움말의 "세션 편집 투어") 것을
// 가리킬 때 쓴다. 그 화면이 지금 마운트돼 있지 않으니 useTutorial().start() 를 부를 인스턴스가
// 없다 — 대신 "안 봤음" 으로 되돌려 다음에 그 화면을 열 때 자동으로 뜨게 한다.
import type { TutorialScreenKey } from '../../storage/prefs.ts';

export function withTutorialUnseen(
  tutorialsSeen: Partial<Record<TutorialScreenKey, true>>,
  screen: TutorialScreenKey,
): Partial<Record<TutorialScreenKey, true>> {
  const next = { ...tutorialsSeen };
  delete next[screen];
  return next;
}
