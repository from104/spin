// §3.5(자유 그리기) — 획 모델. 단순화·순환·회전·경로 문자열.
//
// ⚠️ 이 파일의 규율: **값을 베끼지 않는다.** 기대값을 STROKE_WIDTHS 나 ARROW_COLOR_CYCLE 에서
//    파생시키거나 성질(거리 보존·개수·키 유무)로 재고, 리터럴 대조는 그 상수가 곧 계약인
//    자리(순환 길이 3 같은 것)에만 쓴다. 검사표가 데이터를 베끼면 자기증명이 된다.
import { describe, expect, it } from 'vitest';
import { newId } from '../core/ids.ts';
import type { Vec2 } from '../core/units.ts';
import { ARROW_COLOR_CYCLE, ARROW_ROTATE_GAP_PX, ARROW_STYLE } from './arrow.ts';
import {
  STROKE_MIN_STEP_PX,
  STROKE_ROTATE_GAP_PX,
  STROKE_WIDTHS,
  STROKE_WIDTH_DEFAULT,
  cycleStrokeColor,
  cycleStrokeHead,
  cycleStrokeWidth,
  makeStroke,
  parseStrokePointKey,
  rotateStrokeAbout,
  simplifyPoints,
  strokeCenter,
  strokeColor,
  strokeHandlePoints,
  strokeHeadFrom,
  strokeHeadTo,
  strokePath,
  strokePointKey,
  strokeWidthIndexOf,
  strokeWidthOf,
  translateStroke,
  type Stroke,
} from './stroke.ts';

const mk = (pts: Vec2[]): Stroke => makeStroke(newId('fh'), pts);
const line = (n: number, step: number): Vec2[] => Array.from({ length: n }, (_, i) => ({ x: i * step, y: 0 }));

describe('simplifyPoints — RDP + 붙은 표본 제거', () => {
  it('직선 위의 100점은 양 끝 2점으로 줄어든다', () => {
    const out = simplifyPoints(line(100, 5));
    expect(out).toHaveLength(2);
    // 남은 둘이 **양 끝**이라는 것까지가 계약이다 — 아무 2점이나 남기면 획이 다른 선이 된다.
    expect(out[0]).toEqual({ x: 0, y: 0 });
    expect(out[1]).toEqual({ x: 99 * 5, y: 0 });
  });

  it('꺾인 자리는 살아남는다 — ㄱ 자는 3점이다(단순화가 모양을 먹지 않는다)', () => {
    const corner: Vec2[] = [
      ...Array.from({ length: 50 }, (_, i) => ({ x: i * 4, y: 0 })),
      ...Array.from({ length: 50 }, (_, i) => ({ x: 49 * 4, y: (i + 1) * 4 })),
    ];
    const out = simplifyPoints(corner);
    expect(out).toHaveLength(3);
    expect(out[1]).toEqual({ x: 49 * 4, y: 0 });
  });

  it(`${STROKE_MIN_STEP_PX}px 미만으로 붙은 표본은 버리되 획은 살린다(끝점은 지킨다)`, () => {
    const jitter = Array.from({ length: 40 }, (_, i) => ({ x: i * (STROKE_MIN_STEP_PX / 4), y: 0 }));
    const out = simplifyPoints(jitter);
    expect(out).toHaveLength(2); // 1점으로 접히면 validate 가 획을 통째로 버린다
    expect(out[1]).toEqual(jitter[jitter.length - 1]);
  });

  it('허용 오차가 클수록 점이 덜 남는다 — ε 가 실제로 쓰인다', () => {
    // 진폭 3px 의 톱니. ε 1.5 는 이빨을 살리고, ε 10 은 통째로 접는다.
    const saw = Array.from({ length: 41 }, (_, i) => ({ x: i * 4, y: i % 2 === 0 ? 0 : 3 }));
    expect(simplifyPoints(saw, 1.5).length).toBeGreaterThan(simplifyPoints(saw, 10).length);
    expect(simplifyPoints(saw, 10)).toHaveLength(2);
  });

  it('빈 입력은 빈 결과다(throw 하지 않는다)', () => {
    expect(simplifyPoints([])).toEqual([]);
  });
});

describe('굵기 순환 — 3단, 기본으로 돌아오면 키 삭제', () => {
  it('세 바퀴면 처음으로 돌아오고 그때 width 키가 없다', () => {
    const s0 = mk(line(3, 10));
    expect('width' in s0).toBe(false);

    const seen: number[] = [strokeWidthIndexOf(s0)];
    let s = s0;
    for (let i = 0; i < STROKE_WIDTHS.length - 1; i += 1) {
      s = cycleStrokeWidth(s);
      expect('width' in s).toBe(true); // 기본이 아닌 동안에는 키가 있다
      seen.push(strokeWidthIndexOf(s));
    }
    s = cycleStrokeWidth(s);
    // ⚠️ 한 바퀴를 돌면 **키를 지운다** — 남겨 두면 나중에 기본 굵기를 옮긴 날
    //    "기본으로 되돌려 둔" 획만 옛 굵기로 남는다.
    expect('width' in s).toBe(false);
    expect(strokeWidthIndexOf(s)).toBe(STROKE_WIDTH_DEFAULT);
    // 한 바퀴에 세 단계를 **빠짐없이** 지난다.
    expect([...seen].sort()).toEqual(STROKE_WIDTHS.map((_, i) => i));
  });

  it('기본 굵기는 화살표의 선 굵기와 같은 값이다', () => {
    // 화살표 옆에 그은 획이 같은 선으로 보여야 한다. 리터럴이 아니라 두 상수를 맞댄다.
    expect(strokeWidthOf(mk(line(2, 10)))).toBe(ARROW_STYLE.width);
    expect(STROKE_WIDTHS[STROKE_WIDTH_DEFAULT]).toBe(ARROW_STYLE.width);
  });

  it('굵기가 커지는 순서다 — 인덱스는 굵기의 순서를 뜻한다', () => {
    const sorted = [...STROKE_WIDTHS].sort((a, b) => a - b);
    expect(sorted).toEqual([...STROKE_WIDTHS]);
  });
});

describe('화살촉 순환 — 양 끝이 각자 돈다', () => {
  it('세 번 누르면 제자리, 그때 키가 없다', () => {
    let s = mk(line(3, 10));
    expect(strokeHeadTo(s)).toBe('none'); // ⚠️ 화살표(기본 'thin')와 다른 기본값이다
    s = cycleStrokeHead(s, 'to');
    expect(strokeHeadTo(s)).toBe('thin');
    s = cycleStrokeHead(s, 'to');
    expect(strokeHeadTo(s)).toBe('wide');
    s = cycleStrokeHead(s, 'to');
    expect(strokeHeadTo(s)).toBe('none');
    expect('headTo' in s).toBe(false);
  });

  it('한쪽을 돌려도 반대쪽은 그대로다', () => {
    const s = cycleStrokeHead(mk(line(3, 10)), 'from');
    expect(strokeHeadFrom(s)).toBe('thin');
    expect(strokeHeadTo(s)).toBe('none');
    expect('headTo' in s).toBe(false);
  });
});

describe('색 순환 — 화살표와 같은 팔레트', () => {
  it('팔레트를 한 바퀴 돌면 color 키가 사라진다', () => {
    let s = mk(line(3, 10));
    const seen = new Set<string>([strokeColor(s)]);
    for (let i = 0; i < ARROW_COLOR_CYCLE.length - 1; i += 1) {
      s = cycleStrokeColor(s);
      expect('color' in s).toBe(true);
      seen.add(strokeColor(s));
    }
    expect(seen.size).toBe(ARROW_COLOR_CYCLE.length); // 겹치는 색 없이 전부 지난다
    s = cycleStrokeColor(s);
    expect('color' in s).toBe(false);
    expect(strokeColor(s)).toBe(ARROW_STYLE.color);
  });
});

describe('회전 — 중심을 지키고 모양을 지킨다', () => {
  const base = mk([
    { x: 100, y: 100 },
    { x: 200, y: 100 },
    { x: 200, y: 160 },
  ]);

  it('축까지의 거리가 모든 점에서 보존된다', () => {
    const c = strokeCenter(base);
    const r = rotateStrokeAbout(base, c, 0.7);
    base.points.forEach((p, i) => {
      const q = r.points[i]!;
      expect(Math.hypot(q.x - c.x, q.y - c.y)).toBeCloseTo(Math.hypot(p.x - c.x, p.y - c.y), 9);
    });
  });

  it('직각 네 번이면 제자리다(누적 오차가 아니라 정말 한 바퀴다)', () => {
    const c = strokeCenter(base);
    let r = base;
    for (let i = 0; i < 4; i += 1) r = rotateStrokeAbout(r, c, Math.PI / 2);
    base.points.forEach((p, i) => {
      expect(r.points[i]!.x).toBeCloseTo(p.x, 9);
      expect(r.points[i]!.y).toBeCloseTo(p.y, 9);
    });
  });

  it('축 위의 점은 움직이지 않는다', () => {
    const c: Vec2 = { x: 50, y: 50 };
    const s = mk([c, { x: 90, y: 50 }]);
    const r = rotateStrokeAbout(s, c, 1.234);
    expect(r.points[0]!.x).toBeCloseTo(c.x, 9);
    expect(r.points[0]!.y).toBeCloseTo(c.y, 9);
    expect(r.points[1]).not.toEqual(s.points[1]); // 대조군 — 나머지는 실제로 돈다
  });

  it('색·굵기·화살촉은 회전으로 바뀌지 않는다(모양만 도는 조작이다)', () => {
    const styled = cycleStrokeWidth(cycleStrokeColor(cycleStrokeHead(base, 'to')));
    const r = rotateStrokeAbout(styled, strokeCenter(styled), 0.4);
    expect(r.color).toBe(styled.color);
    expect(r.width).toBe(styled.width);
    expect(r.headTo).toBe(styled.headTo);
  });
});

describe('평행이동', () => {
  it('모든 점이 같은 델타만큼 움직인다', () => {
    const s = mk(line(5, 10));
    const t = translateStroke(s, { x: 7, y: -3 });
    s.points.forEach((p, i) => {
      expect(t.points[i]).toEqual({ x: p.x + 7, y: p.y - 3 });
    });
  });

  it('델타가 0 이면 같은 참조다 — 되돌리기에 빈 칸이 쌓이지 않는다', () => {
    const s = mk(line(5, 10));
    expect(translateStroke(s, { x: 0, y: 0 })).toBe(s);
  });
});

describe('strokePath — 경로 문자열 형식', () => {
  it('점 2개면 직선이다', () => {
    const d = strokePath(mk([{ x: 0, y: 0 }, { x: 10, y: 20 }]));
    expect(d).toBe('M0,0 L10,20');
  });

  it('점 3개 이상이면 M + (점수-1)개의 3차 베지에다', () => {
    const n = 6;
    const d = strokePath(mk(line(n, 10)));
    expect(d.startsWith('M')).toBe(true);
    expect(d.match(/C/g) ?? []).toHaveLength(n - 1);
    expect(d).not.toContain('L');
  });

  it('좌표는 0.01 로 반올림한다 — 트윈 종점과 렌더 결과가 한 글자도 안 어긋나게', () => {
    const d = strokePath(mk([{ x: 1.234567, y: 2.005 }, { x: 3, y: 4 }]));
    expect(d).toBe('M1.23,2.01 L3,4');
  });

  it('빈 획은 빈 문자열이다(throw 하지 않는다)', () => {
    expect(strokePath({ points: [] })).toBe('');
  });
});

describe('앵커 셋 — 양 끝 + 회전', () => {
  it('from/to 는 첫 점과 끝 점이다', () => {
    const pts = line(5, 12);
    const h = strokeHandlePoints(mk(pts));
    expect(h.from).toEqual(pts[0]);
    expect(h.to).toEqual(pts[pts.length - 1]);
  });

  it('회전 앵커는 끝점에서 간격만큼, 끝 접선을 **연장한** 쪽에 앉는다', () => {
    const pts = line(5, 12); // +x 방향으로 간다
    const h = strokeHandlePoints(mk(pts));
    expect(Math.hypot(h.rotate.x - h.to.x, h.rotate.y - h.to.y)).toBeCloseTo(STROKE_ROTATE_GAP_PX, 9);
    expect(h.rotate.x).toBeGreaterThan(h.to.x); // 획 뒤쪽이 아니라 앞쪽 — 획과 겹치지 않는 자리다
    expect(h.rotate.y).toBeCloseTo(h.to.y, 9);
  });

  it('간격은 화살표의 것과 같은 값이다(손이 자리를 두 벌 외우지 않게)', () => {
    expect(STROKE_ROTATE_GAP_PX).toBe(ARROW_ROTATE_GAP_PX);
  });

  it('퇴화(모든 점이 같은 자리)면 위로 눕는다 — 화살표의 퇴화 처리와 같은 방향', () => {
    const h = strokeHandlePoints({ points: [{ x: 5, y: 5 }, { x: 5, y: 5 }] });
    expect(h.rotate).toEqual({ x: 5, y: 5 - STROKE_ROTATE_GAP_PX });
  });
});

describe('트윈 프레임 키 — 점 수가 키에 들어간다', () => {
  it('왕복한다', () => {
    const id = newId('fh');
    expect(parseStrokePointKey(strokePointKey(id, 12, 5))).toEqual({ id, count: 12, index: 5 });
  });

  it('점 수가 다르면 키가 겹치지 않는다 — 그것이 곧 "스냅" 정책이다', () => {
    const id = newId('fh');
    expect(strokePointKey(id, 5, 0)).not.toBe(strokePointKey(id, 12, 0));
  });

  it('획이 아닌 키는 거절한다', () => {
    expect(parseStrokePointKey('ar_abc@from')).toBeNull();
    expect(parseStrokePointKey(newId('fh'))).toBeNull();
    expect(parseStrokePointKey(strokePointKey(newId('fh'), 3, 3))).toBeNull(); // 첨자가 범위 밖
  });
});
