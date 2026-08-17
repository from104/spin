// §3.11 썸네일 렌더 검증: viewBox 가 COURT_DEFS[mode] 그대로인지, ThumbSpec 오브젝트가
// 콘→화살표→휠체어→공 순서로 그려지는지 확인한다.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { CHIP_GLYPH_SCALE, CourtThumbnail, THUMB_GLYPH } from './CourtThumbnail.tsx';
import type { ThumbSpec } from '../model/thumb.ts';
import { ARROW_COLORS } from '../core/colors.ts';

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
    const big = layer(CHIP_GLYPH_SCALE);
    expect(sizes(big)).toEqual(sizes(one).map((v) => v * CHIP_GLYPH_SCALE));

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

  it('★ 칩 배수는 1 보다 크다 — 칩(≈76 px)은 카드(≈300 px)보다 4배 작게 그려진다', () => {
    expect(CHIP_GLYPH_SCALE).toBeGreaterThan(1);
  });
});
