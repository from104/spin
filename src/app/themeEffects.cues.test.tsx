// §4.3 P1-4 — `prefs.a11y.sound` 가 실제로 소리 스위치에 닿는가.
//
// **왜 store 가 아니라 app-shell 인가**: 모션 줄이기와 같은 층의 설정이지만(그쪽은
// SettingsProvider 가 documentElement 에 data 속성을 건다), `cues` 는 ui-kit 이고
// DESIGN.md §8 모듈 표에서 `store` 의 의존 목록에 ui-kit 이 없다. 의존이 전부 열려 있는
// app-shell 이 그 배선을 진다 — uiScale·큰 터치 타깃과 같은 자리다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ThemeEffects } from './App.tsx';
import { SettingsProvider } from '../store/settings/SettingsProvider.tsx';
import { makeDefaultPrefs, PREFS_KEY } from '../storage/prefs.ts';
import { cues } from '../ui/cues.ts';

let setEnabled: ReturnType<typeof vi.spyOn>;

function seed(sound: boolean) {
  const p = makeDefaultPrefs();
  localStorage.setItem(PREFS_KEY, JSON.stringify({ ...p, a11y: { ...p.a11y, sound } }));
}

beforeEach(() => {
  localStorage.clear();
  setEnabled = vi.spyOn(cues, 'setEnabled').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  cues.reset();
});

describe('ThemeEffects — 놓임 소리 스위치', () => {
  it('설정이 끔이면 끈다 — 마운트 시점에 반드시 한 번 전달한다(기본 켬이 아니다)', () => {
    seed(true);
    const { unmount } = render(
      <SettingsProvider>
        <ThemeEffects />
      </SettingsProvider>,
    );
    expect(setEnabled).toHaveBeenCalledWith(true);
    unmount();

    setEnabled.mockClear();
    seed(false);
    render(
      <SettingsProvider>
        <ThemeEffects />
      </SettingsProvider>,
    );
    expect(setEnabled).toHaveBeenCalledWith(false);
    expect(setEnabled.mock.calls.some((c: unknown[]) => c[0] === true)).toBe(false);
  });
});
