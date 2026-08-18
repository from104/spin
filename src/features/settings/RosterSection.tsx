// C8(2026-08-18 구조 개편) — 설정 화면의 **선수 명단(로스터)** 섹션. 질문 20문 ⑬·⑰:
// 단일 팀 명단(이름 + PF1/PF2 클래스). 저장은 통째로(saveRoster — 문서 하나라 부분 갱신이
// 없다), 편집 연산은 model/roster.ts 의 순수 헬퍼를 거친다.
//
// PF 클래스는 **선택**이다 — 분류 심사를 아직 안 받은 선수가 현실에 흔하다(미분류).
// 경기 규정(PF2 동시 출전 최대 2명)은 여기서 강제하지 않는다: 명단은 정원이 아니라 목록이고,
// 라인업 판단은 코치 몫이다. 세션 참가자 체크(SessionEditorScreen)가 이 명단을 읽는다.
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { loadRoster, saveRoster } from '../../storage/rosterRepo.ts';
import { PF_CLASSES, addPlayer, removePlayer, updatePlayer, type PFClass, type Roster } from '../../model/roster.ts';
import { LIMITS } from '../../model/validate.ts';
import { Button } from '../../ui/Button.tsx';
import { IconPlus } from '../../ui/icons.tsx';

export function RosterSection() {
  const [roster, setRoster] = useState<Roster | null>(null);
  const [newName, setNewName] = useState('');
  const [newClass, setNewClass] = useState<'' | PFClass>('');

  useEffect(() => {
    let cancelled = false;
    void loadRoster().then((r) => {
      if (!cancelled) setRoster(r);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!roster) return <p style={{ fontSize: '0.8125rem', color: 'var(--faint-text)' }}>불러오는 중…</p>;

  async function save(next: Roster): Promise<void> {
    setRoster(next); // 낙관적 반영 — 세션 편집 화면과 같은 패턴
    setRoster(await saveRoster(next));
  }

  const full = roster.players.length >= LIMITS.rosterMax;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {roster.players.length === 0 ? (
        <p style={{ fontSize: '0.8125rem', color: 'var(--faint-text)' }}>
          아직 등록한 선수가 없습니다. 명단을 만들면 세션 편집에서 참가자를 체크할 수 있습니다.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6, padding: 0, margin: 0 }}>
          {roster.players.map((p) => (
            <li key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                aria-label={`${p.name} 이름`}
                defaultValue={p.name}
                maxLength={LIMITS.playerNameLen}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v.length > 0 && v !== p.name) void save(updatePlayer(roster, p.id, { name: v }));
                }}
                style={{ ...inputStyle, flex: 1 }}
              />
              <select
                aria-label={`${p.name} 클래스`}
                value={p.klass ?? ''}
                onChange={(e) => {
                  const v = e.target.value as '' | PFClass;
                  // 미분류로 되돌리면 키를 지운다 — validateRoster 의 "없음 = 미분류" 교리.
                  void save(updatePlayer(roster, p.id, { klass: v === '' ? undefined : v }));
                }}
                style={{ ...inputStyle, width: 110 }}
              >
                <option value="">미분류</option>
                {PF_CLASSES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <button
                type="button"
                aria-label={`${p.name} 명단에서 삭제`}
                onClick={() => void save(removePlayer(roster, p.id))}
                style={iconBtnStyle}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="text"
          aria-label="새 선수 이름"
          placeholder="선수 이름"
          value={newName}
          maxLength={LIMITS.playerNameLen}
          onChange={(e) => setNewName(e.target.value)}
          style={{ ...inputStyle, flex: 1 }}
        />
        <select aria-label="새 선수 클래스" value={newClass} onChange={(e) => setNewClass(e.target.value as '' | PFClass)} style={{ ...inputStyle, width: 110 }}>
          <option value="">미분류</option>
          {PF_CLASSES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <Button
          variant="secondary"
          icon={<IconPlus size={14} />}
          disabled={newName.trim().length === 0 || full}
          onClick={() => {
            const name = newName.trim();
            if (name.length === 0 || full) return;
            void save(addPlayer(roster, name, newClass === '' ? undefined : newClass));
            setNewName('');
            setNewClass('');
          }}
        >
          추가
        </Button>
      </div>
      <p style={{ fontSize: '0.75rem', color: 'var(--faint-text)' }}>
        {roster.players.length}/{LIMITS.rosterMax}명{full ? ' — 정원이 찼습니다' : ''} · 명단은 전체 백업에 함께 실립니다
      </p>
    </div>
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
};

const iconBtnStyle: CSSProperties = {
  width: 'var(--hit)',
  height: 'var(--hit)',
  minWidth: 44,
  minHeight: 44,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--elev)',
  color: 'var(--text)',
};
