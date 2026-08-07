import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { LiveRegion, liveRegion } from './LiveRegion.tsx';

describe('LiveRegion', () => {
  it('aria-live="polite" aria-atomic="true" 인 sr-only 컨테이너를 렌더링한다', () => {
    const { container } = render(<LiveRegion />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveAttribute('aria-live', 'polite');
    expect(el).toHaveAttribute('aria-atomic', 'true');
    expect(el.className).toBe('sr-only');
  });

  it('say() 는 마운트된 엘리먼트의 textContent 를 즉시 갱신한다(React state 를 거치지 않는다)', () => {
    render(<LiveRegion />);
    liveRegion.say('A팀 3번 · d3 칸');
    // seq 홀짝에 따라 널 폭 공백이 붙을 수 있다(아래 테스트) — 보이는 텍스트만 검증한다.
    expect(liveRegion.el?.textContent?.startsWith('A팀 3번 · d3 칸')).toBe(true);
  });

  it('연속으로 같은 문구를 불러도 매번 textContent 가 실제로 바뀐다(중복 낭독 보장)', () => {
    render(<LiveRegion />);
    liveRegion.say('저장됨');
    const first = liveRegion.el?.textContent;
    liveRegion.say('저장됨');
    const second = liveRegion.el?.textContent;
    expect(first).not.toBe(second);
    // 널 폭 공백만 토글되므로 눈에 보이는 텍스트는 둘 다 '저장됨'으로 시작한다.
    expect(first?.startsWith('저장됨')).toBe(true);
    expect(second?.startsWith('저장됨')).toBe(true);
  });
});
