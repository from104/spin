// §6.8 헤더 — useAppHeader 발행/구독과 config prop 오버라이드(홈/목록/설정 정적 헤더 대
// 편집기/시연 자체 선언)를 검증한다.
//
// i18n C2 — AppHeader 가 useT/useLocale(→ useSettingsState)을 직접 쓰게 되면서 SettingsProvider
// 없이는 못 선다. 전부 `{ wrapper: SettingsProvider }` 로 감싼다(테스트 로케일은 test/setup.ts
// 가 'ko' 로 고정하므로 기존 한글 단언은 그대로 유효하다).
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
  // ⚠️ 2026-09-18 — 이 테스트가 보던 계약이 **반으로 줄었다.** 헤더 48 통일로 compact 의 높이
  //    덮어쓰기가 사라졌고(모든 화면이 같은 minHeight 를 쓴다), 이어서 오른쪽 조작부 2/3 지시로
  //    그 값이 33 이 됐다. 그래서 높이는 더 이상 compact 의 몫이 아니다 — 남은 몫은 **부제·설명을
  //    안 그리는 것**과 **좌우 여백을 12 로 좁히는 것** 둘이고, 아래가 그 둘을 본다.
  //    높이 자체는 chromeBudget.test 가 예산 표와 묶어 지킨다(소스 리터럴 대조).
  it('compact 는 subtitle·description 을 안 그리고 좌우 여백을 좁힌다', () => {
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
    // 넓은 창인데도 좁은 창 여백(12)을 쓴다 — compact 가 지금 실제로 하는 일.
    expect(document.querySelector('header')).toHaveStyle({ padding: '2px 12px' });
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

  // 2026-09-08 (PLAN-HELP-OVERHAUL F3·결정 9). 한글 조합을 끝내는 Enter 는 **입력기의 것**이다 —
  // 그 Enter 로 blur 를 걸면 사용자는 첫 낱말을 확정하는 순간 편집이 닫힌다. NoteEditModal 이
  // 이미 관측해 둔 패턴이고(그 파일 주석), 여기 이름·설명 두 칸에는 가드가 없었다.
  it('IME 조합 중의 Enter 는 이름 편집을 닫지도 커밋하지도 않는다', () => {
    const onChange = vi.fn();
    function TitlePublisher() {
      useAppHeader({ title: '측면 돌파', titleField: { value: '측면 돌파', maxLength: 60, onChange } });
      return null;
    }
    render(
      <HeaderProvider>
        <AppHeader />
        <TitlePublisher />
      </HeaderProvider>,
      { wrapper: SettingsProvider },
    );
    fireEvent.click(screen.getByRole('button', { name: '드릴 이름: 측면 돌파. 눌러서 수정' }));
    const input = screen.getByRole('textbox', { name: '드릴 이름' });
    fireEvent.change(input, { target: { value: '측면 돌파 변형' } });

    // 조합 중 Enter — 표준 신호와 구형 IME 경로(keyCode 229) 둘 다.
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 });
    expect(screen.getByRole('textbox', { name: '드릴 이름' })).toBeInTheDocument(); // 아직 편집 중
    expect(onChange).not.toHaveBeenCalled();

    // 대조군 — 조합이 끝난 Enter 는 blur 로 커밋한다(가드가 과하게 막지 않는다).
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('측면 돌파 변형');
    expect(screen.queryByRole('textbox', { name: '드릴 이름' })).toBeNull();
  });

  it('IME 조합 중의 Esc 는 설명 편집을 되돌리지 않는다 — 조합 취소를 빼앗지 않는다', () => {
    function DescPublisher() {
      useAppHeader({
        title: '측면 돌파',
        description: { value: '원래 설명', placeholder: '설명 추가', maxLength: 400, onChange: vi.fn() },
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
    fireEvent.click(screen.getByRole('button', { name: '원래 설명' }));
    const input = screen.getByRole('textbox', { name: '드릴 설명' });
    fireEvent.change(input, { target: { value: '쓰던 글' } });

    fireEvent.keyDown(input, { key: 'Escape', isComposing: true });
    expect(screen.getByRole('textbox', { name: '드릴 설명' })).toHaveValue('쓰던 글'); // 그대로 편집 중

    // 대조군 — 조합 밖 Esc 는 표시 모드로 되돌린다.
    fireEvent.keyDown(input, { key: 'Escape' });
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

// 2026-09-19 — 헤더 세 칸의 **폭 배분**. 옛 모양은 셋 다 `1 1 0` 이라 정확히 1/3 씩이었고,
// 그것이 실기에서 두 결함의 한 원인이었다(실측, 헤더 폭 1049 → 칸마다 324):
//   · 자유 전술판 — **빈 왼쪽 칸이 324 를 붙들어** 부제가 359 를 못 받아 말줄임됐다.
//   · 드릴 목록 — 오른쪽 칸도 324 라 검색칸+[새 드릴]이 안 들어가 헤더가 **두 줄**(74)이 됐다.
// 이제 제목 칸만 내용 크기(`0 1 auto`)이고 양옆은 `1 1 0` 이다. **가운데 정렬은 그대로다** —
// 양옆이 같은 flex 라 남는 폭을 똑같이 나눠 제목의 중심이 언제나 헤더의 중심이다.
//
// jsdom 은 레이아웃이 없어 «324 였다» 를 잴 수 없다 — 그래서 **배분 규칙 자체**를 본다.
// 세 칸이 다시 균등해지면 실기에서만 보이는 그 두 결함이 조용히 돌아온다.
describe('헤더 세 칸의 폭 배분 (2026-09-19)', () => {
  // ⚠️ 이 규칙만 **소스 대조**다. jsdom 의 cssstyle 은 `flex: '1 1 0'`(단위 없는 basis)을 충실히
  //    직렬화하지 못한다 — 실측에서 한 칸은 통째로 사라지고 다른 칸은 `0 0 auto` 로 뭉개졌다.
  //    그 값에 단언하면 **거짓 신호**가 나므로, 배분 규칙은 소스에서 읽어 못박는다
  //    (chromeBudget.test 가 예산표를 소스와 대조하는 것과 같은 이유).
  const src = readFileSync(resolve(process.cwd(), 'src/app/AppHeader.tsx'), 'utf-8');

  it('제목 칸은 내용 크기, 양옆은 균등 — 그래야 제목이 중앙이면서 부제가 안 잘린다', () => {
    // 제목: symmetric 이면 내용 크기. `1 1 0` 으로 되돌아가면 칸이 다시 1/3 로 고정된다.
    expect(src).toContain("flex: absolute ? (symmetric ? '0 1 auto' : '1 1 6rem') : '1 1 12rem'");
    // 양옆은 **같은 값**이어야 가운데 정렬이 성립한다(한쪽만 바꾸면 제목이 옆으로 밀린다).
    expect(src).toContain("<div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>{leading}</div>");
    expect(src).toContain("flex: symmetric ? '1 1 0' : 'none'");
    // 끝까지 밀리면 칸 안에서 말줄임된다 — 칸을 늘려 헤더를 접지 않는다.
    expect(src).toContain('minWidth: 0, flex: absolute');
  });

  it('검색칸은 줄어들 수 있다 — 하한만 있고 상한이 없으면 헤더가 두 줄로 접힌다', () => {
    function SearchPublisher() {
      useAppHeader({ title: '목록', search: { value: '', onChange: () => {} } });
      return null;
    }
    render(
      <HeaderProvider>
        <AppHeader />
        <SearchPublisher />
      </HeaderProvider>,
      { wrapper: SettingsProvider },
    );
    const input = document.getElementById('drill-search') as HTMLInputElement;
    const box = input.closest('label') as HTMLElement;
    // 210 은 **기준이자 하한**이지 고정폭이 아니다.
    expect(box.style.flex).toBe('1 1 210px');
    expect(box.style.minWidth).toBe('210px');
    // 안쪽 input 의 자동 최소 크기(브라우저 기본 size)가 칸을 301px 까지 밀어 올렸던 자리다.
    expect(input.style.minWidth).toBe('0px');
  });
});
