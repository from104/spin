// §6.11 "(세션 탭) 세션 리스트 행 (요일·시각 Space Grotesk 17px/700 + 장소 / 세션명 + 카테고리 점 /
// 총 시간 + "N개 드릴" + [시연] 44×44)". 프로토타입에 없던 탭이라 §6.11 서술을 그대로 마크업화한다.
import { useId, useRef, useState } from 'react';
import { formatSessionWhen } from '../../model/session.ts';
import type { ResolvedSession } from '../../model/session.ts';
import { categoryColor } from '../../core/colors.ts';
import { IconPlay, IconPlus } from '../../ui/icons.tsx';
import { Button } from '../../ui/Button.tsx';

const MAX_DOTS = 4;

export interface SessionTabProps {
  sessions: ResolvedSession[];
  onOpen(id: ResolvedSession['session']['id']): void;
  onPresent(id: ResolvedSession['session']['id']): void;
  onDelete(id: ResolvedSession['session']['id']): void;
  onExport(id: ResolvedSession['session']['id']): void;
  onCreate(): void;
}

export function SessionTab({ sessions, onOpen, onPresent, onDelete, onExport, onCreate }: SessionTabProps) {
  if (sessions.length === 0) {
    return (
      <div
        style={{
          border: '1px dashed var(--border-strong)',
          borderRadius: 16,
          padding: '48px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
          textAlign: 'center',
        }}
      >
        <p style={{ fontSize: '0.875rem', color: 'var(--faint-text)' }}>아직 만든 세션이 없습니다. 드릴을 묶어 훈련 순서를 계획해 보세요.</p>
        <Button variant="primary" icon={<IconPlus size={14} />} onClick={onCreate}>
          새 세션
        </Button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {sessions.map((s) => (
        <SessionRow key={s.session.id} resolved={s} onOpen={() => onOpen(s.session.id)} onPresent={() => onPresent(s.session.id)} onDelete={() => onDelete(s.session.id)} onExport={() => onExport(s.session.id)} />
      ))}
    </div>
  );
}

function SessionRow({ resolved, onOpen, onPresent, onDelete, onExport }: { resolved: ResolvedSession; onOpen(): void; onPresent(): void; onDelete(): void; onExport(): void }) {
  const { session, items, totalMin } = resolved;
  const categories = Array.from(new Set(items.map((it) => it.categoryCache))).slice(0, MAX_DOTS);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        border: '1px solid var(--border)',
        borderRadius: 14,
        background: 'var(--panel)',
        padding: '14px 16px',
      }}
    >
      <button type="button" onClick={onOpen} style={{ display: 'flex', alignItems: 'center', gap: 18, flex: 1, minWidth: 0, textAlign: 'left' }}>
        <div style={{ flex: 'none', minWidth: 96 }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.0625rem', fontWeight: 700 }}>
            {session.scheduledAt !== undefined ? formatSessionWhen(session.scheduledAt) : '미정'}
          </div>
          {session.location && <div style={{ fontSize: '0.75rem', color: 'var(--faint-text)', marginTop: 2 }}>{session.location}</div>}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.title}</span>
            <span aria-hidden style={{ display: 'flex', gap: 3 }}>
              {categories.map((c) => (
                <span key={c} style={{ width: 7, height: 7, borderRadius: '50%', background: categoryColor(c) }} />
              ))}
            </span>
          </div>
        </div>
        <div style={{ flex: 'none', fontSize: '0.78125rem', color: 'var(--muted)', fontWeight: 600 }}>
          {totalMin}분 · {items.length}개 드릴
        </div>
      </button>

      <button
        type="button"
        onClick={onPresent}
        aria-label={`${session.title} 시연 시작`}
        style={{
          flex: 'none',
          width: 44,
          height: 44,
          borderRadius: 11,
          background: 'var(--accent)',
          color: 'var(--accent-ink-strong)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        className="on-accent"
      >
        <IconPlay />
      </button>

      <div ref={menuRef} style={{ position: 'relative' }}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          aria-label={`${session.title} 더보기`}
          onClick={() => setMenuOpen((v) => !v)}
          style={{ width: 36, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint-text)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden fill="currentColor">
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
        </button>
        {menuOpen && (
          <div
            id={menuId}
            role="menu"
            aria-label={`${session.title} 작업`}
            style={{
              position: 'absolute',
              right: 0,
              top: 40,
              zIndex: 10,
              minWidth: 140,
              border: '1px solid var(--border-strong)',
              borderRadius: 10,
              background: 'var(--panel)',
              boxShadow: '0 12px 26px -10px rgba(0,0,0,.55)',
              padding: 6,
              display: 'flex',
              flexDirection: 'column',
            }}
            onPointerLeave={() => setMenuOpen(false)}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onExport();
              }}
              style={{ minHeight: 36, padding: '0 10px', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600, textAlign: 'left' }}
            >
              내보내기
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onDelete();
              }}
              style={{ minHeight: 36, padding: '0 10px', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600, textAlign: 'left', color: '#e0554a' }}
            >
              삭제
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
