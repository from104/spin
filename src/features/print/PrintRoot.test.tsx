// §6.3 인쇄 **시점** 계약. 종이가 백지로 나오는 사고는 조용하다 — 예외도 경고도 없다.
// jsdom 의 window.print 는 no-op 이라 "무엇이 인쇄되는가" 는 여기서 반증할 수 없다.
// 반증할 수 있는 것은 **언제 부르고 언제 안 부르는가**이고, 그것이 이 파일 전부다.
import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { createDrill } from '../../model/defaults.ts';
import type { Drill, DrillStep } from '../../model/drill.ts';
import { PrintRoot } from './PrintRoot.tsx';
import { printWhenReady } from './printWhenReady.ts';
import type { PrintDoc } from './printDoc.ts';

function drillOf(n: number): Drill {
  const base = createDrill({ courtMode: 'full', formation: '1-2-1' });
  const step0 = base.steps[0]!;
  const steps: DrillStep[] = Array.from({ length: n }, (_, i) => ({ ...step0, id: `${step0.id}_${i}` as DrillStep['id'] }));
  return { ...base, steps };
}
const docOf = (n: number): PrintDoc => ({ kind: 'drill', drill: drillOf(n) });

describe('PrintRoot — 문서가 없으면 아무것도 없다', () => {
  it('doc 이 null 이면 인쇄 트리 자체가 DOM 에 없다', () => {
    render(<PrintRoot doc={null} />);
    expect(document.querySelector('[data-print-root]')).toBeNull();
    expect(document.querySelectorAll('[data-print-page]')).toHaveLength(0);
  });

  it('doc 이 있으면 body 포털로 붙는다 — #root 안이 아니다 (인쇄 시 #root 는 접힌다)', () => {
    const { container } = render(<PrintRoot doc={docOf(3)} />);
    const root = document.querySelector('[data-print-root]');
    expect(root).not.toBeNull();
    expect(container.contains(root)).toBe(false);
    expect(document.querySelectorAll('[data-print-page]')).toHaveLength(3);
  });
});

describe('printWhenReady — 0장이면 부르지 않는다', () => {
  it('대조군: 인쇄 트리가 없으면 print() 를 부르지 않고 false 를 준다', () => {
    const print = vi.fn();
    render(<PrintRoot doc={null} />);
    expect(printWhenReady({ win: { print } })).toBe(false);
    expect(print).not.toHaveBeenCalled();
  });

  it('트리가 있으면 정확히 1회 부른다', () => {
    const print = vi.fn();
    render(<PrintRoot doc={docOf(2)} />);
    expect(printWhenReady({ win: { print } })).toBe(true);
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('기본 인자는 진짜 window.print 다 — 주입이 없으면 아무 일도 안 하는 함수가 되면 안 된다', () => {
    const spy = vi.spyOn(window, 'print').mockImplementation(() => {});
    render(<PrintRoot doc={docOf(1)} />);
    expect(printWhenReady()).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

describe('onReady — 페이지가 DOM 에 붙은 **뒤**에 부른다', () => {
  it('★ onReady 안에서 이미 페이지가 세어진다 (여기서 print() 를 불러도 백지가 아니다)', () => {
    let pagesAtCall = -1;
    render(<PrintRoot doc={docOf(4)} onReady={() => { pagesAtCall = document.querySelectorAll('[data-print-page]').length; }} />);
    // -1 이면 아예 안 불렸다는 뜻이고, 0 이면 붙기 전에 불렸다는 뜻이다. 둘 다 백지 사고다.
    expect(pagesAtCall).toBe(4);
  });

  it('문서당 1회다 — 같은 doc 으로 다시 렌더해도 두 번 인쇄되지 않는다', () => {
    const onReady = vi.fn();
    const doc = docOf(2);
    const { rerender } = render(<PrintRoot doc={doc} onReady={onReady} />);
    rerender(<PrintRoot doc={doc} onReady={onReady} />);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('⚠️ StrictMode 의 effect 2회 실행에도 1회다 — 개발 모드에서 대화상자가 두 번 뜨면 안 된다', () => {
    const onReady = vi.fn();
    render(
      <StrictMode>
        <PrintRoot doc={docOf(2)} onReady={onReady} />
      </StrictMode>,
    );
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('닫았다가 다시 열면 또 부른다 — 한 번 쓰고 죽는 가드가 아니다', () => {
    const onReady = vi.fn();
    const doc = docOf(1);
    const { rerender } = render(<PrintRoot doc={doc} onReady={onReady} />);
    rerender(<PrintRoot doc={null} onReady={onReady} />);
    rerender(<PrintRoot doc={doc} onReady={onReady} />);
    expect(onReady).toHaveBeenCalledTimes(2);
  });
});
