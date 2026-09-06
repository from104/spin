// **아웃오브플레이(Law 9) 공의 색이 네 경로에서 같은가** (2026-09-06 경로 대조에서 나온 것).
//
// 화면 둘은 공이 코트 밖으로 나가면 붉게 칠한다(`render/ruleOverlay.ts` 의 `judge` → 공 DOM 의
// fill 을 직접 쓴다). PNG·인쇄는 **언제나 노란색**이었다 — 판에서 붉게 나간 공이 종이·그림에서는
// 평범한 공이었다. `renderPaths.ts` 는 이것을 못 잡는다: 네 경로 모두 `balls: YES` 이고,
// 그 표는 *"그리는가"* 만 말하지 **어떤 상태로 그리는가**를 말하지 않는다.
//
// ⚠️ 기대색을 이 파일에 적지 않는다. **화면 writer 를 실제로 돌려** 그 결과 fill 을 읽고,
//    정적 두 경로가 같은 색을 냈는지만 본다 — 값을 손으로 적으면 그것이 사본 하나 더다.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { BALL } from '../core/constants.ts';
import { courtDefFor } from '../model/court.ts';
import { staticFrameOf } from '../model/playback.ts';
import { CURRENT_DRILL_SCHEMA, type Drill, type TeamSide } from '../model/drill.ts';
import type { BallId, ChairId, DrillId, StepId } from '../core/ids.ts';
import { buildStaticSvg } from '../features/export/buildStaticSvg.ts';
import { PrintCourt } from '../features/print/PrintCourt.tsx';
import { SettingsProvider } from '../store/settings/SettingsProvider.tsx';
import { createRuleOverlay } from './ruleOverlay.ts';

const TEAMS: Record<TeamSide, { label: string; color: string; gkColor: string }> = {
  home: { label: '레드', color: '#d93a3a', gkColor: '#f2c811' },
  away: { label: '블루', color: '#1f6bb8', gkColor: '#22a95b' },
};

const DEF = courtDefFor('full');
/** 골라인 **밖**(오른쪽 사이드라인 너머). 공 반지름까지 완전히 넘겨야 아웃이다(model/rules.ts). */
const OUT = { x: DEF.surface.x + DEF.surface.w + BALL.viewRadiusPx + 5, y: DEF.surface.y + 40 };
/** 대조군 — 같은 판, 코트 한가운데. */
const IN = { x: DEF.surface.x + DEF.surface.w / 2, y: DEF.surface.y + DEF.surface.h / 2 };

function drillWithBall(p: { x: number; y: number }): Drill {
  return {
    schemaVersion: CURRENT_DRILL_SCHEMA,
    id: 'dr_b' as DrillId,
    title: '아웃 색 시험',
    drillType: 'tactical',
    level: '초급',
    durationMin: 5,
    tags: [],
    courtMode: 'full',
    defense: 'home',
    formation: '1-2-1',
    teams: TEAMS,
    cast: { chairs: [{ id: 'ch_a' as ChairId, team: 'home', number: '1', isGk: false }], balls: [{ id: 'bl_1' as BallId }], cones: [] },
    steps: [
      {
        id: 'st_1' as StepId,
        name: '스텝 1',
        note: '',
        chairs: { ch_a: { x: 400, y: 260, angleDeg: 0 } },
        balls: { bl_1: p },
        cones: {},
        arrows: [],
        notes: [],
        shapes: [],
      },
    ],
    createdAt: 0,
    updatedAt: 0,
  };
}

/** 화면 경로가 그 좌표의 공에 실제로 쓰는 fill. writer 를 그대로 돌린다. */
function screenFill(p: { x: number; y: number }): string {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  const rules = createRuleOverlay({ say() {} });
  rules.setContext({
    enabled: true,
    roster: [],
    goalAreas: [],
    goalMouths: [],
    fiveMeterDefense: null,
    teamLabels: { home: '레드', away: '블루' },
    locale: 'ko',
    // RuleOverlay.tsx 가 넘기는 것과 같은 값이다(courtDefFor(mode,size).surface).
    court: { mode: 'full', surface: DEF.surface },
  });
  rules.registerBall('bl_1', el);
  rules.write({ bl_1: p });
  return el.getAttribute('fill')!;
}

const pngFill = (d: Drill): string => {
  const svg = buildStaticSvg(staticFrameOf(d, d.steps[0]!), { mode: 'full', teams: TEAMS, defense: 'home', showRuleZones: true });
  // 개체 목록의 공 하나. `<circle … fill="…"` 에서 r 이 공 반지름인 것을 고른다.
  const m = svg.match(new RegExp(`<circle cx="0" cy="0" r="${BALL.viewRadiusPx}" fill="([^"]+)"`));
  expect(m, 'PNG 에 공이 없다').not.toBeNull();
  return m![1]!;
};

const printFill = (d: Drill): string => {
  const { container } = render(
    <SettingsProvider>
      <PrintCourt drill={d} step={d.steps[0]!} ariaLabel="코트" view={{ showGrid: false, showGridLabels: false, showRuleZones: true }} />
    </SettingsProvider>,
  );
  const c = container.querySelector('[data-print-ball]')!;
  expect(c, '인쇄에 공이 없다').not.toBeNull();
  return c.getAttribute('fill')!;
};

describe('아웃오브플레이 공 — 정적 경로가 화면과 같은 색을 쓴다', () => {
  it('코트 밖 공은 PNG·인쇄에서도 붉다', () => {
    const expected = screenFill(OUT);
    expect(pngFill(drillWithBall(OUT))).toBe(expected);
    expect(printFill(drillWithBall(OUT))).toBe(expected);
  });

  it('대조군 — 코트 안 공은 셋 다 평소 색이고, 두 색은 실제로 다르다', () => {
    const inside = screenFill(IN);
    expect(inside).not.toBe(screenFill(OUT)); // 자가 무언가를 잰다
    expect(pngFill(drillWithBall(IN))).toBe(inside);
    expect(printFill(drillWithBall(IN))).toBe(inside);
  });

  it('규칙 표시를 끄면 화면과 같이 판정도 서지 않는다 — 밖에 있어도 평소 색', () => {
    // 화면 writer 는 `ctx.enabled` 가 거짓이면 아예 판정을 안 돈다(ruleOverlay.write).
    // 정적 경로가 스위치를 무시하면 규칙 표시를 끈 판만 그림에서 붉은 공이 뜬다.
    const d = drillWithBall(OUT);
    const svg = buildStaticSvg(staticFrameOf(d, d.steps[0]!), { mode: 'full', teams: TEAMS, defense: 'home', showRuleZones: false });
    const m = svg.match(new RegExp(`<circle cx="0" cy="0" r="${BALL.viewRadiusPx}" fill="([^"]+)"`))!;
    expect(m[1]).toBe(screenFill(IN));
  });
});
