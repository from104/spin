// 팀 상세의 [선수] 절 (PLAN-TEAM 결정 17). 설정 화면의 `RosterSection`(2026-09-09 폐기)이 하던
// 일을 흡수하고, 거기 없던 것 넷을 더한다: **인라인 추가 행 · 행 클릭 편집 · 검색·정렬 · 비활성 보기**.
//
// ── 이 파일이 하지 않는 것 ────────────────────────────────────────────────────────
// - **저장을 모른다.** 편집은 `model/team.ts` 의 순수 헬퍼를 거쳐 `onChange(next)` 로 올려보내고,
//   IDB 쓰기는 TeamDetail 한 곳이 한다 — 저장 경로가 둘이 되면 낙관적 반영과 CAS 가 어긋난다.
// - **규정을 따지지 않는다.** 명단(스쿼드) 편성에는 등급 조합 제한이 전혀 없다(R6) — 그래서
//   머리의 PF 칩은 **회색 정보 칩**이고(결정 9), 노란 경고는 라인업 절에만 있다.
//
// ⚠️ **개인정보**: 만드는 입력칸은 결정 6 의 목록 그대로다. 성별·정확한 생년월일·사진·연락처·
//    진단명·보호자 칸을 여기에 **더하지 않는다** — 필드를 만들지 않는 것이 가장 강한 보호다.
//    자유 입력인 [메모] 는 막을 수 없으므로 입력칸 **아래에** 안내 한 줄을 붙인다.
//
// IME: 이름 입력의 Enter 는 `isImeKeyEvent` 로 조합 중을 걸러야 한글 이름 첫 글자가 확정되며
// 곧바로 추가되는 사고가 안 난다(ui/keyboard.ts 머리말).
import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { PFClass, Player } from '../../model/roster.ts';
import { PF_CLASSES } from '../../model/roster.ts';
import type { Team } from '../../model/team.ts';
import { addPlayer, rosterCounts, updatePlayer } from '../../model/team.ts';
import type { PlayerId } from '../../core/ids.ts';
import { LIMITS } from '../../model/validate.ts';
import { Button } from '../../ui/Button.tsx';
import { IconPlus } from '../../ui/icons.tsx';
import { Toggle } from '../../ui/Toggle.tsx';
import { isImeKeyEvent } from '../../ui/keyboard.ts';
import { useT } from '../../i18n/useT.ts';
import { ClassChips } from './TeamCard.tsx';

export type PlayerSort = 'number' | 'name' | 'klass';

export interface PlayerTableProps {
  team: Team;
  /** 선수별 «참가 세션 n회». 저장하지 않는 파생값이다(결정 10) — TeamDetail 이 세션에서 센다. */
  sessionCounts: Map<PlayerId, number>;
  onChange(next: Team): void;
  /** 삭제는 undo 토스트를 띄워야 해서 화면(TeamDetail)이 진다 — 여기서 `removePlayer` 를 직접
   *  부르면 되돌릴 스냅샷을 쥐는 자리가 둘이 된다. */
  onRemove(p: Player): void;
}

export function PlayerTable({ team, sessionCounts, onChange, onRemove }: PlayerTableProps) {
  const t = useT();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<PlayerSort>('number');
  const [showInactive, setShowInactive] = useState(false);
  const [editingId, setEditingId] = useState<PlayerId | null>(null);
  const [newName, setNewName] = useState('');
  const [newClass, setNewClass] = useState<'' | PFClass>('');

  const counts = rosterCounts(team);
  const full = team.players.length >= LIMITS.rosterMax;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = team.players.filter((p) => {
      if (!showInactive && p.active === false) return false;
      if (q.length === 0) return true;
      return p.name.toLowerCase().includes(q) || (p.number !== undefined && String(p.number).includes(q));
    });
    // ⚠️ 원본 배열을 정렬하지 않는다(`toSorted` 없이 spread) — 저장 순서는 추가 순서이고,
    //    화면 정렬이 그것을 갈아엎으면 [복제]·내보내기 파일의 줄 순서가 화면 따라 바뀐다.
    const by = [...filtered];
    if (sort === 'name') by.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'klass') by.sort((a, b) => classRank(a) - classRank(b) || a.name.localeCompare(b.name));
    // 등번호순: 미지정(undefined)은 **뒤로** 민다. 0 이 유효한 등번호라 0 으로 접을 수 없다.
    else by.sort((a, b) => (a.number ?? Number.MAX_SAFE_INTEGER) - (b.number ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name));
    return by;
  }, [team.players, query, sort, showInactive]);

  const commitAdd = () => {
    const name = newName.trim();
    if (name.length === 0 || full) return;
    onChange(addPlayer(team, name.slice(0, LIMITS.playerNameLen), newClass === '' ? undefined : newClass));
    setNewName('');
    setNewClass('');
  };

  return (
    <div data-tut="team-players" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <input
          type="search"
          aria-label={t('team.players.searchAriaLabel')}
          placeholder={t('team.players.searchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ ...inputStyle, flex: '1 1 160px', minWidth: 120 }}
        />
        <select aria-label={t('team.players.sortAriaLabel')} value={sort} onChange={(e) => setSort(e.target.value as PlayerSort)} style={{ ...inputStyle, width: 130 }}>
          <option value="number">{t('team.players.sortNumber')}</option>
          <option value="name">{t('team.players.sortName')}</option>
          <option value="klass">{t('team.players.sortClass')}</option>
        </select>
        {/* Toggle 자신이 라벨을 품는다 — <label> 로 감싸면 role="switch" 버튼이 두 번 읽힌다. */}
        <Toggle checked={showInactive} onChange={setShowInactive} label={t('team.players.showInactive')} ariaLabel={t('team.players.showInactive')} />
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <ClassChips pf1={counts.pf1} pf2={counts.pf2} unclassified={counts.unclassified} />
        </span>
      </div>

      {team.players.length === 0 ? (
        <p style={hintStyle}>{t('team.players.empty')}</p>
      ) : rows.length === 0 ? (
        <p style={hintStyle}>{t('team.players.emptyFiltered')}</p>
      ) : (
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6, padding: 0, margin: 0 }}>
          {rows.map((p) => (
            <li key={p.id}>
              <PlayerRow
                player={p}
                team={team}
                sessions={sessionCounts.get(p.id) ?? 0}
                expanded={editingId === p.id}
                onToggle={() => setEditingId((cur) => (cur === p.id ? null : p.id))}
                onChange={onChange}
                onRemove={() => {
                  setEditingId(null);
                  onRemove(p);
                }}
              />
            </li>
          ))}
        </ul>
      )}

      {/* 인라인 추가 행 — 목록 **아래**다. 위에 두면 목록이 길어질 때 추가할 자리를 찾으러
          스크롤을 올려야 하고, 방금 추가한 사람이 화면 밖에 생긴다. */}
      <div data-tut="team-player-add" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="text"
          aria-label={t('team.players.addNameAriaLabel')}
          placeholder={t('team.players.addNamePlaceholder')}
          value={newName}
          maxLength={LIMITS.playerNameLen}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            // ⚠️ 한글·일본어 조합 중의 Enter 는 "조합 확정" 이지 "제출" 이 아니다.
            if (e.key !== 'Enter' || isImeKeyEvent(e.nativeEvent)) return;
            e.preventDefault();
            commitAdd();
          }}
          style={{ ...inputStyle, flex: '1 1 150px', minWidth: 120 }}
        />
        <select aria-label={t('team.players.addClassAriaLabel')} value={newClass} onChange={(e) => setNewClass(e.target.value as '' | PFClass)} style={{ ...inputStyle, width: 110 }}>
          <option value="">{t('team.players.unclassified')}</option>
          {PF_CLASSES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <Button variant="secondary" icon={<IconPlus size={14} />} disabled={newName.trim().length === 0 || full} onClick={commitAdd}>
          {t('team.players.addButton')}
        </Button>
      </div>
      <p style={{ ...hintStyle, marginTop: 0 }}>
        {t('team.players.countLine', { count: team.players.length, max: LIMITS.rosterMax, fullNote: full ? t('team.players.fullSuffix') : '' })}
      </p>
    </div>
  );
}

/** 미분류를 **맨 뒤**로 민다 — 등급순 정렬은 "심사받은 사람부터" 라는 뜻이지 미분류가 PF1 보다
 *  가볍다는 뜻이 아니다(R8: 미분류는 어느 쪽으로도 세지 않는다). */
function classRank(p: Player): number {
  return p.klass === 'PF1' ? 0 : p.klass === 'PF2' ? 1 : 2;
}

function PlayerRow({
  player,
  team,
  sessions,
  expanded,
  onToggle,
  onChange,
  onRemove,
}: {
  player: Player;
  team: Team;
  sessions: number;
  expanded: boolean;
  onToggle(): void;
  onChange(next: Team): void;
  onRemove(): void;
}) {
  const t = useT();
  const p = player;
  const patch = (fields: Parameters<typeof updatePlayer>[2]) => onChange(updatePlayer(team, p.id, fields));

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: expanded ? 'var(--panel-2)' : 'transparent' }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={t('team.players.editAriaLabel', { name: p.name })}
        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 'var(--hit)', padding: '0 12px', textAlign: 'left' }}
      >
        <span style={{ flex: 'none', width: 30, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: p.number === undefined ? 'var(--faint-text)' : 'var(--text)' }}>
          {p.number ?? t('team.players.noNumber')}
        </span>
        <span style={{ flex: 1, minWidth: 0, fontSize: '0.875rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: p.active === false ? 0.55 : 1 }}>
          {p.name}
        </span>
        <span style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {p.klass && <span style={badgeStyle}>{p.klass}</span>}
          {p.isCaptain && <span style={badgeStyle}>{t('team.players.captainBadge')}</span>}
          {p.preferredGk && <span style={badgeStyle}>{t('team.players.gkBadge')}</span>}
          {p.active === false && <span style={badgeStyle}>{t('team.players.inactiveBadge')}</span>}
          <span style={{ fontSize: '0.6875rem', color: 'var(--faint-text)' }}>{t('team.players.sessionCount', { n: sessions })}</span>
        </span>
      </button>

      {expanded && (
        <div style={{ padding: '4px 12px 12px', display: 'grid', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
            <Field label={t('team.players.nameLabel')}>
              <input
                type="text"
                defaultValue={p.name}
                maxLength={LIMITS.playerNameLen}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  // 빈 이름은 커밋하지 않는다 — 그런데 uncontrolled 라 화면을 저장값으로 되돌려야
                  // 표시와 저장본이 갈라지지 않는다(RosterSection 이 쓰던 그 규칙).
                  if (v.length > 0 && v !== p.name) patch({ name: v });
                  else e.target.value = p.name;
                }}
                style={inputStyle}
              />
            </Field>
            <Field label={t('team.players.numberLabel')}>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={99}
                defaultValue={p.number ?? ''}
                onBlur={(e) => {
                  const raw = e.target.value.trim();
                  if (raw === '') {
                    patch({ number: undefined });
                    return;
                  }
                  const n = Math.round(Number(raw));
                  if (!Number.isFinite(n) || n < 0 || n > 99) {
                    e.target.value = p.number === undefined ? '' : String(p.number);
                    return;
                  }
                  patch({ number: n });
                }}
                style={inputStyle}
              />
            </Field>
            <Field label={t('team.players.classLabel')}>
              <select
                value={p.klass ?? ''}
                onChange={(e) => {
                  const v = e.target.value as '' | PFClass;
                  // 미분류로 되돌리면 **키를 지운다** — "없음 = 미분류" 교리(model/roster.ts).
                  patch({ klass: v === '' ? undefined : v });
                }}
                style={inputStyle}
              >
                <option value="">{t('team.players.unclassified')}</option>
                {PF_CLASSES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('team.players.birthYearLabel')}>
              <input
                type="number"
                inputMode="numeric"
                min={1900}
                max={2100}
                defaultValue={p.birthYear ?? ''}
                onBlur={(e) => {
                  const raw = e.target.value.trim();
                  if (raw === '') {
                    patch({ birthYear: undefined });
                    return;
                  }
                  const n = Math.round(Number(raw));
                  if (!Number.isFinite(n) || n < 1900 || n > 2100) {
                    e.target.value = p.birthYear === undefined ? '' : String(p.birthYear);
                    return;
                  }
                  patch({ birthYear: n });
                }}
                style={inputStyle}
              />
            </Field>
            <Field label={t('team.players.chairModelLabel')}>
              <input
                type="text"
                defaultValue={p.chairModel ?? ''}
                maxLength={LIMITS.chairModelLen}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  patch({ chairModel: v.length > 0 ? v : undefined });
                }}
                style={inputStyle}
              />
            </Field>
          </div>

          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            <CheckRow label={t('team.players.captainLabel')} checked={p.isCaptain === true} onChange={(v) => patch({ isCaptain: v ? true : undefined })} />
            <CheckRow label={t('team.players.preferredGkLabel')} title={t('team.players.preferredGkHint')} checked={p.preferredGk === true} onChange={(v) => patch({ preferredGk: v ? true : undefined })} />
            <CheckRow label={t('team.players.activeLabel')} title={t('team.players.activeHint')} checked={p.active !== false} onChange={(v) => patch({ active: v ? undefined : false })} />
          </div>

          <Field label={t('team.players.noteLabel')}>
            <textarea
              rows={2}
              defaultValue={p.note ?? ''}
              maxLength={LIMITS.playerNoteLen}
              onBlur={(e) => {
                const v = e.target.value.trim();
                patch({ note: v.length > 0 ? v : undefined });
              }}
              style={{ ...inputStyle, minHeight: 56, padding: '0.5rem 0.75rem', resize: 'vertical' }}
            />
          </Field>
          {/* ⚠️ 이 줄을 지우지 마라 — 결정 6. 자유 입력칸을 막을 수는 없으므로 안내가 유일한 울타리다. */}
          <p style={{ ...hintStyle, marginTop: -4 }}>{t('team.players.notePrivacyHint')}</p>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={onToggle}>
              {t('team.players.closeEdit')}
            </Button>
            <Button variant="secondary" onClick={onRemove} style={{ color: '#e0554a' }}>
              {t('team.players.removeButton')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600 }}>
      {label}
      {children}
    </label>
  );
}

function CheckRow({ label, title, checked, onChange }: { label: string; title?: string; checked: boolean; onChange(v: boolean): void }) {
  return (
    <label title={title} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', minHeight: 'var(--hit)' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ width: 18, height: 18 }} />
      {label}
    </label>
  );
}

const inputStyle: CSSProperties = {
  minHeight: 'var(--hit)',
  padding: '0 0.75rem',
  borderRadius: '0.6rem',
  border: '1px solid var(--border)',
  background: 'var(--elev)',
  color: 'var(--text)',
  fontSize: '0.8125rem',
  width: '100%',
};

const hintStyle: CSSProperties = { fontSize: '0.75rem', color: 'var(--faint-text)', margin: 0 };

const badgeStyle: CSSProperties = {
  fontSize: '0.6875rem',
  fontWeight: 700,
  color: 'var(--muted)',
  background: 'var(--panel-2)',
  border: '1px solid var(--border)',
  borderRadius: 999,
  padding: '2px 7px',
};
