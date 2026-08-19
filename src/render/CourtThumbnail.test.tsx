// §3.11 썸네일 렌더 검증: viewBox 가 COURT_DEFS[mode] 그대로인지, ThumbSpec 오브젝트가
// 콘→화살표→휠체어→공 순서로 그려지는지 확인한다.
import { describe, expect, it } from 'vitest';
import { render as rtlRender } from '@testing-library/react';
import type { ReactElement } from 'react';
import { CourtThumbnail, SIDEBAR_GLYPH_SCALE, THUMB_GLYPH } from './CourtThumbnail.tsx';
import type { ThumbSpec } from '../model/thumb.ts';
import type { Shape } from '../model/shape.ts';
import { SHAPE_STROKE_PX } from '../model/shape.ts';
import { NOTE_DEFAULT_SIZE_PX } from './objects/noteChip.ts';
import { ARROW_COLORS } from '../core/colors.ts';
import { SettingsProvider } from '../store/settings/SettingsProvider.tsx';

// CourtThumbnail 이 aria-label 번역에 useLocale()(→ SettingsProvider)을 쓰게 되면서(C7) 이
// 파일의 모든 render 호출이 Provider 를 필요로 한다 — 한 곳에서 감싸 12곳을 손대지 않는다.
const render = (ui: ReactElement) => rtlRender(ui, { wrapper: SettingsProvider });

describe('CourtThumbnail', () => {
  it('mode 별 viewBox 는 COURT_DEFS 의 vbW/vbH 그대로다', () => {
    const { container: full } = render(<CourtThumbnail mode="full" />);
    expect(full.querySelector('svg')).toHaveAttribute('viewBox', '0 0 825 525');
    const { container: half } = render(<CourtThumbnail mode="half" />);
    expect(half.querySelector('svg')).toHaveAttribute('viewBox', '0 0 525 450');
  });

  it('thumb 이 없으면 코트만 그리고 오브젝트 레이어는 없다', () => {
    const { container } = render(<CourtThumbnail mode="full" />);
    expect(container.querySelectorAll(`circle[r="${THUMB_GLYPH.chairR}"]`)).toHaveLength(0);
    expect(container.querySelectorAll(`circle[r="${THUMB_GLYPH.ballR}"]`)).toHaveLength(0);
  });

  it('thumb 이 있으면 콘·화살표·휠체어·공을 이 순서로 그린다(§3.5 레이어 순서)', () => {
    const thumb: ThumbSpec = {
      mode: 'full',
      chairs: [{ x: 100, y: 100, a: 0, t: 0, g: 0 }],
      balls: [[200, 200]],
      cones: [[50, 50, 0]],
      arrows: [{ p: [10, 10, 20, 20, 30, 30] }],
    };
    const { container } = render(<CourtThumbnail mode="full" thumb={thumb} />);
    const groups = container.querySelectorAll('svg > g');
    const layer = groups[groups.length - 1]!; // 코트 라인 g 다음에 오는 마지막 g 가 오브젝트 레이어다
    const tags = Array.from(layer.children).map((el) => el.tagName.toLowerCase());
    expect(tags).toEqual(['path', 'path', 'circle', 'circle']); // 콘(path), 화살표(path), 휠체어(circle), 공(circle)
  });
});

// 2026-08-17 — 굽힘점 클릭으로 선 색이 3단이 되면서 썸네일도 따라와야 했다. 썸네일은 색이
// 아니라 **첨자**를 저장한다(model/thumb.ts) — 그래야 색값을 고친 날 이미 저장된 카드까지
// 함께 따라온다. 여기서 재는 것은 "첨자가 색으로 제대로 풀리는가" 다.
describe('화살표 색 — 저장된 첨자를 푼다', () => {
  const withArrows = (arrows: ThumbSpec['arrows']): ThumbSpec => ({ mode: 'full', chairs: [], balls: [], cones: [], arrows });
  const strokes = (t: ThumbSpec): (string | null)[] => {
    const { container } = render(<CourtThumbnail mode="full" thumb={t} />);
    // 개체 층은 **마지막** 직계 <g> 다(CourtSurface 뒤에 온다). 코트 중앙 표시도 획 굵기가 2라
    // svg 전체에서 고르면 그것까지 딸려 온다 — 실제로 그랬다.
    const layer = [...container.querySelectorAll('svg > g')].at(-1)!;
    return [...layer.querySelectorAll(`path[stroke-width="${THUMB_GLYPH.arrowW}"]`)].map((p) => p.getAttribute('stroke'));
  };

  it('첨자가 없으면 기본색이다 — 옛 요약(첨자 필드가 생기기 전)이 이 경우다', () => {
    expect(strokes(withArrows([{ p: [10, 10, 20, 20, 30, 30] }]))).toEqual([ARROW_COLORS[0]]);
  });

  it('★ 첨자마다 다른 색이 나온다 — 한 카드 안에서 섞여도 각자 제 색이다', () => {
    expect(
      strokes(
        withArrows([
          { p: [0, 0, 1, 1, 2, 2] },
          { p: [0, 0, 1, 1, 2, 2], c: 1 },
          { p: [0, 0, 1, 1, 2, 2], c: 2 },
        ]),
      ),
    ).toEqual([ARROW_COLORS[0], ARROW_COLORS[1], ARROW_COLORS[2]]);
  });

  it('범위 밖 첨자는 기본색으로 접는다 — 색 수를 줄인 날 카드가 빈 획이 되면 안 된다', () => {
    expect(strokes(withArrows([{ p: [0, 0, 1, 1, 2, 2], c: 99 }]))).toEqual([ARROW_COLORS[0]]);
  });
});

// 2026-08-17 기현님 지시 — *"섬네일 객체 표현이 약간 과장되어야 가독성이 좋아짐"*.
// 옛 값(휠체어 r 6 · 공 r 4 · 화살표 획 2)은 목록 카드(≈300 px)에서 점, 44 px 스텝 칩에서는
// **1 px 미만**이었다. 여기서 재는 것은 두 가지다: ① 크기가 상수 한 곳에서 나온다
// ② **과장은 글리프에만 걸리고 좌표에는 안 걸린다** — 자리까지 부풀리면 썸네일이 다른 배치를
// 보여주는 그림이 된다.
describe('글리프 크기 — 축척이 아니라 읽히려고 과장한다', () => {
  const SPEC: ThumbSpec = {
    mode: 'full',
    chairs: [{ x: 100, y: 100, a: 0, t: 0, g: 0 }],
    balls: [[200, 210]],
    cones: [[50, 60, 0]],
    arrows: [{ p: [10, 10, 20, 20, 30, 30] }],
  };
  const layer = (glyphScale?: number): Element => {
    const { container } = render(<CourtThumbnail mode="full" thumb={SPEC} glyphScale={glyphScale} />);
    return [...container.querySelectorAll('svg > g')].at(-1)!;
  };
  /** [휠체어 r, 휠체어 획, 공 r, 화살표 획] */
  const sizes = (l: Element): number[] => {
    const circles = [...l.querySelectorAll('circle')];
    const arrow = [...l.querySelectorAll('path')].at(-1)!; // 콘 다음이 화살표다
    return [
      Number(circles[0]!.getAttribute('r')),
      Number(circles[0]!.getAttribute('stroke-width')),
      Number(circles[1]!.getAttribute('r')),
      Number(arrow.getAttribute('stroke-width')),
    ];
  };

  it('기본 배수(목록 카드)는 THUMB_GLYPH 를 그대로 쓴다', () => {
    expect(sizes(layer())).toEqual([THUMB_GLYPH.chairR, THUMB_GLYPH.chairStroke, THUMB_GLYPH.ballR, THUMB_GLYPH.arrowW]);
  });

  it('★ 휠체어 원이 차폭(25 px)만 하다 — 지름 12 짜리 점이던 것이 이 항목의 이유다', () => {
    expect(THUMB_GLYPH.chairR * 2).toBeGreaterThanOrEqual(20);
    expect(THUMB_GLYPH.ballR).toBeGreaterThan(4); // 옛 값
    expect(THUMB_GLYPH.arrowW).toBeGreaterThan(2); // 옛 값
  });

  it('★ glyphScale 은 글리프만 키운다 — 좌표는 한 픽셀도 안 움직인다', () => {
    const one = layer(1);
    const big = layer(SIDEBAR_GLYPH_SCALE);
    expect(sizes(big)).toEqual(sizes(one).map((v) => v * SIDEBAR_GLYPH_SCALE));

    const at = (l: Element): (string | null)[] => {
      const circles = [...l.querySelectorAll('circle')];
      return [
        circles[0]!.getAttribute('cx'),
        circles[0]!.getAttribute('cy'),
        circles[1]!.getAttribute('cx'),
        circles[1]!.getAttribute('cy'),
      ];
    };
    expect(at(big)).toEqual(at(one));
    expect(at(one)).toEqual(['100', '100', '200', '210']);
  });

  it('★ 사이드바 배수는 1 보다 크다 — 사이드바 카드(≈200 px)는 목록 카드(≈300 px)보다 작게 그려진다', () => {
    expect(SIDEBAR_GLYPH_SCALE).toBeGreaterThan(1);
  });
});

// 2026-08-17 기현님 지시 *"도형, 메모(글자를 2~3px로) 등도 잡혀야지"*.
// 여기서 재는 것: ① 도형은 `ShapeLayer` 를 **재사용**한다(옮겨 적으면 반투명 값이 갈라진다)
// ② 도형은 **코트 위·개체 아래** 층이다 ③ 메모는 쪽지+글자로 그려지고 글자 크기가 목록 카드에서
// 2~3 px 로 떨어진다.
describe('도형·메모 — 썸네일에도 잡힌다', () => {
  const SHAPE: Shape = { id: 'sh_1' as Shape['id'], kind: 'rect', x: 200, y: 150, w: 100, h: 60, rot: 0 };
  const spec = (over: Partial<ThumbSpec> = {}): ThumbSpec => ({
    mode: 'full',
    chairs: [],
    balls: [],
    cones: [],
    arrows: [],
    ...over,
  });

  it('★ 도형은 ShapeLayer 가 그린다 — 여기서 손으로 그리지 않는다', () => {
    const { container } = render(<CourtThumbnail mode="full" thumb={spec({ shapes: [SHAPE] })} />);
    const layer = container.querySelector('[data-shape-layer]');
    expect(layer).not.toBeNull();
    expect(layer!.querySelector('rect[width="100"]')).not.toBeNull();
  });

  it('★ 도형 테두리만 굵어진다 — 크기는 사용자가 그린 구역 그 자체다', () => {
    const { container } = render(<CourtThumbnail mode="full" thumb={spec({ shapes: [SHAPE] })} />);
    const r = container.querySelector('[data-shape-layer] rect')!;
    expect(Number(r.getAttribute('stroke-width'))).toBe(SHAPE_STROKE_PX * THUMB_GLYPH.shapeStroke);
    expect(r.getAttribute('width')).toBe('100'); // 배수가 크기에 새지 않았다
    expect(r.getAttribute('height')).toBe('60');
  });

  it('★ 도형은 코트 위·개체 아래 층이다 (ShapeLayer.tsx 머리말의 그 순서)', () => {
    const { container } = render(
      <CourtThumbnail mode="full" thumb={spec({ shapes: [SHAPE], chairs: [{ x: 100, y: 100, a: 0, t: 0, g: 0 }] })} />,
    );
    const gs = [...container.querySelectorAll('svg > g')];
    const shapeAt = gs.findIndex((el) => el.hasAttribute('data-shape-layer'));
    const objAt = gs.findIndex((el) => el.querySelector('circle') !== null);
    expect(shapeAt).toBeGreaterThanOrEqual(0);
    expect(shapeAt).toBeLessThan(objAt); // 개체보다 먼저 = 아래
  });

  it('★ 메모는 쪽지와 글자로 그려진다 — 자리는 메모의 좌표다', () => {
    const { container } = render(<CourtThumbnail mode="full" thumb={spec({ notes: [{ x: 300, y: 200, t: '왼쪽으로' }] })} />);
    const g = [...container.querySelectorAll('g')].find((el) => el.getAttribute('transform') === 'translate(300 200)');
    expect(g).toBeDefined();
    expect(g!.querySelectorAll('path')).toHaveLength(2); // 쪽지 + 접힌 귀
    expect(g!.querySelector('text')!.textContent).toBe('왼쪽으로');
  });

  it('★ 글자는 목록 카드에서 2~3 px 로 떨어진다 — 그 크기가 이 항목의 요구였다', () => {
    const { container } = render(<CourtThumbnail mode="full" thumb={spec({ notes: [{ x: 0, y: 0, t: '가' }] })} />);
    const font = Number(container.querySelector('text')!.getAttribute('font-size'));
    expect(font).toBe(NOTE_DEFAULT_SIZE_PX * THUMB_GLYPH.noteFontScale);
    // 목록 카드는 코트(825 단위)를 약 300 px 로 그린다 → 표시 크기 = font × 300/825.
    const shownPx = (font * 300) / 825;
    expect(shownPx).toBeGreaterThan(2);
    expect(shownPx).toBeLessThan(4);
  });

  it('메모의 크기·색·정렬은 넘어온 값을 따른다 (기본값은 판과 같다)', () => {
    const { container } = render(
      <CourtThumbnail mode="full" thumb={spec({ notes: [{ x: 0, y: 0, t: '가', s: 28, c: '#ff0000', a: 'start' }] })} />,
    );
    const t = container.querySelector('text')!;
    expect(Number(t.getAttribute('font-size'))).toBe(28 * THUMB_GLYPH.noteFontScale);
    expect(t.getAttribute('fill')).toBe('#ff0000');
    expect(t.getAttribute('text-anchor')).toBe('start');
  });

  it('도형·메모가 없으면 그 층은 아예 없다 (옛 요약이 이 경우다)', () => {
    const { container } = render(<CourtThumbnail mode="full" thumb={spec({ chairs: [{ x: 1, y: 1, a: 0, t: 0, g: 0 }] })} />);
    expect(container.querySelector('[data-shape-layer]')).toBeNull();
    expect(container.querySelector('text')).toBeNull();
  });
});
