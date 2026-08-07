// §10.7 store — "설정 영속" (§4.6 loadPrefs/savePrefs 는 throw 하지 않는다, boolean 반환).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { PREFS_KEY, loadPrefs } from '../../storage/prefs.ts';
import { SettingsProvider, useSettings } from './SettingsProvider.tsx';

const wrapper = ({ children }: { children: ReactNode }) => <SettingsProvider>{children}</SettingsProvider>;

beforeEach(() => {
  localStorage.clear();
});

describe('SettingsProvider', () => {
  it('마운트 시 loadPrefs() 결과를 state 로 노출한다', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.prefs.theme).toBe('dark');
    expect(result.current.prefs.schemaVersion).toBe(loadPrefs().schemaVersion);
  });

  it('setPrefs 가 즉시 localStorage 에 영속화된다(§4.6 동기 요구)', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => {
      result.current.setPrefs({ theme: 'light' });
    });
    expect(result.current.prefs.theme).toBe('light');
    expect(loadPrefs().theme).toBe('light'); // 리렌더를 기다리지 않고도 storage 에 반영됨
  });

  it('resolvePhysics 가 반영된 physics 를 노출한다(존 경계 클램프)', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => {
      result.current.setPrefs({ physics: { linearKmh: 999 } });
    });
    expect(result.current.physics.linearKmh).toBe(16); // clamp(999,4,16)
  });

  it('savePrefs 가 실패해도(예: quota) throw 하지 않고 persistFailed 를 세운다', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => {
      const persisted = result.current.setPrefs({ theme: 'light' });
      expect(persisted).toBe(false);
    });
    expect(result.current.persistFailed).toBe(true);
    expect(result.current.prefs.theme).toBe('light'); // React state 는 그래도 갱신됨(이번 탭 한정)
    spy.mockRestore();
  });

  it('resetPrefs 가 PREFS_KEY 를 지우고 기본값으로 되돌린다', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => {
      result.current.setPrefs({ theme: 'light' });
    });
    expect(localStorage.getItem(PREFS_KEY)).not.toBeNull();
    act(() => {
      result.current.resetPrefs();
    });
    expect(localStorage.getItem(PREFS_KEY)).toBeNull();
    expect(result.current.prefs.theme).toBe('dark');
  });
});
