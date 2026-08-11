// 하단 속도 제한 스위치 — 눌렀을 때 설정이 실제로 바뀌고, 그 값이 다시 화면에 반영되는가.
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { SpeedLimitSwitch } from './SpeedLimitSwitch.tsx';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { loadPrefs, resolvePhysics } from '../../storage/prefs.ts';

const wrapper = ({ children }: { children: ReactNode }) => <SettingsProvider>{children}</SettingsProvider>;

beforeEach(() => {
  localStorage.clear();
});

describe('SpeedLimitSwitch', () => {
  it('기본은 켬이고, 누르면 설정에 저장된 뒤 화면 상태도 뒤집힌다', async () => {
    const user = userEvent.setup();
    render(<SpeedLimitSwitch />, { wrapper });
    const sw = screen.getByRole('switch', { name: '개체 이동 속도 제한' });

    expect(sw).toHaveAttribute('aria-checked', 'true');
    expect(resolvePhysics(loadPrefs()).speedLimit).toBe(true);

    await user.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'false');
    // 저장까지 갔는지 본다 — 화면 상태만 뒤집히고 설정이 안 남으면 새로고침에 되돌아간다.
    expect(resolvePhysics(loadPrefs()).speedLimit).toBe(false);

    await user.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'true');
    expect(resolvePhysics(loadPrefs()).speedLimit).toBe(true);
  });

  it('상태에 따라 이름이 바뀌어 스크린리더로도 지금 켜졌는지 알 수 있다', async () => {
    const user = userEvent.setup();
    render(<SpeedLimitSwitch />, { wrapper });
    const sw = screen.getByRole('switch', { name: '개체 이동 속도 제한' });
    expect(sw).toHaveTextContent('속도 제한 켬');
    await user.click(sw);
    expect(sw).toHaveTextContent('속도 제한 끔');
  });
});
