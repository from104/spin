// §6.11 "(세션 탭) 세션 리스트 행 (요일·시각 Space Grotesk 17px/700 + 장소 / 세션명 + 카테고리 점 /
// 총 시간 + "N개 드릴" + [시연] 44×44)". 프로토타입에 없던 탭이라 §6.11 서술을 그대로 마크업화한다.
//
// 2026-08-12(계획서 2.8): HomeDashboard 를 지우면서 그 '다음 세션' 카드 하나만 여기 **머리**로
// 흡수했다. 대시보드의 나머지(히어로·통계 4칸·최근 드릴)는 되살리지 않는다 — 목록 위에 얹혀
// 첫 화면 표적 예산만 먹고 드릴 그리드를 접힘 아래로 밀어냈던 것이 제거 이유다. 남긴 것은
// "다음에 뭘 하지" 라는 질문 하나뿐이고, 그 답은 세션 탭에서 물어야 맥락이 맞는다.
import { useId, useRef, useState } from 'react';
import { formatSessionWhen, pickNextSession } from '../../model/session.ts';
import type { ResolvedSession } from '../../model/session.ts';
import { drillTypeColor } from '../../core/colors.ts';
import { IconPlay, IconPlus } from '../../ui/icons.tsx';
import { Button } from '../../ui/Button.tsx';
import { useT } from '../../i18n/useT.ts';
import { useLocale } from '../../i18n/useLocale.ts';

const MAX_DOTS = 4;
const MAX_STRIP_DRILLS = 4;

export interface SessionTabProps {
  sessions: ResolvedSession[];
  onOpen(id: ResolvedSession['session']['id']): void;
  onPresent(id: ResolvedSession['session']['id']): void;
  onDelete(id: ResolvedSession['session']['id']): void;
  onExport(id: ResolvedSession['session']['id']): void;
  onCreate(): void;
}

export function SessionTab({ sessions, onOpen, onPresent, onDelete, onExport, onCreate }: SessionTabProps) {
  const t = useT();
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
        <p style={{ fontSize: '0.875rem', color: 'var(--faint-text)' }}>{t('sessionTab.emptyNoSessions')}</p>
        <Button variant="primary" icon={<IconPlus size={14} />} onClick={onCreate}>
          {t('sessionTab.newSessionButton')}
        </Button>
      </div>
    );
  }

  // 시각이 잡힌 세션 중 가장 가까운 것 하나. 전부 '미정' 이면 스트립 자체가 안 뜬다 —
  // 없는 것을 "없습니다" 라고 알리는 빈 카드는 대시보드에서 자리만 먹던 그것이다.
  const nextRaw = pickNextSession(sessions.map((s) => s.session));
  const next = nextRaw ? sessions.find((s) => s.session.id === nextRaw.id) : undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {next && <NextSessionStrip resolved={next} onOpen={() => onOpen(next.session.id)} />}
      {sessions.map((s) => (
        <SessionRow key={s.session.id} resolved={s} onOpen={() => onOpen(s.session.id)} onPresent={() => onPresent(s.session.id)} onDelete={() => onDelete(s.session.id)} onExport={() => onExport(s.session.id)} />
      ))}
    </div>
  );
}

/** 목록 머리의 '다음 세션' 한 줄. 아래 행과 같은 세션을 한 번 더 보여주지만 **행에 없는 것**을
 *  싣는다 — 편성된 드릴 이름이다. 표적은 하나(스트립 전체가 열기 버튼)로 둔다: [시연] 을 여기
 *  또 두면 같은 이름의 버튼이 화면에 둘이 되어 보조기술에 중복 표적이 된다(2.7 의 [열기] 판단과
 *  같은 이유). 시연은 바로 아래 행의 44×44 [시연] 이 이미 맡고 있다. */
function NextSessionStrip({ resolved, onOpen }: { resolved: ResolvedSession; onOpen(): void }) {
  const { session, items, totalMin } = resolved;
  const shown = items.slice(0, MAX_STRIP_DRILLS);
  const more = items.length - shown.length;
  const t = useT();
  const locale = useLocale();
  const when = session.scheduledAt !== undefined ? formatSessionWhen(session.scheduledAt, locale) : t('sessionTab.unscheduled');

  return (
    <section
      aria-label={t('sessionTab.nextSessionLabel')}
      style={{
        border: '1px solid var(--accent)',
        borderRadius: 14,
        background: 'color-mix(in srgb, var(--accent) 8%, var(--panel))',
        padding: '12px 16px 14px',
        marginBottom: 8,
      }}
    >
      <div style={{ fontSize: '0.71875rem', fontWeight: 700, letterSpacing: 0.4, color: 'var(--accent-text)', marginBottom: 6 }}>{t('sessionTab.nextSessionLabel')}</div>
      <button
        type="button"
        onClick={onOpen}
        aria-label={t('sessionTab.nextSessionOpenAriaLabel', { title: session.title })}
        style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 16, minHeight: 'var(--hit)', flexWrap: 'wrap' }}
      >
        <span style={{ flex: 'none', fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.0625rem', fontWeight: 700 }}>{when}</span>
        <span style={{ minWidth: 0, flex: 1, fontSize: '0.875rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {session.title}
        </span>
        <span style={{ flex: 'none', fontSize: '0.78125rem', color: 'var(--muted)', fontWeight: 600 }}>
          {[session.location, t('common.minutes', { min: totalMin }), t('sessionTab.drillCount', { count: items.length })].filter(Boolean).join(' · ')}
        </span>
      </button>
      {shown.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 8 }}>
          {shown.map((it) => (
            <span key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', opacity: it.missing ? 0.5 : 1 }}>
              <span aria-hidden style={{ flex: 'none', width: 7, height: 7, borderRadius: '50%', background: drillTypeColor(it.categoryCache) }} />
              {it.missing ? t('sessionTab.missingDrillSuffix', { title: it.titleCache }) : it.titleCache}
            </span>
          ))}
          {more > 0 && <span style={{ fontSize: '0.75rem', color: 'var(--faint-text)' }}>{t('sessionTab.moreCount', { count: more })}</span>}
        </div>
      )}
    </section>
  );
}

function SessionRow({ resolved, onOpen, onPresent, onDelete, onExport }: { resolved: ResolvedSession; onOpen(): void; onPresent(): void; onDelete(): void; onExport(): void }) {
  const { session, items, totalMin } = resolved;
  const categories = Array.from(new Set(items.map((it) => it.categoryCache))).slice(0, MAX_DOTS);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const t = useT();
  const locale = useLocale();

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
            {session.scheduledAt !== undefined ? formatSessionWhen(session.scheduledAt, locale) : t('sessionTab.unscheduled')}
          </div>
          {session.location && <div style={{ fontSize: '0.75rem', color: 'var(--faint-text)', marginTop: 2 }}>{session.location}</div>}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.title}</span>
            <span aria-hidden style={{ display: 'flex', gap: 3 }}>
              {categories.map((c) => (
                <span key={c} style={{ width: 7, height: 7, borderRadius: '50%', background: drillTypeColor(c) }} />
              ))}
            </span>
          </div>
        </div>
        <div style={{ flex: 'none', fontSize: '0.78125rem', color: 'var(--muted)', fontWeight: 600 }}>
          {t('common.minutes', { min: totalMin })} · {t('sessionTab.drillCount', { count: items.length })}
        </div>
      </button>

      <button
        type="button"
        onClick={onPresent}
        aria-label={t('drillCard.presentAriaLabel', { title: session.title })}
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
          aria-label={t('drillCard.kebabMoreAriaLabel', { title: session.title })}
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
            aria-label={t('drillCard.kebabMenuAriaLabel', { title: session.title })}
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
              {t('sessionTab.exportMenuItem')}
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
              {t('drillCard.deleteMenuItem')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
