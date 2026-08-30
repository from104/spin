// ★ 5.6 완료 판정의 핵심 — **강제색(Windows 고대비) 화면에서 코치가 우리 팀과 상대 팀을
//   구분할 수 있는가.**
//
// 이 항목의 진짜 난점은 "SVG 를 강제색에 맡길 것인가, 뺄 것인가" 였다. 산문으로 판단만 적어
// 두면 되돌려도 아무 테스트가 빨개지지 않는다(이 저장소가 겪은 헛통과 2형태: "설계의 뒷문장에
// 단언이 없다"). 그래서 **두 세계를 다 시뮬레이션해 양쪽에 단언을 둔다.**
//
//   A) 판을 강제색에 맡긴 세계 — fill 과 stroke 가 **둘 다** 같은 전경색(CanvasText)이 된다.
//      · 4.6 의 파선 테두리는 마크업에 그대로 남는다 → **마크업 단언은 통과한다(헛통과).**
//        그러나 "CanvasText 면 위의 CanvasText 파선" 은 대비 1.00:1 이라 **보이지 않는다.**
//      · 대체 채널이 **하나도 없는** 것 넷이 함께 죽는다: 등번호(글자 fill=차체 fill),
//        팀 색, 골키퍼 표시(색이 전부다), §3.5 개별 색 지정.
//      → 완료 판정("코치가 우리 팀과 상대 팀을 구분할 수 있는가") 실패.
//   B) 판을 강제색에서 뺀 세계(우리가 고른 쪽, styles/contrast.css ①) —
//      기본 팀 색에서 흰 테두리가 차체 위 4.06~4.88:1, 코트 위 4.78:1 이라 파선이 실제로 보이고
//      등번호는 4.5:1 이상을 유지한다. 강제색 팔레트가 라이트든 다크든 결과가 같다.
//   대조군 — 콘(실루엣)·화살표(파선·굵기)는 A 에서도 산다. 즉 판을 빼는 이유는 "색 밖 채널이
//   없어서" 라는 뭉뚱그린 말이 아니라 **위 넷에만 없어서**다.
//
// 축: 강제 팔레트 라이트/다크 × 세 경로(화면·PNG·인쇄) × 팀 색 기본/개별 지정.
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { render } from '@testing-library/react';
import type { BallId, ChairId, ConeId } from '../core/ids.ts';
import type { ChairDef, Drill, DrillStep, TeamSide, TeamStyle } from '../model/drill.ts';
import type { RenderFrame } from '../model/playback.ts';
import { DEFAULT_TEAMS } from '../model/defaults.ts';
import { COURT_BG, GK_AWAY_COLOR, GK_HOME_COLOR, OBJ_STROKE, strokeFor, TEAM_COLOR_CHOICES } from '../core/colors.ts';
import { buildStaticSvg } from '../features/export/buildStaticSvg.ts';
import { PrintCourt } from '../features/print/PrintCourt.tsx';
import { ChairChip } from '../render/objects/ChairChip.tsx';
import { ArrowMarkers } from '../render/ArrowMarkers.tsx';
import { ConeMark } from '../render/objects/ConeMark.tsx';
import { createTransformWriter } from '../render/transformWriter.ts';
import { teamMarkFor } from '../render/teamMark.ts';
import { compositeOver, contrastRatio, dashChannelVisible, NON_TEXT_MIN } from './contrastMath.ts';
import { SettingsProvider } from '../store/settings/SettingsProvider.tsx';

const TEAMS: Record<TeamSide, TeamStyle> = { home: { ...DEFAULT_TEAMS.home }, away: { ...DEFAULT_TEAMS.away } };
const CHAIR_ID = 'ch_1' as ChairId;
const defOf = (team: TeamSide, color?: string): ChairDef =>
  color === undefined ? { id: CHAIR_ID, team, number: '4', isGk: false } : { id: CHAIR_ID, team, number: '4', isGk: false, color };

/** 강제색 팔레트 두 종. 시스템 색은 사용자가 고르지만 전경/배경이 **한 쌍**이라는 점은 같다. */
const PALETTES = [
  ['고대비 다크', { canvas: '#000000', canvasText: '#ffffff' }],
  ['고대비 라이트', { canvas: '#ffffff', canvasText: '#000000' }],
] as const;

// ── 세 경로. 각각 "칩 하나의 마크업" 을 돌려준다(teamMonochrome.test.tsx 와 같은 방식). ──
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
const PATHS: Array<[string, (team: TeamSide, color?: string) => string]> = [
  ['화면(ChairChip)', screenChip],
  ['PNG(buildStaticSvg)', pngChip],
  ['인쇄(PrintCourt)', printChip],
];

/** 강제색 모드가 색을 나르는 속성에 하는 일. CSS Color Adjust 의 강제 목록대로 **fill·stroke 를
 *  같은 전경색으로** 바꾼다. `stroke-width`·`stroke-dasharray` 는 색이 아니므로 건드리지 않는다
 *  — 정규식이 이름 뒤에 곧바로 `=` 를 요구해 하이픈 붙은 이름에는 걸리지 않는다. */
const COLOR_ATTR = /(\s(?:fill|stroke|color|stop-color|flood-color))="[^"]*"/g;
const forceColors = (markup: string, fg: string): string => markup.replace(COLOR_ATTR, `$1="${fg}"`);
const forcedCount = (markup: string): number => markup.match(COLOR_ATTR)?.length ?? 0;

describe('대조군 — 강제색 시뮬레이터가 실제로 색을 치환하고, 색 아닌 것은 남긴다', () => {
  it.each(PATHS)('%s', (_n, chipOf) => {
    const away = chipOf('away');
    expect(forcedCount(away), '치환할 색 속성이 4개 미만이면 시뮬레이션이 무의미하다').toBeGreaterThanOrEqual(4);
    const forced = forceColors(away, '#ffffff');
    expect(forced).not.toContain(TEAMS.away.color); // 팀 색이 실제로 사라졌다
    expect(forced).toContain('stroke-dasharray="5 3"'); // 파선 **마크업**은 그대로 남는다
    expect(forced).toContain('stroke-width'); // 굵기도 남는다(색 목록이 아니다)
  });
});

describe.each(PALETTES)('A) 판을 강제색에 맡기면 무엇이 죽는가 — %s', (_name, pal) => {
  // 여기서 재는 것은 "치환 뒤에도 마크업이 다른가" 가 **아니다**. 마크업은 다르다 — 그런데도
  // 화면에서는 같아 보이는 것이 이 항목의 함정이다. 그래서 전부 **대비 숫자**로 잰다.
  const F = pal.canvasText; // 치환 뒤 fill·stroke 는 전부 이 하나가 된다

  it('★ 등번호가 사라진다 — 글자 fill 과 차체 fill 이 같은 색이 된다', () => {
    // 기준선: inkFor 가 고른 글자색은 차체 위 4.5:1 이상이다(colors.ts 임계 .25 의 근거).
    for (const team of ['home', 'away'] as const) {
      const mark = teamMarkFor(defOf(team), TEAMS);
      expect(contrastRatio(mark.ink, mark.fill)).toBeGreaterThanOrEqual(4.5);
    }
    // 치환 후: 1.00:1. 등번호에는 **대체 채널이 하나도 없다**(4.6 이 번호 접두를 일부러 뺐다).
    expect(contrastRatio(F, F)).toBe(1);
  });

  it('★ 팀 표식의 주 채널(파선)이 차체 위에서 안 보이게 된다', () => {
    // 기준선 — 기본 팀 색에서는 흰 테두리가 차체 위 4:1 을 넘는다.
    for (const team of ['home', 'away'] as const) {
      const m = teamMarkFor(defOf(team), TEAMS);
      expect(dashChannelVisible(m.fill, m.stroke, '5 3'), `${team} 기준선`).toBe(true);
    }
    // 치환 후 — 파선 마크업은 남지만 대비가 1.00:1 이라 무늬가 사라진다.
    expect(dashChannelVisible(F, F, '5 3')).toBe(false);
  });

  it('★ 보조 채널(볼가드 톤)도 같이 죽는다 — guardFill **자체가** 치환 대상이다', () => {
    for (const team of ['home', 'away'] as const) {
      const m = teamMarkFor(defOf(team), TEAMS);
      // 기준선: 반투명 가드는 차체 위에서 밝기 방향으로 벌어진다(회색조에서 살아남는 면 채널).
      expect(contrastRatio(compositeOver(m.guardFill, m.fill), m.fill), `${team} 기준선`).toBeGreaterThan(1.2);
      // 치환 후: 가드의 `fill` 은 색 속성이라 차체와 **같은 값**으로 바뀐다(알파째 사라진다).
      expect(forceColors(screenChip(team), F), `${team}: 가드 톤이 치환을 피해 갔다`).not.toContain(m.guardFill);
    }
    expect(contrastRatio(F, F)).toBe(1);
  });

  it('★ 골키퍼 표시는 색이 전부다 — 치환하면 필드 선수와 같은 그림이 된다', () => {
    const gk: ChairDef = { id: CHAIR_ID, team: 'away', number: '4', isGk: true };
    const field = defOf('away');
    expect(teamMarkFor(gk, TEAMS).fill).not.toBe(teamMarkFor(field, TEAMS).fill); // 기준선: 색으로 다르다
    expect(forceColors(screenChip('away'), F)).toBe(
      forceColors(
        renderToStaticMarkup(
          createElement(ChairChip, {
            id: CHAIR_ID,
            writer: createTransformWriter(),
            color: teamMarkFor(gk, TEAMS).fill,
            team: 'away' as TeamSide,
            number: '4',
            selected: false,
            active: false,
            ariaLabel: '칩',
          }),
        ),
        F,
      ),
    );
  });

  it('★ 개별 색 지정(§3.5)이 통째로 무효가 된다', () => {
    const a = forceColors(screenChip('home', '#7c5cd6'), F);
    const b = forceColors(screenChip('home', '#0f7a51'), F);
    expect(a).toBe(b);
  });

  it.each(PATHS)('%s — 치환 후 두 팀의 차이는 파선 마크업 하나뿐이다(그리고 그것은 안 보인다)', (_p, chipOf) => {
    const strip = (m: string): string => m.replace(/\s(?:stroke-dasharray)="[^"]*"/g, '');
    expect(strip(forceColors(chipOf('home'), F))).toBe(strip(forceColors(chipOf('away'), F)));
  });

  it('대조군 — 콘·화살표는 치환해도 살아남는다 (시뮬레이터가 무엇이든 같게 만드는 도구가 아니다)', () => {
    // 이 저장소는 콘을 **실루엣**으로(슬롯 1 에만 밑변 베이스), 화살표를 **파선·굵기**로 이미
    // 갈라 두었다. 즉 강제색에서 판을 빼야 하는 이유는 "색 밖 채널이 없어서" 가 아니라
    // **등번호·팀·골키퍼·개별 색 넷에만 대체 채널이 없어서**다. 이 대조군이 없으면 위 단언들은
    // "치환하면 다 같아진다" 는 동어반복이 된다.
    const cone = (i: 0 | 1): string =>
      renderToStaticMarkup(
        createElement(ConeMark, { id: 'cn_1' as ConeId, writer: createTransformWriter(), colorIndex: i, selected: false, active: false, ariaLabel: '콘' }),
      );
    expect(forceColors(cone(0), F)).not.toBe(forceColors(cone(1), F));
    // ⚠️ 2026-08-16 — 화살표의 색 밖 채널이 **파선·굵기에서 화살촉으로 옮겨 갔다**(종류 삭제).
    //    강제색은 fill/stroke 를 갈아치우지만 **모양은 안 건드리므로**, 좁은·넓은 화살촉의
    //    치수 차이가 그대로 남는다 — 그것이 여기서 재는 '색 밖 채널' 이다.
    const head = (k: 'thin' | 'wide'): string =>
      renderToStaticMarkup(createElement(ArrowMarkers, { uid: 'u', colors: ['#38bdf8'] })).match(
        new RegExp(`<marker id="u-38bdf8-${k}"[^>]*>.*?</marker>`),
      )![0];
    expect(forceColors(head('thin'), F)).not.toBe(forceColors(head('wide'), F));
  });
});

describe.each(PALETTES)('B) 판을 강제색에서 빼면 판이 판독 가능하다 — %s 팔레트에서도', (_name, pal) => {
  // 판을 뺐으므로 판의 색은 시스템 팔레트와 무관하다. 팔레트 축을 그래도 도는 이유는
  // "빼면 팔레트가 무엇이든 결과가 같다" 가 바로 이 선택의 이유이기 때문이다.
  it('팔레트가 결과에 개입하지 않는다(축 통과 표시)', () => {
    expect(contrastRatio(pal.canvas, pal.canvasText)).toBe(21);
  });

  it('등번호가 남는다 — 팔레트 4색·골키퍼 2색 전부에서 4.5:1 이상', () => {
    for (const color of [...TEAM_COLOR_CHOICES, GK_HOME_COLOR, GK_AWAY_COLOR]) {
      const m = teamMarkFor(defOf('away', color), TEAMS);
      expect(contrastRatio(m.ink, m.fill), `개별 색 ${color}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('★ 상대팀만 파선이고, 기본 팀 색에서 그 파선이 실제로 보인다', () => {
    const away = teamMarkFor(defOf('away'), TEAMS);
    const home = teamMarkFor(defOf('home'), TEAMS);
    expect(dashChannelVisible(away.fill, away.stroke, away.strokeDash)).toBe(true); // 4.88:1
    // 대조군 — 우리팀은 파선이 없다(무엇을 넣어도 true 를 돌려주는 함수가 아니다).
    expect(home.strokeDash).toBeUndefined();
    expect(dashChannelVisible(home.fill, home.stroke, home.strokeDash)).toBe(false);
  });

  it('테두리는 **코트 위**에서도 3:1 을 넘는다 — 파선의 틈으로 코트가 드러나는 바깥 채널', () => {
    // 알파 .92 흰색을 코트(#a9713c) 위에 실제로 합성하면 3.75:1 이다 — 기준(3:1)은 넘는다
    // 넘는다. **2026-08-13(6.3) 갱신**: 여기 있던 *"colors.ts 주석은 5.34 라고 적는다"* 는
    // 지적은 해소됐다. 그 주석이 4.78 로 고쳐졌고, `src/test/docsMatchCode.test.ts` 가
    // 그 한 줄을 파일에서 읽어 이 계산과 대조한다(같은 함정을 ARROW_CASING 주석이 이미 기록).
    const onCourt = contrastRatio(compositeOver(OBJ_STROKE, COURT_BG), COURT_BG);
    expect(onCourt).toBeGreaterThanOrEqual(NON_TEXT_MIN);
    expect(onCourt).toBeCloseTo(3.75, 1);
  });

  it('★ 6.5 로 **메워진** 구멍 — 밝은 차체에서도 파선이 보인다 (팔레트 4색 + 골키퍼 2색 전수)', () => {
    // ── 여기 있던 '⚠️ 알려진 구멍' 을 6.5 가 메웠다. 숫자는 지우지 않고 방향만 뒤집는다. ──
    // 5.6 당시(흰 테두리 **고정**): #d93a3a 4.06 · #1f6bb8 4.88 · #7c5cd6 4.36 ·
    //   **#e08a12 2.50** · **#22a95b 2.80** · **#f2c811 1.55** — 4색 중 3색만 안전했고,
    //   #22a95b 는 DEFAULT_TEAMS.away.gkColor 라 **기본 설정에서 이미** 발생했다.
    // 6.5(테두리를 차체 밝기로 뒤집은 뒤): 같은 계산으로 7.28 · 6.44 · 11.84 — 전수 통과.
    // 대조군은 아래 두 줄(옛 고정 테두리로는 여전히 실패한다)과 teamMarkContrast.test.tsx 의
    // RGB 큐브 전수 탐색이 맡는다.
    const all = [...TEAM_COLOR_CHOICES, GK_HOME_COLOR, GK_AWAY_COLOR];
    const ratios = all.map((c) => contrastRatio(compositeOver(strokeFor(c), c), c));
    expect(ratios.filter((r) => r >= NON_TEXT_MIN)).toHaveLength(all.length);
    for (const c of all) expect(dashChannelVisible(c, strokeFor(c), '5 3'), `${c} 파선`).toBe(true);
    // 대조군 — 옛 방식(흰 테두리 고정)이었다면 이 셋은 지금도 실패한다. 즉 위 통과는
    // "판정이 헐거워져서" 가 아니라 **선 색이 실제로 뒤집혀서** 나온 것이다.
    expect(dashChannelVisible('#e08a12', OBJ_STROKE, '5 3')).toBe(false);
    expect(dashChannelVisible(GK_AWAY_COLOR, OBJ_STROKE, '5 3')).toBe(false);
    expect(dashChannelVisible(GK_HOME_COLOR, OBJ_STROKE, '5 3')).toBe(false);
  });

  it.each(PATHS)('%s — 세 경로 모두 파선을 실제로 그린다', (_p, chipOf) => {
    expect(chipOf('away')).toContain('stroke-dasharray="5 3"');
    expect(chipOf('home')).not.toContain('stroke-dasharray');
  });
});

describe('C) 그 선택을 실행하는 것은 CSS 한 곳뿐이다', () => {
  const css = readFileSync('src/styles/contrast.css', 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');

  it('⚠️ .stage-svg · .spin-print-court 의 forced-color-adjust: none — 이 두 줄이 A→B 를 고른다', () => {
    expect(css).toMatch(/\.stage-svg\s*,\s*\.spin-print-court\s*\{[^}]*forced-color-adjust:\s*none/);
  });

  it('썸네일은 일부러 넣지 않았다 — 거기에는 파선 표식 자체가 없다(render/teamMark.ts 머리말)', () => {
    // 뒷문장에도 단언을 둔다: "적용하지 않은 한 곳" 이 정말로 적용되지 않았는가.
    expect(css).not.toContain('CourtThumbnail');
    const thumb = readFileSync('src/render/CourtThumbnail.tsx', 'utf-8');
    expect(thumb).not.toContain('strokeDasharray');
    expect(thumb).not.toContain('teamPatternFor');
  });

  it('테두리색이 상수(strokeFor)에서 나온다 — 리터럴로 갈라지면 위 계산이 거짓이 된다', () => {
    // 기본 팀 색은 둘 다 어두워서(L .181 / .143) 흰 테두리 쪽으로 떨어진다 — 위 B) 의 4.06 /
    // 4.88 계산이 여전히 이 값 위에 서 있다.
    expect(teamMarkFor(defOf('away'), TEAMS).stroke).toBe(OBJ_STROKE);
    expect(teamMarkFor(defOf('home'), TEAMS).stroke).toBe(OBJ_STROKE);
    // 대조군 — 밝은 차체에서는 실제로 다른 값이 나온다(6.5). 상수를 지나지 않으면 여기가 빨개진다.
    expect(teamMarkFor(defOf('away', GK_HOME_COLOR), TEAMS).stroke).toBe(strokeFor(GK_HOME_COLOR));
    expect(teamMarkFor(defOf('away', GK_HOME_COLOR), TEAMS).stroke).not.toBe(OBJ_STROKE);
  });
});
