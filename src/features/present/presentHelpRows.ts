// 시연 도움말 표 — `HelpOverlay.tsx`(§7.5f)에서 옮겼다. `ui/help/HelpCenter.tsx`(§0.5 문서형
// 도움말, docs/PLAN-HELP-TUTORIAL.md §B)와 같은 함수를 불러 쓴다 — editorHelpRows.ts 와 같은 이유.
import { helpRows } from '../../core/keymap.ts';
import { translateKeymapDesc } from '../../i18n/keymapDesc.ts';
import type { useT } from '../../i18n/useT.ts';
import type { Locale } from '../../i18n/locale.ts';
import type { HelpRow } from '../editor/editorHelpRows.ts';

export function presentHelpRows(t: ReturnType<typeof useT>, locale: Locale): readonly HelpRow[] {
  // 키가 아니라서 keymap.ts 표에 없는 줄. 스와이프는 시연에서 가장 많이 쓰이는 조작인데
  // 키보드 표만 보면 존재를 모른다.
  const extraRows: readonly HelpRow[] = [[t('present.help.swipeKey'), t('present.help.swipeDesc')]];
  return [...helpRows('present', { steps: true }).map(([key, desc]): HelpRow => [key, translateKeymapDesc(desc, locale)]), ...extraRows];
}
