// §4.3 P1-5 메모 = 종이 쪽지 — 네 겹의 원인 중 (a) 빈 메모의 픽셀 · (b) 선택 링 · (d) 정합.
//
// 예전 NoteLabel 은 `<text>{text}</text>` 하나였다. `placement.ts` 가 만드는 `text:''` 메모는
// 그래서 **픽셀이 0** 이었고, 5종 개체 중 유일하게 선택 링도 없었다(`aria-pressed` 뿐).
// 코트를 탭했는데 화면이 그대로인 것 — 그게 "메모 도구 무반응" 의 절반이다.
//
// (d) 가 이 파일의 핵심이다: **그려진 쪽지의 꼭짓점 좌표를 DOM 에서 직접 읽어** 그대로
// `hitTest` 에 넣는다. 시각과 히트가 상수 하나로 묶여 있다는 것을 두 층 사이에서 실제로
// 건너가며 확인하는 방법이라, 어느 한쪽 숫자만 바꾸면 반드시 빨간불이 된다.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { NOTE } from '../../core/constants.ts';
import type { NoteId } from '../../core/ids.ts';
import { hitTest } from '../../physics/hitTest.ts';
import type { HitContext, SceneSnapshot } from '../../physics/hitTest.ts';
import { HIT_R_MAX_PX } from '../hitRadius.ts';
import { createTransformWriter } from '../transformWriter.ts';
import { NoteLabel } from './NoteLabel.tsx';
import { NOTE_PLACEHOLDER, noteChipWidthPx } from './noteChip.ts';

const id = 'nt_1' as NoteId;
const NOTE_AT = { x: 300, y: 200 };

/** 실측 배율 분포(§4.4 P2-2): 7인치 0.663 / narrow 0.891 / PC 오버레이 1.151 / 27인치 1.675.
 *  4.0 은 상한(22)이 물리지 않는 구간까지 넓혀 보려고 덧붙인 값이다. */
const SCALES = [0.663, 0.891, 1.151, 1.675, 4.0];

function renderNote(text: string, selected = false) {
  const writer = createTransformWriter();
  const { container } = render(
    <svg>
      <NoteLabel id={id} writer={writer} text={text} selected={selected} active={false} ariaLabel="메모" />
    </svg>,
  );
  return container;
}

/** NoteLabel 이 실제로 내보내는 명령(M/L/H/V/Z)만 읽는 최소 파서. jsdom 에는 `getBBox` 가
 *  없어서 DOM 에서 형상을 되읽으려면 이 방법뿐이다 — 상수를 다시 읽어 오는 게 아니라 **그려진
 *  것**을 재야 (d) 가 의미를 갖는다. */
function pathPoints(d: string): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  let x = 0;
  let y = 0;
  const re = /([MLHVZ])([^MLHVZ]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d)) !== null) {
    const nums = (m[2]!.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    if (m[1] === 'M' || m[1] === 'L') {
      x = nums[0]!;
      y = nums[1]!;
      pts.push({ x, y });
    } else if (m[1] === 'H') {
      x = nums[0]!;
      pts.push({ x, y });
    } else if (m[1] === 'V') {
      y = nums[0]!;
      pts.push({ x, y });
    }
  }
  return pts;
}

/** 그려진 칩의 로컬 경계 상자. */
function chipBox(container: Element): { minX: number; maxX: number; minY: number; maxY: number } {
  const d = container.querySelector('.note-chip')!.getAttribute('d')!;
  const pts = pathPoints(d);
  return {
    minX: Math.min(...pts.map((p) => p.x)),
    maxX: Math.max(...pts.map((p) => p.x)),
    minY: Math.min(...pts.map((p) => p.y)),
    maxY: Math.max(...pts.map((p) => p.y)),
  };
}

const scene: SceneSnapshot = { chairs: [], balls: [], cones: [], notes: [{ id, p: NOTE_AT }], arrows: [] };

/** **지우개**로 잰다 — select 는 2차(관대) 패스가 있어 1차 반경을 가려 버린다(§4.3 P1-2 [A-2]).
 *  여기서 재려는 것은 "그려진 칩이 1차 패스만으로 잡히는가" 다. */
const noteHitCtx = (pxPerUnit: number): HitContext => ({
  zones: { sTowRearMax: 0.12, sSpinMin: 0.32, sTowFrontMin: 0.85, grabPadPx: 10 },
  pxPerUnit,
  pointerType: 'touch',
  selectedChairId: null,
  selectedArrowId: null,
  handlesVisible: false,
  // 2차 패스([A-2])는 선택 도구에서만 돈다 — 여기서 재는 것은 **1차 반경**이라 비-select 도구여야 한다.
  tool: 'note',
});

describe('(a) 빈 메모도 접힌 쪽지로 그려진다', () => {
  it('text:"" 여도 칩 배경 · 접힌 모서리 · 흐린 플레이스홀더가 있다', () => {
    const c = renderNote('');
    expect(c.querySelector('.note-chip')).not.toBeNull();
    expect(c.querySelector('.note-fold')).not.toBeNull();
    expect(c.querySelector('.note-placeholder')?.textContent).toBe(NOTE_PLACEHOLDER);
    // 예전에는 이 값이 '' 였다 — 그게 "탭했는데 아무 일도 안 일어난다" 의 실체다.
    expect(c.textContent).not.toBe('');
  });

  it('빈 칩은 정확히 NOTE.chipMinWPx × NOTE.chipHPx 다', () => {
    const box = chipBox(renderNote(''));
    expect(box.maxX - box.minX).toBeCloseTo(NOTE.chipMinWPx, 9);
    expect(box.maxY - box.minY).toBeCloseTo(NOTE.chipHPx, 9);
    // 앵커(메모의 x,y)가 칩의 한가운데다 — 히트 원의 중심과 같은 점이어야 한다.
    expect(box.minX + box.maxX).toBeCloseTo(0, 9);
    expect(box.minY + box.maxY).toBeCloseTo(0, 9);
  });

  it('글이 있으면 플레이스홀더 대신 글을 쓰고, 칩이 글을 감싸도록 넓어진다', () => {
    const text = '왼쪽 압박';
    const c = renderNote(text);
    expect(c.querySelector('.note-placeholder')).toBeNull();
    expect(c.querySelector('#obj-nt_1 text')?.textContent).toBe(text);
    const box = chipBox(c);
    expect(box.maxX - box.minX).toBeCloseTo(noteChipWidthPx(text, 14), 9);
    expect(box.maxX - box.minX).toBeGreaterThan(NOTE.chipMinWPx);
    // 세로는 상수다 — 히트 반경이 상수라서 그렇다(NOTE 머리말).
    expect(box.maxY - box.minY).toBeCloseTo(NOTE.chipHPx, 9);
  });
});

describe('(b) 선택 링 — 5종 개체 중 메모만 빠져 있었다', () => {
  it('selected=false 면 링이 없다', () => {
    expect(renderNote('').querySelector('.sel-ring')).toBeNull();
  });

  it('selected=true 면 ChairChip·BallDot·ConeMark 와 같은 2겹 링이 r=NOTE.ringRadiusPx 로 그려진다', () => {
    const ring = renderNote('', true).querySelector('.sel-ring')!;
    const circles = Array.from(ring.querySelectorAll('circle'));
    expect(circles).toHaveLength(2); // 어두운 밑선 + 액센트 파선(한 겹이면 개체 색과 겹쳐 사라진다)
    for (const el of circles) expect(el.getAttribute('r')).toBe(String(NOTE.ringRadiusPx));
    expect(circles[1]!.getAttribute('stroke')).toBe('var(--accent)');
  });

  it('글이 길어져도 링은 앵커 기준 같은 원이다 — SelectionOverlay 의 note 링과 어긋나면 안 된다', () => {
    const ring = renderNote('아주 긴 메모입니다', true).querySelector('.sel-ring')!;
    for (const el of Array.from(ring.querySelectorAll('circle'))) {
      expect(el.getAttribute('r')).toBe(String(NOTE.ringRadiusPx));
      expect(el.getAttribute('cx')).toBe('0');
    }
  });
});

describe('(d) 히트 반경 ↔ 시각 크기 정합', () => {
  it('그려진 빈 쪽지의 **네 꼭짓점**이 전 배율에서 1차 히트 원 안이다', () => {
    const box = chipBox(renderNote(''));
    const corners = [
      { x: box.minX, y: box.minY },
      { x: box.maxX, y: box.minY },
      { x: box.minX, y: box.maxY },
      { x: box.maxX, y: box.maxY },
    ];
    for (const s of SCALES) {
      for (const c of corners) {
        const tap = { x: NOTE_AT.x + c.x, y: NOTE_AT.y + c.y };
        expect(hitTest(tap, scene, noteHitCtx(s))).toEqual({ kind: 'note', id });
      }
    }
  });

  it('그 꼭짓점 거리(=칩 외접원)가 곧 NOTE.hitRadiusPx 다 — 히트가 칩보다 작아질 수 없다', () => {
    const box = chipBox(renderNote(''));
    const circum = Math.hypot((box.maxX - box.minX) / 2, (box.maxY - box.minY) / 2);
    expect(circum).toBeCloseTo(NOTE.hitRadiusPx, 9);
  });

  it('선택 링(22) = 히트 상한이고, 칩 외접원(20)보다 크다 — 링 안은 다 잡히고 링 밖은 안 잡힌다', () => {
    expect(HIT_R_MAX_PX.note).toBe(NOTE.ringRadiusPx);
    expect(NOTE.ringRadiusPx).toBeGreaterThan(NOTE.hitRadiusPx);
    for (const s of SCALES) {
      // 링 바로 안 = 잡힌다. 링 바로 밖 = 안 잡힌다(상한이 링과 같은 값이므로).
      expect(hitTest({ x: NOTE_AT.x + NOTE.ringRadiusPx - 0.5, y: NOTE_AT.y }, scene, noteHitCtx(s))).toEqual({ kind: 'note', id });
      expect(hitTest({ x: NOTE_AT.x + NOTE.ringRadiusPx + 0.5, y: NOTE_AT.y }, scene, noteHitCtx(s))).toBeNull();
    }
  });

  it('예전의 자기 반지름 0 이었다면 s=1.675 에서 칩 안쪽조차 빗나갔다 — 회귀 감시', () => {
    // 옛 반경 = min(0 + 6/s, 22) = 3.58. 칩 오른쪽 끝(16)은 물론 세로 끝(12)도 밖이었다.
    const s = 1.675;
    const oldR = Math.min(0 + 6 / s, HIT_R_MAX_PX.note);
    expect(oldR).toBeLessThan(NOTE.chipHPx / 2);
    expect(hitTest({ x: NOTE_AT.x, y: NOTE_AT.y + NOTE.chipHPx / 2 }, scene, noteHitCtx(s))).toEqual({ kind: 'note', id });
  });
});
