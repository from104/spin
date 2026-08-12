// 4.4 PNG — `buildStaticSvg` 가드. 이 파일의 단언 하나하나가 계획서 §6.2 의 실패 형태
// 하나씩에 대응한다. 각 가드마다 **대조군**을 함께 둔다 — "출력이 비어서 통과" 와
// "정규식이 원래 아무것도 못 잡아서 통과" 를 둘 다 막기 위해서다.
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { COURT_DEFS } from '../../model/court.ts';
import type { ChairId } from '../../core/ids.ts';
import { ChairChip } from '../../render/objects/ChairChip.tsx';
import { createTransformWriter } from '../../render/transformWriter.ts';
import { RULE_ALERT_STROKE } from '../../render/ruleOverlay.ts';
import { buildStaticSvg, buildStaticScene } from './buildStaticSvg.ts';
import { staticSceneMetrics, EXPORT_LAYOUT } from './staticSceneLayout.ts';
import { makeFrame, TEAMS } from './sceneFixture.ts';

const OPTS = { mode: 'full' as const, teams: TEAMS };

function parse(svg: string): Document {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  expect(doc.querySelector('parsererror'), 'SVG 가 XML 로 파싱되지 않는다').toBeNull();
  return doc;
}

/** 편집기 원본 칩의 마크업. **가드가 실제로 잡아내는 물건**임을 증명하는 대조군이다 —
 *  이게 없으면 "정규식이 아무것도 못 잡는 정규식이라 통과" 를 배제할 수 없다. */
function editorChipMarkup(): string {
  return renderToStaticMarkup(
    createElement(ChairChip, {
      id: 'ch_x' as ChairId,
      writer: createTransformWriter(),
      color: '#d93a3a',
      team: 'home',
      number: '4',
      selected: true,
      active: true,
      ariaLabel: '우리 팀 4번',
    }),
  );
}

describe('buildStaticSvg — 계획서 §6.2 가드 5종', () => {
  it('class= 가 0회다 (외부 CSS 가 없는 곳에서 열리므로 클래스는 의미가 없다)', () => {
    const svg = buildStaticSvg(makeFrame(), OPTS);
    expect(svg.match(/class=/g)).toBeNull();
    // 대조군 ①: 같은 정규식이 편집기 원본 칩에서는 실제로 잡아낸다.
    expect(editorChipMarkup().match(/class=/g)!.length).toBeGreaterThan(0);
    // 대조군 ②: 출력이 비어서 통과한 것이 아니다.
    expect(svg.length).toBeGreaterThan(1000);
  });

  it('var(-- 가 0회다 (CSS 변수는 SVG 를 따로 열면 전부 무너진다)', () => {
    const svg = buildStaticSvg(makeFrame(), OPTS);
    expect(svg.includes('var(--')).toBe(false);
    // 대조군: 편집기 원본 칩의 선택 링은 var(--accent) 를 쓴다.
    expect(editorChipMarkup().includes('var(--accent)')).toBe(true);
  });

  it('focus-ind 가 0회다 (포커스 링이 그림에 찍히면 안 된다)', () => {
    const svg = buildStaticSvg(makeFrame(), OPTS);
    expect(svg.includes('focus-ind')).toBe(false);
    // 대조군: 원본 칩에는 focus-ind-outer/inner 가 둘 다 있다.
    expect(editorChipMarkup().match(/focus-ind/g)!.length).toBeGreaterThanOrEqual(2);
  });

  it('★A-9 <text> 노드가 0개다 — 글자는 전부 캔버스가 그린다', () => {
    const scene = buildStaticScene(makeFrame(), { ...OPTS, caption: { title: '전환 훈련', stepIndex: 2, stepCount: 7, stepName: '왼쪽 전환' } });
    expect(parse(scene.svg).querySelectorAll('text')).toHaveLength(0);
    expect(scene.svg.includes('<text')).toBe(false);
    // 대조군 ①: 원본 칩은 등번호를 <text> 로 그린다 — 즉 이 가드는 실재하는 위험을 막는다.
    expect(editorChipMarkup().includes('<text')).toBe(true);
    // 대조군 ②: 글자가 사라진 것이 아니라 **자리를 옮긴 것**이다.
    //   등번호 8 + 메모 1(빈 메모 제외) + 캡션 2 = 11
    expect(scene.texts).toHaveLength(11);
  });

  it('★A-10 width/height 를 명시한다 — viewBox 만 있으면 300×150 으로 뭉개진다', () => {
    const m = staticSceneMetrics(OPTS);
    const root = parse(buildStaticSvg(makeFrame(), OPTS)).documentElement;
    expect(root.getAttribute('width')).toBe(String(m.widthPx));
    expect(root.getAttribute('height')).toBe(String(m.heightPx));
    expect(root.getAttribute('viewBox')).toBe(`0 0 ${m.vbW} ${m.totalH}`);
    // 대조군: 값이 실재하는 픽셀이다(0 이나 NaN 이 아니다).
    expect(m.widthPx).toBeGreaterThan(300);
    expect(m.heightPx).toBeGreaterThan(150);
  });

  it('자립 문서다 — xmlns 가 있고 외부 참조(http/url(...)/@font-face)가 없다', () => {
    const svg = buildStaticSvg(makeFrame(), OPTS);
    expect(svg.includes('xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg.includes('@font-face')).toBe(false);
    expect(svg.includes('<image')).toBe(false);
    expect(svg.includes('foreignObject')).toBe(false);
    // url(...) 은 marker-end 의 문서 내부 참조(`url(#...)`)뿐이어야 한다.
    for (const m of svg.matchAll(/url\(([^)]*)\)/g)) expect(m[1]!.startsWith('#')).toBe(true);
  });
});

describe('buildStaticSvg — 무엇이 실제로 그려졌는가 (하한 대조군)', () => {
  it('칩 8 · 화살표 2 · 콘 2 · 공 1 · 쪽지 2 가 전부 문서에 있다', () => {
    const doc = parse(buildStaticSvg(makeFrame(), OPTS));
    const ids = (prefix: string): number => doc.querySelectorAll(`[id^="obj-${prefix}"]`).length;
    expect(ids('ch_')).toBe(8);
    expect(ids('ar_')).toBe(2);
    expect(ids('cn_')).toBe(2);
    expect(ids('bl_')).toBe(1);
    // 빈 메모도 쪽지는 그려진다 — 글자만 안 나온다.
    expect(ids('nt_')).toBe(2);
  });

  it('빈 프레임은 개체가 0개다 — 위 하한이 "무엇을 넣어도 통과" 가 아님을 보인다', () => {
    const empty = makeFrame({ chairs: [], balls: [], cones: [], arrows: [], notes: [] });
    const doc = parse(buildStaticSvg(empty, OPTS));
    expect(doc.querySelectorAll('[id^="obj-"]')).toHaveLength(0);
    // 그래도 코트는 그려진다(코트 라인은 프레임과 무관하다).
    expect(doc.querySelectorAll('rect').length).toBeGreaterThan(0);
  });

  it('opacity 0 인 개체는 그리지 않는다 (스텝 전환 퇴장 프레임)', () => {
    const f = makeFrame();
    f.chairs[0]!.opacity = 0;
    f.arrows[1]!.opacity = 0;
    const doc = parse(buildStaticSvg(f, OPTS));
    expect(doc.querySelectorAll('[id^="obj-ch_"]')).toHaveLength(7);
    expect(doc.querySelectorAll('[id^="obj-ar_"]')).toHaveLength(1);
  });

  it('화살촉 마커가 실제로 참조 가능하다 — marker-end 의 id 가 문서 안에 있다', () => {
    const doc = parse(buildStaticSvg(makeFrame(), OPTS));
    const refs = [...doc.querySelectorAll('[marker-end]')].map((el) => el.getAttribute('marker-end')!);
    expect(refs.length).toBe(2);
    for (const ref of refs) {
      const id = ref.slice('url(#'.length, -1);
      expect(doc.getElementById(id), `마커 ${id} 가 문서에 없다 — 화살촉이 사라진다`).not.toBeNull();
    }
  });
});

describe('buildStaticSvg — 좌표의 유일한 출처는 COURT_DEFS 다', () => {
  // 2026-08-11 사고 재발 방지: 외곽선·골대가 리터럴이라 마진을 넓히자 골대가 선 밖으로 나갔다.
  it.each(['full', 'half'] as const)('%s — 경기면 외곽선과 골대 원이 COURT_DEFS 좌표에 있다', (mode) => {
    const def = COURT_DEFS[mode];
    const doc = parse(buildStaticSvg(makeFrame({ chairs: [], balls: [], cones: [], arrows: [], notes: [] }), { mode, teams: TEAMS }));
    const circles = [...doc.querySelectorAll('circle')].map((c) => `${c.getAttribute('cx')},${c.getAttribute('cy')}`);
    for (const p of def.goalPosts) expect(circles).toContain(`${p.x},${p.y}`);
    // 대조군: 다른 코트의 골대 좌표는 들어 있지 않다(둘이 같은 좌표를 쓰지 않는다).
    const other = COURT_DEFS[mode === 'full' ? 'half' : 'full'];
    for (const p of other.goalPosts) expect(circles).not.toContain(`${p.x},${p.y}`);
  });

  it('flat 코트는 라인이 없다 — 그래도 SVG 는 성립한다', () => {
    const doc = parse(buildStaticSvg(makeFrame({ chairs: [], balls: [], cones: [], arrows: [], notes: [] }), { mode: 'flat', teams: TEAMS }));
    expect(doc.querySelectorAll('line')).toHaveLength(0);
    expect(doc.documentElement.getAttribute('viewBox')).toBe('0 0 525 450');
  });
});

describe('buildStaticSvg — opts', () => {
  it('배경 흰색이면 전면 흰 사각형이 깔리고, 투명이면 안 깔린다', () => {
    const white = buildStaticSvg(makeFrame(), { ...OPTS, background: 'white' });
    const clear = buildStaticSvg(makeFrame(), { ...OPTS, background: 'transparent' });
    expect(white.includes('fill="#ffffff"/><rect') || white.includes('height="525" fill="#ffffff"')).toBe(true);
    expect(white.match(/<rect x="0" y="0" width="825" height="525" fill="#ffffff"\/>/)).not.toBeNull();
    expect(clear.match(/<rect x="0" y="0" width="825" height="525" fill="#ffffff"\/>/)).toBeNull();
  });

  it('해상도 1x/2x — 2x 는 긴 변이 정확히 2배이고 계획서의 2048 이다', () => {
    const one = staticSceneMetrics({ ...OPTS, resolution: 1 });
    const two = staticSceneMetrics({ ...OPTS, resolution: 2 });
    expect(one.widthPx).toBe(EXPORT_LAYOUT.baseLongEdgePx);
    expect(two.widthPx).toBe(EXPORT_LAYOUT.baseLongEdgePx * 2);
    expect(two.widthPx).toBe(2048);
    // 세로는 정수 반올림 때문에 정확히 2배가 아닐 수 있다(825×525 는 1304 vs 1303) —
    // 가로가 긴 변이라 비율 오차는 1 px 이하다.
    expect(Math.abs(two.heightPx - one.heightPx * 2)).toBeLessThanOrEqual(1);
    // 대조군: 배율은 SVG 문자열에도 반영된다(계산만 하고 안 쓰면 무의미하다).
    expect(buildStaticSvg(makeFrame(), { ...OPTS, resolution: 2 }).includes('width="2048"')).toBe(true);
  });

  it('격자는 showGrid 로만 나온다 — 칸 라벨(글자)은 어떤 경우에도 없다', () => {
    // 코트 라인에도 <line>(하프라인)이 있으므로 격자 그룹으로 좁혀 센다.
    const gridLines = (svg: string): number => parse(svg).querySelectorAll('g[shape-rendering="crispEdges"] line').length;
    expect(gridLines(buildStaticSvg(makeFrame(), OPTS))).toBe(0);
    expect(gridLines(buildStaticSvg(makeFrame(), { ...OPTS, showGrid: true }))).toBe(9); // full: 내부 5v + 4h
    expect(parse(buildStaticSvg(makeFrame(), { ...OPTS, showGrid: true })).querySelectorAll('text')).toHaveLength(0);
  });

  it('캡션이 있으면 viewBox 높이가 캡션 띠만큼 늘고, 없으면 코트 높이 그대로다', () => {
    const withCap = staticSceneMetrics({ ...OPTS, caption: { title: 'x', stepIndex: 0, stepCount: 1, stepName: '' } });
    const without = staticSceneMetrics(OPTS);
    expect(without.totalH).toBe(COURT_DEFS.full.vbH);
    expect(withCap.totalH).toBe(COURT_DEFS.full.vbH + EXPORT_LAYOUT.captionBandPx);
    expect(withCap.captionH).toBe(EXPORT_LAYOUT.captionBandPx);
    expect(without.captionH).toBe(0);
  });

  it('투명 배경 + 캡션이면 캡션 띠를 불투명하게 깐다 (흰 글자가 읽혀야 한다)', () => {
    const cap = { title: '전환', stepIndex: 0, stepCount: 3, stepName: 'a' };
    const clear = buildStaticSvg(makeFrame(), { ...OPTS, background: 'transparent', caption: cap });
    const white = buildStaticSvg(makeFrame(), { ...OPTS, background: 'white', caption: cap });
    expect(clear.includes('y="525" width="825" height="46"')).toBe(true);
    // 흰 배경에서는 전면 흰 사각형이 이미 있으므로 띠를 또 칠하지 않는다.
    expect(white.includes('y="525" width="825" height="46"')).toBe(false);
  });
});

describe('buildStaticSvg — 규칙 오버레이(3 m 링 · 골 지역)', () => {
  const ringOpts = { ...OPTS, showRuleZones: true };

  it('showRuleZones 가 꺼져 있으면 링도 존도 없다', () => {
    const svg = buildStaticSvg(makeFrame(), OPTS);
    expect(svg.includes('stroke-dasharray="8 6"')).toBe(false);
    expect(svg.includes(RULE_ALERT_STROKE)).toBe(false);
  });

  it('켜면 공마다 3 m 링이 하나씩 생기고, 깨끗하면 흰 파선이다', () => {
    const doc = parse(buildStaticSvg(makeFrame(), ringOpts));
    const rings = [...doc.querySelectorAll('circle')].filter((c) => c.getAttribute('r') === '75');
    // 센터 서클(r=75, 실선 흰색)이 코트 라인에 하나 있고 링이 2개(케이싱+본선) 더 붙는다.
    expect(rings.length).toBe(3);
    expect(doc.documentElement.outerHTML.includes(RULE_ALERT_STROKE)).toBe(false);
  });

  it('2-on-1 위반 장면이면 링이 붉은 실선이 된다 — 화면과 같은 판정 함수를 쓴다', () => {
    // 공 주변 3 m 안에 홈 2명 + 원정 1명 → ringViolation(home)
    const f = makeFrame();
    f.chairs[1]!.x = 420;
    f.chairs[1]!.y = 262.5;
    f.chairs[2]!.x = 430;
    f.chairs[2]!.y = 270;
    f.chairs[5]!.x = 440;
    f.chairs[5]!.y = 262.5;
    const svg = buildStaticSvg(f, ringOpts);
    expect(svg.includes(RULE_ALERT_STROKE)).toBe(true);
    // 대조군: 같은 옵션·같은 개체 수인데 위치만 흩으면 붉지 않다.
    expect(buildStaticSvg(makeFrame(), ringOpts).includes(RULE_ALERT_STROKE)).toBe(false);
  });

  it('골 지역 3인 장면이면 존이 붉게 덮인다', () => {
    const zone = COURT_DEFS.full.ruleZones[0]!;
    const f = makeFrame({ balls: [] });
    for (let i = 0; i < 3; i++) {
      f.chairs[i]!.x = zone.x + 20 + i * 10;
      f.chairs[i]!.y = zone.y + 20;
    }
    expect(buildStaticSvg(f, ringOpts).includes(`fill="${RULE_ALERT_STROKE}"`)).toBe(true);
    // 대조군: 2명이면 반칙이 아니다.
    const two = makeFrame({ balls: [] });
    two.chairs[0]!.x = zone.x + 20;
    two.chairs[0]!.y = zone.y + 20;
    two.chairs[1]!.x = zone.x + 40;
    two.chairs[1]!.y = zone.y + 20;
    expect(buildStaticSvg(two, ringOpts).includes(`fill="${RULE_ALERT_STROKE}"`)).toBe(false);
  });
});

describe('buildStaticSvg — 모델에서 온 문자열이 SVG 를 깨뜨리지 않는다', () => {
  it('색에 따옴표가 섞여 있어도 속성 밖으로 새지 않는다', () => {
    const f = makeFrame();
    f.chairs[0]!.def = { ...f.chairs[0]!.def, color: '#fff" onload="alert(1)' };
    f.notes[0]!.color = 'red"/><script/>';
    const svg = buildStaticSvg(f, OPTS);
    expect(svg.includes('onload')).toBe(false);
    expect(svg.includes('<script')).toBe(false);
    parse(svg); // 여전히 XML 로 파싱된다
    // 대조군: 정상 색은 그대로 실린다.
    expect(buildStaticSvg(makeFrame(), OPTS).includes('#d93a3a')).toBe(true);
  });

  it('id 에 이상한 문자가 있어도 속성이 깨지지 않는다', () => {
    const f = makeFrame();
    f.balls[0]!.id = 'bl_1"/><g x="' as never;
    const svg = buildStaticSvg(f, OPTS);
    expect(svg.includes('bl_1"')).toBe(false);
    parse(svg);
  });
});
