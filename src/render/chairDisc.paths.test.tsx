// 심플 모드의 원이 **세 경로(화면 · PNG · 인쇄)에서 같은 기하**로 나온다 — PLAN-SIMPLE-DRIVE 결정 A3.
// 지우면 새는 실기 버그: 한 경로만 원 반지름·방향 표시를 따로 적어(2026-11-19 부터는 방향 표시가 어느 경로에도 없어야 한다)(또는 옛 차체 `<rect>` 를 남겨) 화면은 원인데 종이·그림은
// 다른 모양이 되는 것, 팀 구분 파선(색 밖 채널)이 원 갈래에서 빠져 흑백 인쇄에서 두 팀이 같아지는 것. 기하 상수는
// `model/chairDisc.ts` 에서 읽는다 — 값을 베끼지 않는다(자기증명 금지, AGENTS.md 「테스트 작성 규칙」).
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { render } from '@testing-library/react';
import type { ChairId } from '../core/ids.ts';
import type { ChairDef, Drill, DrillStep, TeamSide, TeamStyle } from '../model/drill.ts';
import type { RenderFrame } from '../model/playback.ts';
import { DEFAULT_TEAMS } from '../model/defaults.ts';
import { DISC_RADIUS_PX } from '../model/chairDisc.ts';
import { buildStaticSvg, buildStaticScene, ruleMarkup } from '../features/export/buildStaticSvg.ts';
import { RULE_ALERT_STROKE } from './ruleOverlay.ts';
import type { BallId } from '../core/ids.ts';
import { PrintCourt } from '../features/print/PrintCourt.tsx';
import { ChairChip } from './objects/ChairChip.tsx';
import { createTransformWriter } from './transformWriter.ts';
import { teamMarkFor } from './teamMark.ts';
import { SettingsProvider } from '../store/settings/SettingsProvider.tsx';

const TEAMS: Record<TeamSide, TeamStyle> = { home: { ...DEFAULT_TEAMS.home }, away: { ...DEFAULT_TEAMS.away } };
const CHAIR_ID = 'ch_1' as ChairId;
const defOf = (team: TeamSide): ChairDef => ({ id: CHAIR_ID, team, number: '7', isGk: false });

function screen(team: TeamSide): string {
  const def = defOf(team);
  return renderToStaticMarkup(
    createElement(ChairChip, { id: CHAIR_ID, writer: createTransformWriter(), color: teamMarkFor(def, TEAMS).fill, team, number: '7', selected: false, active: false, ariaLabel: '칩', disc: true }),
  );
}
const frameOf = (team: TeamSide): RenderFrame => ({
  stepIndex: 0,
  t: 0,
  chairs: [{ id: CHAIR_ID, def: defOf(team), x: 200, y: 200, theta: 0, opacity: 1 }],
  balls: [],
  cones: [],
  arrows: [],
  notes: [],
  strokes: [],
});
function png(team: TeamSide): string {
  const svg = buildStaticSvg(frameOf(team), { mode: 'full', teams: TEAMS, caption: null, chairDisc: true });
  return /<g id="obj-ch_1"[\s\S]*?<\/g>/.exec(svg)![0];
}
function print(team: TeamSide): string {
  const def = defOf(team);
  const drill: Pick<Drill, 'courtMode' | 'cast' | 'teams'> = { courtMode: 'full', teams: TEAMS, cast: { chairs: [def], balls: [], cones: [] } };
  const step = { chairs: { [CHAIR_ID]: { x: 200, y: 200, angleDeg: 0 } }, balls: {}, cones: {}, arrows: [], notes: [], strokes: [] } as unknown as DrillStep;
  const { container } = render(<PrintCourt drill={drill} step={step} ariaLabel="코트" view={{ showGrid: true, showGridLabels: true, showRuleZones: true, chairDisc: true }} />, { wrapper: SettingsProvider });
  return container.querySelector('[data-print-chair]')!.outerHTML;
}

describe('심플 모드 원 — 세 경로가 같은 기하', () => {
  it.each([
    ['화면(ChairChip)', screen],
    ['PNG(buildStaticSvg)', png],
    ['인쇄(PrintCourt)', print],
  ] as const)('%s', (_n, chipOf) => {
    const home = chipOf('home');
    expect(home).not.toContain('<rect'); // 차체·볼가드가 남아 있지 않다
    expect(home).toMatch(new RegExp(`<circle[^>]*\\br="${DISC_RADIUS_PX}"`));
    // 방향 표시가 없다(2026-11-19 기현님 *"전면 표시 없애고"*) — 원 안에 그려진 것은 몸통 원 하나뿐이다. 반지름이 R 보다 작은
    // 원(눈·점)이 하나라도 있으면 방향 표시가 되살아난 것이다. R 보다 큰 원은 화면의 포커스 링(R + 여백)이라 상관없다.
    expect(home).not.toContain('data-disc-eye');
    const radii = [...home.matchAll(/<circle[^>]*\br="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(radii.filter((r) => r === DISC_RADIUS_PX)).toHaveLength(1);
    expect(radii.filter((r) => r < DISC_RADIUS_PX)).toEqual([]);
    // 팀 구분 파선(색 밖 채널)은 원에서도 산다 — 상대팀만 dasharray 를 단다
    expect(chipOf('away')).toContain('stroke-dasharray');
    expect(home).not.toContain('stroke-dasharray');
  });

  it('PNG 의 등번호 글자는 피벗(원 중심)에 앉는다 — 차체처럼 앞으로 밀리지 않는다', () => {
    const f = frameOf('home');
    const disc = buildStaticScene(f, { mode: 'full', teams: TEAMS, caption: null, chairDisc: true }).texts.find((t) => t.text === '7');
    const body = buildStaticScene(f, { mode: 'full', teams: TEAMS, caption: null }).texts.find((t) => t.text === '7');
    expect(disc!.x).toBeCloseTo(200);
    expect(body!.x).toBeGreaterThan(205);
  });

  it('★ PNG·인쇄의 규칙 표시도 원으로 잰다 — 앞범퍼만 3 m 를 밟은 2-on-1 이 심플 그림에서는 안 붉다(2026-11-19)', () => {
    // 지우면 새는 실기 버그: 화면(ruleOverlay)은 원으로 재 깨끗한데 내보낸 그림·인쇄(ruleMarkup)만 보이지 않는 차체로 재 붉다.
    const home = (id: string, x: number, y: number, theta: number) => ({ id: id as ChairId, def: { id: id as ChairId, team: 'home' as const, number: id, isGk: false }, x, y, theta, opacity: 1 });
    const f: RenderFrame = {
      ...frameOf('away'),
      chairs: [
        home('ch_a', 300 + 95, 260, Math.PI), // 피벗 3.8 m — 앞범퍼(26 px)만 3 m 링 안
        home('ch_b', 300, 260 + 95, -Math.PI / 2),
        { id: CHAIR_ID, def: defOf('away'), x: 320, y: 260, theta: 0, opacity: 1 },
      ],
      balls: [{ id: 'bl_1' as BallId, x: 300, y: 260, opacity: 1, ring: '3m' }],
    };
    const opts = { mode: 'full' as const, teams: TEAMS, caption: null, showRuleZones: true };
    expect(ruleMarkup(f, opts)).toContain(RULE_ALERT_STROKE);
    expect(ruleMarkup(f, { ...opts, chairDisc: true })).not.toContain(RULE_ALERT_STROKE);
  });

  it('★ 심플을 켜고 끄면 번호가 새 노드여도 바로 선다 — 원정(θ = 180°)의 번호가 거꾸로 눕지 않는다(2026-11-19)', () => {
    // 지우면 새는 실기 버그: 갈래가 바뀌며 번호 `<g>` 가 새 노드가 되는데 writer 가 옛 노드를 쥐고 있어 새 번호가 역회전을 못 받았다 —
    // 방향이 없어야 할 원의 번호가 거꾸로 서서 「보는 쪽」을 드러냈다(e2e S18c 스크린숏).
    const writer = createTransformWriter();
    const props = { id: CHAIR_ID, writer, color: '#d93a3a', team: 'away' as const, number: '7', selected: false, active: false, ariaLabel: '칩' };
    const { container, rerender } = render(<svg>{createElement(ChairChip, { ...props, disc: false })}</svg>, { wrapper: SettingsProvider });
    writer.write(CHAIR_ID, 200, 200, Math.PI);
    rerender(<svg>{createElement(ChairChip, { ...props, disc: true })}</svg>);
    const label = container.querySelector('text')!;
    expect(label.closest('[transform^="rotate(-180"]'), '번호를 감싼 역회전이 없다').not.toBeNull();
  });
});
