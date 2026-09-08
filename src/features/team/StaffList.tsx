// 팀 상세의 [스태프] 절 (PLAN-TEAM 결정 7·17). 벤치에 서는 사람들 — FIPFA Technical Supplement
// 의 역할 목록(코치·보조코치·매니저·의무·활동지원·정비)을 **복수 선택**으로 준다.
//
// 왜 복수인가: 국내 팀은 한 사람이 코치 겸 정비를 겸하는 일이 흔하다. 역할을 하나로 강제하면
// 인쇄한 팀시트가 현실과 다르게 나온다.
//
// **선임 코치는 역할이 아니라 지목이다** — 벤치 제재를 승계하는 사람이라 팀당 1명이어야 하고,
// 역할로 두면 여럿이 될 수 있어야 하는 자리와 섞인다(model/team.ts Staff 주석). 여기서 켜면
// `updateStaff` 가 나머지를 끈다 — 저장 뒤 `validateTeam` 도 같은 규칙을 걸지만, 눌렀을 때
// 화면이 즉시 하나만 보여야 사람이 "저장이 안 됐나" 로 읽지 않는다.
//
// ⚠️ 자격증 번호·유효기간 칸을 만들지 않는다(결정 7). 선수 쪽과 같은 이유다 — 필드가 있으면
//    언젠가 채워지고, 채워지면 백업·동기화·인쇄물을 타고 흐른다.
import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { Staff, StaffRole, Team } from '../../model/team.ts';
import { STAFF_ROLES, addStaff, updateStaff } from '../../model/team.ts';
import type { PlayerId, StaffId } from '../../core/ids.ts';
import { LIMITS } from '../../model/validate.ts';
import { Button } from '../../ui/Button.tsx';
import { IconPlus } from '../../ui/icons.tsx';
import { isImeKeyEvent } from '../../ui/keyboard.ts';
import { useT } from '../../i18n/useT.ts';
import type { DictKey } from '../../i18n/ko.ts';

/** 역할 → 사전 키. 사전 문자열을 `team.staff.role.${r}` 로 조립하지 않는 이유는 `DictKey` 가
 *  템플릿 문자열을 안 좁혀 주기 때문이다 — 표로 두면 키 오타가 컴파일 에러가 된다. */
const ROLE_KEY: Record<StaffRole, DictKey> = {
  coach: 'team.staff.role.coach',
  assistantCoach: 'team.staff.role.assistantCoach',
  manager: 'team.staff.role.manager',
  doctor: 'team.staff.role.doctor',
  carer: 'team.staff.role.carer',
  mechanic: 'team.staff.role.mechanic',
};

export interface StaffListProps {
  team: Team;
  onChange(next: Team): void;
  onRemove(s: Staff): void;
}

export function StaffList({ team, onChange, onRemove }: StaffListProps) {
  const t = useT();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<StaffId | null>(null);
  const full = team.staff.length >= LIMITS.staffMax;

  const commitAdd = () => {
    const name = newName.trim();
    if (name.length === 0 || full) return;
    onChange(addStaff(team, name.slice(0, LIMITS.playerNameLen)));
    setNewName('');
  };

  return (
    <div data-tut="team-staff" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {team.staff.length === 0 ? (
        <p style={hintStyle}>{t('team.staff.empty')}</p>
      ) : (
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6, padding: 0, margin: 0 }}>
          {team.staff.map((s) => (
            <li key={s.id}>
              <StaffRow
                staff={s}
                team={team}
                expanded={editingId === s.id}
                onToggle={() => setEditingId((cur) => (cur === s.id ? null : s.id))}
                onChange={onChange}
                onRemove={() => {
                  setEditingId(null);
                  onRemove(s);
                }}
              />
            </li>
          ))}
        </ul>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="text"
          aria-label={t('team.staff.addNameAriaLabel')}
          placeholder={t('team.staff.addNamePlaceholder')}
          value={newName}
          maxLength={LIMITS.playerNameLen}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || isImeKeyEvent(e.nativeEvent)) return;
            e.preventDefault();
            commitAdd();
          }}
          style={{ ...inputStyle, flex: '1 1 150px', minWidth: 120 }}
        />
        <Button variant="secondary" icon={<IconPlus size={14} />} disabled={newName.trim().length === 0 || full} onClick={commitAdd}>
          {t('team.staff.addButton')}
        </Button>
      </div>
      <p style={hintStyle}>{t('team.staff.countLine', { count: team.staff.length, max: LIMITS.staffMax, fullNote: full ? t('team.staff.fullSuffix') : '' })}</p>
    </div>
  );
}

function StaffRow({
  staff,
  team,
  expanded,
  onToggle,
  onChange,
  onRemove,
}: {
  staff: Staff;
  team: Team;
  expanded: boolean;
  onToggle(): void;
  onChange(next: Team): void;
  onRemove(): void;
}) {
  const t = useT();
  const s = staff;
  const patch = (fields: Parameters<typeof updateStaff>[2]) => onChange(updateStaff(team, s.id, fields));
  const roleNames = s.roles.map((r) => t(ROLE_KEY[r]));

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: expanded ? 'var(--panel-2)' : 'transparent' }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={t('team.staff.editAriaLabel', { name: s.name })}
        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 'var(--hit)', padding: '0 12px', textAlign: 'left' }}
      >
        <span style={{ flex: 1, minWidth: 0, fontSize: '0.875rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
        <span style={{ fontSize: '0.75rem', color: roleNames.length > 0 ? 'var(--muted)' : 'var(--faint-text)' }}>
          {roleNames.length > 0 ? roleNames.join(' · ') : t('team.staff.noRoles')}
        </span>
        {s.isSeniorCoach && <span style={badgeStyle}>{t('team.staff.seniorCoachLabel')}</span>}
      </button>

      {expanded && (
        <div style={{ padding: '4px 12px 12px', display: 'grid', gap: 10 }}>
          <Field label={t('team.staff.nameLabel')}>
            <input
              type="text"
              defaultValue={s.name}
              maxLength={LIMITS.playerNameLen}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v.length > 0 && v !== s.name) patch({ name: v });
                else e.target.value = s.name;
              }}
              style={inputStyle}
            />
          </Field>

          <fieldset style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <legend style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600, padding: 0 }}>{t('team.staff.rolesLabel')}</legend>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
              {STAFF_ROLES.map((r) => (
                <label key={r} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: '0.8125rem', minHeight: 'var(--hit)' }}>
                  <input
                    type="checkbox"
                    checked={s.roles.includes(r)}
                    onChange={(e) => {
                      // 순서는 STAFF_ROLES 를 따른다 — 체크한 순서대로 쌓으면 같은 두 사람이
                      // 인쇄물에서 다른 순서로 찍혀 "다른 역할" 처럼 읽힌다.
                      const next = e.target.checked ? STAFF_ROLES.filter((x) => x === r || s.roles.includes(x)) : s.roles.filter((x) => x !== r);
                      patch({ roles: [...next] });
                    }}
                    style={{ width: 18, height: 18 }}
                  />
                  {t(ROLE_KEY[r])}
                </label>
              ))}
            </div>
          </fieldset>

          <label title={t('team.staff.seniorCoachHint')} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', minHeight: 'var(--hit)' }}>
            <input type="checkbox" checked={s.isSeniorCoach === true} onChange={(e) => patch({ isSeniorCoach: e.target.checked ? true : undefined })} style={{ width: 18, height: 18 }} />
            {t('team.staff.seniorCoachLabel')}
          </label>
          <p style={{ ...hintStyle, marginTop: -6 }}>{t('team.staff.seniorCoachHint')}</p>

          <Field label={t('team.staff.playerLinkLabel')}>
            <select
              value={s.playerId ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                patch({ playerId: v === '' ? undefined : (v as PlayerId) });
              }}
              style={inputStyle}
            >
              <option value="">{t('team.staff.playerLinkNone')}</option>
              {team.players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t('team.staff.noteLabel')}>
            <textarea
              rows={2}
              defaultValue={s.note ?? ''}
              maxLength={LIMITS.playerNoteLen}
              onBlur={(e) => {
                const v = e.target.value.trim();
                patch({ note: v.length > 0 ? v : undefined });
              }}
              style={{ ...inputStyle, minHeight: 56, padding: '0.5rem 0.75rem', resize: 'vertical' }}
            />
          </Field>
          {/* 선수 [메모]와 같은 울타리 — 스태프 메모도 자유 입력이다(결정 6·7). */}
          <p style={{ ...hintStyle, marginTop: -4 }}>{t('team.players.notePrivacyHint')}</p>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={onToggle}>
              {t('team.staff.closeEdit')}
            </Button>
            <Button variant="secondary" onClick={onRemove} style={{ color: '#e0554a' }}>
              {t('team.staff.removeButton')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600 }}>
      {label}
      {children}
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
