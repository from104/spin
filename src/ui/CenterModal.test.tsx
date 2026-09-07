// CenterModal 의 Esc — **조합 취소를 빼앗지 않는다**(2026-09-08, PLAN-HELP-OVERHAUL F3·결정 7).
//
// 이 파일이 존재하는 이유는 한 가지다: 이 모달 안에는 긴 텍스트 칸이 산다(드릴 정보 시트의
// 준비물·코칭포인트). 한글로 쓰다 조합을 물리려고 누른 Esc 가 시트를 통째로 닫으면 쓰던 글이
// 사라진다 — Modal.tsx 가 이미 같은 규율을 지키고 있었는데 형제인 이쪽만 빠져 있었다.
// 그 밖의 계약(포커스 복귀·배경 클릭)은 이 파일의 몫이 아니다.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { CenterModal } from './CenterModal.tsx';

describe('CenterModal — IME 가드', () => {
  it('조합 중의 Esc 는 닫지 않고, 조합 밖 Esc 는 닫는다', () => {
    const onClose = vi.fn();
    render(
      <CenterModal open onClose={onClose} title="드릴 정보">
        <textarea aria-label="코칭 포인트" defaultValue="" />
      </CenterModal>,
    );

    // 표준 신호 · 구형 IME 경로(조합 첫 keydown) 둘 다. 셋째 신호(`key === 'Process'`)는
    // 여기서 안 쏜다 — 그 값이 오면 `key` 자체가 'Escape' 가 아니라 가드가 없어도 안 닫히므로,
    // 이 창을 통해서는 **빨간불로 만들 수 없는** 단언이 된다(자기증명). 그 갈래는 진단 창의
    // 표시로만 관측된다.
    fireEvent.keyDown(document, { key: 'Escape', isComposing: true });
    fireEvent.keyDown(document, { key: 'Escape', keyCode: 229 });
    expect(onClose).not.toHaveBeenCalled();

    // 대조군 — 가드가 과하게 막고 있지 않다.
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
