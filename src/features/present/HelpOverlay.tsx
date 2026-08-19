// §6.9/§7.5f "Shift+? 도움말 오버레이 (role="dialog", 포커스 트랩, Esc)" — ui/Modal.tsx(ui-kit
// 소유) 의 일반형을 그대로 쓴다.
import { useId } from 'react';
import { helpRows } from '../../core/keymap.ts';
import { Modal } from '../../ui/Modal.tsx';
import { useT } from '../../i18n/useT.ts';
import { useLocale } from '../../i18n/useLocale.ts';
import { translateKeymapDesc } from '../../i18n/keymapDesc.ts';

// 2026-08-16 — 손으로 적던 목록을 `core/keymap.ts` 파생으로 바꿨다. 개편 전 이 표에는
// `P`(재생)·`F`·`L`·`.` 이 적혀 있었는데, 편집기에서 P 는 선수 도구·L 은 선 도구다.
// 표가 배선에서 나오면 두 화면이 어긋나는 순간 계약 테스트가 먼저 운다.

export function HelpOverlay({ open, onClose }: { open: boolean; onClose(): void }) {
  const titleId = useId();
  const t = useT();
  const locale = useLocale();
  // 키가 아니라서 keymap.ts 표에 없는 줄. 스와이프는 시연에서 가장 많이 쓰이는 조작인데
  // 키보드 표만 보면 존재를 모른다.
  const extraRows: ReadonlyArray<[string, string]> = [[t('present.help.swipeKey'), t('present.help.swipeDesc')]];
  const rows: ReadonlyArray<[string, string]> = [
    ...helpRows('present', { steps: true }).map(([key, desc]) => [key, translateKeymapDesc(desc, locale)] as [string, string]),
    ...extraRows,
  ];
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
