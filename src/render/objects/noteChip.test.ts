// 메모 줄바꿈의 기하 (기현 지시 2026-08-17: *"메모 표시나 편집에 줄바꿈 가능하게"*).
//
// 이 파일이 지키는 것은 셋이다.
//  ① **한 줄이면 예전 그대로다.** 줄바꿈이 없는 메모의 칩은 2026-08-17 이전과 한 픽셀도 달라선
//     안 된다 — 이미 저장된 드릴 수백 개가 전부 한 줄짜리 메모다.
//  ② **칩이 무한히 커지지 않는다.** 히트 판정이 칩 상자를 쓰게 된 순간(hitTest 의 notes),
//     "폭 8000 px 짜리 쪽지" 는 그리기 사고가 아니라 **코트의 모든 탭을 삼키는** 사고가 된다.
//  ③ **줄 나눔의 출처가 하나다.** 화면·인쇄·시연·내보내기가 같은 배열을 보지 않으면 종이가
//     화면보다 한 줄 적게 나오고, 그러면 코치는 종이를 못 믿는다.
import { describe, expect, it } from 'vitest';
import { NOTE } from '../../core/constants.ts';
import {
  NOTE_DEFAULT_SIZE_PX,
  noteChipHeightPx,
  noteChipWidthPx,
  noteLineDy,
  noteLineHeightPx,
  noteLines,
  noteRingRadiusPx,
} from './noteChip.ts';

const S = NOTE_DEFAULT_SIZE_PX;

describe('줄 나누기', () => {
  it('빈 글은 줄이 없다 — 플레이스홀더는 호출부가 얹는다', () => {
    expect(noteLines('', S)).toEqual([]);
  });

  it('\\n 이 곧 줄이다', () => {
    expect(noteLines('앞선 압박\n오른쪽 전환', S)).toEqual(['앞선 압박', '오른쪽 전환']);
  });

  it('빈 줄도 한 줄이다 — 문단 사이를 띄우려고 친 Enter 를 삼키지 않는다', () => {
    expect(noteLines('가\n\n나', S)).toEqual(['가', '', '나']);
  });

  it('폭 상한을 넘는 한 줄은 스스로 접힌다', () => {
    const long = '가'.repeat(60);
    const lines = noteLines(long, S);
    expect(lines.length).toBeGreaterThan(1);
    // 접고 나면 칩은 상한 안이다 — 이것이 없으면 히트 상자가 코트를 덮는다.
    expect(noteChipWidthPx(long, S)).toBeLessThanOrEqual(NOTE.chipMaxWPx);
  });

  it('띄어쓰기가 있으면 낱말을 안 쪼갠다', () => {
    // 라틴 문자만으로 상한을 넘겨 접기를 유도한다(한국어는 띄어쓰기가 드물어 글자 끊기가 정상 경로).
    const lines = noteLines('press press press press press press press press press', S);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(line).not.toMatch(/^ress|pres$/);
  });

  it('줄 수 상한을 넘으면 마지막 줄에 … 를 붙여 알린다 — 글을 버리지는 않는다', () => {
    const many = Array.from({ length: NOTE.maxLines + 4 }, (_, i) => `줄${i}`).join('\n');
    const lines = noteLines(many, S);
    expect(lines).toHaveLength(NOTE.maxLines);
    expect(lines[NOTE.maxLines - 1]).toMatch(/…$/);
  });
});

describe('칩 크기', () => {
  it('빈 메모는 정확히 32×24 다', () => {
    expect(noteChipWidthPx('', S)).toBe(NOTE.chipMinWPx);
    expect(noteChipHeightPx('', S)).toBe(NOTE.chipHPx);
  });

  it('한 줄짜리 글의 세로는 여전히 chipHPx 다 — 줄바꿈 이전과 같다는 약속', () => {
    expect(noteChipHeightPx('왼쪽 압박', S)).toBe(NOTE.chipHPx);
  });

  it('줄이 하나 늘 때마다 lineHPx 만큼만 자란다', () => {
    expect(noteChipHeightPx('가\n나', S)).toBe(NOTE.chipHPx + NOTE.lineHPx);
    expect(noteChipHeightPx('가\n나\n다', S)).toBe(NOTE.chipHPx + 2 * NOTE.lineHPx);
  });

  it('가로는 **가장 긴 줄**이 정한다 — 줄들의 합이 아니다', () => {
    const wide = noteChipWidthPx('가나다라마', S);
    expect(noteChipWidthPx('가\n가나다라마\n가', S)).toBe(wide);
  });

  it('세로도 상한이 있다 — maxLines 를 넘겨도 더 자라지 않는다', () => {
    const many = '줄\n'.repeat(NOTE.maxLines + 10);
    expect(noteChipHeightPx(many, S)).toBe(NOTE.chipHPx + (NOTE.maxLines - 1) * NOTE.lineHPx);
  });
});

describe('줄의 자리', () => {
  it('한 줄은 앵커 한가운데다', () => {
    expect(noteLineDy(0, 1, S)).toBe(0);
  });

  it('여러 줄은 앵커를 가운데 두고 위아래로 갈라진다 — 줄이 늘어도 자리가 안 튄다', () => {
    expect(noteLineDy(0, 2, S)).toBeCloseTo(-NOTE.lineHPx / 2, 9);
    expect(noteLineDy(1, 2, S)).toBeCloseTo(+NOTE.lineHPx / 2, 9);
    expect(noteLineDy(0, 3, S) + noteLineDy(2, 3, S)).toBeCloseTo(0, 9);
    expect(noteLineDy(1, 3, S)).toBe(0);
  });

  // §0.5 미배송 빚(2026-08-20) — size 입력 UI가 생기며 줄 간격이 size 비례가 됐다.
  // 기본 size(S=14)에서는 위 테스트들이 이미 "NOTE.lineHPx(18)와 같다"를 증명한다 — 여기서는
  // 그 비례 관계 자체(18/14 비율 유지)를 다른 size 로 확인한다.
  it('줄 간격은 size 에 비례한다 — 기본 size 의 2배면 간격도 2배', () => {
    expect(noteLineHeightPx(S * 2)).toBeCloseTo(NOTE.lineHPx * 2, 9);
    expect(noteLineDy(0, 2, S * 2)).toBeCloseTo(-NOTE.lineHPx, 9);
  });
});

describe('선택 링', () => {
  it('빈 메모는 예전 상수 그대로 22 다', () => {
    expect(noteRingRadiusPx('', S)).toBe(NOTE.ringRadiusPx);
  });

  it('칩이 원을 넘어서면 링이 칩을 감싸도록 커진다', () => {
    const text = '앞선 압박\n오른쪽 전환\n골키퍼는 앞으로';
    const r = noteRingRadiusPx(text, S);
    const halfW = noteChipWidthPx(text, S) / 2;
    const halfH = noteChipHeightPx(text, S) / 2;
    // 칩의 꼭짓점까지 링 안이다 — 링이 "무엇이 선택됐는지" 를 실제로 그린다는 뜻.
    expect(r).toBeGreaterThanOrEqual(Math.hypot(halfW, halfH));
  });
});
