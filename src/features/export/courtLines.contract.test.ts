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
import { COURT_DEFS, COURT_MODES } from '../../model/court.ts';
import { CourtSurface } from '../../render/CourtSurface.tsx';
import { ArrowMarkers } from '../../render/ArrowMarkers.tsx';
import { RuleZones } from '../../render/RuleZones.tsx';
import { arrowMarkersMarkup, courtLinesMarkup, MARKER_UID, ruleZonesMarkup } from './buildStaticSvg.ts';

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
