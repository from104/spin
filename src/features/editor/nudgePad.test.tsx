// 미세 조정 패드 (2026-09-02 기현 지시로 개체 메뉴 안의 3×3 판을 대체).
//
// 이 패드가 지키는 계약 중 **조용히 깨지는 것**은 둘이다:
//   ① *"칸을 눌러도 패드는 안 닫힌다."* — 여러 번 눌러 맞추는 조작이라 한 번에 닫히면
//      2.5px 을 옮길 때마다 패드를 다시 열어야 한다. 그런데 화면에는 여전히 잘 보이고
//      첫 탭도 잘 먹으므로 눈으로는 안 드러난다.
//   ② *"아무 키나 누르면 닫히되, 그 키를 막지는 않는다."* — 전파를 막는 한 줄이 끼면
//      방향키가 패드만 닫고 개체는 안 움직인다. 이것도 눈으로는 "닫혔으니 됐네" 로 보인다.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { NudgePad } from './NudgePad.tsx';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';

const noop = () => {};

function open(ids: string[]) {
  const calls: number[][] = [];
  const onClose = vi.fn();
  render(
    <NudgePad
      target={{ ids, x: 20, y: 20 }}
      onClose={onClose}
      onNudge={(_ids, dx, dy, dt) => calls.push([dx, dy, dt])}
    />,
    { wrapper: SettingsProvider },
  );
  return { calls, onClose };
}

describe('미세 조정 패드', () => {
  it('★ 칸을 눌러도 패드가 닫히지 않는다 — 단위 벡터가 그대로 간다', () => {
    const { calls, onClose } = open(['ch_1']);
    fireEvent.pointerDown(screen.getByLabelText('오른쪽으로 조금'), { pointerId: 1 });
    expect(calls).toEqual([[1, 0, 0]]);
    expect(onClose, '이것은 명령이 아니라 반복 조작이다').not.toHaveBeenCalled();
  });

  it('회전은 휠체어 하나일 때만 난다 — 공에는 각도가 없다', () => {
    open(['bl_1']);
    expect(screen.queryByLabelText('왼쪽으로 조금 회전'), '눌러도 안 도는 칸을 내지 않는다').toBeNull();
    expect(screen.getByLabelText('왼쪽으로 조금'), '이동은 공에도 난다').toBeInTheDocument();
  });

  it('회전 칸은 휠체어 하나일 때 실제로 난다', () => {
    const { calls } = open(['ch_1']);
    fireEvent.pointerDown(screen.getByLabelText('왼쪽으로 조금 회전'), { pointerId: 1 });
    expect(calls).toEqual([[0, 0, -1]]);
  });

  it('★ 아무 키나 누르면 닫힌다 — 키가 있다는 것은 이 패드가 필요 없다는 뜻이다', () => {
    const { onClose } = open(['ch_1']);
    fireEvent.keyDown(window, { key: 'a' });
    expect(onClose).toHaveBeenCalled();
  });

  it('★ 닫으면서 그 키를 막지 않는다 — 방향키 한 번이 패드를 닫고 개체도 옮긴다', () => {
    const { onClose } = open(['ch_1']);
    const seen: string[] = [];
    // ⚠️ 듣는 자리와 치는 자리가 **둘 다** 실제와 같아야 이 단언이 뜻을 갖는다.
    //    · 편집기의 키 처리부는 `document` 버블이다(useEditorKeyboard). 그래서 여기서 듣는다.
    //    · 패드는 `window` 캡처다. 캡처가 먼저 오므로 거기서 전파를 막으면 document 까지
    //      못 내려간다 — 그게 이 테스트가 잡으려는 회귀다.
    //    · 치는 자리가 `window` 면 window 가 곧 target 이라 캡처·버블이 같은 노드에서 나고,
    //      stopPropagation 이 있어도 둘 다 실행돼 **아무것도 못 잡는다.** 그래서 body 를 친다.
    const spy = (e: Event) => seen.push((e as KeyboardEvent).key);
    document.addEventListener('keydown', spy);
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    document.removeEventListener('keydown', spy);
    expect(onClose).toHaveBeenCalled();
    expect(seen, '전파를 막으면 개체가 안 움직인다').toEqual(['ArrowRight']);
  });

  it('바깥을 누르면 닫힌다', () => {
    const { onClose } = open(['ch_1']);
    // 덮개는 패널 **뒤**에 깔린 전면 판이다 — 그걸 직접 짚는다(패널을 눌렀을 때 안 닫히는
    // 것은 위 ★ 가 이미 잰다).
    const cover = document.querySelectorAll('body > div');
    const overlay = Array.from(cover).find((el) => (el as HTMLElement).style.inset === '0px');
    expect(overlay, '바깥 덮개가 있어야 한다 — 없으면 닫으려던 탭이 코트에 닿는다').toBeTruthy();
    fireEvent.pointerDown(overlay!);
    expect(onClose).toHaveBeenCalled();
  });

  it('대상이 없으면 아무것도 안 그린다', () => {
    render(<NudgePad target={null} onClose={noop} onNudge={noop} />, { wrapper: SettingsProvider });
    expect(screen.queryByLabelText('오른쪽으로 조금')).toBeNull();
  });
});
