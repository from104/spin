// §4.6/§6.8/§7.4 설정 화면. 각 컨트롤이 실제 SettingsProvider/localStorage 에 반영되는지,
// 팀 색상 상호 배제(§7.8)와 물리 슬라이더·기본값 복원, 데이터 내보내기(§4.7) 흐름을 확인한다.
// downloadBlob 은 <a> 클릭을 트리거한다 — jsdom 에서 no-op 이지만 URL.createObjectURL 은
// jsdom 미구현이라 모킹한다(features/library/transfer.test.ts 와 동일 패턴).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DEFAULT_ZONES } from '../../core/constants.ts';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

vi.mock('../../storage/files.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../storage/files.ts')>();
  return { ...actual, downloadBlob: vi.fn() };
});

import { SettingsScreen } from './SettingsScreen.tsx';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { LibraryProvider } from '../../store/library/LibraryProvider.tsx';
import { ToastProvider, useToast } from '../../store/toast/ToastProvider.tsx';
import { ToastHost } from '../../ui/ToastHost.tsx';
import { loadPrefs } from '../../storage/prefs.ts';
import { idbDrillRepo } from '../../storage/drillRepo.ts';

function ToastHostBridge() {
  const { toasts, dismiss } = useToast();
  return <ToastHost toasts={toasts} onDismiss={dismiss} />;
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <SettingsProvider>
    <LibraryProvider>
      <ToastProvider>
        {children}
        <ToastHostBridge />
      </ToastProvider>
    </LibraryProvider>
  </SettingsProvider>
);

beforeEach(() => {
  localStorage.clear();
});

describe('SettingsScreen — 화면', () => {
  it('기본값을 반영해 렌더한다', () => {
    render(<SettingsScreen />, { wrapper });
    expect(screen.getByRole('radio', { name: '다크' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('switch', { name: '격자 표시' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: '100%' })).toHaveAttribute('aria-checked', 'true');
  });

  it('테마를 라이트로 바꾸면 즉시 반영되고 localStorage 에 저장된다', async () => {
    render(<SettingsScreen />, { wrapper });
    await userEvent.setup().click(screen.getByRole('radio', { name: '라이트' }));
    expect(screen.getByRole('radio', { name: '라이트' })).toHaveAttribute('aria-checked', 'true');
    expect(loadPrefs().theme).toBe('light');
  });

  it('격자 표시 토글이 prefs.showGrid 를 뒤집는다', async () => {
    render(<SettingsScreen />, { wrapper });
    const toggle = screen.getByRole('switch', { name: '격자 표시' });
    await userEvent.setup().click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(loadPrefs().showGrid).toBe(false);
  });

  it('UI 배율을 130% 로 바꾸면 prefs.a11y.uiScale 이 갱신된다', async () => {
    render(<SettingsScreen />, { wrapper });
    await userEvent.setup().click(screen.getByRole('radio', { name: '130%' }));
    expect(loadPrefs().a11y.uiScale).toBe(1.3);
  });

  // 감사 2026-08-08 major #1 회귀 — 이 토글은 SettingsScreen 에서 prefs 로 저장되기만 하고
  // 어떤 렌더러도 읽지 않았다. 소비처(GridOverlay/CourtStage) 배선은 render 쪽 테스트가 맡고,
  // 여기서는 "설정 화면이 이 값을 여전히 정상적으로 쓰고 읽는다"만 확인한다.
  it('격자 칸 라벨 표시 토글이 prefs.showGridLabels 를 뒤집는다', async () => {
    render(<SettingsScreen />, { wrapper });
    const toggle = screen.getByRole('switch', { name: '격자 칸 라벨 표시' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    await userEvent.setup().click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(loadPrefs().showGridLabels).toBe(false);
  });

  // 감사 2026-08-08 minor — 기본값은 defaultCourtMode:null → "항상 묻기".
  it('기본 코트 모드를 "하프" 로 바꾸면 prefs.defaultCourtMode 가 갱신된다', async () => {
    render(<SettingsScreen />, { wrapper });
    expect(screen.getByRole('radio', { name: '항상 묻기' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.setup().click(screen.getByRole('radio', { name: '하프' }));
    expect(loadPrefs().defaultCourtMode).toBe('half');
  });
});

describe('SettingsScreen — 시연 (minor #5, 이전에는 설정 화면에 노출되지 않았다)', () => {
  it('화면 꺼짐 방지·자동 전체화면 토글이 각각 prefs.present 에 반영된다', async () => {
    render(<SettingsScreen />, { wrapper });
    const wakeLock = screen.getByRole('switch', { name: '화면 꺼짐 방지' });
    const autoFs = screen.getByRole('switch', { name: '자동 전체화면' });
    expect(wakeLock).toHaveAttribute('aria-checked', 'true'); // 기본값 true
    expect(autoFs).toHaveAttribute('aria-checked', 'false'); // 기본값 false

    const user = userEvent.setup();
    await user.click(wakeLock);
    expect(loadPrefs().present.wakeLock).toBe(false);
    await user.click(autoFs);
    expect(loadPrefs().present.autoFullscreen).toBe(true);
  });
});

describe('SettingsScreen — 팀 색상', () => {
  it('상대 팀이 쓰는 색은 aria-disabled 이고 클릭하면 토스트만 뜬다', async () => {
    render(<SettingsScreen />, { wrapper });
    const homeGroup = screen.getByRole('radiogroup', { name: '우리 팀 색상' });
    // 기본값: 우리 팀 빨강, 상대 팀 파랑 → 우리 팀 목록에서 파랑이 비활성.
    const blueInHome = within(homeGroup).getByRole('radio', { name: '팀 색상: 파랑' });
    expect(blueInHome).toHaveAttribute('aria-disabled', 'true');

    await userEvent.setup().click(blueInHome);
    expect(await screen.findByText('상대 팀과 같은 색은 선택할 수 없습니다.')).toBeInTheDocument();
    expect(loadPrefs().teams.home.color).toBe('#d93a3a'); // 변경되지 않았다
  });

  it('사용 가능한 색을 고르면 즉시 반영된다', async () => {
    render(<SettingsScreen />, { wrapper });
    const homeGroup = screen.getByRole('radiogroup', { name: '우리 팀 색상' });
    const purple = within(homeGroup).getByRole('radio', { name: '팀 색상: 보라' });
    await userEvent.setup().click(purple);
    expect(purple).toHaveAttribute('aria-checked', 'true');
    expect(loadPrefs().teams.home.color).toBe('#7c5cd6');
  });
});

describe('SettingsScreen — 물리', () => {
  it('존 경계 슬라이더를 조정하면 즉시 표시가 바뀌고 저장된다', () => {
    render(<SettingsScreen />, { wrapper });
    const slider = screen.getByRole('slider', { name: '후방 견인 경계' });
    // 리터럴로 두면 기본값을 조정할 때마다 슬라이더 동작과 무관하게 빨간불이 뜬다.
    expect(slider).toHaveValue(String(DEFAULT_ZONES.sTowRearMax));
    // userEvent 는 range 타이핑을 지원하지 않으므로 fireEvent.change 로 직접 갱신한다.
    fireEvent.change(slider, { target: { value: '0.18' } });
    expect(loadPrefs().physics.zones?.sTowRearMax).toBe(0.18);
  });

  it('기본값으로 복원하면 physics 오버라이드가 비워진다', async () => {
    render(<SettingsScreen />, { wrapper });
    const slider = screen.getByRole('slider', { name: '후방 견인 경계' });
    fireEvent.change(slider, { target: { value: '0.18' } });
    expect(loadPrefs().physics.zones?.sTowRearMax).toBe(0.18);

    await userEvent.setup().click(screen.getByRole('button', { name: '기본값으로 복원' }));
    await waitFor(() => expect(screen.getByRole('slider', { name: '후방 견인 경계' })).toHaveValue(String(DEFAULT_ZONES.sTowRearMax)));
    expect(loadPrefs().physics).toEqual({});
  });
});

describe('SettingsScreen — 물리 설명문 (minor 회귀)', () => {
  // 감사 2026-08-08 minor — "놓은 뒤 자동 재생에만 적용"이라는 옛 설명은 실제 동작(드래그 중
  // 속도 상한에도 곱해진다, EditorProvider.tsx vLinPxPerS/omegaRadPerS)과 달랐다. 동작이
  // 계약(prefs.ts §5.11 주석)에 맞으므로 설명문 쪽을 고쳤다 — "자동 재생에만" 문구가 다시
  // 나타나지 않는지 확인한다.
  it('"편집 속도 배수" 설명이 드래그에도 적용됨을 밝힌다("자동 재생에만"이라고 말하지 않는다)', () => {
    render(<SettingsScreen />, { wrapper });
    expect(screen.getByText('드래그와 놓은 뒤 이어가기, 둘 다의 속도 상한에 곱해집니다')).toBeInTheDocument();
    expect(screen.queryByText(/자동 재생에만 적용/)).toBeNull();
  });
});

describe('SettingsScreen — 데이터 내보내기', () => {
  it('드릴이 없으면 안내 토스트만 띄운다', async () => {
    render(<SettingsScreen />, { wrapper });
    await userEvent.setup().click(screen.getByRole('button', { name: '내보내기' }));
    expect(await screen.findByText('내보낼 드릴이 없습니다.')).toBeInTheDocument();
  });

  it('드릴이 있으면 전체를 내보내고 개수를 알린다', async () => {
    await idbDrillRepo.createDrill({ courtMode: 'full', title: '측면 돌파', category: '공격' });
    render(<SettingsScreen />, { wrapper });
    await waitFor(() => expect(screen.getByRole('button', { name: '내보내기' })).not.toHaveAttribute('aria-disabled', 'true'));
    await userEvent.setup().click(screen.getByRole('button', { name: '내보내기' }));
    expect(await screen.findByText('드릴 1개를 내보냈습니다.')).toBeInTheDocument();
  });
});
