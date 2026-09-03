// §6.10 편집기 도구 메타데이터. 레일 순서 = "포인터 → 작도 → 배치 → 주석 → 파괴".
//
// 2026-08-16 단축키 전면 개편 — **키는 여기서 정하지 않는다**. `core/keymap.ts` 가 정본이고
// 여기는 그 표에서 글자를 읽어 레일에 보여줄 뿐이다. 개편 전에는 이 파일이 `key`·`digit` 을
// 직접 들고 있어서, 도움말 표·전역 디스패처·레일 툴팁 셋이 서로를 안 보고 각자 적었다.
import type { ComponentType } from 'react';
import { KEYMAP, TOOL_KEY_PREFIX } from '../../core/keymap.ts';
import type { IconProps } from '../../ui/icons.tsx';
import {
  IconToolSelect,
  IconToolRoute,
  IconToolBall,
  IconToolCone,
  IconToolPlayer,
  IconToolNote,
  IconToolErase,
  IconShapeEllipse,
  IconShapeTriangle,
  IconShapeRect,
} from '../../ui/icons.tsx';
import type { ToolId } from '../../physics/index.ts';
import { SUPPORTED_LOCALES, type Locale } from '../../i18n/locale.ts';
import { translate } from '../../i18n/useT.ts';
import type { DictKey } from '../../i18n/ko.ts';

export interface ToolDef {
  id: ToolId;
  label: Record<Locale, string>;
  /** 단축키 글자(`core/keymap.ts` 에서 파생). 지금은 10종 모두 키를 갖지만, 표에 없으면
   *  빈 문자열이 온다 — 그 경우 레일 버튼에 글자 배지가 안 붙는다(ToolRail 의 그 분기). */
  key: string;
  Icon: ComponentType<IconProps>;
}

/** 도구 → 단축키 글자. 표에 없으면 빈 문자열. */
const letterOf = (id: ToolId): string =>
  KEYMAP.find((d) => d.id === `${TOOL_KEY_PREFIX}${id}`)?.label ?? '';

const allLocales = (key: DictKey): Record<Locale, string> =>
  Object.fromEntries(SUPPORTED_LOCALES.map((l) => [l, translate(l, key)])) as Record<Locale, string>;

const def = (id: ToolId, labelKey: DictKey, Icon: ComponentType<IconProps>): ToolDef => ({
  id,
  label: allLocales(labelKey),
  key: letterOf(id),
  Icon,
});

export const TOOLS: readonly ToolDef[] = [
  def('select', 'editor.toolDefs.select', IconToolSelect),
  def('line', 'editor.toolDefs.line', IconToolRoute),
  def('shapeEllipse', 'editor.toolDefs.shapeEllipse', IconShapeEllipse),
  def('shapeTriangle', 'editor.toolDefs.shapeTriangle', IconShapeTriangle),
  def('shapeRect', 'editor.toolDefs.shapeRect', IconShapeRect),
  def('ball', 'editor.toolDefs.ball', IconToolBall),
  def('cone', 'editor.toolDefs.cone', IconToolCone),
  def('player', 'editor.toolDefs.player', IconToolPlayer),
  def('note', 'editor.toolDefs.note', IconToolNote),
  // 2026-08-16 — **지우개가 사라졌다**(기현 지시). 이유는 두 겹이다:
  //   ① 영어 머릿글자 규칙에서 `erase` 의 e·r·a·s 가 전부 다른 자리에 막혀 줄 글자가 없었다.
  //   ② 애초에 지우는 문이 너무 많았다 — 지우개 도구 · Delete(개체 포커스) ·
  //      Delete(고른 것 — 하나든 여럿이든) · 개체 메뉴의 [삭제] · 트레이로 끌어 복귀.
  //      같은 일을 하는 문이 다섯이면 어느 문이 무엇을 지우는지가 매번 질문이 된다.
  //
  // ⚠️ 마우스만 쓰는 사람의 경로는 지우개가 아니었다(기현 확인 2026-08-16): **오른쪽 버튼/
  //    길게 누르기 → 개체 메뉴 → 삭제**, 그리고 **코트에서 트레이로 끌기 = 복귀**
  //    (useEditorPointer 의 isOverTray — 칩·공·콘). 둘 다 그대로 살아 있으므로 지우개를
  //    걷어내도 마우스 경로는 한 톨도 줄지 않는다. 키보드 쪽은 선택 후 Delete 가 받는다.
  //
  // 🔁 **2026-09-03 되살림**(기현 지시: *"메모 옆에 (객체)지우기 버튼 추가… 연속 삭제 가능.
  //    빈 곳을 클릭하거나 다시 지우기 버튼을 누르거나 esc를 누르면 선택으로 복귀"*).
  //    위 두 근거를 지우지 않는 이유는 **둘 다 그때의 참**이었기 때문이고, 지금 뒤집히는
  //    이유는 두 전제가 각각 죽었기 때문이다:
  //      ① 글자가 없다 → 머릿글자 규칙을 이 도구에서만 놓았다. 화면이 붉은 `X` 로 말하므로
  //         키도 `X` 다(keymap.ts 의 그 줄). 아무 자리도 뺏지 않는다.
  //      ② 문이 너무 많다 → **그때 것과 다른 물건**이다. 옛 지우개는 선택과 겹치는 **드래그**
  //         도구라 "지금 무슨 모드인가" 가 손짓만으로는 안 보였다. 지금 것은 클릭만 받고,
  //         커서가 붉은 X 로 바뀌어 모드를 계속 말하고, 빈 곳을 한 번 찍으면 스스로 빠진다 —
  //         들어가고 나오는 값이 싸서 상시로 켜 두는 모드가 아니다.
  //    ⚠️ 고정(`toolLock`) 대상이 아니다 — `LOCKABLE_TOOLS` 는 허용 목록이라 자동으로 빠진다.
  //       연속 삭제는 이 도구의 성질이지 고정이 아니고, 파괴 모드가 잠긴 채 남으면 안 된다.
  def('eraser', 'editor.toolDefs.eraser', IconToolErase),
];

/** 키맵 동작 id(`tool:ball`) → ToolId. 도구 동작이 아니면 undefined. */
export function toolForAction(actionId: string): ToolId | undefined {
  if (!actionId.startsWith(TOOL_KEY_PREFIX)) return undefined;
  const id = actionId.slice(TOOL_KEY_PREFIX.length) as ToolId;
  return TOOLS.some((t) => t.id === id) ? id : undefined;
}
