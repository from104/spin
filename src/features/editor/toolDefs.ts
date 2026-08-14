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
  IconShapeEllipse,
  IconShapeTriangle,
  IconShapeRect,
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
  // 작도 도형 3종(2026-08-14 기현 지시). 이동·패스 바로 뒤 = **작도 서랍 안**이다.
  // 단축키는 남은 글자로 잡았다: o(circle 의 모양) · y(삼각) · u(사각). 숫자는 8 을 넘으므로
  // 안 준다 — §7.5f 의 '1–8' 계약을 늘리면 지우개(8)가 밀린다.
  { id: 'shapeEllipse', label: '원', key: 'o', digit: '', Icon: IconShapeEllipse },
  { id: 'shapeTriangle', label: '삼각', key: 'y', digit: '', Icon: IconShapeTriangle },
  { id: 'shapeRect', label: '사각', key: 'u', digit: '', Icon: IconShapeRect },
  { id: 'ball', label: '공', key: 'b', digit: '4', Icon: IconToolBall },
  { id: 'cone', label: '콘', key: 'c', digit: '5', Icon: IconToolCone },
  { id: 'player', label: '선수', key: 'a', digit: '6', Icon: IconToolPlayer },
  { id: 'note', label: '메모', key: 't', digit: '7', Icon: IconToolNote },
  { id: 'erase', label: '지우개', key: 'e', digit: '8', Icon: IconToolErase },
];

const BY_KEY = new Map<string, ToolId>();
for (const t of TOOLS) {
  BY_KEY.set(t.key, t.id);
  // 도형 3종은 숫자 키가 없다(digit ''). 빈 문자열을 넣으면 '' 로 누른 적 없는 키가 도구를
  // 바꾸는 통로가 생긴다.
  if (t.digit) BY_KEY.set(t.digit, t.id);
}

/** 소문자 문자 키 또는 숫자 키 → ToolId. 해당 없으면 undefined. */
export function toolForKey(rawKey: string): ToolId | undefined {
  return BY_KEY.get(rawKey.length === 1 ? rawKey.toLowerCase() : rawKey);
}
