// 휠체어 조정 모드의 **상단 띠** — docs/PLAN-SIMPLE-DRIVE.md 결정 B8. "지금 무엇을 몰고 있고, 얼마나 빠르고, 어떻게 나오나" 를
// 늘 보이게 한다. 모드는 판 전체의 키를 바꾸므로(W A S D 가 개체 이동이 아니다) 그 사실이 화면에 없으면 키가 고장 난 줄 안다.
// [끝] 단추는 키보드 없는 손의 출구다(Esc 와 같은 길).
//
// 발표는 여기서 하지 않는다 — 들어갈 때·속도 바꿀 때·나올 때 한 줄씩 useDriveSession 이 LiveRegion 으로 한다. 이 띠에 role=status 를
// 달면 같은 말이 두 번 읽힌다.
import { useT } from '../../i18n/useT.ts';

export function DriveStrip({ chair, level, onEnd }: { chair: string; level: number; onEnd(): void }) {
  const t = useT();
  const name = t('drive.name');
  return (
    <div
      role="group"
      aria-label={name}
      data-testid="drive-strip"
      data-drive-ui=""
      data-level={level}
      style={{
        position: 'absolute',
        top: 8,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 3,
        maxWidth: 'calc(100% - 16px)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '4px 4px 4px 12px',
        borderRadius: 999,
        border: '1px solid var(--accent)',
        background: 'color-mix(in srgb, var(--panel) 92%, transparent)',
        color: 'var(--text)',
        fontSize: '0.75rem',
        fontWeight: 600,
      }}
    >
      <span style={{ fontWeight: 700, color: 'var(--accent-text)', whiteSpace: 'nowrap' }}>{t('drive.strip.label', { name })}</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('drive.strip.status', { chair, level })}</span>
      <button
        type="button"
        data-testid="drive-end"
        onClick={onEnd}
        aria-label={t('drive.strip.endAria', { name })}
        title={t('drive.strip.endAria', { name })}
        style={{
          minHeight: 'var(--hit)',
          minWidth: 'var(--hit)',
          padding: '0 14px',
          borderRadius: 999,
          border: '1px solid var(--border-strong)',
          background: 'var(--panel-2)',
          color: 'var(--text)',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        {t('drive.strip.end')}
      </button>
    </div>
  );
}
