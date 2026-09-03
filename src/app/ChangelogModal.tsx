// 변경 내역 모달 — 레일·좁은 헤더의 버전 번호가 연다(2026-09-03 기현 지시: *"버전 클릭하면 이번
// 버전 changelog 보이는 모달 띄우자 일단 한국어만"*, 곧이어 *"모든 버전이 모달 헤더 양쪽 버튼으로
// 좌우로 스크롤 되게"*).
//
// 데이터는 `CHANGELOG.md` 그 자체를 `?raw` 로 읽어 `changelog.ts` 가 파싱한다 — 별도로 옮겨
// 적지 않는다(두 벌은 반드시 어긋난다). 처음 열리는 자리는 화면에 박힌 `v{__APP_VERSION__}` 과
// 같은 절이고, 좌우 버튼으로 다른 버전(오래된 쪽·새 쪽)을 넘겨 본다. `[Unreleased]` 는 아직
// 나가지 않은 절이라 넘기기 목록에서 뺀다 — 사용자가 화면에서 볼 수 있는 것은 이미 나간 버전
// 뿐이다. "이번 버전" 이 목록에 없으면(릴리스 준비 중이라 `CHANGELOG.md` 에 그 절이 아직 없는
// 순간) 가장 최근 버전에서 시작한다.
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { Modal } from '../ui/Modal.tsx';
import { useT } from '../i18n/useT.ts';
import { parseAllChangelogVersions } from './changelog.ts';
import type { ChangelogItem, ChangelogVersion } from './changelog.ts';
import changelogRaw from '../../CHANGELOG.md?raw';

/** 지금 실행 중인 앱 버전이 목록 몇 번째인지. 못 찾으면(빌드는 올랐는데 `CHANGELOG.md` 절이
 *  아직 없는 릴리스 준비 중 순간) 목록 맨 앞 — 배열이 최신→과거 순이라 그게 가장 최근 나간
 *  버전이다. 모듈 스코프에 둔 이유는 `useEffect`/`useState` 양쪽에서 같은 함수를 참조로 안전하게
 *  쓰기 위해서다(컴포넌트 안에 두면 매 렌더 새 함수라 의존성 배열에 넣을 수 없다). */
function findCurrentVersionIndex(versions: readonly ChangelogVersion[]): number {
  const i = versions.findIndex((v) => v.version === __APP_VERSION__);
  return i === -1 ? 0 : i;
}

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
  // 모달이 열릴 때마다 CHANGELOG.md 를 다시 파싱할 이유가 없다 — 파일 내용은 렌더 사이에
  // 안 바뀐다(핫리로드는 이 파일 자체를 다시 평가한다). 목록은 파일에 적힌 순서 그대로라
  // 최신이 인덱스 0 이다.
  const versions = useMemo(() => parseAllChangelogVersions(changelogRaw).filter((v) => v.version !== 'Unreleased'), []);
  const [index, setIndex] = useState(() => findCurrentVersionIndex(versions));
  // ⚠️ `Modal` 은 부모(AppRail/AppNavSegment)가 `open` 값과 무관하게 **상시 렌더**한다 — `Modal`
  // 자신은 `!open` 일 때 반환값만 `null` 로 바꿀 뿐(Modal.tsx:114) 이 컴포넌트(그 부모)는 한 번도
  // 언마운트하지 않는다. 그래서 위 `useState` 초기화 함수는 **최초 마운트 때 딱 한 번**만 돈다 —
  // 열어 둔 채 좌우로 넘겨 보다가 닫았다 다시 열면, 이 effect 가 없으면 옛 자리에 그대로 남는다.
  // "다시 열 때마다 이번 버전으로 돌아간다" 는 뜻을 실제로 지키는 것은 이 effect다.
  useEffect(() => {
    if (open) setIndex(findCurrentVersionIndex(versions));
  }, [open, versions]);
  const current = versions[index] ?? null;
  const older = versions[index + 1] ?? null; // 파일 순서가 최신→과거라, 다음 인덱스가 더 옛 버전.
  const newer = versions[index - 1] ?? null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      titleId="changelog-modal-title"
      title={t('app.changelog.title')}
      closeLabel={t('common.close')}
      returnFocusRef={returnFocusRef}
      // 절마다 항목 수가 들쭉날쭉해(0.3.0 은 스물여덟 줄, 0.6.1 은 여섯 줄) 좌우로 넘길 때마다
      // 창 높이가 늘었다 줄었다 하면 손이 화면 위에서 계속 움직여야 한다(2026-09-03 기현 지시:
      // *"체인지로그 모달 높이를 화면 높이의 60%로 고정"*) — `maxHeight` 가 아니라 `height` 로
      // 박아 짧은 절도 빈 여백을 두고 그 높이를 지킨다.
      //
      // ⚠️ `overflowY: 'hidden'` 로 Modal 기본값(패널 전체가 통째로 스크롤)을 끈다 — 곧이은
      // 지시 *"스크롤은 내용만 되게(제목·버튼·버전·날짜 등은 모달 상단 고정)"* 때문이다. 대신
      // `display:flex; flexDirection:column` 을 얹어 패널을 세로 기둥으로 만든다 — Modal 이
      // 그리는 `<h2>` 제목 하나, 그리고 children(아래 nav-row + 스크롤 상자) 둘이 그 기둥의
      // flex item 이 된다. 닫기 ✕ 는 `position:absolute` 라 이 흐름과 무관하게 항상 고정이다.
      panelStyle={{ height: '60vh', maxHeight: '60vh', overflowY: 'hidden', display: 'flex', flexDirection: 'column' }}
    >
      {current ? (
        // `minHeight: 0` 이 없으면 flex item 은 내용만큼 늘어나려 해서 아래 스크롤 상자가
        // 패널 밖으로 넘친다(flex 의 기본 `min-height: auto` 함정) — 이 값이 있어야 자식의
        // `overflowY: auto` 가 실제로 발동한다.
        <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0 }}>
          {/* 좌우 넘기기 — 상단 고정 구역. 양쪽 버튼 사이에 지금 보는 버전·날짜가 선다
              (2026-09-03 기현 지시, 곧이어 *"이전 버전 다음버전 좌우 바꿈"* — 화살표는 항상
              바깥(왼쪽 끝은 ←, 오른쪽 끝은 →)을 가리키고, 그 자리에 어느 동작이 서는지만 바꿨다).
              `aria-live` 로 화면리더가 넘길 때마다 새 버전을 읽는다. */}
          <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, margin: '-4px 0 14px', paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
            <button
              type="button"
              onClick={() => newer && setIndex(index - 1)}
              disabled={!newer}
              style={{ flex: 'none', background: 'none', border: 'none', padding: '6px 4px', minHeight: 'var(--hit)', fontSize: '0.8125rem', fontWeight: 600, color: newer ? 'var(--text)' : 'var(--faint-text)', cursor: newer ? 'pointer' : 'default', opacity: newer ? 1 : 0.4 }}
            >
              ← {t('app.changelog.newer')}
            </button>
            <div aria-live="polite" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.9375rem', fontWeight: 700 }}>v{current.version}</div>
              {current.date && <div style={{ fontSize: '0.75rem', color: 'var(--faint-text)' }}>{current.date}</div>}
            </div>
            <button
              type="button"
              onClick={() => older && setIndex(index + 1)}
              disabled={!older}
              style={{ flex: 'none', background: 'none', border: 'none', padding: '6px 4px', minHeight: 'var(--hit)', fontSize: '0.8125rem', fontWeight: 600, color: older ? 'var(--text)' : 'var(--faint-text)', cursor: older ? 'pointer' : 'default', opacity: older ? 1 : 0.4 }}
            >
              {t('app.changelog.older')} →
            </button>
          </div>
          {/* 스크롤은 이 안에서만 — 위 nav-row 와 Modal 의 제목·닫기는 패널에 고정된 채 남는다. */}
          <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto' }}>
            {current.groups.map((g, i) => (
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
        </div>
      ) : (
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.875rem', lineHeight: 1.6 }}>{t('app.changelog.empty')}</p>
      )}
    </Modal>
  );
}
