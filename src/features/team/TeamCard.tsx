// [팀] 목록의 카드 한 장 (PLAN-TEAM 결정 17). 세션 목록의 `SessionRow`(features/library/
// SessionTab.tsx)와 **같은 꼴**이다: 카드 전체가 여는 버튼, 오른쪽 끝에 ⋮ 케밥.
//
// ⚠️ 케밥에 **[링크로 공유] 를 만들지 않는다**(결정 12). 세션 행에는 그 항목이 있으므로 이 파일을
//    거기서 복사해 오는 다음 사람이 무심코 되살릴 수 있다 — 팀은 링크로 나가지 않고, 그 방어선은
//    `share/codec.ts` 의 닫힌 유니온과 **여기 이 주석** 둘이다.
//
// 등급 칩(PF1/PF2/미분류)은 **회색 정보 칩**이다(결정 9). 경고색을 쓰지 않는 이유: 스쿼드 편성에는
// 등급 조합 제한이 전혀 없다(R6). 규정이 걸리는 것은 라인업뿐이고 그 경고는 LineupBoard 가 낸다.
import { useId, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Team } from '../../model/team.ts';
import { rosterCounts } from '../../model/team.ts';
import { useT } from '../../i18n/useT.ts';

export interface TeamCardProps {
  team: Team;
  /** 첫 카드에만 `data-tut` 앵커를 단다 — 세션 카드(`sessions-card`)와 같은 관례다. */
  first?: boolean;
  onOpen(): void;
  onDuplicate(): void;
  onExport(): void;
  onPrint(): void;
  onDelete(): void;
}

export function TeamCard({ team, first, onOpen, onDuplicate, onExport, onPrint, onDelete }: TeamCardProps) {
  const t = useT();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const counts = rosterCounts(team);
  const activePlayers = team.players.filter((p) => p.active !== false).length;

  const item = (label: string, onAction: () => void, danger?: boolean) => (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        setMenuOpen(false);
        onAction();
      }}
      style={{ minHeight: 36, padding: '0 10px', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600, textAlign: 'left', ...(danger ? { color: '#e0554a' } : {}) }}
    >
      {label}
    </button>
  );

  return (
    <div
      data-tut={first ? 'team-card' : undefined}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        border: '1px solid var(--border)',
        borderRadius: 14,
        background: 'var(--panel)',
        padding: '14px 16px',
      }}
    >
      <button type="button" onClick={onOpen} aria-label={t('team.card.openAriaLabel', { name: team.name })} style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0, textAlign: 'left' }}>
        {/* 색 견본 둘 — 필드 색 위에 골키퍼 색을 작게 겹친다. 규정상 GK 는 다른 색이어야 하므로
            (Laws) 두 색을 **한 자리에서 나란히** 보여야 "같은 색으로 둔 것"이 눈에 띈다. */}
        <span aria-hidden style={{ flex: 'none', position: 'relative', width: 34, height: 34 }}>
          <span style={{ position: 'absolute', inset: 0, borderRadius: 9, background: team.color, border: '1px solid var(--border-strong)' }} />
          <span style={{ position: 'absolute', right: -3, bottom: -3, width: 16, height: 16, borderRadius: 6, background: team.gkColor, border: '1px solid var(--panel)' }} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: '0.9375rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team.name}</span>
            {team.shortName && <span style={{ fontSize: '0.75rem', color: 'var(--faint-text)', fontWeight: 600 }}>{team.shortName}</span>}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6, alignItems: 'center' }}>
            <span style={metaStyle}>{t('team.card.playerCount', { n: activePlayers })}</span>
            <span style={metaStyle}>{t('team.card.staffCount', { n: team.staff.length })}</span>
            <ClassChips pf1={counts.pf1} pf2={counts.pf2} unclassified={counts.unclassified} />
          </div>
          {(team.league || team.season) && (
            <div style={{ fontSize: '0.75rem', color: 'var(--faint-text)', marginTop: 4 }}>{[team.league, team.season].filter(Boolean).join(' · ')}</div>
          )}
        </div>
      </button>

      <div style={{ position: 'relative' }}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          aria-label={t('team.card.moreAriaLabel', { name: team.name })}
          title={t('team.card.moreAriaLabel', { name: team.name })}
          data-tut={first ? 'team-card-menu' : undefined}
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
            aria-label={t('team.card.menuAriaLabel', { name: team.name })}
            style={{
              position: 'absolute',
              right: 0,
              top: 40,
              zIndex: 10,
              minWidth: 150,
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
            {item(t('team.card.openMenuItem'), onOpen)}
            {item(t('team.card.duplicateMenuItem'), onDuplicate)}
            {item(t('team.card.exportMenuItem'), onExport)}
            {item(t('team.card.printMenuItem'), onPrint)}
            {item(t('team.card.deleteMenuItem'), onDelete, true)}
          </div>
        )}
      </div>
    </div>
  );
}

/** 회색 정보 칩(결정 9). 0 인 칸은 그리지 않는다 — "PF2 0" 은 알려 주는 것이 없으면서 줄만 채운다. */
export function ClassChips({ pf1, pf2, unclassified }: { pf1: number; pf2: number; unclassified: number }) {
  const t = useT();
  return (
    <>
      {pf1 > 0 && <span style={chipStyle}>{t('team.chip.pf1', { n: pf1 })}</span>}
      {pf2 > 0 && <span style={chipStyle}>{t('team.chip.pf2', { n: pf2 })}</span>}
      {unclassified > 0 && <span style={chipStyle}>{t('team.chip.unclassified', { n: unclassified })}</span>}
    </>
  );
}

const metaStyle: CSSProperties = { fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600 };

/** ⚠️ 경고색(노랑·빨강)을 쓰지 않는다 — 결정 9. `--panel-2` 바탕 + `--muted` 글자. */
const chipStyle: CSSProperties = {
  fontSize: '0.6875rem',
  fontWeight: 700,
  color: 'var(--muted)',
  background: 'var(--panel-2)',
  border: '1px solid var(--border)',
  borderRadius: 999,
  padding: '2px 8px',
};
