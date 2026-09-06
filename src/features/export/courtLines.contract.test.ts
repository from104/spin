// 4.4 — **드리프트 가드**. 내보내기용 코트 라인·화살촉·규칙 존은 화면 컴포넌트를 손으로 옮긴
// 것이다(배포 바이트를 아끼려고 `react-dom/server` 를 앱 번들에서 뺐다 — buildStaticSvg.ts
// 머리말의 ⚠️ 실측 참고: +63.4 kB gzip). 옮긴 것은 반드시 갈라진다. 그래서 여기서 **진짜
// 컴포넌트를 구워** 도형 집합을 통째로 대조한다. 테스트 코드는 앱 번들에 실리지 않으므로
// `react-dom/server` 를 여기서 쓰는 것은 공짜다.
//
// 5.1(코트 3단) · 5.2(코너 인크로치먼트 마크) · 5.3(센터 마크 도입 / 센터 서클 제거)이
// 코트 라인을 손대면 **이 파일이 가장 먼저 빨개진다.** 그때 할 일은 이 테스트를 고치는 것이
// 아니라 `courtLinesMarkup` 을 컴포넌트에 맞추는 것이다.
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { COURT_DEFS, COURT_MODES, courtDefFor, goalBaseRect, type CourtMode } from '../../model/court.ts';
import { GOAL_BASE_FILL, GOAL_POST_EDGE } from '../../core/colors.ts';
import type { TeamSide } from '../../model/drill.ts';
import type { Shape } from '../../model/shape.ts';
import { COURT_LINE_WEIGHTS, CourtSurface } from '../../render/CourtSurface.tsx';
import { GoalPostMarks } from '../../render/courtLines/GoalPostMarks.tsx';
import { ArrowMarkers } from '../../render/ArrowMarkers.tsx';
import { RuleZones } from '../../render/RuleZones.tsx';
import { ShapeLayer } from '../../render/ShapeLayer.tsx';
import { SideMarks } from '../../render/SideMarks.tsx';
import { arrowMarkersMarkup, courtLinesMarkup, goalPostsMarkup, MARKER_UID, ruleZonesMarkup, shapesMarkup, sideMarksMarkup } from './buildStaticSvg.ts';
import { TEAMS } from './sceneFixture.ts';

/** 상속되는 표현 속성. `<g>` 로 묶었는지 개별 요소에 적었는지는 **그림에 영향이 없으므로**
 *  대조에서 지운다 — 우리가 지켜야 하는 것은 마크업의 모양이 아니라 그려지는 도형이다. */
const INHERITED = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'opacity'] as const;
const CONTAINERS = new Set(['g', 'defs', 'svg']);

/** 마크업 → "그려지는 도형" 의 정렬된 목록. 숫자는 값으로 비교한다(`75` 와 `75.0` 은 같다). */
function shapesOf(markup: string): string[] {
  const doc = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${markup}</svg>`, 'image/svg+xml');
  expect(doc.querySelector('parsererror')).toBeNull();
  const out: string[] = [];

  const walk = (el: Element, inherited: Record<string, string>): void => {
    const own: Record<string, string> = { ...inherited };
    for (const a of [...el.attributes]) own[a.name] = a.value;
    const tag = el.tagName.toLowerCase();
    if (CONTAINERS.has(tag)) {
      const next = { ...inherited };
      for (const key of INHERITED) {
        const v = el.getAttribute(key);
        if (v !== null) next[key] = v;
      }
      for (const child of [...el.children]) walk(child, next);
      return;
    }
    const parts = Object.entries(own)
      .map(([k, v]) => `${k}=${Number.isNaN(Number(v)) || v.trim() === '' ? v : String(Number(v))}`)
      .sort();
    out.push(`${tag}|${parts.join(' ')}`);
    for (const child of [...el.children]) walk(child, own);
  };

  for (const child of [...doc.documentElement.children]) walk(child, {});
  return out.sort();
}

describe('코트 라인 — 내보내기와 화면이 같은 도형을 그린다', () => {
  it.each(COURT_MODES)('%s', (mode) => {
    const fromComponent = shapesOf(renderToStaticMarkup(createElement(CourtSurface, { mode, variant: 'present' })));
    const fromExport = shapesOf(courtLinesMarkup(mode));
    expect(fromExport).toEqual(fromComponent);
  });

  it('대조군 ① — 비교가 실제로 무언가를 세고 있다 (flat 만 0개)', () => {
    expect(shapesOf(courtLinesMarkup('full')).length).toBeGreaterThanOrEqual(15);
    expect(shapesOf(courtLinesMarkup('half')).length).toBeGreaterThanOrEqual(8);
    expect(shapesOf(courtLinesMarkup('flat'))).toHaveLength(0);
  });

  it('대조군 ② — 다른 변형(editor)과는 실제로 다르다 (굵기 비교가 살아 있다)', () => {
    const present = shapesOf(renderToStaticMarkup(createElement(CourtSurface, { mode: 'full', variant: 'present' })));
    const editor = shapesOf(renderToStaticMarkup(createElement(CourtSurface, { mode: 'full', variant: 'editor' })));
    expect(present).not.toEqual(editor);
    // 내보내기는 present 쪽이다 — 편집기 변형은 골대를 물리 바디로 그리므로 정적 원이 없다.
    expect(shapesOf(courtLinesMarkup('full'))).not.toEqual(editor);
  });

  it('대조군 ③ — 좌표를 손으로 옮겨 적은 것이 아니라 COURT_DEFS 파생이다', () => {
    // full 과 half 는 골 지역 좌표가 다르다. 둘 다 컴포넌트와 일치한다는 것은
    // 어느 한쪽을 상수로 박아 넣지 않았다는 뜻이다.
    expect(shapesOf(courtLinesMarkup('full'))).not.toEqual(shapesOf(courtLinesMarkup('half')));
  });

  // ── 2026-08-13 기현님 실기 지시 ① — 센터 마크 (도형 **대조**만으로는 못 잡는 것) ────────────
  // ⚠️ 위 도형 대조는 **양쪽이 함께 잃으면 초록이다.** `HalfCourtLines` 의 X 와
  //    `courtLinesMarkup` 의 `centerMarkMarkup(def.centerMark)` 를 같이 지우면 두 집합이
  //    여전히 같아서 통과한다 — 이 저장소가 적어 둔 "설계의 뒷문장에 단언이 없다" 그 형태다.
  //    그래서 **존재 자체**를 따로 단언한다. PNG 는 코치가 카톡으로 보내는 그림이다.
  it('⚠️ PNG 마크업에 센터 마크가 실제로 있다 (full·half) — flat 은 없다', () => {
    for (const mode of ['full', 'half'] as const) {
      const d = COURT_DEFS[mode].centerMark;
      expect(d, mode).not.toBeNull();
      expect(courtLinesMarkup(mode), mode).toContain(`<path d="${d}" stroke-width="2.4"`);
    }
    // 대조군 ① — flat 은 그대로 없다(전량 참이라 통과한 것이 아니다).
    expect(COURT_DEFS.flat.centerMark).toBeNull();
    expect(courtLinesMarkup('flat')).toBe('');
    // 대조군 ② — half 마크업이 full 의 X 를 담고 있지 않다(모드를 실제로 탄다).
    expect(courtLinesMarkup('half')).not.toContain(COURT_DEFS.full.centerMark!);
  });

  it('⚠️ PNG 의 센터 X 폭이 골 십자(페널티 스팟)와 같다 — "같은 크기로"(기현님 지시)', () => {
    // 상수를 공유한다는 것을 **구운 문자열에서** 확인한다. 한쪽만 리터럴로 되돌리면 여기가 빨갛다.
    const markup = courtLinesMarkup('full');
    const spanOf = (d: string): number => {
      const xs = [...d.matchAll(/[ML](-?[\d.]+),/g)].map((m) => Number(m[1]));
      expect(xs.length, d).toBe(4);
      return Math.max(...xs) - Math.min(...xs);
    };
    const spot = COURT_DEFS.full.spotMarks[0]!;
    const crossD = [...markup.matchAll(/<path d="(M[^"]+)"\/>/g)].map((m) => m[1]!).find((d) => d.startsWith(`M${spot.x - 3.5},`))!;
    expect(spanOf(COURT_DEFS.full.centerMark!)).toBeCloseTo(spanOf(crossD), 9);
    expect(spanOf(crossD)).toBe(7); // 대조군: 자가 실제로 무언가를 쟀다(3.5 × 2)
  });
});

describe('화살촉 마커 — id 규약과 모양이 ArrowMarkers 와 같다', () => {
  it.each([[[]], [['#38bdf8']], [['#38bdf8', '#fbbf24']]])('색 %j', (colors: string[]) => {
    const fromComponent = shapesOf(renderToStaticMarkup(createElement(ArrowMarkers, { uid: MARKER_UID, colors })));
    expect(shapesOf(arrowMarkersMarkup(colors))).toEqual(fromComponent);
  });

  it('대조군 — 색이 늘면 마커도 는다(빈 목록이라 통과한 것이 아니다)', () => {
    // 2026-08-16 — 화살촉이 좁은·넓은 둘이라 색마다 마커가 둘이다. 케이싱 전용 마커는
    // 같은 날 사라졌으므로(대비는 화살촉 stroke 가 맡는다) **색이 없으면 마커도 없다**.
    expect(shapesOf(arrowMarkersMarkup([])).length).toBe(0);
    expect(shapesOf(arrowMarkersMarkup(['#38bdf8', '#fbbf24'])).length).toBe(8); // 2색 × 2종 × (marker + path)
  });
});

// ── 2026-09-06 — 골대가 코트 라인에서 **떨어져 나왔다** ────────────────────────────────
// 그 전에는 `courtLinesMarkup` 안에 골대가 있어서 위 '코트 라인' 대조가 골대까지 함께 쟀다.
// 이제 골대는 규칙 표시 뒤에서 따로 그려지므로(GoalPostMarks.tsx 머리말: 코트 라인 그룹에
// 있으면 규칙 존 파선이 받침판 위를 가로지른다) 대조도 여기로 따라 옮긴다 —
// **옮기면서 재는 것을 잃지 않는다**(이 파일 아래쪽 2026-08-17 주석이 말하는 그 실패다).
describe('골대 표시 — GoalPostMarks 와 같은 도형을 그린다', () => {
  const W = COURT_LINE_WEIGHTS.present;
  const component = (mode: CourtMode): string =>
    renderToStaticMarkup(createElement(GoalPostMarks, { def: courtDefFor(mode), spotR: W.spotR!, spotSw: W.spotSw }));

  it.each(COURT_MODES)('%s', (mode) => {
    expect(shapesOf(goalPostsMarkup(courtDefFor(mode)))).toEqual(shapesOf(component(mode)));
  });

  it('대조군 — 기둥마다 셋(받침판·기둥 원·흰 덧테)이고 flat 은 0개', () => {
    // 개수를 손으로 적지 않는다 — 코트 정의에서 센다(풀은 골대 2대 × 포스트 2 = 4).
    for (const mode of ['full', 'half'] as const) {
      const def = courtDefFor(mode);
      const posts = def.goalPosts.length;
      const bases = def.goalPosts.filter((_p, i) => goalBaseRect(def, i) !== null).length;
      expect(posts, mode).toBeGreaterThan(0);
      expect(shapesOf(goalPostsMarkup(def)), mode).toHaveLength(bases + posts * 2);
    }
    expect(goalPostsMarkup(courtDefFor('flat'))).toBe('');
  });

  it('⚠️ 받침판에는 테두리가 없다 — 그룹의 주황 stroke 는 기둥 것이다', () => {
    // 2026-09-06 기현 신고(*"골대 밑판 위에 코트 라인이 보임"*)의 두 번째 원인이었다:
    // 판이 기둥과 같은 `<g stroke="#c2410c">` 안에 있어 상속으로 테를 두르고 있었고,
    // 그 테가 골라인과 겹쳐 보였다. 편집 화면의 판(GoalPost.tsx BasePlate)은 처음부터
    // stroke 가 없다 — 정본이 그쪽이므로 정적 경로가 따라간다.
    const def = courtDefFor('full');
    const base = shapesOf(goalPostsMarkup(def)).filter((sh) => sh.includes(`fill=${GOAL_BASE_FILL}`));
    expect(base).toHaveLength(def.goalPosts.filter((_p, i) => goalBaseRect(def, i) !== null).length);
    expect(base.length).toBeGreaterThan(0); // 대조군 — 빈 목록이라 통과한 것이 아니다
    for (const sh of base) expect(sh).toContain('stroke=none');
    // 대조군 — 기둥 원은 여전히 그 주황 테를 갖는다(전부 지운 것이 아니다).
    expect(shapesOf(goalPostsMarkup(def)).some((sh) => sh.includes(`stroke=${GOAL_POST_EDGE}`))).toBe(true);
  });
});

describe('규칙 존 — RuleZones 와 같은 사각형을 그린다', () => {
  it.each(COURT_MODES)('%s', (mode) => {
    const fromComponent = shapesOf(renderToStaticMarkup(createElement(RuleZones, { mode, visible: true })));
    expect(shapesOf(ruleZonesMarkup(mode))).toEqual(fromComponent);
  });

  it('대조군 — full 2개 · half 1개 · flat 0개', () => {
    expect(shapesOf(ruleZonesMarkup('full'))).toHaveLength(2);
    expect(shapesOf(ruleZonesMarkup('half'))).toHaveLength(1);
    expect(shapesOf(ruleZonesMarkup('flat'))).toHaveLength(0);
  });
});

// ── 2026-08-17 — 여기부터 둘은 **없어서 생긴 사고**를 막는 자리다 ────────────────────────
// 기현님 신고: *"그림으로 내보내기 시 도형, 진영 표시 안나온다."* 둘 다 화면에는 있고 PNG 에만
// 없었다. 코트 라인·화살촉·규칙 존은 위에서 대조하고 있었는데, 나중에 생긴 이 두 층은
// 대조 목록에 들어오지 않아 **빠진 것을 아무도 못 셌다.** 그림 층을 새로 만들면 여기 한 줄을
// 같이 늘려라 — 그것이 이 파일의 쓸모다.
describe('진영 표시 — SideMarks 와 같은 깃발을 그린다', () => {
  const opts = (mode: CourtMode, defense: TeamSide) => ({ mode, teams: TEAMS, defense });

  it.each(COURT_MODES)('%s', (mode) => {
    for (const defense of ['home', 'away'] as const) {
      const fromComponent = shapesOf(renderToStaticMarkup(createElement(SideMarks, { mode, teams: TEAMS, defense })));
      expect(shapesOf(sideMarksMarkup(opts(mode, defense)))).toEqual(fromComponent);
    }
  });

  it('코트 크기를 바꿔도 같이 움직인다 — 좌표를 손으로 옮겨 적은 것이 아니다', () => {
    const a = sideMarksMarkup({ mode: 'full', size: '30x18', teams: TEAMS });
    const b = sideMarksMarkup({ mode: 'full', size: '25x14', teams: TEAMS });
    expect(a).not.toEqual(b);
    expect(shapesOf(b)).toEqual(shapesOf(renderToStaticMarkup(createElement(SideMarks, { mode: 'full', size: '25x14', teams: TEAMS }))));
  });

  it('대조군 — full·half 는 깃발이 있고(존당 깃대+페넌트 2벌) flat 은 0개', () => {
    expect(shapesOf(sideMarksMarkup(opts('full', 'home')))).toHaveLength(8); // 존 2 × 깃발 2 × 요소 2
    expect(shapesOf(sideMarksMarkup(opts('half', 'home')))).toHaveLength(4);
    expect(shapesOf(sideMarksMarkup(opts('flat', 'home')))).toHaveLength(0);
  });

  it('진영을 뒤집으면 깃발 색이 바뀐다 — defense 가 실제로 배선돼 있다', () => {
    expect(sideMarksMarkup(opts('full', 'home'))).not.toEqual(sideMarksMarkup(opts('full', 'away')));
  });
});

describe('작도 도형 — ShapeLayer 와 같은 도형을 그린다', () => {
  /** 세 종류 한 벌. 좌표·회전에 **딱 떨어지지 않는 값**을 섞는다 — 반올림이 끼어들면 바로 갈린다. */
  const SHAPES: Shape[] = [
    { id: 'sh_a', kind: 'ellipse', x: 210.5, y: 130.25, w: 101.5, h: 67.125, rot: 0 },
    { id: 'sh_b', kind: 'rect', x: 400, y: 260, w: 120, h: 80, rot: 37.5 },
    { id: 'sh_c', kind: 'triangle', x: 600.75, y: 300, w: 100, h: 86.6, rot: -12 },
  ];

  /** `shapesOf` 는 `<g>` 의 `transform` 을 지운다(그리는 도형만 세려는 것이다). 도형은 자리가
   *  그 `transform` 에 있으므로 따로 센다 — 안 그러면 **전부 원점에 그려도 통과**한다. */
  function transformsOf(markup: string): string[] {
    const doc = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${markup}</svg>`, 'image/svg+xml');
    return [...doc.querySelectorAll('g[transform]')].map((g) => g.getAttribute('transform')!).sort();
  }

  const fromComponent = () => renderToStaticMarkup(createElement(ShapeLayer, { shapes: SHAPES }));

  it('도형이 같다', () => {
    expect(shapesOf(shapesMarkup(SHAPES))).toEqual(shapesOf(fromComponent()));
  });

  it('자리·회전이 같다', () => {
    expect(transformsOf(shapesMarkup(SHAPES))).toEqual(transformsOf(fromComponent()));
  });

  it('대조군 — 세 종류가 실제로 세어지고, 빈 목록은 아무것도 안 낸다', () => {
    expect(shapesOf(shapesMarkup(SHAPES))).toHaveLength(3);
    expect(shapesMarkup([])).toBe('');
    expect(transformsOf(shapesMarkup(SHAPES))).toHaveLength(3);
  });

  it('⚠️ 그룹에 opacity 를 걸지 않는다 — 겹치면 진해지는 성질이 납작해진다', () => {
    expect(shapesMarkup(SHAPES)).not.toMatch(/<g[^>]*opacity/);
  });

  it('선택 색(var(--accent))·class 가 새어 나오지 않는다 — 자립 SVG 규약', () => {
    const out = shapesMarkup(SHAPES);
    expect(out).not.toContain('var(--');
    expect(out).not.toContain('class=');
  });
});
