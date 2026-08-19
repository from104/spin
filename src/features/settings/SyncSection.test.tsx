// 0.6 커밋 7 — SyncSection. auth 모듈은 통째 모킹한다(GIS·팝업은 jsdom 밖 세계).
// 여기서 못박는 것: ① 미구성이면 안내뿐(연결 버튼 없음) ② 켜기는 동의 모달을 지나야만
// OAuth 가 시작된다 ③ 연결 성공이 prefs.sync.enabled 를 켜고 이메일 힌트를 IDB meta 에
// 남긴다(prefs 가 아님 — 백업 비탑재) ④ 다른 계정 재연결이 문서행을 비우되 톰스톤은 남긴다
// ⑤ 해제가 revoke + 힌트 삭제 + enabled=false 를 하고 로컬 부기는 건드리지 않는다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { ToastProvider, useToast } from '../../store/toast/ToastProvider.tsx';
import { SyncSection } from './SyncSection.tsx';
import { loadPrefs, savePrefs, makeDefaultPrefs } from '../../storage/prefs.ts';
import { clearSyncDocRows, getSyncDeviceMeta, listSyncDocRows, listTombstones, putSyncDeviceMeta, putSyncDocRow, tombstoneRecord } from '../../storage/syncMeta.ts';
import { getDB } from '../../storage/db.ts';

vi.mock('../../sync/auth.ts', () => ({
  isSyncConfigured: vi.fn(() => true),
  connectInteractive: vi.fn(async () => ({ token: 'tok', email: 'coach@example.com' })),
  revokeAccess: vi.fn(async () => {}),
  getAccessToken: vi.fn(async () => 'tok'),
}));
vi.mock('../../sync/drive.ts', () => ({
  driveWipeAll: vi.fn(async () => 7),
}));
import { connectInteractive, isSyncConfigured, revokeAccess } from '../../sync/auth.ts';
import { driveWipeAll } from '../../sync/drive.ts';

/** ToastProvider 는 상태만 든다 — 그리는 것은 AppShell 의 ToastHost 몫(ExportSheet.test 와
 *  같은 사정). 토스트 문구 단언용으로 메시지를 그대로 흘려 그린다. */
function ToastEcho() {
  const { toasts } = useToast();
  return (
    <div>
      {toasts.map((toast) => (
        <span key={toast.id}>{toast.message}</span>
      ))}
    </div>
  );
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <ToastProvider>
        {children}
        <ToastEcho />
      </ToastProvider>
    </SettingsProvider>
  );
}

beforeEach(async () => {
  localStorage.clear();
  await clearSyncDocRows();
  // 기기행도 초기화 — 파일 내 테스트끼리 공유 DB 다.
  const db = await getDB();
  await db.delete('meta', 'sync/meta');
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('미구성 배포', () => {
  it('안내 한 줄만 — 연결 버튼이 없다(켤 방법이 없는 게 사실이므로 숨기지 않고 말한다)', () => {
    vi.mocked(isSyncConfigured).mockReturnValueOnce(false);
    render(<SyncSection />, { wrapper: Wrapper });
    expect(screen.getByText('이 배포에는 동기화가 구성되어 있지 않습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Google 계정 연결' })).toBeNull();
  });
});

describe('켜기 — 동의가 OAuth 보다 먼저다', () => {
  it('[연결] 은 모달만 열고, OAuth 는 [연결하고 켜기]에서만 시작한다. 성공하면 enabled 켜지고 이메일은 IDB meta 로 간다', async () => {
    const user = userEvent.setup();
    render(<SyncSection />, { wrapper: Wrapper });
    await user.click(screen.getByRole('button', { name: 'Google 계정 연결' }));
    expect(connectInteractive).not.toHaveBeenCalled(); // 모달이 먼저다
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '연결하고 켜기' }));
    await waitFor(() => expect(loadPrefs().sync.enabled).toBe(true));
    expect(connectInteractive).toHaveBeenCalledTimes(1);
    const meta = await getSyncDeviceMeta();
    expect(meta?.accountEmail).toBe('coach@example.com');
    expect(meta?.writerId).toBeTruthy();
    // 이메일이 prefs(=백업에 실리는 곳)에 없다
    expect(JSON.stringify(loadPrefs())).not.toContain('coach@example.com');
    // 화면이 켬 상태로 바뀌었다
    expect(await screen.findByText('coach@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '연결 해제' })).toBeInTheDocument();
  });

  it('취소하면 아무 일도 없다', async () => {
    const user = userEvent.setup();
    render(<SyncSection />, { wrapper: Wrapper });
    await user.click(screen.getByRole('button', { name: 'Google 계정 연결' }));
    await user.click(screen.getByRole('button', { name: '취소' }));
    expect(connectInteractive).not.toHaveBeenCalled();
    expect(loadPrefs().sync.enabled).toBe(false);
  });

  it('다른 계정으로 갈아타면 문서행은 비우고 톰스톤은 남긴다', async () => {
    // 이전 연결의 흔적: 계정 A + 문서행 + 톰스톤
    await putSyncDeviceMeta({ writerId: 'w-x', accountEmail: 'old@example.com' });
    await putSyncDocRow('drill', 'dr_1', { lastSyncedAt: 10, remoteFileId: 'f1' });
    const db = await getDB();
    const tx = db.transaction('meta', 'readwrite');
    tx.store.put(tombstoneRecord('drill', 'dr_gone', 99));
    await tx.done;

    const user = userEvent.setup();
    render(<SyncSection />, { wrapper: Wrapper });
    await user.click(screen.getByRole('button', { name: 'Google 계정 연결' }));
    await user.click(screen.getByRole('button', { name: '연결하고 켜기' })); // coach@ ≠ old@
    await waitFor(async () => expect((await getSyncDeviceMeta())?.accountEmail).toBe('coach@example.com'));
    expect(await listSyncDocRows()).toEqual([]); // 새 원격과는 처음부터 다시 페어링
    expect((await listTombstones()).some((t) => t.id === 'dr_gone')).toBe(true); // 삭제 사실은 계정 무관
    expect((await getSyncDeviceMeta())?.writerId).toBe('w-x'); // 기기 식별자는 유지
  });
});

describe('켬 상태', () => {
  beforeEach(async () => {
    savePrefs({ ...makeDefaultPrefs(), sync: { enabled: true } });
    await putSyncDeviceMeta({ writerId: 'w-x', accountEmail: 'coach@example.com', lastSyncAt: 1_700_000_000_000 });
    await putSyncDocRow('drill', 'dr_keep', { lastSyncedAt: 5, remoteFileId: 'f9' });
  });

  it('계정·상태 줄과 [지금 동기화]·[연결 해제]가 보인다', async () => {
    render(<SyncSection />, { wrapper: Wrapper });
    expect(await screen.findByText('coach@example.com')).toBeInTheDocument();
    expect(screen.getByText('아직 동기화한 적 없습니다.')).toBeInTheDocument(); // 모듈 관찰자 초기값(idle)
    expect(screen.getByRole('button', { name: '지금 동기화' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '연결 해제' })).toBeInTheDocument();
  });

  it('해제 — revoke + 이메일 힌트 삭제 + enabled=false. 문서행·톰스톤·writerId 는 비접촉', async () => {
    const user = userEvent.setup();
    render(<SyncSection />, { wrapper: Wrapper });
    await user.click(await screen.findByRole('button', { name: '연결 해제' }));
    await waitFor(() => expect(loadPrefs().sync.enabled).toBe(false));
    expect(revokeAccess).toHaveBeenCalledTimes(1);
    const meta = await getSyncDeviceMeta();
    expect(meta?.accountEmail).toBeUndefined();
    expect(meta?.writerId).toBe('w-x');
    expect(meta?.lastSyncAt).toBe(1_700_000_000_000);
    expect((await listSyncDocRows()).some((r) => r.id === 'dr_keep')).toBe(true); // 로컬 부기 비접촉
    expect(screen.getByRole('button', { name: 'Google 계정 연결' })).toBeInTheDocument(); // 꺼짐 화면으로
  });

  it('[Drive 데이터 삭제] — 재확인 모달을 지나야 지우고, 지운 뒤 동기화도 끈다(문서행 소거·톰스톤 유지)', async () => {
    const db = await getDB();
    const tx = db.transaction('meta', 'readwrite');
    tx.store.put(tombstoneRecord('drill', 'dr_gone', 99));
    await tx.done;

    const user = userEvent.setup();
    render(<SyncSection />, { wrapper: Wrapper });
    await user.click(await screen.findByRole('button', { name: 'Drive 데이터 삭제' }));
    expect(driveWipeAll).not.toHaveBeenCalled(); // 모달이 먼저다
    await user.click(screen.getByRole('button', { name: '지우고 동기화 끄기' }));
    await waitFor(() => expect(loadPrefs().sync.enabled).toBe(false));
    expect(driveWipeAll).toHaveBeenCalledTimes(1);
    expect(revokeAccess).toHaveBeenCalledTimes(1);
    expect(await listSyncDocRows()).toEqual([]); // 그 원격은 더 이상 존재하지 않는다
    expect((await listTombstones()).some((tb) => tb.id === 'dr_gone')).toBe(true); // 로컬 톰스톤 비접촉
    expect(await screen.findByText('Drive 에서 파일 7개를 지우고 동기화를 껐습니다.')).toBeInTheDocument(); // 토스트
  });
});
