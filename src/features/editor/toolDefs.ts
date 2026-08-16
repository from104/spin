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

export interface ToolDef {
  id: ToolId;
  label: string;
  /** 단축키 글자(`core/keymap.ts` 에서 파생). 키가 없는 도구는 빈 문자열이다 —
   *  지우개가 그렇다: Delete 로 일원화하기로 해서 도구 키를 주지 않는다. */
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
  // 지우개는 레일에만 남아 있고 단축키가 없다. 2단계에서 도구 자체가 사라진다 —
  // 그때까지는 이미 이 버튼을 쓰던 사용자의 경로를 끊지 않는다.
  def('erase', '지우개', IconToolErase),
];

/** 키맵 동작 id(`tool:ball`) → ToolId. 도구 동작이 아니면 undefined. */
export function toolForAction(actionId: string): ToolId | undefined {
  if (!actionId.startsWith(TOOL_KEY_PREFIX)) return undefined;
  const id = actionId.slice(TOOL_KEY_PREFIX.length) as ToolId;
  return TOOLS.some((t) => t.id === id) ? id : undefined;
}
