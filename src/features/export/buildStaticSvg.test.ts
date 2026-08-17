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
import { RULE_ALERT_STROKE, RULE_ZONE_ALERT_FILL } from '../../render/ruleOverlay.ts';
import { RING_5M_R_PX, RING_R_PX } from '../../model/rules.ts';
import { buildStaticSvg, buildStaticScene } from './buildStaticSvg.ts';
import { staticSceneMetrics, EXPORT_LAYOUT } from './staticSceneLayout.ts';
import type { Shape } from '../../model/shape.ts';
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

// 기현님 신고(2026-08-17): *"그림으로 내보내기 시 도형, 진영 표시 안나온다."* 둘 다 화면에는
// 있는데 굽는 쪽 조립 목록에서 빠져 있었다. 도형·깃발의 **모양**이 화면과 같은지는
// courtLines.contract.test.ts 가 대조한다 — 여기서 세는 것은 "조립에 들어왔는가" 하나다.
describe('buildStaticSvg — 화면에 있는 층이 그림에도 있다', () => {
  const bare = () => makeFrame({ chairs: [], balls: [], cones: [], arrows: [], notes: [] });
  const SHAPE: Shape = { id: 'sh_1', kind: 'ellipse', x: 300, y: 200, w: 100, h: 80, rot: 0 };

  it('진영 깃발이 실린다 — full 은 존 2 × 깃발 2 = 페넌트 4개', () => {
    // 코트 라인은 polygon 을 하나도 안 그린다(전부 path·rect·line·circle) — 그래서 이 수는
    // 깃발만 센다. 개체를 다 빼도 남는 것이 진영 표시다(규칙 존 스위치와 무관하게 그린다).
    expect(parse(buildStaticSvg(bare(), OPTS)).querySelectorAll('polygon')).toHaveLength(4);
    // 대조군 — 플랫 코트에는 진영이라는 개념이 없다.
    expect(parse(buildStaticSvg(bare(), { mode: 'flat', teams: TEAMS })).querySelectorAll('polygon')).toHaveLength(0);
  });

  it('작도 도형이 실린다 — 넘긴 것만, 넘긴 만큼', () => {
    // 센터 서클을 5.3 이 지운 뒤로 코트 라인에는 ellipse 가 없다. 그래서 이 수는 도형만 센다.
    expect(parse(buildStaticSvg(bare(), { ...OPTS, shapes: [SHAPE] })).querySelectorAll('ellipse')).toHaveLength(1);
    expect(parse(buildStaticSvg(bare(), OPTS)).querySelectorAll('ellipse')).toHaveLength(0);
  });

  it('도형은 코트 **위**·개체 **아래**다 (기현 지시 2026-08-14)', () => {
    const svg = buildStaticSvg(makeFrame(), { ...OPTS, shapes: [SHAPE] });
    const shapeAt = svg.indexOf('id="obj-sh_1"');
    expect(shapeAt).toBeGreaterThan(svg.indexOf('viewBox')); // 코트면·라인 뒤
    expect(shapeAt).toBeLessThan(svg.indexOf('id="obj-ch')); // 칩 앞
  });
});

describe('buildStaticSvg — opts', () => {
  it('배경 검정이면 전면 검정 사각형이 깔리고, 투명이면 안 깔린다', () => {
    const black = buildStaticSvg(makeFrame(), { ...OPTS, background: 'black' });
    const clear = buildStaticSvg(makeFrame(), { ...OPTS, background: 'transparent' });
    const FULL = /<rect x="0" y="0" width="825" height="525" fill="#000000"\/>/;
    expect(black.match(FULL)).not.toBeNull();
    expect(clear.match(FULL)).toBeNull();
    // 기본값이 검정이다 — 넘기지 않은 그림이 투명으로 나가면 카톡·밴드에서 바탕이 비친다
    // (기현 지시 2026-08-17. 그 전 기본값은 흰색이었다).
    expect(buildStaticSvg(makeFrame(), OPTS).match(FULL)).not.toBeNull();
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
    const black = buildStaticSvg(makeFrame(), { ...OPTS, background: 'black', caption: cap });
    expect(clear.includes('y="525" width="825" height="46"')).toBe(true);
    // 검정 배경에서는 전면 검정 사각형이 이미 있으므로 띠를 또 칠하지 않는다.
    expect(black.includes('y="525" width="825" height="46"')).toBe(false);
  });
});

describe('buildStaticSvg — 규칙 오버레이(거리 원 · 골 지역)', () => {
  const ringOpts = { ...OPTS, showRuleZones: true };
  /** ⚠️ 2026-08-13(§7 5.2) — 공의 원은 공마다 따로이고 **기본이 '없음'** 이다. 픽스처의 공은
   *  원을 안 켜므로, 옛 링 단언들을 계속 재려면 프레임에서 켜 줘야 한다. */
  const ringFrame = (ring: '3m' | '5m') => {
    const f = makeFrame();
    f.balls = f.balls.map((b) => ({ ...b, ring }));
    return f;
  };

  it('showRuleZones 가 꺼져 있으면 링도 존도 없다', () => {
    const svg = buildStaticSvg(makeFrame(), OPTS);
    expect(svg.includes('stroke-dasharray="8 6"')).toBe(false);
    expect(svg.includes(RULE_ALERT_STROKE)).toBe(false);
  });

  it('원을 안 켠 공(기본)은 스위치를 켜도 링이 없다 — 5.2 초기값은 원 없음이다', () => {
    const doc = parse(buildStaticSvg(makeFrame(), ringOpts));
    expect([...doc.querySelectorAll('circle')].filter((c) => c.getAttribute('r') === String(RING_R_PX))).toHaveLength(0);
    // 대조군 — 존은 그려진다(오버레이가 통째로 빠진 것이 아니다).
    expect(doc.documentElement.outerHTML.includes('stroke-dasharray="8 6"')).toBe(true);
  });

  it('켜면 공마다 3 m 링이 하나씩 생기고, 깨끗하면 흰 파선이다', () => {
    const doc = parse(buildStaticSvg(ringFrame('3m'), ringOpts));
    const rings = [...doc.querySelectorAll('circle')].filter((c) => c.getAttribute('r') === '75');
    // ⚠️ 옛 판은 3개였다 — 링 2개(케이싱+본선)에 **코트의 센터 서클**(r=75 실선 흰색)이 하나
    //    더 있었기 때문이다. 5.3 이 그 원을 지웠으므로(§9 결정 ⑧) 이제 정확히 2개다.
    //    이 숫자가 다시 3이 되면 규정에 없는 원이 내보낸 그림에 되살아난 것이다.
    expect(rings.length).toBe(2);
    expect(rings.filter((c) => c.hasAttribute('cx'))).toHaveLength(0); // 링은 그룹 원점에 그려진다
    expect(doc.documentElement.outerHTML.includes(RULE_ALERT_STROKE)).toBe(false);
  });

  it('2-on-1 위반 장면이면 링이 붉은 실선이 된다 — 화면과 같은 판정 함수를 쓴다', () => {
    // 공 주변 3 m 안에 홈 2명 + 원정 1명 → ringViolation(home)
    const f = ringFrame('3m');
    f.chairs[1]!.x = 420;
    f.chairs[1]!.y = 262.5;
    f.chairs[2]!.x = 430;
    f.chairs[2]!.y = 270;
    f.chairs[5]!.x = 440;
    f.chairs[5]!.y = 262.5;
    const svg = buildStaticSvg(f, ringOpts);
    expect(svg.includes(RULE_ALERT_STROKE)).toBe(true);
    // 대조군: 같은 옵션·같은 개체 수인데 위치만 흩으면 붉지 않다.
    expect(buildStaticSvg(ringFrame('3m'), ringOpts).includes(RULE_ALERT_STROKE)).toBe(false);
  });

  it('5 m 를 켠 공은 PNG 에도 5 m 로 나간다 — 판정 반경(3 m)과 다른 값이다', () => {
    const doc = parse(buildStaticSvg(ringFrame('5m'), ringOpts));
    const rr = (r: number) => [...doc.querySelectorAll('circle')].filter((c) => c.getAttribute('r') === String(r));
    expect(rr(RING_5M_R_PX)).toHaveLength(2); // 케이싱 + 표시선
    expect(rr(RING_R_PX)).toHaveLength(0);
  });

  it('스위치가 꺼져 있어도 **켜 놓은 원**은 PNG 에 실린다 — 다만 존도 경고색도 없다', () => {
    const f = ringFrame('5m');
    f.chairs[1]!.x = 420;
    f.chairs[1]!.y = 262.5;
    f.chairs[2]!.x = 430;
    f.chairs[2]!.y = 270;
    f.chairs[5]!.x = 440;
    f.chairs[5]!.y = 262.5;
    const doc = parse(buildStaticSvg(f, OPTS)); // showRuleZones 없음
    expect([...doc.querySelectorAll('circle')].filter((c) => c.getAttribute('r') === String(RING_5M_R_PX))).toHaveLength(2);
    // 판정이 서지 않으므로(화면과 같은 판단) 같은 위반 장면인데 붉지 않다.
    expect(doc.documentElement.outerHTML.includes(RULE_ALERT_STROKE)).toBe(false);
    // 대조군 — 스위치를 켜면 같은 장면이 붉어진다.
    expect(buildStaticSvg(f, ringOpts).includes(RULE_ALERT_STROKE)).toBe(true);
  });

  it('골 지역 3인 장면이면 존이 붉게 덮인다', () => {
    const zone = COURT_DEFS.full.ruleZones[0]!;
    const f = makeFrame({ balls: [] });
    for (let i = 0; i < 3; i++) {
      f.chairs[i]!.x = zone.x + 20 + i * 10;
      f.chairs[i]!.y = zone.y + 20;
    }
    // 2026-08-13(②) 위반 **면**은 선 색(#ff5a5a)이 아니라 한 단 진한 RULE_ZONE_ALERT_FILL 이다.
    expect(buildStaticSvg(f, ringOpts).includes(`fill="${RULE_ZONE_ALERT_FILL}"`)).toBe(true);
    // 대조군: 2명이면 반칙이 아니다.
    const two = makeFrame({ balls: [] });
    two.chairs[0]!.x = zone.x + 20;
    two.chairs[0]!.y = zone.y + 20;
    two.chairs[1]!.x = zone.x + 40;
    two.chairs[1]!.y = zone.y + 20;
    expect(buildStaticSvg(two, ringOpts).includes(`fill="${RULE_ZONE_ALERT_FILL}"`)).toBe(false);
  });

  // ── 2026-08-13 — 판정이 **차체 사각형**으로 바뀌었다(model/chairOverlap.ts) ────────────────
  // PNG 는 `ruleActors()` 라는 **자기만의 RuleActor 생성기**를 갖는다. 거기서 theta 를 빠뜨리면
  // 화면 셋 중 **PNG 만 옛 판정으로** 그려진다 — 정확히 5차의 "시연 화면만 …" 과 같은 형태다.
  it('★ 차체 방향이 PNG 판정까지 온다 — 좌표는 그대로인데 각도만 바꾸면 색이 갈린다', () => {
    const ball = makeFrame().balls[0]!;
    const scene = (deg: number) => {
      const f = ringFrame('3m');
      // 홈 한 대를 공에서 피벗 100 px(4 m) 에 둔다. 공을 마주 보면(180°) 앞범퍼가 70 px 라
      // 3 m 안이고, 등을 돌리면(0°) 뒷면이 92.5 px 라 밖이다. **좌표는 두 경우가 같다.**
      f.chairs[1]!.x = ball.x + 100;
      f.chairs[1]!.y = ball.y;
      f.chairs[1]!.theta = (deg * Math.PI) / 180;
      return buildStaticSvg(f, ringOpts);
    };
    expect(scene(180).includes(RULE_ALERT_STROKE), '공을 마주 보면 붉다').toBe(true);
    expect(scene(0).includes(RULE_ALERT_STROKE), '등을 돌리면 깨끗하다').toBe(false);
  });

  it('★ 존 판정도 차체 사각형이다 — 피벗이 전부 존 밖인 3대가 걸린다', () => {
    const zone = COURT_DEFS.full.ruleZones[0]!;
    const f = makeFrame({ balls: [] });
    // 세 대 모두 피벗은 존 오른쪽 변 **밖**(+5 px)이고, 차체 뒷부분(0.3 m)만 존에 걸친다.
    for (let i = 0; i < 3; i++) {
      f.chairs[i]!.x = zone.x + zone.w + 5;
      f.chairs[i]!.y = zone.y + 40 + i * 40;
      f.chairs[i]!.theta = 0;
    }
    expect(buildStaticSvg(f, ringOpts).includes(`fill="${RULE_ZONE_ALERT_FILL}"`)).toBe(true);
    // 대조군 — 같은 세 대를 뒷면까지 존 밖으로 빼면(피벗 +10) 아무도 안 걸린다.
    for (let i = 0; i < 3; i++) f.chairs[i]!.x = zone.x + zone.w + 10;
    expect(buildStaticSvg(f, ringOpts).includes(`fill="${RULE_ZONE_ALERT_FILL}"`)).toBe(false);
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
