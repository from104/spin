// 4.4 PNG — 글자 배치(★A-9 로 SVG 밖으로 뺀 절반)와 출력 크기(★A-10).
// SVG 쪽 가드가 "글자가 0개다" 를 말한다면, 이 파일은 "그 글자들이 **어디로 갔는지**" 를 말한다.
// 둘 중 하나만 있으면 "글자를 통째로 잃어버린 구현" 이 초록불이 된다.
import { describe, expect, it } from 'vitest';
import { CHAIR, NOTE } from '../../core/constants.ts';
import { inkFor } from '../../core/colors.ts';
import { COURT_DEFS } from '../../model/court.ts';
import { pointAtLever } from '../../model/chair.ts';
import { noteChipWidthPx } from '../../render/objects/noteChip.ts';
import {
  buildTextPlacements,
  canvasAlignFor,
  captionSubText,
  EXPORT_LAYOUT,
  fontCssFor,
  FONT_STACKS,
  noteHalfWidth,
  staticSceneMetrics,
  textToOutputPx,
  type TextPlacement,
} from './staticSceneLayout.ts';
import { makeFrame, TEAMS } from './sceneFixture.ts';

const OPTS = { mode: 'full' as const, teams: TEAMS };
const numbersOf = (ts: TextPlacement[]): TextPlacement[] => ts.filter((t) => t.font === 'number');

describe('buildTextPlacements — 등번호', () => {
  it('칩마다 하나씩, 글자는 def.number 그대로다 (골키퍼는 G)', () => {
    const ts = numbersOf(buildTextPlacements(makeFrame(), OPTS));
    expect(ts).toHaveLength(8);
    expect(ts.map((t) => t.text).sort()).toEqual(['2', '2', '3', '3', '4', '4', 'G', 'G']);
    // 대조군: 칩이 0대면 등번호도 0개다("무엇을 넣어도 8개" 가 아니다).
    expect(numbersOf(buildTextPlacements(makeFrame({ chairs: [] }), OPTS))).toHaveLength(0);
  });

  it('중심은 피벗이 아니라 pointAtLever(centroidOffsetPx) 다 — ChairChip 과 같은 식', () => {
    const f = makeFrame();
    f.chairs = [{ ...f.chairs[0]!, x: 200, y: 300, theta: Math.PI / 2 }];
    const t = numbersOf(buildTextPlacements(f, OPTS))[0]!;
    const want = pointAtLever({ x: 200, y: 300, theta: Math.PI / 2 }, CHAIR.centroidOffsetPx);
    expect(t.x).toBeCloseTo(want.x, 6);
    expect(t.y).toBeCloseTo(want.y, 6);
    // 대조군: 피벗 그대로가 아니다 — 90° 로 세운 칩은 아래로 11.25 px 내려간 자리에 글자가 있다.
    expect(t.y).toBeCloseTo(300 + CHAIR.centroidOffsetPx, 6);
    expect(t.x).toBeCloseTo(200, 6);
  });

  it('차체가 돌아도 글자는 돌지 않는다 — 배치에 회전 정보가 아예 없다(§3.4)', () => {
    const a = numbersOf(buildTextPlacements(makeFrame(), OPTS))[0]!;
    expect(Object.keys(a)).not.toContain('rotation');
    expect(Object.keys(a)).not.toContain('theta');
  });

  it('글자색은 배경 밝기에서 나온다 (골키퍼 노랑 위에는 어두운 잉크)', () => {
    const ts = numbersOf(buildTextPlacements(makeFrame(), OPTS));
    const gkHome = ts.find((t) => t.color === inkFor(TEAMS.home.gkColor))!;
    expect(gkHome).toBeDefined();
    expect(gkHome.color).toBe('#14200a');
    // 대조군: 필드 플레이어(붉은색)는 흰 글자다.
    expect(ts.some((t) => t.color === '#ffffff')).toBe(true);
  });

  it('opacity 는 칩의 opacity 를 따른다 (퇴장 프레임에서 글자만 남지 않는다)', () => {
    const f = makeFrame();
    f.chairs[0]!.opacity = 0.4;
    f.chairs[1]!.opacity = 0;
    const ts = numbersOf(buildTextPlacements(f, OPTS));
    expect(ts).toHaveLength(7);
    expect(ts.some((t) => t.opacity === 0.4)).toBe(true);
  });
});

describe('buildTextPlacements — 메모', () => {
  it('빈 메모는 글자를 만들지 않는다 (플레이스홀더 "메모" 는 앱의 안내문이다)', () => {
    const ts = buildTextPlacements(makeFrame(), OPTS).filter((t) => t.font === 'body');
    expect(ts).toHaveLength(1);
    expect(ts[0]!.text).toBe('왼쪽으로 전환');
    expect(ts.some((t) => t.text === NOTE_PLACEHOLDER_TEXT)).toBe(false);
    // 대조군: 글이 있으면 나온다 — "메모는 원래 안 나온다" 가 아니다.
    const two = makeFrame();
    two.notes[1]!.text = '뒤로';
    expect(buildTextPlacements(two, OPTS).filter((t) => t.font === 'body')).toHaveLength(2);
  });

  it('align 이 앵커 기준 칩 위치이기도 하다 — NoteLabel 과 같은 x 오프셋', () => {
    const f = makeFrame();
    f.notes = [{ ...f.notes[0]!, x: 100, y: 200, align: 'start' }];
    const t = buildTextPlacements(f, OPTS)[8]!;
    const halfW = noteChipWidthPx('왼쪽으로 전환', 14) / 2;
    expect(t.x).toBeCloseTo(100 - halfW + NOTE.chipPadXPx, 6);
    expect(t.align).toBe('start');
    // 대조군: middle 이면 앵커 그대로다.
    const g = makeFrame();
    g.notes = [{ ...g.notes[0]!, x: 100, y: 200 }];
    expect(buildTextPlacements(g, OPTS)[8]!.x).toBe(100);
  });

  it('칩 폭의 출처가 render/objects/noteChip.ts 하나다', () => {
    expect(noteHalfWidth('가나다', 14)).toBe(noteChipWidthPx('가나다', 14) / 2);
    // 대조군: 글이 길면 실제로 넓어진다(상수를 돌려주는 게 아니다).
    expect(noteHalfWidth('가나다라마바사아자차', 14)).toBeGreaterThan(noteHalfWidth('가', 14));
  });

  it('수상한 색은 기본 흰색으로 접는다', () => {
    const f = makeFrame();
    f.notes[0]!.color = 'red"/><script/>';
    expect(buildTextPlacements(f, OPTS).find((t) => t.font === 'body')!.color).toBe('#ffffff');
  });
});

describe('buildTextPlacements — 캡션', () => {
  const cap = { title: '전환 훈련', stepIndex: 2, stepCount: 7, stepName: '왼쪽 전환' };

  it('캡션이 없으면 캡션 글자도 없다', () => {
    const ts = buildTextPlacements(makeFrame(), OPTS);
    expect(ts).toHaveLength(9); // 등번호 8 + 메모 1
    expect(buildTextPlacements(makeFrame(), { ...OPTS, caption: cap })).toHaveLength(11);
  });

  it('제목과 "n/N · 스텝 이름" 두 줄이 코트 아래 띠 안에 있다', () => {
    const ts = buildTextPlacements(makeFrame(), { ...OPTS, caption: cap });
    const [title, sub] = ts.slice(-2) as [TextPlacement, TextPlacement];
    expect(title.text).toBe('전환 훈련');
    expect(sub.text).toBe('3/7 · 왼쪽 전환');
    const top = COURT_DEFS.full.vbH;
    for (const t of [title, sub]) {
      expect(t.y).toBeGreaterThan(top);
      expect(t.y).toBeLessThan(top + EXPORT_LAYOUT.captionBandPx);
      expect(t.align).toBe('start');
      expect(t.font).toBe('body'); // 한글이라 Pretendard 여야 한다
    }
  });

  it('스텝 이름이 비면 번호만 찍는다', () => {
    expect(captionSubText({ title: 'x', stepIndex: 0, stepCount: 3, stepName: '' })).toBe('1/3');
    expect(captionSubText({ title: 'x', stepIndex: 0, stepCount: 3, stepName: 'a' })).toBe('1/3 · a');
  });

  it('배경에 따라 캡션 잉크가 뒤집힌다 (투명 위 검은 글자는 사라진다)', () => {
    const white = buildTextPlacements(makeFrame(), { ...OPTS, caption: cap, background: 'white' }).slice(-2);
    const clear = buildTextPlacements(makeFrame(), { ...OPTS, caption: cap, background: 'transparent' }).slice(-2);
    expect(white[0]!.color).toBe('#111827');
    expect(clear[0]!.color).toBe('#ffffff');
    expect(white[0]!.color).not.toBe(clear[0]!.color);
  });
});

describe('staticSceneMetrics — 출력 크기', () => {
  it('긴 변이 어느 코트에서나 baseLongEdgePx × 해상도다', () => {
    for (const mode of ['full', 'half', 'flat'] as const) {
      const m = staticSceneMetrics({ mode, teams: TEAMS, resolution: 2 });
      expect(Math.max(m.widthPx, m.heightPx)).toBe(EXPORT_LAYOUT.baseLongEdgePx * 2);
    }
  });

  it('가로세로 비가 viewBox 와 같다 (1 px 반올림 이내)', () => {
    const m = staticSceneMetrics({ mode: 'half', teams: TEAMS });
    expect(Math.abs(m.widthPx / m.heightPx - m.vbW / m.totalH)).toBeLessThan(0.005);
  });

  it('scale 은 월드 px → 출력 px 배율이다', () => {
    const m = staticSceneMetrics({ mode: 'full', teams: TEAMS, resolution: 1 });
    expect(m.scale).toBeCloseTo(1024 / 825, 9);
    expect(textToOutputPx({ x: 100, y: 50 } as TextPlacement, m.scale)).toEqual({ x: 100 * m.scale, y: 50 * m.scale });
  });
});

describe('캔버스로 넘길 값', () => {
  const p: TextPlacement = { text: '4', x: 0, y: 0, sizePx: 12, weight: 700, color: '#fff', align: 'middle', font: 'number', opacity: 1 };

  it('font 문자열이 굵기·출력 px·글꼴 스택 순서다', () => {
    expect(fontCssFor(p, 2)).toBe(`700 24px ${FONT_STACKS.number}`);
    // 대조군: 배율이 실제로 곱해진다.
    expect(fontCssFor(p, 1)).toBe(`700 12px ${FONT_STACKS.number}`);
  });

  it('한글이 들어갈 수 있는 글자는 Pretendard 스택이다 (Space Grotesk 라틴 서브셋은 글리프가 빈다)', () => {
    expect(FONT_STACKS.body).toContain('Pretendard');
    expect(FONT_STACKS.number).toContain('Space Grotesk');
    expect(fontCssFor({ ...p, font: 'body' }, 1)).toContain('Pretendard');
  });

  it('정렬이 캔버스 textAlign 으로 옮겨진다', () => {
    expect(canvasAlignFor('start')).toBe('left');
    expect(canvasAlignFor('middle')).toBe('center');
    expect(canvasAlignFor('end')).toBe('right');
  });
});

// NoteLabel 이 빈 메모에 얹는 흐린 안내 문구. 여기서 다시 적는 이유는 **그것이 내보낸 그림에
// 없어야 한다** 는 것이 단언이기 때문이다 — 원본을 import 하면 대조가 아니라 동어반복이 된다.
const NOTE_PLACEHOLDER_TEXT = '메모';
