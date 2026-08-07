// §6.9/§7.5f "Shift+? 도움말 오버레이 (role="dialog", 포커스 트랩, Esc)" — ui/Modal.tsx(ui-kit
// 소유) 의 일반형을 그대로 쓴다.
import { useId } from 'react';
import { Modal } from '../../ui/Modal.tsx';

const ROWS: ReadonlyArray<[string, string]> = [
  ['→ ↓ PageDown Space', '다음 스텝'],
  ['← ↑ PageUp', '이전 스텝'],
  ['Home / End', '처음 / 마지막 스텝'],
  ['Shift + → / ←, N', '다음 / 이전 드릴(세션 시연)'],
  ['P', '재생 / 일시정지'],
  ['F', '전체화면 전환'],
  ['.', '블랙아웃'],
  ['L', '반복 켜기/끄기'],
  ['←→ 스와이프', '이전 / 다음 스텝'],
  ['Esc', '전체화면 종료(창모드에서 한 번 더 누르면 시연 종료)'],
];

export function HelpOverlay({ open, onClose }: { open: boolean; onClose(): void }) {
  const titleId = useId();
  return (
    <Modal open={open} onClose={onClose} titleId={titleId} title="시연 단축키">
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
        <tbody>
          {ROWS.map(([key, desc]) => (
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
