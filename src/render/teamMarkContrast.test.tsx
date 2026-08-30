// ★ 6.5 완료 판정 — **밝은 차체에서도 4.6 의 파선 표식이 실제로 보이는가.**
//
// 5.6 은 이 자리를 '⚠️ 알려진 구멍' 으로 숫자까지 적어 두고 넘겼다(테두리색이 4.6 소유 파일이라).
// 그 숫자가 말한 것: 흰 테두리(OBJ_STROKE) **고정**이라 차체가 밝으면 선과 면의 대비가 3:1 아래로
// 내려가 **파선을 그렸는데 그 파선이 안 보인다.**
//   #d93a3a 4.06 · #1f6bb8 4.88 · #7c5cd6 4.36 · #e08a12 2.50 · #22a95b 2.80 · #f2c811 1.55
// #22a95b 는 `DEFAULT_TEAMS.away.gkColor` 라 **기본 설정에서 이미** 발생했다.
//
// ── 이 파일이 손으로 쓴 it 몇 개가 아니라 '표' 인 이유 ─────────────────────────────────
// 색은 늘어난다(팀 색 팔레트 · 골키퍼 2색 · §3.5 개별 색 지정 · 앞으로 더할 색). 손으로 고른
// 색 서너 개만 재면 **새 색이 들어올 때 반드시 빠진다.** 그래서
//   ① 팔레트 전 색 × 골키퍼 2색 × 팀 2 × 경로 3 을 전수로 돌고,
//   ② 그 위에 **RGB 큐브 격자 전수**를 한 번 더 돌린다(개별 색 지정은 팔레트 밖 색도 받는다).
//
// 축(이 재편이 겪은 헛통과 1형태 — "어느 축을 안 찔렀나"):
//   · 경로 4 — 편집기 화면(ChairChip) · 시연(같은 ChairChip) · PNG(buildStaticSvg) · 인쇄(PrintCourt)
//   · 팀 2 — 상대팀(파선)/우리팀(실선). 파선 채널은 상대팀에만 있다.
//   · 라이트/다크 — 판의 색은 **테마에 개입받지 않는다**(아래 '테마 축' 참고).
//   · 썸네일 — 일부러 뺀 화면. 뒷문장에도 단언을 둔다.
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { render } from '@testing-library/react';
import type { BallId, ChairId } from '../core/ids.ts';
import type { ChairDef, Drill, DrillStep, TeamSide, TeamStyle } from '../model/drill.ts';
import type { RenderFrame } from '../model/playback.ts';
import { DEFAULT_TEAMS } from '../model/defaults.ts';
import {
  COURT_BG,
  GK_AWAY_COLOR,
  GK_HOME_COLOR,
  OBJ_INK_L,
  OBJ_STROKE,
  OBJ_STROKE_DARK,
  relLuminance,
  strokeFor,
  TEAM_COLOR_CHOICES,
} from '../core/colors.ts';
import { buildStaticSvg } from '../features/export/buildStaticSvg.ts';
import { PrintCourt } from '../features/print/PrintCourt.tsx';
import { ChairChip } from './objects/ChairChip.tsx';
import { createTransformWriter } from './transformWriter.ts';
import { teamMarkFor } from './teamMark.ts';
import { compositeOver, contrastRatio, dashChannelVisible, NON_TEXT_MIN } from '../styles/contrastMath.ts';
import { SettingsProvider } from '../store/settings/SettingsProvider.tsx';

const TEAMS: Record<TeamSide, TeamStyle> = { home: { ...DEFAULT_TEAMS.home }, away: { ...DEFAULT_TEAMS.away } };
const CHAIR_ID = 'ch_1' as ChairId;
const defOf = (team: TeamSide, color?: string): ChairDef =>
  color === undefined ? { id: CHAIR_ID, team, number: '4', isGk: false } : { id: CHAIR_ID, team, number: '4', isGk: false, color };

/** 선이 면 위에서 실제로 보이는가 — 알파를 합성한 **화면색**으로 잰다.
 *  (알파를 무시하면 숫자가 실물과 달라진다 — contrastMath.compositeOver 머리말) */
const onFill = (stroke: string, fill: string): number => contrastRatio(compositeOver(stroke, fill), fill);

// ── 경로 4개. 각각 "칩 하나의 마크업" 을 돌려준다(teamMonochrome.test.tsx 와 같은 방식). ──
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
  const frame: RenderFrame = {
    stepIndex: 0,
    t: 0,
    chairs: [{ id: CHAIR_ID, def: defOf(team, color), x: 200, y: 200, theta: 0, opacity: 1 }],
    balls: [{ id: 'bl_1' as BallId, x: 300, y: 300, opacity: 1 }],
    cones: [],
    arrows: [],
    notes: [],
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
  const step = { chairs: { [CHAIR_ID]: { x: 200, y: 200, angleDeg: 0 } }, balls: {}, cones: {}, arrows: [], notes: [] } as unknown as DrillStep;
  const { container } = render(<PrintCourt drill={drill} step={step} ariaLabel="코트" view={{ showGrid: true, showGridLabels: true, showRuleZones: true }} />, { wrapper: SettingsProvider });
  const g = container.querySelector('[data-print-chair]');
  expect(g, '인쇄 트리에 칩 그룹이 없다').not.toBeNull();
  return g!.outerHTML;
}
/** 시연 화면은 편집기와 **같은 ChairChip** 을 쓴다(PresentObjects.tsx). 그래서 마크업 경로가
 *  아니라 '같은 컴포넌트를 부른다' 를 못박는다 — 그쪽이 자기 칩을 따로 그리기 시작하면 빨개진다. */
const PATHS: Array<[string, (team: TeamSide, color?: string) => string]> = [
  ['편집기 화면(ChairChip)', screenChip],
  ['PNG(buildStaticSvg)', pngChip],
  ['인쇄(PrintCourt)', printChip],
];

/** 표의 행. 팔레트 전 색 + 골키퍼 2색. 색이 늘면 여기 상수들에서 자동으로 따라온다. */
const FILLS: Array<[string, string]> = [
  ...TEAM_COLOR_CHOICES.map((c): [string, string] => [`팀 색 ${c}`, c]),
  [`GK 홈 ${GK_HOME_COLOR}`, GK_HOME_COLOR],
  [`GK 어웨이 ${GK_AWAY_COLOR}`, GK_AWAY_COLOR],
];

describe('대조군 — 고치기 전에 실제로 미달이 있었다 (없는 문제를 고친 척하지 않는다)', () => {
  it('흰 테두리 고정이면 6색 중 3색이 3:1 미달이다 (5.6 이 적어 둔 숫자 그대로)', () => {
    const fixed = FILLS.map(([, c]) => onFill(OBJ_STROKE, c));
    expect(fixed.filter((r) => r < NON_TEXT_MIN)).toHaveLength(3);
    // 그 셋이 어느 색인지까지 못박는다(개수만 세면 색이 바뀌어도 통과한다).
    expect(onFill(OBJ_STROKE, '#e08a12')).toBeCloseTo(2.5, 1);
    expect(onFill(OBJ_STROKE, GK_AWAY_COLOR)).toBeCloseTo(2.8, 1);
    expect(onFill(OBJ_STROKE, GK_HOME_COLOR)).toBeCloseTo(1.55, 1);
    // ★ 그중 하나는 **기본 설정**이다 — 사용자가 아무것도 안 건드려도 발생했다.
    expect(DEFAULT_TEAMS.away.gkColor).toBe(GK_AWAY_COLOR);
  });

  it('대조군 — 뒤집힌 테두리라고 아무 색이나 통과시키는 것이 아니다', () => {
    // 방향이 반대인 선(밝은 차체에 흰 선 / 어두운 차체에 검은 선)은 이 판정을 통과하지 못한다.
    expect(onFill(OBJ_STROKE, GK_HOME_COLOR)).toBeLessThan(NON_TEXT_MIN);
    expect(onFill(OBJ_STROKE_DARK, '#1f6bb8')).toBeGreaterThanOrEqual(NON_TEXT_MIN); // 여기는 양쪽 다 통과하는 구간
    expect(onFill(OBJ_STROKE_DARK, '#000000')).toBeLessThan(NON_TEXT_MIN); // 검정 차체에 검은 선은 실패
  });
});

// ── ★ 표 — 색 6 × 팀 2. 손으로 쓴 it 이 아니라 표라서, 색이 늘면 행이 따라 늘어난다. ────────
describe.each(FILLS)('★ %s — 뒤집힌 테두리가 3:1 을 넘는다', (_label, fill) => {
  it.each([['우리팀', 'home'] as const, ['상대팀', 'away'] as const])('%s 칩의 테두리 / 차체', (_t, team) => {
    const m = teamMarkFor(defOf(team, fill), TEAMS);
    expect(m.fill).toBe(fill); // 전제 확인: 개별 색 지정이 실제로 먹었다
    expect(m.stroke).toBe(strokeFor(fill));
    expect(onFill(m.stroke, m.fill), `${fill}: 테두리가 차체 위에서 안 보인다`).toBeGreaterThanOrEqual(NON_TEXT_MIN);
  });

  it('테두리 / **코트**(#1f7a46) — 파선의 틈으로 드러나는 바깥 채널도 3:1 을 넘는다', () => {
    // 안쪽(차체)만 재면 "차체 위에서는 보이는데 칩 윤곽이 코트에 녹는" 상태를 놓친다.
    expect(onFill(strokeFor(fill), COURT_BG), `${fill}: 칩 윤곽이 코트에 녹는다`).toBeGreaterThanOrEqual(NON_TEXT_MIN);
  });

  it('★ 상대팀 파선이 실제로 보인다 / 우리팀은 실선이다 (대조군 포함)', () => {
    const away = teamMarkFor(defOf('away', fill), TEAMS);
    const home = teamMarkFor(defOf('home', fill), TEAMS);
    expect(dashChannelVisible(away.fill, away.stroke, away.strokeDash), `${fill}: 파선 채널이 죽었다`).toBe(true);
    // 대조군 — 무엇을 넣어도 true 를 돌려주는 함수가 아니다(우리팀은 파선 자체가 없다).
    expect(home.strokeDash).toBeUndefined();
    expect(dashChannelVisible(home.fill, home.stroke, home.strokeDash)).toBe(false);
  });

  it.each(PATHS)('%s — 마크업에 실제로 그 선 색이 찍힌다(리터럴이 남아 있지 않다)', (name, chipOf) => {
    const expected = strokeFor(fill);
    const markup = chipOf('away', fill);
    expect(markup, `${name}: ${fill} 칩에 ${expected} 가 없다`).toContain(expected);
    // ★ 한 칩 안에서 선 색이 **하나**다. 밝은 차체인데 흰 리터럴이 남아 있으면(가드 테두리·
    //   머리 점) 같은 칩 안에 보이는 선과 안 보이는 선이 섞인다.
    if (expected !== OBJ_STROKE) {
      expect(markup, `${name}: ${fill} 칩에 흰 테두리 리터럴이 남아 있다`).not.toContain(OBJ_STROKE);
    }
  });
});

describe('★ 임계 .25 는 **RGB 큐브 전수**로 정한 값이다 (팔레트 밖 개별 색까지 산다)', () => {
  /** 임계 t 로 뒤집었을 때 격자 전수의 최소 대비. t 를 인자로 받는 이유는 대조군 때문이다. */
  function minRatioOverCube(t: number, step = 17): { min: number; at: string } {
    let min = Infinity;
    let at = '';
    const hex = (n: number): string => n.toString(16).padStart(2, '0');
    for (let r = 0; r < 256; r += step)
      for (let g = 0; g < 256; g += step)
        for (let b = 0; b < 256; b += step) {
          const fill = `#${hex(r)}${hex(g)}${hex(b)}`;
          const stroke = relLuminance(fill) > t ? OBJ_STROKE_DARK : OBJ_STROKE;
          const ratio = onFill(stroke, fill);
          if (ratio < min) {
            min = ratio;
            at = fill;
          }
        }
    return { min, at };
  }

  it('임계 .25 — 격자 전수(4096색)에서 최솟값이 3:1 을 넘는다', () => {
    expect(OBJ_INK_L).toBe(0.25);
    const { min, at } = minRatioOverCube(OBJ_INK_L);
    expect(min, `최악의 색 ${at}`).toBeGreaterThanOrEqual(NON_TEXT_MIN);
  });

  it('전수 탐색의 최악 색(#f80bd5, 24bit 전수 최솟값 3.084)도 통과한다', () => {
    // 격자(step 17)는 이 색을 지나가지 않는다 — 그래서 따로 못박는다.
    expect(onFill(strokeFor('#f80bd5'), '#f80bd5')).toBeCloseTo(3.08, 1);
    expect(onFill(strokeFor('#f80bd5'), '#f80bd5')).toBeGreaterThanOrEqual(NON_TEXT_MIN);
  });

  it('⚠️ 대조군 — 임계를 .28 로 올리면 이 판정이 실제로 깨진다 (무엇을 넣어도 통과가 아니다)', () => {
    const { min } = minRatioOverCube(0.28);
    expect(min).toBeLessThan(NON_TEXT_MIN);
  });
});

describe('테마 축(라이트/다크) — 판의 색에는 테마가 개입할 통로가 없다', () => {
  // 축을 "돌았다" 고만 적으면 헛통과다. 개입 통로는 **토큰 참조**뿐이므로 그 부재를 단언한다.
  it('칩을 그리는 값 어디에도 var(--…) 이 없다 (선택 링은 예외 — 선택했을 때만 그린다)', () => {
    for (const [name, chipOf] of PATHS) {
      expect(chipOf('away', GK_HOME_COLOR), `${name}: 칩 색이 테마 토큰을 탄다`).not.toContain('var(--');
    }
  });

  it('코트 배경은 라이트·다크 공통 상수 하나다 — 그래서 위 표의 코트 대비가 두 테마에서 같다', () => {
    // 2026-08-30 초록 → 나무(기현 지시). 리터럴로 못박는 것은 값이 아니라 **한 값뿐**이라는 사실이다.
    expect(COURT_BG).toBe('#a9713c');
    const tokens = readFileSync('src/styles/tokens.css', 'utf-8');
    expect(tokens).not.toContain('--court'); // 코트 색을 테마 토큰으로 내린 적이 없다
  });
});

describe('경계 — 일부러 적용하지 않은 화면(뒷문장에도 단언을 둔다)', () => {
  it('썸네일은 그대로다 — 거기에는 파선 표식 자체가 없다(render/teamMark.ts 머리말)', () => {
    const thumb = readFileSync('src/render/CourtThumbnail.tsx', 'utf-8');
    expect(thumb).not.toContain('strokeFor');
    expect(thumb).not.toContain('strokeDasharray');
  });

  it('시연 화면은 자기 칩을 따로 그리지 않는다 — 편집기와 **같은 ChairChip** 이다', () => {
    // 이 한 줄이 시연 축을 닫는다. 여기서 자체 칩을 그리기 시작하면 위 표가 시연에 안 닿는다.
    const present = readFileSync('src/features/present/PresentObjects.tsx', 'utf-8');
    expect(present).toContain("import { ChairChip } from '../../render/objects/ChairChip.tsx'");
    expect(present).toContain('<ChairChip');
  });
});
