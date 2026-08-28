// §6.8 헤더 — useAppHeader 발행/구독과 config prop 오버라이드(홈/목록/설정 정적 헤더 대
// 편집기/시연 자체 선언)를 검증한다.
//
// i18n C2 — AppHeader 가 useT/useLocale(→ useSettingsState)을 직접 쓰게 되면서 SettingsProvider
// 없이는 못 선다. 전부 `{ wrapper: SettingsProvider }` 로 감싼다(테스트 로케일은 test/setup.ts
// 가 'ko' 로 고정하므로 기존 한글 단언은 그대로 유효하다).
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppHeader, HeaderProvider, useAppHeader } from './AppHeader.tsx';
import { SettingsProvider } from '../store/settings/SettingsProvider.tsx';
import { PREFS_KEY, makeDefaultPrefs } from '../storage/prefs.ts';

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
      { wrapper: SettingsProvider },
    );
    expect(document.querySelector('header')).toBeInTheDocument();
  });

  it('useAppHeader 로 선언한 내용을 AppHeader 가 그린다', () => {
    render(
      <HeaderProvider>
        <AppHeader />
        <Publisher title="편집기" subtitle="풀코트 · 4스텝" />
      </HeaderProvider>,
      { wrapper: SettingsProvider },
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
      { wrapper: SettingsProvider },
    );
    expect(screen.getByText('설정')).toBeInTheDocument();
    expect(screen.queryByText('편집기(무시돼야 함)')).not.toBeInTheDocument();
  });

  it('배지·주 액션 클릭을 실제로 처리한다', async () => {
    const onSave = vi.fn();
    function EditorPublisher() {
      useAppHeader({ title: '측면 돌파', badge: '편집중', primary: { label: '저장', onAction: onSave } });
      return null;
    }
    render(
      <HeaderProvider>
        <AppHeader />
        <EditorPublisher />
      </HeaderProvider>,
      { wrapper: SettingsProvider },
    );
    expect(screen.getByText('편집중')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '저장' }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  // 2026-08-20 §A·B — presentButton 필드는 폐기됐다(편집 화면의 [시연]은 이제 primary 다,
  // 위 테스트가 그 경로를 본다). 그때 함께 신설된 compact 는 아래에서 본다.
  //
  // ⚠️ 2026-08-28 — **infoButton 케이스 둘이 여기서 사라졌다**(*"ⓘ가 제목 옆에 선다"* ·
  //    *"null 이면 안 그린다"*). 필드 자체가 폐기됐다: 편집·시연이 같은 ⓘ 하나를 나눠 써서
  //    눌러 보기 전에는 고칠 수 있는지 알 수 없었다(기현 지시). 지금 그 버튼은 각 화면의
  //    오른쪽 세로 바에 아이콘을 달리해 서고, 계약은 그쪽 테스트가 본다 —
  //    EditorWorkspace.viewControls(편집) · PresentRunner(시연).
  it('compact 는 높이를 48 로 줄이고 subtitle·description 을 안 그린다', () => {
    function CompactPublisher() {
      useAppHeader({
        title: '측면 돌파',
        subtitle: '이 문구는 compact 에서 안 보인다',
        compact: true,
      });
      return null;
    }
    render(
      <HeaderProvider>
        <AppHeader />
        <CompactPublisher />
      </HeaderProvider>,
      { wrapper: SettingsProvider },
    );
    expect(screen.getByText('측면 돌파')).toBeInTheDocument();
    expect(screen.queryByText('이 문구는 compact 에서 안 보인다')).not.toBeInTheDocument();
    expect(document.querySelector('header')).toHaveStyle({ minHeight: '48px' });
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
      { wrapper: SettingsProvider },
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
      { wrapper: SettingsProvider },
    );
    // userEvent.type 은 한글처럼 조합(IME)이 필요한 입력을 jsdom 에서 안정적으로 흉내내지 못해
    // 멎는다 — 검색창은 실제 조합 이벤트를 검증할 대상이 아니므로 fireEvent.change 로 값 전달
    // 경로만 확인한다.
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '크로스' } });
    expect(onChange).toHaveBeenCalledWith('크로스');
  });

  it('description 을 선언하면 값이 버튼으로 보이고, 클릭하면 인라인 입력으로 바뀐다', async () => {
    const onChange = vi.fn();
    function DescPublisher() {
      useAppHeader({
        title: '측면 돌파',
        description: { value: '측면에서 크로스', placeholder: '설명 추가', maxLength: 400, onChange },
      });
      return null;
    }
    render(
      <HeaderProvider>
        <AppHeader />
        <DescPublisher />
      </HeaderProvider>,
      { wrapper: SettingsProvider },
    );
    const display = screen.getByRole('button', { name: '측면에서 크로스' });
    const user = userEvent.setup();
    await user.click(display);

    const input = screen.getByRole('textbox', { name: '드릴 설명' });
    expect(input).toHaveValue('측면에서 크로스');

    await user.clear(input);
    await user.type(input, '새 설명');
    await user.tab(); // blur — 커밋 시점

    expect(onChange).toHaveBeenCalledWith('새 설명');
    // 표시 모드로 돌아왔다 — 실제 화면에서는 onChange 가 store 를 고쳐 다음 렌더의
    // `cfg.value` 가 새 글로 오지만(EditorWorkspace.headerDescription.test.tsx 가 그
    // 왕복을 본다), 이 스위트는 정적 Publisher 라 값이 되먹임하지 않는다 — 여기서는
    // 편집 input 이 실제로 사라졌는지(= 표시 모드로 돌아왔는지)만 본다.
    expect(screen.queryByRole('textbox', { name: '드릴 설명' })).toBeNull();
  });

  it('설명이 비어 있으면 placeholder 를 조용한 버튼으로 보여준다', () => {
    function EmptyDescPublisher() {
      useAppHeader({ title: '측면 돌파', description: { value: '', placeholder: '설명 추가', maxLength: 400, onChange: () => {} } });
      return null;
    }
    render(
      <HeaderProvider>
        <AppHeader />
        <EmptyDescPublisher />
      </HeaderProvider>,
      { wrapper: SettingsProvider },
    );
    expect(screen.getByRole('button', { name: '설명 추가' })).toBeInTheDocument();
  });

  it('Esc 는 커밋 없이 표시 모드로 되돌린다', async () => {
    const onChange = vi.fn();
    function DescPublisher() {
      useAppHeader({
        title: '측면 돌파',
        description: { value: '원래 설명', placeholder: '설명 추가', maxLength: 400, onChange },
      });
      return null;
    }
    render(
      <HeaderProvider>
        <AppHeader />
        <DescPublisher />
      </HeaderProvider>,
      { wrapper: SettingsProvider },
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '원래 설명' }));
    const input = screen.getByRole('textbox', { name: '드릴 설명' });
    await user.clear(input);
    await user.type(input, '지우다 만 값');

    await user.keyboard('{Escape}');

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '원래 설명' })).toBeInTheDocument();
  });

  it('prefs.language 를 English 로 두면 잠긴 코트 스위치 알약이 실제로 영어로 바뀐다(i18n C2)', () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...makeDefaultPrefs(), language: 'en' }));
    function LockedPublisher() {
      useAppHeader({ title: 'Editor', courtSwitch: { value: 'half', locked: true } });
      return null;
    }
    render(
      <HeaderProvider>
        <AppHeader />
        <LockedPublisher />
      </HeaderProvider>,
      { wrapper: SettingsProvider },
    );
    expect(screen.getByRole('radiogroup', { name: 'Court shape (locked)' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Half' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Full' })).toBeInTheDocument();
  });

  it('언마운트되면 헤더가 비워진다(다음 화면이 채우기 전 이전 화면 것이 남지 않는다)', () => {
    function Wrapper({ show }: { show: boolean }) {
      return (
        <SettingsProvider>
          <HeaderProvider>
            <AppHeader />
            {show && <Publisher title="편집기" />}
          </HeaderProvider>
        </SettingsProvider>
      );
    }
    const { rerender } = render(<Wrapper show />);
    expect(screen.getByText('편집기')).toBeInTheDocument();
    rerender(<Wrapper show={false} />);
    expect(screen.queryByText('편집기')).not.toBeInTheDocument();
  });
});
