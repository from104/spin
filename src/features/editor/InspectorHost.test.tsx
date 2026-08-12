// 2.2 인스펙터 껍데기의 계약 — **포커스 계약 [D-5]**(완료 판정 (d))와 핀 노출 문턱(c),
// 그리고 "핀을 눌러도 재마운트되지 않는다"(b) 를 컴포넌트 단위에서 못박는다.
//
// Esc 우선순위(모달 > 시트 > 선택 해제)는 플래그가 아니라 **이벤트 단계**로 정해진다. 그래서
// 여기서는 소비자 둘을 실제 등록 지점에 세워 두고 확인한다:
//   · 전역 선택 해제(useEditorKeyboard) 대역 = document **버블** 리스너
//   · 모달(ui/Modal) 대역               = document **캡처** 리스너 + stopPropagation
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useCallback, useEffect, useRef, useState } from 'react';
import { InspectorHost } from './InspectorHost.tsx';

/** 인스펙터 자리에 들어가는 대역 — 마운트 횟수와 자기 state 를 함께 들고 있어서
 *  "재마운트되지 않았다" 를 두 방향(횟수 · 상태 보존)으로 볼 수 있다. */
let mounts = 0;
function Probe() {
  const [n, setN] = useState(0);
  useEffect(() => {
    mounts++;
  }, []);
  return (
    <button type="button" onClick={() => setN((v) => v + 1)}>
      센 값 {n}
    </button>
  );
}

interface HarnessProps {
  containerWidthPx?: number;
  edge?: 'bottom' | 'side';
  startPinned?: boolean;
}

function Harness({ containerWidthPx = 1280, edge = 'side', startPinned = false }: HarnessProps) {
  const [open, setOpen] = useState(true);
  const [pinned, setPinned] = useState(startPinned);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  // 프로덕션(EditorWorkspace)과 같은 조건으로 맞춘다 — onClose 가 렌더마다 새 함수면 포커스
  // 이펙트가 매번 다시 돌아 "핀을 눌러도 포커스를 뺏지 않는다" 를 우연히 어기게 된다.
  const close = useCallback(() => setOpen(false), []);
  return (
    <div>
      <button type="button" ref={triggerRef} aria-expanded={open} aria-controls="insp" onClick={() => setOpen(true)}>
        속성
      </button>
      <InspectorHost
        id="insp"
        open={open}
        pinned={pinned}
        containerWidthPx={containerWidthPx}
        edge={edge}
        onClose={close}
        onTogglePin={() => setPinned((v) => !v)}
        returnFocusRef={triggerRef}
      >
        <Probe />
        <input aria-label="드릴 이름" />
      </InspectorHost>
      <button type="button">판 위 버튼</button>
    </div>
  );
}

const panel = () => document.getElementById('insp');

let globalEsc = vi.fn(() => {});
let globalEscListener: (e: KeyboardEvent) => void;
beforeEach(() => {
  mounts = 0;
  // 전역 '선택 해제'(1.7) 자리. 시트가 Esc 를 먹으면 여기까지 오면 안 된다.
  globalEsc = vi.fn();
  globalEscListener = (e: KeyboardEvent) => {
    if (e.key === 'Escape') globalEsc();
  };
  document.addEventListener('keydown', globalEscListener);
});
afterEach(() => {
  document.removeEventListener('keydown', globalEscListener);
});

describe('오버레이 시트 — 비모달 계약 (완료 판정 (d))', () => {
  it('role="dialog" + aria-modal="false" 이고 제목이 이름을 준다', () => {
    render(<Harness />);
    const sheet = screen.getByRole('dialog', { name: '속성' });
    expect(sheet).toBe(panel());
    // 모달이 **아니다**: 판을 덮되 뒤의 코트·트레이는 계속 쓸 수 있어야 한다.
    expect(sheet).toHaveAttribute('aria-modal', 'false');
  });

  it('붙박이(핀)로 바뀌면 다이얼로그가 아니다 — 그냥 자리를 가진 영역이다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: '고정' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(panel()).not.toHaveAttribute('aria-modal');
    // 대조군: 사라진 게 아니라 **자리를 차지하고** 서 있다.
    expect(panel()!.style.width).toBe('312px');
    expect(panel()!.style.position).toBe('');
  });

  it('열리면 제목으로 포커스가 들어간다', () => {
    render(<Harness />);
    expect(screen.getByRole('heading', { name: '속성' })).toHaveFocus();
  });

  it('포커스 트랩이 없다 — 마지막 요소에서 Tab 하면 판으로 나간다', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('textbox', { name: '드릴 이름' }));
    await user.tab();

    // 트랩이 있으면 첫 요소([고정])로 되돌아온다. 나가야 맞다.
    expect(screen.getByRole('button', { name: '판 위 버튼' })).toHaveFocus();
  });
});

describe('Esc 우선순위 — 모달 > 시트 > 선택 해제', () => {
  it('포커스가 시트 안이면 시트가 먹는다 — 선택 해제까지 가지 않는다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByRole('heading', { name: '속성' })).toHaveFocus();

    await user.keyboard('{Escape}');

    expect(panel()).toBeNull();
    expect(globalEsc).not.toHaveBeenCalled();
    // §7.6 — 닫으면 연 트리거로 포커스가 돌아온다.
    expect(screen.getByRole('button', { name: '속성' })).toHaveFocus();
  });

  it('대조군: 포커스가 판이면 시트는 안 닫히고 선택 해제가 발화한다', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: '판 위 버튼' }));
    await user.keyboard('{Escape}');

    expect(panel()).not.toBeNull();
    expect(globalEsc).toHaveBeenCalledTimes(1);
  });

  it('입력 중 Esc 는 먹지 않는다 — IME 조합 취소를 빼앗지 않는다', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('textbox', { name: '드릴 이름' }));
    await user.keyboard('{Escape}');

    expect(panel()).not.toBeNull();
    // useEditorKeyboard 도 editable 을 걸러내므로 선택 해제도 발화하지 않는 것이 맞다.
    // 여기 대역은 걸러내지 않으므로 "시트가 stopPropagation 하지 않았다" 만 본다.
    expect(globalEsc).toHaveBeenCalledTimes(1);
  });

  it('모달이 document 캡처에서 먼저 먹으면 시트는 닫히지 않는다', async () => {
    const user = userEvent.setup();
    const modalEsc = vi.fn();
    const capture = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      modalEsc();
    };
    document.addEventListener('keydown', capture, true);
    try {
      render(<Harness />);
      await user.keyboard('{Escape}');

      expect(modalEsc).toHaveBeenCalledTimes(1);
      expect(panel()).not.toBeNull(); // 도움말을 닫았을 뿐, 속성은 그대로다
      expect(globalEsc).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener('keydown', capture, true);
    }
  });
});

describe('[고정] 핀 (완료 판정 (b)(c))', () => {
  it('컨테이너가 1100 미만이면 핀 버튼이 아예 없다', () => {
    render(<Harness containerWidthPx={1099} />);
    expect(screen.queryByRole('button', { name: '고정' })).toBeNull();
    // 대조군: 문턱을 넘으면 나온다(선택자가 낡아서 못 찾는 것이 아니다).
    render(<Harness containerWidthPx={1100} />);
    expect(screen.getAllByRole('button', { name: '고정' })).toHaveLength(1);
  });

  it('핀 값이 켜져 있어도 좁으면 오버레이로 물러난다 — 폭을 떼어 가지 않는다', () => {
    render(<Harness containerWidthPx={1024} startPinned />);
    expect(panel()!.style.position).toBe('absolute');
    expect(panel()!.style.width).not.toBe('312px');
  });

  it('핀을 눌러도 인스펙터가 재마운트되지 않는다 — 펼침 상태가 살아남는다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /센 값/ }));
    expect(screen.getByRole('button', { name: '센 값 1' })).toBeInTheDocument();
    expect(mounts).toBe(1);

    await user.click(screen.getByRole('button', { name: '고정' })); // 오버레이 → 붙박이
    expect(mounts).toBe(1);
    expect(screen.getByRole('button', { name: '센 값 1' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '고정' })); // 붙박이 → 오버레이
    expect(mounts).toBe(1);
    expect(screen.getByRole('button', { name: '센 값 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '고정' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('대조군: 닫았다 열면 재마운트된다 — 위 단언이 "안 세는 계수기" 로 통과하지 않는다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /센 값/ }));
    expect(mounts).toBe(1);

    await user.click(screen.getByRole('button', { name: '속성 닫기' }));
    await user.click(screen.getByRole('button', { name: '속성' }));

    expect(mounts).toBe(2);
    expect(screen.getByRole('button', { name: '센 값 0' })).toBeInTheDocument();
  });
});

describe('여는 변 — 붙박이가 설 자리에서 미끄러진다', () => {
  it('가로는 오른쪽에서', () => {
    render(<Harness edge="side" />);
    expect(panel()!.style.right).toBe('0px');
    expect(panel()!.style.top).toBe('0px');
  });

  it('세로는 아래에서', () => {
    render(<Harness edge="bottom" />);
    expect(panel()!.style.bottom).toBe('0px');
    expect(panel()!.style.left).toBe('0px');
    expect(panel()!.style.top).toBe('');
  });
});
