// 안내 모달의 **닫는 네 길이 같은 답을 내는가** 하나만 잰다(계획서 결정 25: "저장은 onClose 한 곳").
//
// Modal 자체의 Esc·포커스 트랩은 `src/ui/Modal.test.tsx` 소관이라 여기서 다시 재지 않는다. 여기서
// 재는 것은 그 위에 얹힌 이 컴포넌트의 계약이다 — Esc 리스너는 `open` 이 서던 순간의 `onClose` 를
// 붙잡고 있어(Modal 이 트랩을 재설정하지 않으므로) 렌더 본문의 최신 값을 못 본다. 그래서 체크 뒤
// Esc 로 닫으면 [다시 보지 않기] 가 조용히 버려지고, 안내가 다음 실행에 또 뜬다. 지우면 새는 버그가
// 정확히 그것이다. 문안·구조·스타일은 안 본다(변경 감지기).
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SmallScreenNotice } from './SmallScreenNotice.tsx';
import { SettingsProvider } from '../store/settings/SettingsProvider.tsx';

const wrapper = ({ children }: { children: ReactNode }) => <SettingsProvider>{children}</SettingsProvider>;

describe('작은 화면 안내 — 닫는 길과 [다시 보지 않기]', () => {
  it('체크한 뒤 Esc 로 닫아도 체크가 그대로 전달된다', () => {
    const onClose = vi.fn();
    render(<SmallScreenNotice open onClose={onClose} />, { wrapper });

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose.mock.calls).toEqual([[true]]);
  });
});
