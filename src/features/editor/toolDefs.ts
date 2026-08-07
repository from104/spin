// §6.10 편집기 도구 8종 메타데이터. 레일 순서 = "포인터(1) → 작도(2–3) → 배치(4–6) → 주석(7)
// → 파괴(8)" — 콘이 공 바로 뒤(5번째)인 이유는 "코트에 흩뿌리는 개체" 라 공과 같은 부류이기
// 때문(§6.10 본문).
import type { ComponentType } from 'react';
import type { IconProps } from '../../ui/icons.tsx';
import {
  IconToolSelect,
  IconToolRoute,
  IconToolPass,
  IconToolBall,
  IconToolCone,
  IconToolPlayer,
  IconToolNote,
  IconToolErase,
} from '../../ui/icons.tsx';
import type { ToolId } from '../../physics/index.ts';

export interface ToolDef {
  id: ToolId;
  label: string;
  /** 단일 문자 단축키(§7.5f "V R P B C A T E"). */
  key: string;
  /** 숫자 단축키(1–8). */
  digit: string;
  Icon: ComponentType<IconProps>;
}

export const TOOLS: readonly ToolDef[] = [
  { id: 'select', label: '선택', key: 'v', digit: '1', Icon: IconToolSelect },
  { id: 'route', label: '이동', key: 'r', digit: '2', Icon: IconToolRoute },
  { id: 'pass', label: '패스', key: 'p', digit: '3', Icon: IconToolPass },
  { id: 'ball', label: '공', key: 'b', digit: '4', Icon: IconToolBall },
  { id: 'cone', label: '콘', key: 'c', digit: '5', Icon: IconToolCone },
  { id: 'player', label: '선수', key: 'a', digit: '6', Icon: IconToolPlayer },
  { id: 'note', label: '메모', key: 't', digit: '7', Icon: IconToolNote },
  { id: 'erase', label: '지우개', key: 'e', digit: '8', Icon: IconToolErase },
];

const BY_KEY = new Map<string, ToolId>();
for (const t of TOOLS) {
  BY_KEY.set(t.key, t.id);
  BY_KEY.set(t.digit, t.id);
}

/** 소문자 문자 키 또는 숫자 키 → ToolId. 해당 없으면 undefined. */
export function toolForKey(rawKey: string): ToolId | undefined {
  return BY_KEY.get(rawKey.length === 1 ? rawKey.toLowerCase() : rawKey);
}
