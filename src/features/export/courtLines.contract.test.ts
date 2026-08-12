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
import { COURT_MODES } from '../../model/court.ts';
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
});

describe('화살촉 마커 — id 규약과 모양이 ArrowMarkers 와 같다', () => {
  it.each([[[]], [['#38bdf8']], [['#38bdf8', '#fbbf24']]])('색 %j', (colors: string[]) => {
    const fromComponent = shapesOf(renderToStaticMarkup(createElement(ArrowMarkers, { uid: MARKER_UID, colors })));
    expect(shapesOf(arrowMarkersMarkup(colors))).toEqual(fromComponent);
  });

  it('대조군 — 색이 늘면 마커도 는다(빈 목록이라 통과한 것이 아니다)', () => {
    expect(shapesOf(arrowMarkersMarkup([])).length).toBe(2); // 케이싱 marker + path
    expect(shapesOf(arrowMarkersMarkup(['#38bdf8', '#fbbf24'])).length).toBe(6);
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
