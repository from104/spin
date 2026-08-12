// 5.5 — 접근성 설정의 **2존 모드** 토글이 네 관문을 전부 통과하는가(§9 결정 ④).
//   ① 화면: 접근성 절에 스위치가 있고 기본이 꺼짐이다
//   ② 화이트리스트(규칙 8): validatePrefs 조립부에 이름이 있어야 저장 왕복에서 안 증발한다
//   ③ 마이그레이션: 이 필드가 없던 옛 저장본이 꺼짐으로 접힌다
//   ④ 4차 backup 봉투: 기기 이사 파일에 실려 나갔다 돌아온다
// 그리고 규칙 7 — `theme` 은 저장 JSON 의 **최상위 문자열**로 남아야 한다(index.html:26-33 의
// 부트 스크립트가 첫 페인트 전에 마이그레이션 없이 날것으로 읽는다).
//
// prefs 자체의 기본값·왕복은 storage/prefs.test.ts 가 이미 갖고 있다(3.0). 여기서 재는 것은
// **화면에서 켠 값이 그 길을 실제로 지나는가** 다.
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

import { SettingsScreen } from './SettingsScreen.tsx';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { LibraryProvider } from '../../store/library/LibraryProvider.tsx';
import { ToastProvider } from '../../store/toast/ToastProvider.tsx';
import { loadPrefs, savePrefs, makeDefaultPrefs, validatePrefs, PREFS_KEY } from '../../storage/prefs.ts';
import { collectBackup, exportBackupFile, parseSpinFile, restoreBackup } from '../../storage/transfer.ts';
import type { BackupPayload } from '../../storage/transfer.ts';

const wrapper = ({ children }: { children: ReactNode }) => (
  <SettingsProvider>
    <LibraryProvider>
      <ToastProvider>{children}</ToastProvider>
    </LibraryProvider>
  </SettingsProvider>
);

beforeEach(() => {
  localStorage.clear();
});

describe('① 화면 — 접근성 절의 2존 토글', () => {
  it('기본은 꺼짐이다 (결정 ④ — 자동으로 켜지지 않는다)', () => {
    render(<SettingsScreen />, { wrapper });
    expect(screen.getByRole('switch', { name: '2존 모드' })).toHaveAttribute('aria-checked', 'false');
    expect(loadPrefs().a11y.twoZone).toBe(false);
  });

  it('켜면 즉시 반영되고 localStorage 에 남는다', async () => {
    render(<SettingsScreen />, { wrapper });
    const sw = screen.getByRole('switch', { name: '2존 모드' });
    await userEvent.setup().click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'true');
    expect(loadPrefs().a11y.twoZone).toBe(true);
  });

  it('다시 누르면 꺼진다 — 되돌릴 수 있다', async () => {
    render(<SettingsScreen />, { wrapper });
    const user = userEvent.setup();
    const sw = screen.getByRole('switch', { name: '2존 모드' });
    await user.click(sw);
    await user.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(loadPrefs().a11y.twoZone).toBe(false);
  });

  it('이웃 접근성 설정을 건드리지 않는다 — 켜도 큰 터치 타깃·소리·단축키가 그대로다', async () => {
    render(<SettingsScreen />, { wrapper });
    await userEvent.setup().click(screen.getByRole('switch', { name: '2존 모드' }));
    const p = loadPrefs();
    expect(p.a11y.largeTargets).toBe(false);
    expect(p.a11y.sound).toBe(true);
    expect(p.a11y.singleKeyShortcuts).toBe('on');
    expect(p.a11y.uiScale).toBe(1);
    expect(p.a11y.reduceMotion).toBe('system');
  });

  it('규칙 7 — 켜도 theme 은 저장 JSON 최상위의 문자열로 남는다', async () => {
    render(<SettingsScreen />, { wrapper });
    await userEvent.setup().click(screen.getByRole('switch', { name: '2존 모드' }));
    // 부트 스크립트와 **같은 리터럴 키**로 읽는다 — PREFS_KEY 를 쓰면 키가 바뀌어도 같이 따라가
    // 초록불이 나고 index.html 만 조용히 어긋난다.
    const raw = JSON.parse(localStorage.getItem('spin.prefs')!) as Record<string, unknown>;
    expect(typeof raw.theme).toBe('string');
    expect(raw.theme).toBe('dark');
    expect((raw.a11y as Record<string, unknown>).twoZone).toBe(true);
    expect(PREFS_KEY).toBe('spin.prefs');
  });
});

describe('② 화이트리스트(규칙 8) — 조립부에 이름이 없으면 소리 없이 증발한다', () => {
  it('true 를 저장했다 다시 읽으면 true 다', () => {
    const d = makeDefaultPrefs();
    savePrefs({ ...d, a11y: { ...d.a11y, twoZone: true } });
    expect(loadPrefs().a11y.twoZone).toBe(true);
  });

  it('대조군 — false 를 저장하면 false 로 돌아온다 ("언제나 true" 구현을 막는다)', () => {
    const d = makeDefaultPrefs();
    savePrefs({ ...d, a11y: { ...d.a11y, twoZone: false } });
    expect(loadPrefs().a11y.twoZone).toBe(false);
  });

  it('쓰레기 값은 기본값(꺼짐)으로 접힌다 — 대조군으로 진짜 true 는 통과한다', () => {
    expect(validatePrefs({ a11y: { twoZone: 'on' } }).value.a11y.twoZone).toBe(false);
    expect(validatePrefs({ a11y: { twoZone: 1 } }).value.a11y.twoZone).toBe(false);
    expect(validatePrefs({ a11y: { twoZone: true } }).value.a11y.twoZone).toBe(true);
  });
});

describe('③ 마이그레이션 — 이 필드가 없던 옛 저장본', () => {
  it('a11y 에 twoZone 이 아예 없으면 꺼짐으로 접히고 형제는 살아남는다', () => {
    localStorage.setItem(
      'spin.prefs',
      JSON.stringify({ schemaVersion: 1, theme: 'light', a11y: { largeTargets: true, uiScale: 1.3, sound: false } }),
    );
    const p = loadPrefs();
    expect(p.a11y.twoZone).toBe(false);
    // 이웃이 함께 죽지 않았는지 — 유실이 한 갈래인지 여러 갈래인지가 여기서 갈린다.
    expect(p.a11y.largeTargets).toBe(true);
    expect(p.a11y.uiScale).toBe(1.3);
    expect(p.a11y.sound).toBe(false);
    expect(p.theme).toBe('light');
  });
});

/** payload → .spin 파일 → 다시 SpinFile. 실제 사용자 데이터가 지나는 유일한 길이다. */
async function roundTrip(payload: BackupPayload) {
  return parseSpinFile(await exportBackupFile(payload).text());
}

describe('④ 기기 이사 파일(4차 backup 봉투)', () => {
  it('켠 채로 봉투를 싸면 payload 에 실리고, 지웠다 복원하면 되살아난다', async () => {
    const d = makeDefaultPrefs();
    savePrefs({ ...d, a11y: { ...d.a11y, twoZone: true } });

    const payload = await collectBackup();
    // '자동으로 되겠지' 를 믿지 않고 봉투 안을 직접 연다.
    expect(payload.prefs.a11y.twoZone).toBe(true);

    localStorage.clear();
    expect(loadPrefs().a11y.twoZone).toBe(false); // 정말 지워졌는지 먼저 확인한다

    // 손으로 봉투를 지어내지 않는다 — 실제 내보내기 → 직렬화 → 파싱 경로를 그대로 지난다.
    // (JSON 왕복에서 boolean 이 살아남는지까지 함께 본다.)
    const report = await restoreBackup(await roundTrip(payload), { prefs: 'replace' });
    expect(report.prefs).toBe('restored');
    expect(loadPrefs().a11y.twoZone).toBe(true);
  });

  it('대조군 — 꺼진 채로 싼 봉투를 복원하면 꺼진 채로 돌아온다', async () => {
    savePrefs(makeDefaultPrefs());
    const payload = await collectBackup();
    expect(payload.prefs.a11y.twoZone).toBe(false);

    savePrefs({ ...makeDefaultPrefs(), a11y: { ...makeDefaultPrefs().a11y, twoZone: true } });
    await restoreBackup(await roundTrip(payload), { prefs: 'replace' });
    expect(loadPrefs().a11y.twoZone).toBe(false);
  });
});
