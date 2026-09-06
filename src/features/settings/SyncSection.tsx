// 0.6 Drive 동기화 — 설정 화면의 동기화 구획(RosterSection 과 같은 자리 매김: SettingsScreen 의
// <Section> 안에서 자기 상태를 스스로 관리한다).
//
// 세 상태를 그린다:
//  · 미구성(VITE_GOOGLE_CLIENT_ID 없음) — 안내 한 줄. 버튼도 없다: 이 배포에서는 켤 방법이
//    없는 게 사실이고, 없는 기능처럼 숨기면 "왜 어떤 배포엔 있고 어떤 배포엔 없나" 를
//    물을 수 없다.
//  · 꺼짐 — 설명 + [Google 계정 연결]. 누르면 **동의 모달**이 먼저다(무엇이·어디로·서버
//    없음·언제든 해제) — 앱이 "데이터는 여러분 컴에만" 이라고 공지했으므로, 그걸 바꾸는
//    스위치는 명시 동의 없이 켜지지 않는다. OAuth 는 모달의 [연결하고 켜기]에서만 시작한다.
//  · 켬 — 계정·상태·마지막 결과 + [지금 동기화] [연결 해제], 만료 시 [다시 연결].
//
// 엔진과의 연결은 Context 가 아니라 모듈 관찰자(useSyncEngine.ts)다 — 상태는
// useSyncExternalStore 로 읽고, 수동 패스는 syncNow() 로 부른다.
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { useSettings } from '../../store/settings/SettingsProvider.tsx';
import { useToast } from '../../store/toast/ToastProvider.tsx';
import { Button } from '../../ui/Button.tsx';
import { Modal } from '../../ui/Modal.tsx';
import { useT } from '../../i18n/useT.ts';
import { useLocale } from '../../i18n/useLocale.ts';
import { LegalLinks } from './LegalLinks.tsx';
import type { LegalDoc } from './legalContent.ts';
import { BCP47 } from '../../i18n/locale.ts';
import { storageErrorText } from '../../i18n/storageError.ts';
import { connectInteractive, getAccessToken, isSyncConfigured, revokeAccess } from '../../sync/auth.ts';
import { driveWipeAll } from '../../sync/drive.ts';
import { clearSyncDocRows, ensureWriterId, getSyncDeviceMeta, putSyncDeviceMeta } from '../../storage/syncMeta.ts';
import { subscribeSyncStatus, syncNow, syncStatusSnapshot } from '../../sync/useSyncEngine.ts';
import type { SyncEngineStatus } from '../../sync/engine.ts';

export function SyncSection({ onOpenLegal }: { onOpenLegal: (doc: LegalDoc) => void }) {
  const t = useT();
  const locale = useLocale();
  const { prefs, setPrefs } = useSettings();
  const toast = useToast();
  const status = useSyncExternalStore(subscribeSyncStatus, syncStatusSnapshot);
  const [consentOpen, setConsentOpen] = useState(false);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState<string | undefined>(undefined);
  const consentTitleId = useId();
  const wipeTitleId = useId();
  const connectBtnRef = useRef<HTMLButtonElement>(null);
  const wipeBtnRef = useRef<HTMLButtonElement>(null);

  const enabled = prefs.sync.enabled;

  // 이메일 힌트는 prefs 가 아니라 IDB meta 에 있다(백업 파일에 이메일 비탑재) — 비동기로 읽는다.
  useEffect(() => {
    let live = true;
    void getSyncDeviceMeta().then((m) => {
      if (live) setEmail(m?.accountEmail);
    });
    return () => {
      live = false;
    };
  }, [enabled]);

  if (!isSyncConfigured()) {
    return <p style={{ fontSize: '0.78125rem', color: 'var(--faint-text)', margin: '13px 0 7px', lineHeight: 1.6 }}>{t('settings.sync.notConfigured')}</p>;
  }

  /** 연결(첫 연결·재연결 공용). 재연결은 이미 동의한 사용자라 동의 모달을 다시 묻지 않는다.
   *  ⚠️ 사용자 제스처의 연장에서 불러야 한다 — OAuth 팝업 차단 회피(auth.ts). */
  const connect = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { email: newEmail } = await connectInteractive();
      const writerId = await ensureWriterId();
      const meta = await getSyncDeviceMeta();
      if (meta?.accountEmail && newEmail && meta.accountEmail !== newEmail) {
        // 다른 계정으로 갈아탔다 — "이 원격과 맞춘 적 있다" 는 문서행 기억을 버린다(새 원격과는
        // 처음부터 다시 페어링). 톰스톤은 남는다: 이 기기에서 지운 사실은 계정과 무관하게 참이다.
        await clearSyncDocRows();
      }
      await putSyncDeviceMeta({
        writerId,
        ...(meta?.lastSyncAt !== undefined ? { lastSyncAt: meta.lastSyncAt } : {}),
        // about 이 실패해 이메일을 못 얻었으면 옛 힌트를 유지한다 — 틀린 힌트는 GIS 가
        // 계정 선택을 띄울 뿐 데이터에는 영향이 없다.
        ...((newEmail ?? meta?.accountEmail) ? { accountEmail: newEmail ?? meta?.accountEmail } : {}),
      });
      setEmail(newEmail ?? meta?.accountEmail);
      setConsentOpen(false);
      // 이 setPrefs 가 App 루트의 useSyncEngine 을 깨워 엔진을 만들고 첫 패스(페어링)를 돌린다.
      setPrefs({ sync: { enabled: true } });
    } catch (e) {
      toast.show(storageErrorText(e, locale, t('settings.sync.connectFailed')));
    } finally {
      setBusy(false);
    }
  };

  /** 해제의 공통 몸통 — 계정 힌트만 지운다(writerId·lastSyncAt 유지). 로컬 데이터·문서행·
   *  톰스톤 비접촉은 ROADMAP "연결 끊어도 로컬 유지" 의 몫이다. */
  const detach = async () => {
    await revokeAccess();
    const meta = await getSyncDeviceMeta();
    if (meta) await putSyncDeviceMeta({ writerId: meta.writerId, ...(meta.lastSyncAt !== undefined ? { lastSyncAt: meta.lastSyncAt } : {}) });
    setEmail(undefined);
    setPrefs({ sync: { enabled: false } });
  };

  const disconnect = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await detach();
    } finally {
      setBusy(false);
    }
  };

  /** [Drive 데이터 삭제] — 원격 전량 실삭제 **후 동기화도 끈다**. 켠 채 지우면 다음 패스가
   *  전부 도로 올려 청소가 헛일이 된다. 문서행도 비운다(그 원격은 더 이상 존재하지 않는다).
   *  로컬 문서·톰스톤은 그대로 — 지우는 것은 Drive 쪽뿐이다. */
  const wipe = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const token = await getAccessToken(email);
      const n = await driveWipeAll(token);
      await clearSyncDocRows();
      await detach();
      setWipeOpen(false);
      toast.show(t('settings.sync.wipeDone', { n }));
    } catch (e) {
      toast.show(storageErrorText(e, locale, t('settings.sync.wipeFailed')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: '13px 0 5px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {enabled ? (
        <>
          <div style={{ fontSize: '0.8125rem' }}>
            <span style={{ fontWeight: 650 }}>{t('settings.sync.accountLabel')}</span>{' '}
            <span style={{ color: 'var(--muted)' }}>{email ?? t('settings.sync.accountUnknown')}</span>
          </div>
          <div style={{ fontSize: '0.78125rem', color: 'var(--muted)', lineHeight: 1.6 }}>
            {statusLine(status, t, locale)}
            {status.lastResult && (
              <span style={{ display: 'block', color: 'var(--faint-text)' }}>
                {t('settings.sync.lastResultLine', { pushed: status.lastResult.pushed, pulled: status.lastResult.pulled + status.lastResult.deletedLocal })}
              </span>
            )}
            {status.lastResult?.sawTooNew && <span style={{ display: 'block', color: 'var(--warn-text, #c77)' }}>{t('settings.sync.updateNeeded')}</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="secondary" aria-disabled={status.state === 'running' || busy} onClick={() => syncNow()}>
              {t('settings.sync.syncNow')}
            </Button>
            {status.state === 'auth-required' && (
              <Button variant="primary" aria-disabled={busy} onClick={() => void connect()}>
                {t('settings.sync.reconnect')}
              </Button>
            )}
            <Button variant="secondary" aria-disabled={busy} onClick={() => void disconnect()}>
              {t('settings.sync.disconnect')}
            </Button>
            <Button ref={wipeBtnRef} variant="secondary" aria-disabled={busy} onClick={() => setWipeOpen(true)} style={{ color: 'var(--danger-text, #c0392b)' }}>
              {t('settings.sync.wipe')}
            </Button>
          </div>
        </>
      ) : (
        <div>
          <Button ref={connectBtnRef} variant="primary" aria-disabled={busy} onClick={() => setConsentOpen(true)}>
            {t('settings.sync.connect')}
          </Button>
          {/* 구글 동의 화면으로 넘어가기 직전, "무엇이 어디로 가나"의 답은 방침이다(LegalLinks.tsx 머리말). */}
          <LegalLinks only="privacy" prefix={t('settings.legal.syncHint')} onOpen={onOpenLegal} />
        </div>
      )}

      <Modal
        open={consentOpen}
        onClose={() => setConsentOpen(false)}
        titleId={consentTitleId}
        title={t('settings.sync.consentTitle')}
        closeLabel={t('common.close')}
        returnFocusRef={connectBtnRef}
      >
        <ul style={{ fontSize: '0.8125rem', color: 'var(--muted)', lineHeight: 1.7, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <li>{t('settings.sync.consentWhat')}</li>
          <li>{t('settings.sync.consentWhere')}</li>
          <li>{t('settings.sync.consentDetach')}</li>
        </ul>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <Button variant="secondary" onClick={() => setConsentOpen(false)}>
            {t('settings.sync.consentCancel')}
          </Button>
          <Button variant="primary" aria-disabled={busy} onClick={() => void connect()}>
            {t('settings.sync.consentConfirm')}
          </Button>
        </div>
      </Modal>

      <Modal
        open={wipeOpen}
        onClose={() => setWipeOpen(false)}
        titleId={wipeTitleId}
        title={t('settings.sync.wipeTitle')}
        closeLabel={t('common.close')}
        returnFocusRef={wipeBtnRef}
      >
        <p style={{ fontSize: '0.8125rem', color: 'var(--muted)', lineHeight: 1.7 }}>{t('settings.sync.wipeBody')}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <Button variant="secondary" onClick={() => setWipeOpen(false)}>
            {t('settings.sync.consentCancel')}
          </Button>
          <Button variant="primary" aria-disabled={busy} onClick={() => void wipe()}>
            {t('settings.sync.wipeConfirm')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function statusLine(status: SyncEngineStatus, t: ReturnType<typeof useT>, locale: keyof typeof BCP47): string {
  if (status.state === 'running') return t('settings.sync.stateRunning');
  if (status.state === 'offline') return t('settings.sync.stateOffline');
  if (status.state === 'auth-required') return t('settings.sync.stateAuthRequired');
  if (status.state === 'error' && status.lastErrorCode) {
    // 모든 StorageErrorCode 는 storage.error.* 사전 키를 갖는다 — i18n/storageError.ts 의
    // CODE_KEY Record 가 그 전수를 컴파일로 강제한다. 그래서 이 조립은 안전하다.
    return t(`storage.error.${status.lastErrorCode}`);
  }
  if (status.lastSyncAt !== undefined) return t('settings.sync.lastSyncLine', { time: new Date(status.lastSyncAt).toLocaleString(BCP47[locale]) });
  return t('settings.sync.stateNeverSynced');
}
