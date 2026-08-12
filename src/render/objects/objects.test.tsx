// §10.7 개별 오브젝트 컴포넌트 스모크 — writer 등록/해지, 시각 계약(§3.4/§6.6)의 핵심만 확인한다.
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

describe('ChairChip', () => {
  it('§3.4 마크업대로 rect(-7.5,-12.5,37.5,25)·볼가드·머리 원을 그린다', () => {
    const writer = createTransformWriter();
    const { container } = render(
      <svg>
        <ChairChip id={'ch_1' as ChairId} writer={writer} color="#d93a3a" team="home" number="4" selected={false} active={false} ariaLabel="A팀 4번" />
      </svg>,
    );
    const body = container.querySelector(`#obj-ch_1`)!;
    const rect = body.querySelector('rect[x="-7.5"]');
    expect(rect).not.toBeNull();
    expect(rect).toHaveAttribute('width', '37.5');
    expect(rect).toHaveAttribute('height', '25');
    const guard = body.querySelector('rect[x="24.375"]');
    expect(guard).not.toBeNull();
    expect(guard).toHaveAttribute('width', '5.625');
    const head = body.querySelector('circle[r="4.2"]');
    expect(head).not.toBeNull();
    expect(body.querySelector('text')?.textContent).toBe('4');
  });

  it('언마운트 시 writer 에서 register(id,null) 로 해지된다', () => {
    const writer = createTransformWriter();
    writer.write('ch_1', 5, 5, 0);
    const { unmount, container } = render(
      <svg>
        <ChairChip id={'ch_1' as ChairId} writer={writer} color="#d93a3a" team="home" number="4" selected={false} active={false} ariaLabel="A팀 4번" />
      </svg>,
    );
    expect(container.querySelector('#obj-ch_1')?.getAttribute('transform')).toBe('translate(5.00 5.00) rotate(0.00)');
    unmount();
    // 재등록 시 값이 다시 적용되는지로 해지를 간접 확인 — 새 엘리먼트에 register 가 걸린다.
    const el2 = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    writer.register('ch_1', el2);
    expect(el2.getAttribute('transform')).toBe('translate(5.00 5.00) rotate(0.00)');
  });
});

describe('BallDot', () => {
  it('시각 반지름 7px(BALL.viewRadiusPx), fill=BALL_FILL', () => {
    const writer = createTransformWriter();
    const { container } = render(
      <svg>
        <BallDot id={'bl_1' as BallId} writer={writer} selected={false} active={false} ariaLabel="공" />
      </svg>,
    );
    const circle = container.querySelector('#obj-bl_1 circle[r="7"]');
    expect(circle).not.toBeNull();
    expect(circle).toHaveAttribute('fill', '#fbbf24');
  });
});

describe('ConeMark', () => {
  it('슬롯 0 은 삼각형만, 슬롯 1 은 삼각형 + 밑변 사각 베이스를 그린다', () => {
    const writer = createTransformWriter();
    const { container: c0 } = render(
      <svg>
        <ConeMark id={'cn_1' as ConeId} writer={writer} colorIndex={0} selected={false} active={false} ariaLabel="콘" />
      </svg>,
    );
    expect(c0.querySelectorAll('#obj-cn_1 path')).toHaveLength(1);

    const { container: c1 } = render(
      <svg>
        <ConeMark id={'cn_2' as ConeId} writer={writer} colorIndex={1} selected={false} active={false} ariaLabel="콘" />
      </svg>,
    );
    expect(c1.querySelectorAll('#obj-cn_2 path')).toHaveLength(2);
  });
});

describe('NoteLabel', () => {
  it('기본값(size=14, color=#fff, align=middle)을 적용한다', () => {
    const writer = createTransformWriter();
    const { container } = render(
      <svg>
        <NoteLabel id={'nt_1' as NoteId} writer={writer} text="메모입니다" selected={false} active={false} ariaLabel="메모" />
      </svg>,
    );
    const text = container.querySelector('#obj-nt_1 text')!;
    expect(text).toHaveAttribute('font-size', '14');
    expect(text).toHaveAttribute('fill', '#ffffff');
    expect(text).toHaveAttribute('text-anchor', 'middle');
    expect(text.textContent).toBe('메모입니다');
  });
});

describe('ArrowPath', () => {
  it('케이싱(halo) + 본선 + 포커스 링(outer/inner) 을 그리고 marker-end 를 uid 로 조립한다(§6.6/§7.2)', () => {
    const arrow: Arrow = { id: 'ar_1' as ArrowId, kind: 'move', from: { x: 0, y: 0 }, ctrl: { x: 5, y: 0 }, to: { x: 10, y: 0 } };
    const { container } = render(
      <svg>
        <ArrowPath arrow={arrow} markerUid="myuid" selected={false} active={false} />
      </svg>,
    );
    const paths = container.querySelectorAll('#obj-ar_1 path');
    expect(paths).toHaveLength(4); // 케이싱 + 본선 + 포커스 outer + 포커스 inner
    // 케이싱은 불투명 검정이어야 §7.1 이 요구하는 3.93:1 이 실제로 나온다(알파 합성이면 2.75:1 로 미달).
    expect(paths[0]).toHaveAttribute('stroke', '#000000');
    expect(paths[1]).toHaveAttribute('marker-end', 'url(#myuid-38bdf8)');
    // ArrowPath 만 포커스 표시가 없던 결함(§7.2) — 다른 4종처럼 outer/inner 를 붙였는지 확인.
    expect(paths[2]).toHaveClass('focus-ind-outer');
    expect(paths[3]).toHaveClass('focus-ind-inner');
    expect(paths[2]).toHaveAttribute('d', paths[1]!.getAttribute('d'));
  });

  it('pass 화살표는 점선(9 9)을 쓴다', () => {
    const arrow: Arrow = { id: 'ar_2' as ArrowId, kind: 'pass', from: { x: 0, y: 0 }, ctrl: { x: 5, y: 0 }, to: { x: 10, y: 0 } };
    const { container } = render(
      <svg>
        <ArrowPath arrow={arrow} markerUid="uid" selected={false} active={false} />
      </svg>,
    );
    const main = container.querySelectorAll('#obj-ar_2 path')[1]!;
    expect(main).toHaveAttribute('stroke-dasharray', '9 9');
  });
});
