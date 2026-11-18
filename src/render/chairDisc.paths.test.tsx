// 심플 모드의 원이 **세 경로(화면 · PNG · 인쇄)에서 같은 기하**로 나온다 — PLAN-SIMPLE-DRIVE 결정 A3.
// 지우면 새는 실기 버그: 한 경로만 원 반지름·눈금을 따로 적어(또는 옛 차체 `<rect>` 를 남겨) 화면은 원인데 종이·그림은
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
import { DISC_RADIUS_PX, discEyes } from '../model/chairDisc.ts';
import { buildStaticSvg, buildStaticScene } from '../features/export/buildStaticSvg.ts';
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
    // 방향 표시(플라나리아 눈 둘)도 같은 자리 — 검은 점 둘이 보는 쪽(+x) 앞에 대칭으로
    const eyes = [...home.matchAll(/<circle data-disc-eye="" cx="([-\d.]+)" cy="([-\d.]+)" r="([\d.]+)"/g)].map((m) => m.slice(1).map(Number));
    const want = discEyes().map((e) => [e.cx, e.cy, e.r]);
    expect(eyes).toHaveLength(2);
    eyes.forEach((e, i) => e.forEach((v, j) => expect(v).toBeCloseTo(want[i]![j]!, 1))); // PNG 는 소수 둘째 자리로 적는다
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
});
