// 조항 도해 디스패처(2026-08-21) — 조항 하나가 어떤 그림을 다는지만 정한다.
//
// **왜 장면(`ruleScenes.ts`)과 따로 두나**: 보드 장면은 코트 위에서 벌어지는 일(배치·이동·
// 판정)을 `Drill` 타임라인으로 재생한다. 그런데 규칙 18개조 중 상당수는 코트 위의 사건이
// 아니다 — 공의 규격, 장비, 경기 시간, 징계 절차. 그런 조항에 억지로 코트를 붙이면 판만
// 덩그러니 뜨고, 안 붙이면 글자만 남아 휑하다(2026-08-21 기현님 지적). 도해는 그 자리를
// 메우는 세 번째 표현이다: 코트가 아닌 한 장의 정지 그림.
//
// `Record<RuleFigureId, ComponentType>` 로 잡아 두면 id 를 하나 늘리는 순간 그림을 안 그린
// 자리가 **컴파일 오류**가 된다 — `screens.ts` 의 라벨 표와 같은 규율이다.
import type { ComponentType } from 'react';
import { CourtFigure } from './figures/CourtFigure.tsx';
import { BallFigure } from './figures/BallFigure.tsx';
import { EquipmentFigure } from './figures/EquipmentFigure.tsx';
import { DistanceFigure } from './figures/DistanceFigure.tsx';
import type { RuleFigureId } from './figures/ids.ts';

const FIGURES: Record<RuleFigureId, ComponentType> = {
  court: CourtFigure,
  ball: BallFigure,
  equipment: EquipmentFigure,
  distance: DistanceFigure,
};

export function RuleFigure({ id }: { id: RuleFigureId }) {
  const Figure = FIGURES[id];
  return <Figure />;
}
