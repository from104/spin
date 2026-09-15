// 「누르면 모달이 닫히고 받기가 시작된다」 (2026-09-16 기현 지시 그대로).
//
// 지우면 새는 것 둘:
// ① 단추가 `<button>` 으로 바뀌면 **받기가 아예 안 일어난다.** 받기를 시작하는 것은 우리
//    코드가 아니라 앵커의 기본 동작(이동 → 깃허브가 Content-Disposition 으로 첨부를 준다)이다.
//    그래서 이 테스트는 «href 를 가진 앵커인가» 를 잰다 — 클릭 핸들러가 있는지가 아니라.
// ② 닫는 것을 빼먹으면 내려받기 표시줄이 뜨는 동안 모달이 화면을 덮은 채 남는다.
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { DownloadModal } from './DownloadModal.tsx';

const wrapper = ({ children }: { children: ReactNode }) => <SettingsProvider>{children}</SettingsProvider>;

describe('데스크톱 받기 모달', () => {
  it('받기는 **앵커**이고 그 판의 파일을 가리킨다 — 버튼으로 바꾸면 아무 일도 안 일어난다', () => {
    render(<DownloadModal open onClose={vi.fn()} platform="windows" version="0.6.9" />, { wrapper });
    const a = screen.getByRole('link', { name: '받기' });
    expect(a.tagName).toBe('A');
    expect(a.getAttribute('href')).toBe(
      'https://github.com/from104/spin/releases/download/v0.6.9/SPIN_0.6.9_x64_en-US.msi',
    );
  });

  it('누르면 닫힌다 — 받는 동안 판이 화면에 남으면 안 된다', () => {
    const onClose = vi.fn();
    render(<DownloadModal open onClose={onClose} platform="linux" version="0.6.9" />, { wrapper });
    fireEvent.click(screen.getByRole('link', { name: '받기' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('무엇이 떨어지는지 누르기 전에 보여 준다 — 플랫폼마다 다른 파일이다', () => {
    const { rerender } = render(<DownloadModal open onClose={vi.fn()} platform="macos" version="0.6.9" />, { wrapper });
    expect(screen.getByText('SPIN_0.6.9_universal.dmg')).toBeTruthy();
    rerender(<DownloadModal open onClose={vi.fn()} platform="linux" version="0.6.9" />);
    expect(screen.getByText('SPIN-0.6.9-x86_64.AppImage')).toBeTruthy();
  });

  it('다른 형식으로 가는 길이 함께 있다 — 파일 링크가 404 일 때의 도피처다', () => {
    render(<DownloadModal open onClose={vi.fn()} platform="linux" version="0.6.9" />, { wrapper });
    expect(screen.getByRole('link', { name: '다른 형식 보기' }).getAttribute('href')).toBe(
      'https://github.com/from104/spin/releases/tag/v0.6.9',
    );
  });
});
