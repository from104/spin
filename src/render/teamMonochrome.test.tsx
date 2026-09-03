// ★ 4.6 완료 판정 — **색을 전부 지워도 두 팀이 구분되는가**, 그것도 화면·PNG·인쇄 **세 경로
//   모두에서**.
//
// 왜 '회색조로 변환'이 아니라 '색 속성 제거'인가:
//   회색조 변환은 헛통과한다. #d93a3a(L .181)과 #1f6bb8(L .143)은 회색조 수치로도 서로 다른
//   값이라, 아무것도 고치지 않은 코드에서도 "두 출력이 다르다"가 성립한다. 실제 흑백 레이저의
//   하프톤에서 저 0.038 차이가 사라지는 것이 문제인데 그걸 테스트가 재현할 수는 없다.
//   그래서 **더 강한 판정**을 쓴다: 색을 나르는 속성(fill·stroke·style…)을 통째로 **제거**한
//   뒤에도 두 팀의 마크업이 다르면, 팀 구분 정보가 색 채널 **밖에** 존재한다는 뜻이다.
//   이건 흑백이든 색각 이상이든 색이 어떻게 뭉개지든 무관하게 성립한다.
//
// 헛통과 방지 대조군(각 경로마다 셋 다 둔다):
//   ① `stripColor` 가 **실제로 무언가를 지웠는가** — 지운 속성 수의 하한.
//   ② 색만 다른 두 칩(**같은 팀** + 개별 색 지정)은 제거 후 **완전히 같아진다** — 즉 이
//      제거기는 색 채널을 진짜로 없앤다. 이 대조군이 없으면 "제거기가 아무것도 안 지워서
//      원본이 그대로 남아 통과" 를 배제할 수 없다.
//   ③ 제거 후에도 등번호 글자·도형은 남아 있다(마크업을 통째로 비워 놓고 통과하는 것 방지).
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { render } from '@testing-library/react';
import type { ChairId, BallId } from '../core/ids.ts';
import type { ChairDef, Drill, DrillStep, TeamSide, TeamStyle } from '../model/drill.ts';
import type { RenderFrame } from '../model/playback.ts';
import { DEFAULT_TEAMS } from '../model/defaults.ts';
import { buildStaticSvg } from '../features/export/buildStaticSvg.ts';
import { PrintCourt } from '../features/print/PrintCourt.tsx';
import { ChairChip } from './objects/ChairChip.tsx';
import { createTransformWriter } from './transformWriter.ts';
import { teamMarkFor } from './teamMark.ts';
import { SettingsProvider } from '../store/settings/SettingsProvider.tsx';

const TEAMS: Record<TeamSide, TeamStyle> = { home: { ...DEFAULT_TEAMS.home }, away: { ...DEFAULT_TEAMS.away } };
const CHAIR_ID = 'ch_1' as ChairId;

function defOf(team: TeamSide, color?: string): ChairDef {
  return color === undefined
    ? { id: CHAIR_ID, team, number: '4', isGk: false }
    : { id: CHAIR_ID, team, number: '4', isGk: false, color };
}

/** 색을 나르는 속성만 걷어낸다. `stroke-width`/`stroke-dasharray` 는 남는다 —
 *  정규식이 `stroke` 뒤에 곧바로 `=` 를 요구하므로 하이픈 붙은 이름에는 걸리지 않는다. */
const COLOR_ATTR = /\s(?:fill|stroke|color|stop-color|flood-color|lighting-color|style)="[^"]*"/g;
function stripColor(markup: string): string {
  return markup.replace(COLOR_ATTR, '');
}
function strippedCount(markup: string): number {
  return markup.match(COLOR_ATTR)?.length ?? 0;
}

// ── 세 경로. 각각 "칩 하나의 마크업"을 돌려준다. ──────────────────────────────────────
function screenChip(team: TeamSide, color?: string): string {
  const def = defOf(team, color);
  return renderToStaticMarkup(
    createElement(ChairChip, {
      id: CHAIR_ID,
      writer: createTransformWriter(),
      color: teamMarkFor(def, TEAMS).fill,
      team,
      number: def.number,
      selected: false,
      active: false,
      ariaLabel: '칩',
    }),
  );
}

function pngChip(team: TeamSide, color?: string): string {
  const def = defOf(team, color);
  const frame: RenderFrame = {
    stepIndex: 0,
    t: 0,
    chairs: [{ id: CHAIR_ID, def, x: 200, y: 200, theta: 0, opacity: 1 }],
    balls: [{ id: 'bl_1' as BallId, x: 300, y: 300, opacity: 1 }],
    cones: [],
    arrows: [],
    notes: [],
    strokes: [],
  };
  const svg = buildStaticSvg(frame, { mode: 'full', teams: TEAMS, caption: null });
  const g = /<g id="obj-ch_1"[\s\S]*?<\/g>/.exec(svg);
  expect(g, 'PNG SVG 안에 칩 그룹이 없다').not.toBeNull();
  return g![0];
}

function printChip(team: TeamSide, color?: string): string {
  const def = defOf(team, color);
  const drill: Pick<Drill, 'courtMode' | 'cast' | 'teams'> = {
    courtMode: 'full',
    teams: TEAMS,
    cast: { chairs: [def], balls: [], cones: [] },
  };
  const step = { chairs: { [CHAIR_ID]: { x: 200, y: 200, angleDeg: 0 } }, balls: {}, cones: {}, arrows: [], notes: [], strokes: [] } as unknown as DrillStep;
  const { container } = render(<PrintCourt drill={drill} step={step} ariaLabel="코트" view={{ showGrid: true, showGridLabels: true, showRuleZones: true }} />, { wrapper: SettingsProvider });
  const g = container.querySelector('[data-print-chair]');
  expect(g, '인쇄 트리에 칩 그룹이 없다').not.toBeNull();
  return g!.outerHTML;
}

const PATHS: Array<[string, (team: TeamSide, color?: string) => string]> = [
  ['화면(ChairChip)', screenChip],
  ['PNG(buildStaticSvg)', pngChip],
  ['인쇄(PrintCourt)', printChip],
];

describe('★ 색을 전부 지워도 두 팀이 구분된다 — 화면·PNG·인쇄', () => {
  it.each(PATHS)('%s', (_name, chipOf) => {
    const home = chipOf('home');
    const away = chipOf('away');

    // 대조군 ① — 제거기가 실제로 무언가를 지웠다. 칩 하나에 최소 색 속성 4개(차체 fill/stroke,
    // 가드 fill/stroke)가 있다.
    expect(strippedCount(home)).toBeGreaterThanOrEqual(4);
    expect(strippedCount(away)).toBeGreaterThanOrEqual(4);

    // 대조군 ② — **같은 팀**인데 색만 다른 두 칩은 제거 후 완전히 같아진다.
    //   이것이 성립해야 아래 본 단언("다른 팀은 제거 후에도 다르다")이 색이 아닌 채널을
    //   증명한 것이 된다. 여기서 실패하면 제거기가 색을 덜 지운 것이다.
    expect(stripColor(chipOf('home', '#7c5cd6'))).toBe(stripColor(chipOf('home', '#0f7a51')));
    expect(stripColor(chipOf('away', '#7c5cd6'))).toBe(stripColor(chipOf('away', '#0f7a51')));

    // 대조군 ③ — 제거 후에도 그림이 남아 있다(빈 문자열끼리 비교해 통과하는 것 방지).
    expect(stripColor(home).length).toBeGreaterThan(60);
    expect(stripColor(home)).toContain('<rect');

    // ★ 본 단언 — 색을 전부 지워도 두 팀은 다르다.
    expect(stripColor(home)).not.toBe(stripColor(away));

    // 그 '다름'이 어디서 오는지까지 못박는다: 상대팀만 파선 테두리를 단다.
    expect(stripColor(away)).toContain('stroke-dasharray="5 3"');
    expect(stripColor(home)).not.toContain('stroke-dasharray');
  });

  it('개별 색 지정(§3.5)으로 팀 색을 덮어써도 팀 구분은 살아남는다', () => {
    // 색 채널이 통째로 무너지는 최악의 경우 — 두 팀 칩에 **같은** 개별 색을 줬다.
    for (const [name, chipOf] of PATHS) {
      const home = chipOf('home', '#7c5cd6');
      const away = chipOf('away', '#7c5cd6');
      expect(home, `${name}: 같은 개별 색이면 색 채널로는 구분 불가여야 한다(전제 확인)`).toContain('#7c5cd6');
      expect(away).toContain('#7c5cd6');
      expect(stripColor(home), `${name}: 개별 색 지정 뒤 팀 구분이 사라졌다`).not.toBe(stripColor(away));
    }
  });

  it('보조 채널 — 볼가드 톤은 팀마다 반대 방향으로 벌어진다(회색조에서 살아남는 면)', () => {
    // 파선은 극단적 축소에서 뭉개진다. 그때 남는 것은 '면'이다 — 우리팀은 차체보다 밝은
    // 앞범퍼, 상대팀은 어두운 앞범퍼. 이 채널은 fill 값 자체가 정보라 위의 제거 판정으로는
    // 증명되지 않는다(그래서 주 채널이 파선이다).
    const home = teamMarkFor(defOf('home'), TEAMS);
    const away = teamMarkFor(defOf('away'), TEAMS);
    expect(home.guardFill).toContain('255,255,255'); // 밝게 얹는다
    expect(away.guardFill).toContain('0,0,0'); // 어둡게 얹는다
    expect(home.guardFill).not.toBe(away.guardFill);
    // 세 경로가 전부 그 값을 실제로 쓴다(리터럴로 되돌아가지 않았다).
    for (const [name, chipOf] of PATHS) {
      expect(chipOf('home'), `${name}: 우리팀 가드 톤이 마크업에 없다`).toContain(home.guardFill);
      expect(chipOf('away'), `${name}: 상대팀 가드 톤이 마크업에 없다`).toContain(away.guardFill);
    }
  });

  it('등번호는 그대로다 — 표식을 더하면서 글자를 건드리지 않았다(판단 기준 ③)', () => {
    // 번호 접두를 고르지 않은 이유가 이것이다(render/teamMark.ts 머리말). 두 팀 모두 '4' 다.
    for (const [name, chipOf] of [PATHS[0]!, PATHS[2]!]) {
      // PNG 경로에는 <text> 가 없다(★[A-9] 캔버스가 그린다) — 그래서 여기서 뺀다.
      expect(chipOf('home'), `${name}: 등번호가 사라졌다`).toContain('>4<');
      expect(chipOf('away')).toContain('>4<');
    }
    // PNG 경로의 등번호는 teamMarkFor().label 이고, 거기에도 접두가 붙지 않았다.
    expect(teamMarkFor(defOf('home'), TEAMS).label).toBe('4');
    expect(teamMarkFor(defOf('away'), TEAMS).label).toBe('4');
  });
});
