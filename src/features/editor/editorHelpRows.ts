// 드릴 편집·자유 전술판 도움말 표 — `HelpModal.tsx`(§7.5f)에서 그대로 옮겨 왔다. 그 파일과
// `ui/help/HelpCenter.tsx`(§0.5 문서형 도움말, docs/PLAN-HELP-TUTORIAL.md §B)가 **같은 함수**를
// 불러 쓴다 — 표가 두 곳에 따로 있으면 한쪽만 고치고 잊는 사고가 난다(HelpModal.tsx 머리말의
// 그 경고 그대로).
import { helpRows, toolHelpRows } from '../../core/keymap.ts';
import { translateKeymapDesc, keymapLabel } from '../../i18n/keymapDesc.ts';
import type { useT } from '../../i18n/useT.ts';
import type { Locale } from '../../i18n/locale.ts';

export type HelpRow = readonly [string, string];

/** 첫 섹션 — "어떻게 놓는가 / 어떻게 옮기는가". 4존 운동학은 **한 문장**이다(§7 3.9). */
export function editorBasicsRows(t: ReturnType<typeof useT>): readonly HelpRow[] {
  return [
    [t('editor.helpModal.basics.place.key'), t('editor.helpModal.basics.place.desc')],
    [t('editor.helpModal.basics.placeMany.key'), t('editor.helpModal.basics.placeMany.desc')],
    [t('editor.helpModal.basics.move.key'), t('editor.helpModal.basics.move.desc')],
    [t('editor.helpModal.basics.select.key'), t('editor.helpModal.basics.select.desc')],
    [t('editor.helpModal.basics.selectMany.key'), t('editor.helpModal.basics.selectMany.desc')],
    [t('editor.helpModal.basics.moveMany.key'), t('editor.helpModal.basics.moveMany.desc')],
    [t('editor.helpModal.basics.note.key'), t('editor.helpModal.basics.note.desc')],
    [t('editor.helpModal.basics.remove.key'), t('editor.helpModal.basics.remove.desc')],
  ];
}

/** 전역 키맵에 없는 줄 — **컴포넌트 자기 것**이거나 아예 키가 아니다. */
function extraRows(steps: boolean, t: ReturnType<typeof useT>): readonly HelpRow[] {
  return [
    [t('editor.helpModal.extra.wheel.key'), t('editor.helpModal.extra.wheel.desc')],
    [t('editor.helpModal.extra.arrowKeys.key'), t('editor.helpModal.extra.arrowKeys.desc')],
    // §4.4 P2-3 스텝 사진 재배열(TransportBar). 전술판에는 스텝 자체가 없다.
    ...(steps ? ([[t('editor.helpModal.extra.stepPhoto.key'), t('editor.helpModal.extra.stepPhoto.desc')]] as HelpRow[]) : []),
  ];
}

/** 같은 키가 같은 말로 두 번 나오면 한 줄로 접는다(전역·개체 스코프의 Delete 중복 등). */
function dedupe(rows: readonly HelpRow[]): readonly HelpRow[] {
  const seen = new Set<string>();
  return rows.filter(([k, d]) => {
    const key = `${k} ${d}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** 도구 표 — keymap.ts 의 toolHelpRows(). */
export function editorToolRows(locale: Locale): readonly HelpRow[] {
  return toolHelpRows().map(([key, desc]): HelpRow => [key, translateKeymapDesc(desc, locale)]);
}

/** 단축키 표 — mode 에 따라 스텝 관련 키 넷을 뺀다(전술판에는 스텝이 없다). */
export function editorShortcutRows(mode: 'board' | 'drill', t: ReturnType<typeof useT>, locale: Locale): readonly HelpRow[] {
  const steps = mode === 'drill';
  const keymapSourceRows: readonly HelpRow[] = [...helpRows('global', { steps }), ...helpRows('object', { steps })].map(
    ([key, desc]): HelpRow => [keymapLabel(key), desc],
  );
  const rows = dedupe([...keymapSourceRows, ...extraRows(steps, t)]).map(
    (r): HelpRow =>
      // 전술판의 Ctrl/⌘+S 는 드릴 자동저장이 아니라 **스냅샷을 지금 저장**이다(BoardScreen.saveNow).
      !steps && r[0] === 'Ctrl/⌘+S' ? ['Ctrl/⌘+S', t('editor.helpModal.boardSaveOverride')] : r,
  );
  return rows.map(([key, desc]): HelpRow => [key, translateKeymapDesc(desc, locale)]);
}
