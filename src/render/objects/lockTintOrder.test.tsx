// 잠김 덮개는 **개체 위에** 그려진다 — 그리는 순서 계약 (기현 신고 2026-08-15:
// *"잠금 표시가 안 된다"*).
//
// ⚠️ **왜 이 파일이 따로 있는가** — 2026-08-14 에 덮개를 넣으면서 테스트는 `.lock-tint` 가
// **있는지**만 봤다. 그래서 초록이었다. 그런데 다섯 개체 모두 덮개가 `<g>` 의 **첫 자식**이라,
// SVG 의 그리기 순서(나중에 그린 것이 위)대로 불투명한 몸통이 덮개를 통째로 가렸다.
// **있는 것과 보이는 것은 다르다** — jsdom 은 픽셀을 안 그리므로, 볼 수 없는 것을 대신
// 재려면 **순서**를 재야 한다. 이 파일이 그 순서를 문다.
//
// 재는 방법: 개체 그룹의 마지막 자식이 덮개여야 한다. `.zone-cursor`(투명·커서 전용,
// "차체의 마지막 자식" 계약이 따로 걸려 있다)만 셈에서 뺀다 — 그것은 아무것도 안 그린다.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { createTransformWriter } from '../transformWriter.ts';
import { ChairChip } from './ChairChip.tsx';
import { BallDot } from './BallDot.tsx';
import { ConeMark } from './ConeMark.tsx';
import { NoteLabel } from './NoteLabel.tsx';
import { ArrowPath } from './ArrowPath.tsx';
import type { ChairId, BallId, ConeId, NoteId, ArrowId } from '../../core/ids.ts';
import type { Arrow } from '../../model/arrow.ts';

const ARROW: Arrow = {
  id: 'ar_1' as ArrowId,
  kind: 'pass',
  from: { x: 100, y: 100 },
  ctrl: { x: 200, y: 120 },
  to: { x: 300, y: 200 },
};

function paintedChildren(g: Element): Element[] {
  return [...g.children].filter((el) => !el.classList.contains('zone-cursor'));
}

/** 잠근 개체를 그리고 "덮개가 맨 나중에 그려지는가" 를 돌려준다. */
function tintIsOnTop(node: React.ReactNode, id: string): { last: string; hasTint: boolean } {
  const { container } = render(<svg>{node}</svg>);
  const g = container.querySelector(`#obj-${id}`)!;
  const kids = paintedChildren(g);
  const last = kids[kids.length - 1]!;
  return {
    last: last.getAttribute('class') ?? last.tagName,
    hasTint: !!g.querySelector('.lock-tint'),
  };
}

describe('잠김 덮개는 개체보다 **뒤에** 그려진다 (= 위에 보인다)', () => {
  const writer = createTransformWriter();

  it('★ 휠체어', () => {
    const r = tintIsOnTop(
      <ChairChip id={'ch_1' as ChairId} writer={writer} color="#d93a3a" team="home" number="4" selected={false} active={false} locked ariaLabel="A팀 4번" />,
      'ch_1',
    );
    expect(r.hasTint, '덮개가 아예 없다').toBe(true);
    expect(r.last, '덮개가 차체 뒤에 없다 — 불투명한 차체가 가려서 화면에는 안 보인다').toBe('lock-tint');
  });

  it('★ 공', () => {
    const r = tintIsOnTop(<BallDot id={'ba_1' as BallId} writer={writer} selected={false} active={false} locked ariaLabel="공" />, 'ba_1');
    expect(r.hasTint).toBe(true);
    expect(r.last).toBe('lock-tint');
  });

  it('★ 콘', () => {
    const r = tintIsOnTop(<ConeMark id={'co_1' as ConeId} writer={writer} colorIndex={0} selected={false} active={false} locked ariaLabel="콘 주황" />, 'co_1');
    expect(r.hasTint).toBe(true);
    expect(r.last).toBe('lock-tint');
  });

  it('★ 메모', () => {
    const r = tintIsOnTop(
      <NoteLabel id={'no_1' as NoteId} writer={writer} text="여기" size={14} color="#fff" align="middle" selected={false} active={false} locked ariaLabel="메모: 여기" />,
      'no_1',
    );
    expect(r.hasTint).toBe(true);
    expect(r.last).toBe('lock-tint');
  });

  it('★ 화살표', () => {
    const r = tintIsOnTop(<ArrowPath arrow={ARROW} markerUid="t" writer={writer} selected={false} active={false} locked />, 'ar_1');
    expect(r.hasTint).toBe(true);
    expect(r.last).toBe('lock-tint');
  });

  it('대조군: 안 잠그면 덮개가 아예 없다 — "언제나 마지막" 이 아니라 "잠갔을 때 마지막" 이다', () => {
    const { container } = render(
      <svg>
        <BallDot id={'ba_2' as BallId} writer={writer} selected={false} active={false} ariaLabel="공" />
      </svg>,
    );
    expect(container.querySelector('.lock-tint')).toBeNull();
  });
});
