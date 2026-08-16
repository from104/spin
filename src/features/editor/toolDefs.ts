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
  IconShapeEllipse,
  IconShapeTriangle,
  IconShapeRect,
} from '../../ui/icons.tsx';
import type { ToolId } from '../../physics/index.ts';

export interface ToolDef {
  id: ToolId;
  label: string;
  /** 단축키 글자(`core/keymap.ts` 에서 파생). 지금은 9종 모두 키를 갖지만, 표에 없으면
   *  빈 문자열이 온다 — 그 경우 레일 버튼에 글자 배지가 안 붙는다(ToolRail 의 그 분기). */
  key: string;
  Icon: ComponentType<IconProps>;
}

/** 도구 → 단축키 글자. 표에 없으면 빈 문자열. */
const letterOf = (id: ToolId): string =>
  KEYMAP.find((d) => d.id === `${TOOL_KEY_PREFIX}${id}`)?.label ?? '';

const def = (id: ToolId, label: string, Icon: ComponentType<IconProps>): ToolDef => ({
  id,
  label,
  key: letterOf(id),
  Icon,
});

export const TOOLS: readonly ToolDef[] = [
  def('select', '선택', IconToolSelect),
  def('line', '선', IconToolRoute),
  def('shapeEllipse', '원', IconShapeEllipse),
  def('shapeTriangle', '삼각', IconShapeTriangle),
  def('shapeRect', '사각', IconShapeRect),
  def('ball', '공', IconToolBall),
  def('cone', '콘', IconToolCone),
  def('player', '선수', IconToolPlayer),
  def('note', '메모', IconToolNote),
  // 2026-08-16 — **지우개가 사라졌다**(기현 지시). 이유는 두 겹이다:
  //   ① 영어 머릿글자 규칙에서 `erase` 의 e·r·a·s 가 전부 다른 자리에 막혀 줄 글자가 없었다.
  //   ② 애초에 삭제 경로가 셋이었다 — 지우개 도구 · Delete(개체 포커스) · Ctrl+Delete(선택).
  //      같은 일을 하는 문이 셋이면 어느 문이 무엇을 지우는지가 매번 질문이 된다.
  // 쓸어서 여러 개를 지우던 경로는 **러버밴드 선택 + Ctrl/⌘+Delete** 가 대신한다.
];

/** 키맵 동작 id(`tool:ball`) → ToolId. 도구 동작이 아니면 undefined. */
export function toolForAction(actionId: string): ToolId | undefined {
  if (!actionId.startsWith(TOOL_KEY_PREFIX)) return undefined;
  const id = actionId.slice(TOOL_KEY_PREFIX.length) as ToolId;
  return TOOLS.some((t) => t.id === id) ? id : undefined;
}
