// ② 기현님 실기 피드백(2026-08-13): *"골에리어 안쪽 흐린 효과 붉은 계열로 수정
// (골에리어 반칙 표시는 진하게, 그냥은 연하게)"*.
//
// 이 파일이 못박는 것은 **두 상태가 눈으로 갈리는가**다. 색만 단언하면 헛통과한다 —
// 붉은색을 코트 초록(#1f7a46) 위에 낮은 알파로 얹으면 합성 결과가 코트와 **거의 같아져서**
// (실측: #ff5a5a α.12 → #3a7648, 코트 대비 1.02:1) "붉게 칠했는데 아무것도 안 보이는" 상태가
// 된다. 그래서 여기서는 hex 가 아니라 **합성색**을 계산해 잰다.
//
// ── 이 항목에서 실제로 잡은 헛통과 ────────────────────────────────────────────────
// RuleZones 의 rect 는 `opacity={0.14}` 를 쓰고 있었다. SVG 의 `opacity` 는 **요소 전체**에
// 걸리므로 흰 파선 테두리까지 0.14 로 깎였다 — 파일 머리말이 *"파선 흰 테두리(5.34:1)로
// 대체한다: 면이 아니라 파선 테두리가 기능을 전달한다"* 라고 적어 둔 그 채널이 실제로는
// **1.26:1**(합성 #599d76 vs 면 #3e8d60)이라 사실상 없었다. 마크업 단언(`stroke="#ffffff"`,
// `stroke-dasharray="8 6"`)은 전부 통과하는 채로다. 아래 '흰 파선 채널' 단언은 DOM 에서
// 요소 opacity 를 **읽어서 곱한다** — 누가 `opacity` 를 되살리면 그 자리에서 빨개진다.
//
// 축: 평소/위반 × 코트 3모드 × 코트 3크기 × 화면(편집·시연=같은 컴포넌트)/PNG × 라이트·다크
//     × 강제색. 인쇄는 규칙 존을 아예 그리지 않는다 — 그 사실도 아래에 기록해 뒀다.
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { COURT_BG } from '../core/colors.ts';
import { COURT_MODES, COURT_SIZES, courtDefFor, type CourtMode } from '../model/court.ts';
import type { TeamSide } from '../model/drill.ts';
import { compositeOver, contrastRatio, NON_TEXT_MIN } from '../styles/contrastMath.ts';
import { buildStaticSvg } from '../features/export/buildStaticSvg.ts';
import { makeFrame, TEAMS } from '../features/export/sceneFixture.ts';
import { RuleOverlay } from './RuleOverlay.tsx';
import { RuleZones } from './RuleZones.tsx';
import { FullCourtLines } from './courtLines/FullCourtLines.tsx';
import { HalfCourtLines } from './courtLines/HalfCourtLines.tsx';
import { createTransformWriter } from './transformWriter.ts';
import {
  createRuleOverlay,
  RULE_ALERT_STROKE,
  RULE_DASH,
  RULE_OK_STROKE,
  RULE_ZONE_ALERT_FILL,
  RULE_ZONE_ALERT_FILL_OPACITY,
  RULE_ZONE_FILL,
  RULE_ZONE_FILL_OPACITY,
} from './ruleOverlay.ts';

const rgba = (hex: string, a: number): string => {
  const [r, g, b] = (hex.replace('#', '').match(/../g) ?? []).map((x) => parseInt(x, 16));
  return `rgba(${r},${g},${b},${a})`;
};

/** "붉은 기운". 상대휘도는 **색상을 못 본다** — 붉은 면과 초록 코트는 휘도가 같아질 수 있어
 *  WCAG 대비만으로는 "붉게 칠했다" 를 증명할 수 없다(실측: 위반면 #92543f vs 평소면 #50875e
 *  = 1.39:1 이지만 붉기는 −34.5 → +73 으로 **부호가 뒤집힌다**). 그래서 채널비를 따로 잰다. */
const redness = (hex: string): number => {
  const [r, g, b] = (hex.replace('#', '').match(/../g) ?? []).map((x) => parseInt(x, 16));
  return r! - (g! + b!) / 2;
};

/** 화면에 실제로 찍히는 평소 층 합성색. */
const normalFace = compositeOver(rgba(RULE_ZONE_FILL, RULE_ZONE_FILL_OPACITY), COURT_BG);
/** 위반 층은 평소 층 **위에** 겹쳐 그려진다(CourtStage: RuleZones → RuleOverlay 순서). */
const alertFace = compositeOver(rgba(RULE_ZONE_ALERT_FILL, RULE_ZONE_ALERT_FILL_OPACITY), normalFace);

function zoneRects(mode: CourtMode, size?: (typeof COURT_SIZES)[number]): SVGRectElement[] {
  const { container } = render(
    <svg>
      <RuleZones mode={mode} size={size} visible />
    </svg>,
  );
  return Array.from(container.querySelectorAll('rect'));
}

describe('② 평소 층 — 연한 붉은 계열', () => {
  it('채움 색이 붉은 계열이다 (흰색이 아니다)', () => {
    const [r, g, b] = (RULE_ZONE_FILL.replace('#', '').match(/../g) ?? []).map((x) => parseInt(x, 16));
    expect(r).toBeGreaterThan(g!);
    expect(r).toBeGreaterThan(b!);
    expect(RULE_ZONE_FILL).not.toBe('#ffffff');
    // 대조군: 옛 값(흰색)은 붉기가 0 이다 — 이 잣대가 무엇이든 통과시키는 잣대가 아니다.
    expect(redness('#ffffff')).toBe(0);
    expect(redness(RULE_ZONE_FILL)).toBeGreaterThan(0);
  });

  it('합성색이 코트보다 **붉은 쪽으로** 간다 — 색을 얹었는데 화면은 그대로가 아니다', () => {
    expect(redness(normalFace)).toBeGreaterThan(redness(COURT_BG) + 20);
    // 대조군 ①: 옛 흰 .14 는 코트보다 겨우 8.5 만 붉어졌다(무채색이라 초록이 그대로 남는다).
    expect(redness(compositeOver(rgba('#ffffff', 0.14), COURT_BG))).toBeLessThan(redness(COURT_BG) + 20);
    // 대조군 ②: 그런데도 **연하다** — 코트 대비는 1.5:1 미만이다(면은 여전히 장식이다).
    expect(contrastRatio(normalFace, COURT_BG)).toBeLessThan(1.5);
    expect(contrastRatio(normalFace, COURT_BG)).toBeGreaterThan(1.1);
  });

  it('★ 흰 파선 채널이 실제로 보인다 — 요소 opacity 가 테두리를 깎지 않는다', () => {
    for (const rect of zoneRects('full')) {
      // ⚠️ 요소 `opacity` 는 fill 과 stroke 에 **함께** 걸린다. DOM 에서 읽어 곱한다.
      const elOpacity = Number(rect.getAttribute('opacity') ?? '1');
      const dashFace = compositeOver(rgba(rect.getAttribute('stroke')!, elOpacity), normalFace);
      expect(contrastRatio(dashFace, normalFace)).toBeGreaterThanOrEqual(NON_TEXT_MIN);
    }
    // 대조군: 옛 구현(요소 opacity .14)이면 1.26:1 로 이 문턱을 못 넘는다.
    const old = compositeOver(rgba('#ffffff', 0.14), COURT_BG);
    expect(contrastRatio(compositeOver(rgba('#ffffff', 0.14), old), old)).toBeLessThan(NON_TEXT_MIN);
  });

  it('DOM 이 상수와 같은 값을 쓴다 — 코트 3모드 × 3크기 전부', () => {
    for (const mode of COURT_MODES) {
      for (const size of COURT_SIZES) {
        const rects = zoneRects(mode, size);
        expect(rects).toHaveLength(courtDefFor(mode, size).ruleZones.length);
        for (const rect of rects) {
          expect(rect.getAttribute('fill')).toBe(RULE_ZONE_FILL);
          expect(Number(rect.getAttribute('fill-opacity'))).toBe(RULE_ZONE_FILL_OPACITY);
          expect(rect.getAttribute('stroke')).toBe(RULE_OK_STROKE);
          expect(rect.getAttribute('stroke-dasharray')).toBe(RULE_DASH);
        }
      }
    }
    // 대조군: flat 은 존이 0개라 위 루프가 아무것도 안 세는 모드가 섞여 있다 — full 은 2개다.
    expect(zoneRects('full')).toHaveLength(2);
    expect(zoneRects('flat')).toHaveLength(0);
  });
});

describe('② 위반 층 — 같은 붉은 계열의 **진한 쪽**', () => {
  it('농도가 평소보다 진하다', () => {
    expect(RULE_ZONE_ALERT_FILL_OPACITY).toBeGreaterThan(RULE_ZONE_FILL_OPACITY * 2);
  });

  it('세 색이 **한 색상각(0°)의 밝기 3단**이다 — 연한 면 → 경고선 → 진한 면', () => {
    for (const hex of [RULE_ZONE_FILL, RULE_ALERT_STROKE, RULE_ZONE_ALERT_FILL]) {
      const [r, g, b] = (hex.replace('#', '').match(/../g) ?? []).map((x) => parseInt(x, 16));
      expect(g, `${hex} 는 순수 색상각 0° 가 아니다`).toBe(b);
      expect(r).toBeGreaterThan(g!);
    }
    // 밝기 순서: 평소 면이 가장 밝고, 위반 면이 가장 어둡다.
    const lightness = (hex: string): number => parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16);
    expect(lightness(RULE_ZONE_FILL)).toBeGreaterThan(lightness(RULE_ALERT_STROKE));
    expect(lightness(RULE_ALERT_STROKE)).toBeGreaterThan(lightness(RULE_ZONE_ALERT_FILL));
  });

  it('★ 두 상태가 **색으로도 밝기로도** 갈린다 (색맹 대조군 포함)', () => {
    // ① 색: 붉기의 부호가 뒤집힌다(초록 우세 → 붉은 우세).
    expect(redness(normalFace)).toBeLessThan(0);
    expect(redness(alertFace)).toBeGreaterThan(0);
    // ② 밝기: 색을 전혀 못 보는 눈(전색맹)에게도 남는 채널 — 상대휘도 대비.
    expect(contrastRatio(alertFace, normalFace)).toBeGreaterThanOrEqual(1.3);
    // 대조군: 옛 조합(#ff5a5a fill-opacity .2 를 흰 .14 위에)은 1.04:1 로 **밝기 채널이 없었다**.
    const oldNormal = compositeOver(rgba('#ffffff', 0.14), COURT_BG);
    expect(contrastRatio(compositeOver(rgba(RULE_ALERT_STROKE, 0.2), oldNormal), oldNormal)).toBeLessThan(1.1);
  });

  it('★ 케이싱이 §7.1 하한(3:1)을 넘는다 — 색을 못 보는 눈에 **모양**을 남기는 채널', () => {
    const { container } = render(
      <svg>
        <RuleOverlay
          mode="full"
          visible
          writer={createTransformWriter()}
          rules={createRuleOverlay({ say: vi.fn(), now: () => 0 })}
          ballIds={[]}
          roster={[]}
          teams={{ home: { label: '홈' }, away: { label: '원정' } }}
        />
      </svg>,
    );
    const casing = container.querySelector('rect[stroke="#000000"]')!;
    // ⚠️ DOM 에서 알파를 **읽어서** 합성한다 — 상수를 0.55 로 되돌리면 2.48:1 로 여기서 빨개진다.
    const face = compositeOver(rgba(casing.getAttribute('stroke')!, Number(casing.getAttribute('opacity') ?? '1')), COURT_BG);
    expect(contrastRatio(face, COURT_BG)).toBeGreaterThanOrEqual(NON_TEXT_MIN);
    // 대조군: 옛 알파 .55 는 이 문턱을 못 넘는다(주석의 3.93 은 **불투명** 기준 숫자였다).
    expect(contrastRatio(compositeOver(rgba('#000000', 0.55), COURT_BG), COURT_BG)).toBeLessThan(NON_TEXT_MIN);
  });

  it('농도 밖 채널이 살아 있다 — 파선 → 실선, 그리고 케이싱', () => {
    const rules = createRuleOverlay({ say: vi.fn(), now: () => 0 });
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    rules.registerZone(0, g);
    const zone = courtDefFor('full').ruleZones[0]!;
    const roster = ['a', 'b', 'c'].map((id) => ({ id, team: 'home' as TeamSide, isGk: false }));
    rules.setContext({ enabled: true, roster, goalAreas: [{ rect: zone, defender: 'home' }], goalMouths: [], fiveMeterDefense: null, teamLabels: { home: '홈', away: '원정' } });

    // 깨끗: 숨어 있고 파선이다.
    rules.write({ a: { x: 0, y: 0 } });
    expect(g.getAttribute('opacity')).toBe('0');
    expect(g.getAttribute('stroke-dasharray')).toBe(RULE_DASH);

    // 3인 반칙: 나타나고 **실선**이 된다 — 농도와 무관한 채널이다.
    const p = { x: zone.x + 10, y: zone.y + 10 };
    rules.write({ a: p, b: { ...p, x: p.x + 5 }, c: { ...p, x: p.x + 10 } });
    expect(g.getAttribute('opacity')).toBe('1');
    expect(g.getAttribute('stroke-dasharray')).toBe('none');
    expect(g.getAttribute('stroke')).toBe(RULE_ALERT_STROKE);
  });
});

describe('② 화면마다 같은 색이 나온다', () => {
  const src = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');

  it('색 리터럴의 출처가 하나다 — RuleZones/RuleOverlay/PNG 가 상수를 import 한다', () => {
    for (const p of ['./RuleZones.tsx', './RuleOverlay.tsx', '../features/export/buildStaticSvg.ts']) {
      const text = src(p);
      expect(text, `${p} 에 존 채움 hex 가 손으로 박혀 있다`).not.toContain(RULE_ZONE_FILL);
      expect(text, `${p} 에 위반 채움 hex 가 손으로 박혀 있다`).not.toContain(RULE_ZONE_ALERT_FILL);
      expect(text).toContain('RULE_ZONE_');
    }
    // 대조군: 상수 파일에는 당연히 있다(위 단언이 "아무 파일에서도 못 찾아서" 통과한 것이 아니다).
    expect(src('./ruleOverlay.ts')).toContain(RULE_ZONE_FILL);
    expect(src('./ruleOverlay.ts')).toContain(RULE_ZONE_ALERT_FILL);
  });

  it('PNG 가 화면과 **같은 두 값**을 굽는다 — 평소 층과 위반 층 둘 다', () => {
    const zone = courtDefFor('full').ruleZones[0]!;
    const clean = buildStaticSvg(makeFrame({ balls: [] }), { mode: 'full', teams: TEAMS, showRuleZones: true });
    expect(clean).toContain(`fill="${RULE_ZONE_FILL}" fill-opacity="${RULE_ZONE_FILL_OPACITY}"`);
    // 대조군 ①: 깨끗한 장면에는 위반 면이 없다.
    expect(clean).not.toContain(RULE_ZONE_ALERT_FILL);

    const bad = makeFrame({ balls: [] });
    for (let i = 0; i < 3; i++) {
      bad.chairs[i]!.x = zone.x + 20 + i * 10;
      bad.chairs[i]!.y = zone.y + 20;
    }
    const svg = buildStaticSvg(bad, { mode: 'full', teams: TEAMS, showRuleZones: true });
    expect(svg).toContain(`fill="${RULE_ZONE_ALERT_FILL}" fill-opacity="${RULE_ZONE_ALERT_FILL_OPACITY}"`);
    // 대조군 ②: 위반이 나도 **평소 층은 그대로 아래에 깔린다**(합성색 계산의 전제다).
    expect(svg).toContain(`fill="${RULE_ZONE_FILL}" fill-opacity="${RULE_ZONE_FILL_OPACITY}"`);
    // 대조군 ③: 옛 값(요소 opacity .14 / 위반 .2)이 남아 있지 않다.
    expect(svg).not.toContain('opacity="0.14"');
    expect(svg).not.toContain('fill-opacity="0.2"');
  });

  it('라이트/다크가 같다 — 판의 색은 테마 토큰이 아니다', () => {
    // 주석은 지우고 본다: 이 파일들의 머리말은 **폐기된** 프로토타입 값(var(--accent) .1)을
    // 기록으로 인용하고 있다. 그 문장까지 금지하면 기록을 지워야 통과하는 테스트가 된다.
    const code = (p: string): string => src(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code('./RuleZones.tsx')).not.toContain('var(--');
    expect(code('./RuleOverlay.tsx')).not.toContain('var(--');
    // 대조군: 주석을 지우기 전에는 실제로 그 문자열이 있다(정규식이 헛돈 것이 아니다).
    expect(src('./RuleZones.tsx')).toContain('var(--');
  });

  it('강제색에서도 붉은 채움이 남는다 — 판은 치환 대상에서 빠져 있다', () => {
    const css = src('../styles/contrast.css');
    // contrast.css ① 블록: `.stage-svg, .spin-print-court { forced-color-adjust: none; }`
    expect(css).toMatch(/\.stage-svg,\s*\n\s*\.spin-print-court\s*\{\s*\n\s*forced-color-adjust:\s*none;/);
    // ⚠️ 이게 없으면 fill·stroke 가 **둘 다** CanvasText 로 치환되어 평소/위반은 물론
    //    파선 채널까지 통째로 사라진다(contrastMath.dashChannelVisible 이 그 계산이다).
  });

  it('인쇄 시트는 규칙 존을 그리지 않는다 (현 상태 기록 — 바뀌면 여기서 알려 준다)', () => {
    expect(src('../features/print/PrintCourt.tsx')).not.toContain('RuleZones');
  });
});

// ── 6차 검증관 발견 (2026-08-13) ─────────────────────────────────────────────────────
// **흰 파선 테두리는 화면에 한 픽셀도 기여하지 않는다.** ② 가 요소 `opacity` 를 `fill-opacity`
// 로 갈라내며 "흰 선/면 4.23:1" 을 얻었다고 적었지만, 그 대비쌍(흰 선 vs 붉은 면)은 **화면에
// 나타나지 않는 쌍**이다: 규칙 존 rect 의 네 변이 코트 자신의 **흰 실선 위에 정확히 겹쳐**
// 그어지고, 그 실선이 파선보다 **굵다**. 파선의 빈칸에는 아래 실선이 그대로 보이므로 파선은
// 연속된 흰 선으로 뭉개진다 — 즉 존을 켜고 끄는 차이는 **면(fill)뿐**이다.
//
// 실측(편집 variant, 30×18):
//   · 존 rect  x=37.5 y=162.5 w=125 h=200, stroke-width **2**(파선 8 6)
//   · 골 지역  path `M37.5,162.5 L162.5,162.5 L162.5,362.5 L37.5,362.5`, stroke-width **2.8**
//     → 위·오른·아래 세 변이 이 실선 안에 완전히 들어간다(2 < 2.8, 같은 중심선).
//   · 왼쪽 변(골라인)은 외곽선 rect(stroke-width **3**)의 왼쪽 변 안에 들어간다.
// 그래서 RuleZones.tsx 머리말의 *"면이 아니라 파선 테두리가 기능을 전달한다"* 는 **옛 값에서도
// 지금 값에서도 사실이 아니다**. 지우지 않고 남기되(기록이다), 사실은 여기서 못박는다.
//
// 되돌리면(= 파선을 코트 실선보다 굵게 하거나 존을 안쪽으로 들이면) 이 단언이 빨개진다.
// 그 판단은 기현님 몫이라 값은 바꾸지 않았다 — 지금은 **사실을 고정**만 한다.
describe('⚠️ 규칙 존의 흰 파선은 코트 실선에 완전히 가려진다 (6차 검증관 실측)', () => {
  interface Seg { x1: number; y1: number; x2: number; y2: number; w: number }

  /** 렌더된 코트 라인 그룹에서 축평행 선분을 전부 끌어낸다(rect·line·path 의 L 명령). */
  function courtSegs(el: Element): Seg[] {
    const out: Seg[] = [];
    for (const node of el.querySelectorAll('rect,line,path')) {
      const w = Number(node.getAttribute('stroke-width') ?? node.closest('g')?.getAttribute('stroke-width') ?? 0);
      if (!w) continue;
      if (node.tagName === 'rect') {
        const x = Number(node.getAttribute('x')), y = Number(node.getAttribute('y'));
        const rw = Number(node.getAttribute('width')), rh = Number(node.getAttribute('height'));
        out.push({ x1: x, y1: y, x2: x + rw, y2: y, w }, { x1: x, y1: y + rh, x2: x + rw, y2: y + rh, w });
        out.push({ x1: x, y1: y, x2: x, y2: y + rh, w }, { x1: x + rw, y1: y, x2: x + rw, y2: y + rh, w });
      } else if (node.tagName === 'line') {
        out.push({ x1: Number(node.getAttribute('x1')), y1: Number(node.getAttribute('y1')), x2: Number(node.getAttribute('x2')), y2: Number(node.getAttribute('y2')), w });
      } else {
        const pts = (node.getAttribute('d') ?? '').split(/(?=[ML])/).map((t) => t.trim()).filter(Boolean);
        let prev: { x: number; y: number } | null = null;
        for (const t of pts) {
          const [x, y] = t.slice(1).split(',').map(Number) as [number, number];
          if (t[0] === 'L' && prev) out.push({ x1: prev.x, y1: prev.y, x2: x, y2: y, w });
          prev = { x, y };
        }
      }
    }
    return out;
  }

  /** `a` 가 `b` 안에 완전히 숨는가 — 같은 직선 위에 있고, 구간이 덮이고, `b` 가 더 굵다. */
  function hiddenIn(a: Seg, b: Seg): boolean {
    const horiz = (s: Seg): boolean => s.y1 === s.y2;
    const vert = (s: Seg): boolean => s.x1 === s.x2;
    if (b.w < a.w) return false;
    if (horiz(a) && horiz(b) && a.y1 === b.y1) {
      return Math.min(a.x1, a.x2) >= Math.min(b.x1, b.x2) && Math.max(a.x1, a.x2) <= Math.max(b.x1, b.x2);
    }
    if (vert(a) && vert(b) && a.x1 === b.x1) {
      return Math.min(a.y1, a.y2) >= Math.min(b.y1, b.y2) && Math.max(a.y1, a.y2) <= Math.max(b.y1, b.y2);
    }
    return false;
  }

  for (const mode of ['full', 'half'] as const) {
    it(`${mode}: 존 rect 의 네 변이 전부 더 굵은 코트 실선 안에 있다`, () => {
      const Lines = mode === 'full' ? FullCourtLines : HalfCourtLines;
      const court = render(<svg>{<Lines variant="editor" />}</svg>);
      const lines = courtSegs(court.container.querySelector('svg')!);
      court.unmount();

      const zones = render(<svg><RuleZones mode={mode} visible /></svg>);
      const zoneRect = zones.container.querySelector('rect')!;
      expect(zoneRect.getAttribute('stroke-dasharray'), '파선이 실제로 있다').toBe(RULE_DASH);
      const edges = courtSegs(zones.container.querySelector('g')!);
      zones.unmount();

      // full 은 좌·우 골 지역 2개, half 는 1개 — 존마다 네 변이다.
      expect(edges, '존마다 네 변').toHaveLength(4 * courtDefFor(mode).ruleZones.length);
      for (const e of edges) {
        expect(lines.some((l) => hiddenIn(e, l)), `${mode} 변 ${JSON.stringify(e)} 을 덮는 실선이 없다`).toBe(true);
      }
    });
  }

  it('대조군 — hiddenIn 은 실제로 거짓을 낼 수 있다 (통과가 검사기 고장이 아니다)', () => {
    const thin = { x1: 0, y1: 0, x2: 10, y2: 0, w: 2 };
    expect(hiddenIn(thin, { x1: 0, y1: 0, x2: 10, y2: 0, w: 3 })).toBe(true);
    expect(hiddenIn(thin, { x1: 0, y1: 0, x2: 10, y2: 0, w: 1 })).toBe(false); // 더 얇으면 못 가린다
    expect(hiddenIn(thin, { x1: 0, y1: 5, x2: 10, y2: 5, w: 3 })).toBe(false); // 다른 직선
    expect(hiddenIn(thin, { x1: 0, y1: 0, x2: 5, y2: 0, w: 3 })).toBe(false); // 구간이 짧다
  });

  it('그래서 존을 켰다 끄는 차이는 **면뿐**이다 — 그 면의 코트 대비는 3:1 미만이다', () => {
    const normal = compositeOver(rgba(RULE_ZONE_FILL, RULE_ZONE_FILL_OPACITY), COURT_BG);
    const r = contrastRatio(normal, COURT_BG);
    expect(r).toBeLessThan(NON_TEXT_MIN);
    // ⚠️ 이것을 "결함" 이 아니라 **기록**으로 두는 이유: 골 지역의 경계 자체는 코트 실선이
    //    언제나 그리고 있고(위 단언이 그 실선의 존재를 증명한다), 존의 면은 그 위에 얹는
    //    강조다. 기현님 지시 ② 가 요구한 것도 "안쪽 흐린 효과" 라는 **면**이다.
    expect(r).toBeGreaterThan(1.2); // 그래도 코트와 같은 색은 아니다(1.02:1 폐기안과의 대조군)
  });
});
