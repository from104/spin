// §6.8 헤더 — useAppHeader 발행/구독과 config prop 오버라이드(홈/목록/설정 정적 헤더 대
// 편집기/시연 자체 선언)를 검증한다.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppHeader, HeaderProvider, useAppHeader } from './AppHeader.tsx';

function Publisher({ title, subtitle }: { title: string; subtitle?: string }) {
  useAppHeader({ title, subtitle });
  return null;
}

describe('AppHeader / useAppHeader', () => {
  it('아무도 선언하지 않으면 빈 타이틀을 그린다', () => {
    render(
      <HeaderProvider>
        <AppHeader />
      </HeaderProvider>,
    );
    expect(document.querySelector('header')).toBeInTheDocument();
  });

  it('useAppHeader 로 선언한 내용을 AppHeader 가 그린다', () => {
    render(
      <HeaderProvider>
        <AppHeader />
        <Publisher title="편집기" subtitle="풀코트 · 4스텝" />
      </HeaderProvider>,
    );
    expect(screen.getByText('편집기')).toBeInTheDocument();
    expect(screen.getByText('풀코트 · 4스텝')).toBeInTheDocument();
  });

  it('config prop 을 직접 주면 Context 구독보다 우선한다(home/library/settings 정적 헤더)', () => {
    render(
      <HeaderProvider>
        <AppHeader config={{ title: '설정' }} />
        <Publisher title="편집기(무시돼야 함)" />
      </HeaderProvider>,
    );
    expect(screen.getByText('설정')).toBeInTheDocument();
    expect(screen.queryByText('편집기(무시돼야 함)')).not.toBeInTheDocument();
  });

  it('배지·주 액션 클릭·시연 버튼 클릭을 실제로 처리한다', async () => {
    const onSave = vi.fn();
    const onPresent = vi.fn();
    function EditorPublisher() {
      useAppHeader({ title: '측면 돌파', badge: '편집중', primary: { label: '저장', onAction: onSave }, presentButton: { onAction: onPresent } });
      return null;
    }
    render(
      <HeaderProvider>
        <AppHeader />
        <EditorPublisher />
      </HeaderProvider>,
    );
    expect(screen.getByText('편집중')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '저장' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: '시연' }));
    expect(onPresent).toHaveBeenCalledTimes(1);
  });

  it('잠긴 코트 스위치는 비활성 알약 클릭 시 값을 바꾸지 않고 onLockedAttempt 만 부른다', async () => {
    const onLockedAttempt = vi.fn();
    function LockedPublisher() {
      useAppHeader({ title: '편집기', courtSwitch: { value: 'full', locked: true, onLockedAttempt } });
      return null;
    }
    render(
      <HeaderProvider>
        <AppHeader />
        <LockedPublisher />
      </HeaderProvider>,
    );
    const half = screen.getByRole('radio', { name: '하프' });
    expect(half).toHaveAttribute('aria-disabled', 'true');
    await userEvent.setup().click(half);
    expect(onLockedAttempt).toHaveBeenCalledTimes(1);
    // 값은 그대로 'full' — 클릭해도 실제로 바뀌지 않는다.
    expect(screen.getByRole('radio', { name: '풀' })).toHaveAttribute('aria-checked', 'true');
  });

  it('search 를 선언하면 입력 시 onChange 로 실시간 전달한다', async () => {
    const onChange = vi.fn();
    function SearchPublisher() {
      useAppHeader({ title: '드릴 라이브러리', search: { value: '', onChange } });
      return null;
    }
    render(
      <HeaderProvider>
        <AppHeader />
        <SearchPublisher />
      </HeaderProvider>,
    );
    // userEvent.type 은 한글처럼 조합(IME)이 필요한 입력을 jsdom 에서 안정적으로 흉내내지 못해
    // 멎는다 — 검색창은 실제 조합 이벤트를 검증할 대상이 아니므로 fireEvent.change 로 값 전달
    // 경로만 확인한다.
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '크로스' } });
    expect(onChange).toHaveBeenCalledWith('크로스');
  });

  it('언마운트되면 헤더가 비워진다(다음 화면이 채우기 전 이전 화면 것이 남지 않는다)', () => {
    function Wrapper({ show }: { show: boolean }) {
      return (
        <HeaderProvider>
          <AppHeader />
          {show && <Publisher title="편집기" />}
        </HeaderProvider>
      );
    }
    const { rerender } = render(<Wrapper show />);
    expect(screen.getByText('편집기')).toBeInTheDocument();
    rerender(<Wrapper show={false} />);
    expect(screen.queryByText('편집기')).not.toBeInTheDocument();
  });
});
