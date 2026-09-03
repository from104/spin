// 변경 내역 모달 — 레일·좁은 헤더의 버전 번호가 연다(2026-09-03 기현 지시: *"버전 클릭하면 이번
// 버전 changelog 보이는 모달 띄우자 일단 한국어만"*).
//
// 데이터는 `CHANGELOG.md` 그 자체를 `?raw` 로 읽어 `changelog.ts` 가 파싱한다 — 별도로 옮겨
// 적지 않는다(두 벌은 반드시 어긋난다). "이번 버전" 은 화면에 박힌 `v{__APP_VERSION__}` 과 같은
// 값이라, `package.json` 의 `version` 이 바뀌고 `CHANGELOG.md` 에 그 절이 아직 없으면(릴리스
// 준비 중인 순간) 모달은 조용히 빈 안내만 보여준다 — 개발 중 흔한 상태라 에러로 다루지 않는다.
import { useMemo } from 'react';
import type { ReactNode, RefObject } from 'react';
import { Modal } from '../ui/Modal.tsx';
import { useT } from '../i18n/useT.ts';
import { parseChangelogVersion } from './changelog.ts';
import type { ChangelogItem } from './changelog.ts';
import changelogRaw from '../../CHANGELOG.md?raw';

export interface ChangelogModalProps {
  open: boolean;
  onClose(): void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

/** `**굵게**` 와 `` `code` `` 만 다룬다 — CHANGELOG.md 가 실제로 쓰는 인라인 서식이 이 둘뿐이다. */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith('**')) {
      out.push(<strong key={`${keyPrefix}-b${i}`}>{token.slice(2, -2)}</strong>);
    } else {
      out.push(
        <code key={`${keyPrefix}-c${i}`} style={{ font: '0.85em ui-monospace, SFMono-Regular, Menlo, monospace', background: 'var(--panel-2)', padding: '0 0.25em', borderRadius: 4 }}>
          {token.slice(1, -1)}
        </code>,
      );
    }
    last = re.lastIndex;
    i += 1;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function ItemList({ items, level }: { items: readonly ChangelogItem[]; level: 0 | 1 }) {
  return (
    <ul style={{ margin: level === 0 ? '0 0 10px' : '6px 0 0', paddingLeft: level === 0 ? 18 : 16, listStyle: 'disc' }}>
      {items.map((it, i) => (
        <li key={i} style={{ margin: level === 0 ? '0 0 8px' : '0 0 4px', lineHeight: 1.6, fontSize: level === 0 ? '0.875rem' : '0.8125rem', color: level === 0 ? 'var(--text)' : 'var(--muted)' }}>
          {renderInline(it.text, `${level}-${i}`)}
          {it.children.length > 0 && <ItemList items={it.children} level={1} />}
        </li>
      ))}
    </ul>
  );
}

export function ChangelogModal({ open, onClose, returnFocusRef }: ChangelogModalProps) {
  const t = useT();
  const version = __APP_VERSION__;
  // 모달이 열릴 때마다 CHANGELOG.md 를 다시 파싱할 이유가 없다 — 파일 내용도 버전 문자열도
  // 렌더 사이에 안 바뀐다(핫리로드는 이 파일 자체를 다시 평가한다).
  const parsed = useMemo(() => parseChangelogVersion(changelogRaw, version), [version]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      titleId="changelog-modal-title"
      title={t('app.changelog.title', { version })}
      closeLabel={t('common.close')}
      returnFocusRef={returnFocusRef}
    >
      {parsed ? (
        <div>
          {parsed.date && (
            <p style={{ margin: '0 0 14px', color: 'var(--faint-text)', fontSize: '0.75rem' }}>{parsed.date}</p>
          )}
          {parsed.groups.map((g, i) => (
            <div key={i}>
              {g.heading && (
                <h3 style={{ margin: i === 0 ? '0 0 6px' : '16px 0 6px', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--muted)' }}>
                  {g.heading}
                </h3>
              )}
              <ItemList items={g.items} level={0} />
            </div>
          ))}
        </div>
      ) : (
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.875rem', lineHeight: 1.6 }}>{t('app.changelog.empty')}</p>
      )}
    </Modal>
  );
}
