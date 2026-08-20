// §6.9/§7.5f "Shift+? 도움말 오버레이 (role="dialog", 포커스 트랩, Esc)" — ui/Modal.tsx(ui-kit
// 소유) 의 일반형을 그대로 쓴다.
//
// 표 자체는 2026-08-20(§0.5 문서형 도움말)에 `presentHelpRows.ts` 로 옮겼다 — `ui/help/
// HelpCenter.tsx` 와 같은 함수를 불러 쓴다. 이 파일은 그 표를 `Modal` 안에 그리는 것뿐이다.
import { useId } from 'react';
import { Modal } from '../../ui/Modal.tsx';
import { useT } from '../../i18n/useT.ts';
import { useLocale } from '../../i18n/useLocale.ts';
import { presentHelpRows } from './presentHelpRows.ts';

export function HelpOverlay({ open, onClose }: { open: boolean; onClose(): void }) {
  const titleId = useId();
  const t = useT();
  const locale = useLocale();
  const rows = presentHelpRows(t, locale);
  return (
    <Modal open={open} onClose={onClose} titleId={titleId} title={t('present.help.title')} closeLabel={t('common.close')}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
        <tbody>
          {rows.map(([key, desc]) => (
            <tr key={key} style={{ borderTop: '1px solid var(--border)' }}>
              <td style={{ padding: '0.5rem 0.75rem 0.5rem 0', fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, whiteSpace: 'nowrap', color: 'var(--accent-text)' }}>
                {key}
              </td>
              <td style={{ padding: '0.5rem 0', color: 'var(--muted)' }}>{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}
