// 새 판이 있다는 알림 — 모달이 아니라 **토스트**다 (2026-09-16).
//
// 왜 모달이 아닌가: 업데이트는 **사용자가 지금 하려던 일이 아니다.** 앱을 열자마자 화면을
// 가로막고 «업데이트하시겠습니까» 를 물으면, 시연 5분 전에 판을 여는 코치에게는 그게 방해다.
// 토스트는 비켜서 있고, 무시하면 그냥 사라진다 — 다음에 열 때 다시 묻는다.
//
// ⚠️ 받는 동안에도 앱을 막지 않는다. 진행률만 같은 자리에 보여 준다.
import { useT } from '../../i18n/useT.ts';
import type { DesktopUpdateApi } from './useDesktopUpdate.ts';

export function UpdateToast({ api }: { api: DesktopUpdateApi }) {
  const t = useT();
  if (api.found === null) return null;

  const pct = api.progress === null ? null : Math.round(api.progress * 100);
  const busy = api.stage === 'downloading' || api.stage === 'ready';

  return (
    <div
      // `role="status"` — 알리되 초점을 훔치지 않는다. 지금 하던 일이 끊기면 안 된다.
      role="status"
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: 240,
        maxWidth: 360,
        padding: '0.875rem 1rem',
        borderRadius: 12,
        border: '1px solid var(--border)',
        background: 'var(--panel)',
        color: 'var(--text)',
        boxShadow: '0 8px 24px rgb(0 0 0 / 0.35)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <strong style={{ fontSize: '0.875rem' }}>{t('update.available', { version: api.found.version })}</strong>
      {api.stage === 'failed' && (
        <span style={{ fontSize: '0.8125rem', color: 'var(--danger, #f87171)' }}>{t('update.failed')}</span>
      )}
      {busy && (
        <span style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>
          {pct === null ? t('update.downloading') : `${pct}%`}
        </span>
      )}
      {!busy && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={api.dismiss}
            style={{ minHeight: 'var(--hit)', padding: '0 0.75rem', background: 'none', border: 'none', color: 'var(--muted)', fontSize: '0.8125rem', cursor: 'pointer' }}
          >
            {t('update.later')}
          </button>
          <button
            type="button"
            onClick={api.install}
            style={{
              minHeight: 'var(--hit)',
              padding: '0 1rem',
              borderRadius: 8,
              border: '1px solid var(--accent)',
              background: 'var(--accent)',
              color: 'var(--accent-ink)',
              fontSize: '0.8125rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {t('update.install')}
          </button>
        </div>
      )}
    </div>
  );
}
