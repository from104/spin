// §3 불변식 3 — 이 드릴이 **실제로 쓰는** 말을 가린다. 트레이 서랍의 자동 개방이 이 값을 읽는다.
//
// EditorWorkspace 안의 useMemo 였던 것을 밖으로 뺐다. 이유는 2026-08-12 3차 검증관의 실측이다:
// `drill.steps.some(...)` 를 `drill.steps[0]` 로 **좁혀도 1623 테스트가 전건 초록불**이었다.
// ToolRail 쪽 테스트는 `drillUses` 를 prop 으로 받으므로 '전체 스텝을 보는가' 를 볼 수 없고,
// 배선을 통째로 끊는 반증은 '전체 vs 현재 스텝' 을 구분하지 못한다. 순수 함수로 빼야 그 한 줄에
// 단언이 닿는다.
import type { Drill } from '../../model/drill.ts';
import type { TrayDrawers } from './ToolRail.tsx';

/** 드릴 **전체 스텝**을 본다. 3번 스텝에만 화살표가 있어도 그 드릴은 화살표를 쓰는 드릴이고,
 *  1번 스텝을 보고 있는 사람에게도 서랍이 준비돼 있어야 한다 — 고급자가 만든 것을 초보자가
 *  받아 열었을 때 *"이 드릴에 있는 것을 나는 왜 못 만드나"* 가 생기지 않게 하는 것이 목적이라,
 *  판단 기준은 **현재 스텝이 아니라 드릴**이다. */
export function drillUsesOf(drill: Pick<Drill, 'steps'>): TrayDrawers {
  return {
    draw: drill.steps.some((s) => s.arrows.length > 0),
    note: drill.steps.some((s) => s.notes.length > 0),
  };
}
