// §6.10 트레이 고스트 — 손을 떼기 **전에** 보이는 것이 뗀 **뒤에** 놓이는 것과 같아야 한다.
// 크기(코트 축척)와 각도(코트 종류가 정하는 배치 방향) 둘 다다.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { TrayGhost } from './TrayGhost.tsx';
import { createDrill } from '../../model/defaults.ts';
import { COURT_DEFS } from '../../model/court.ts';
import type { CourtMode } from '../../model/court.ts';
import type { Drill } from '../../model/drill.ts';

function chairGhost(mode: CourtMode, team: 'home' | 'away') {
  const drill: Drill = createDrill({ courtMode: mode, empty: true });
  const def = drill.cast.chairs.find((c) => c.team === team)!;
  const { container } = render(
    <TrayGhost item={{ kind: 'player', chairId: def.id }} pxPerUnit={1} drill={drill} coneSlot={0} />,
  );
  return { el: container.firstElementChild as HTMLElement, number: def.number };
}

describe('TrayGhost — 휠체어는 놓일 각도 그대로 매달린다', () => {
  for (const mode of Object.keys(COURT_DEFS) as CourtMode[]) {
    it(`${mode} 코트: 팀별 배치 방향과 같다`, () => {
      // 고스트만 눕혀 두면 놓는 순간 칩이 홱 돌아 내려놓은 자리와 눈이 어긋난다.
      const home = chairGhost(mode, 'home');
      const away = chairGhost(mode, 'away');
      expect(home.el.style.transform).toBe(`rotate(${COURT_DEFS[mode].homeHeadingDeg}deg)`);
      expect(away.el.style.transform).toBe(`rotate(${COURT_DEFS[mode].awayHeadingDeg}deg)`);
    });
  }

  it('등번호는 되돌려 세운다 — 코트에서도 숫자는 절대 눕지 않는다(§3.4)', () => {
    const { el } = chairGhost('full', 'home');
    const label = el.querySelector('span') as HTMLElement;
    expect(label.style.transform).toBe(`rotate(${-COURT_DEFS.full.homeHeadingDeg}deg)`);
    // 폭·높이는 차체 치수 그대로 — 회전은 transform 이 맡는다. 미리 바꿔치기하면 90°·270° 아닌 각도에서 조용히 어긋난다.
    expect(el.style.width).toBe('32.5px');
    expect(el.style.height).toBe('20px');
  });
});
