// C8(2026-08-18 구조 개편) — 설정 화면의 **선수 명단(로스터)** 섹션. 질문 20문 ⑬·⑰:
// 단일 팀 명단(이름 + PF1/PF2 클래스). 저장은 통째로(saveRoster — 문서 하나라 부분 갱신이
// 없다), 편집 연산은 model/roster.ts 의 순수 헬퍼를 거친다.
//
// PF 클래스는 **선택**이다 — 분류 심사를 아직 안 받은 선수가 현실에 흔하다(미분류).
// 경기 규정(PF2 동시 출전 최대 2명)은 여기서 강제하지 않는다: 명단은 정원이 아니라 목록이고,
// 라인업 판단은 코치 몫이다. 세션 참가자 체크(SessionEditorScreen)가 이 명단을 읽는다.
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { loadRoster, saveRoster } from '../../storage/rosterRepo.ts';
import { PF_CLASSES, addPlayer, removePlayer, updatePlayer, type PFClass, type Roster } from '../../model/roster.ts';
import { LIMITS } from '../../model/validate.ts';
import { Button } from '../../ui/Button.tsx';
import { IconPlus } from '../../ui/icons.tsx';
import { useT } from '../../i18n/useT.ts';
import { useToast } from '../../store/toast/ToastProvider.tsx';

export function RosterSection() {
  const [roster, setRoster] = useState<Roster | null>(null);
  const [newName, setNewName] = useState('');
  const [newClass, setNewClass] = useState<'' | PFClass>('');
  const t = useT();
  const toast = useToast();
  // 삭제 undo 토스트 — §C-3(세션 편집) 과 같은 화면 단위 스냅샷 패턴. 다른 저장(이름 수정·
  // 클래스 변경·추가·다른 삭제)이 끼어들면 반드시 거둔다 — 안 거두면 그 토스트의 "이전 상태"
  // 스냅샷이 그 사이의 새 편집을 덮어써 안전망이 데이터 손실 장치로 뒤집힌다.
  const undoToastIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadRoster().then((r) => {
      if (!cancelled) setRoster(r);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!roster) return <p style={{ fontSize: '0.8125rem', color: 'var(--faint-text)' }}>{t('settings.roster.loading')}</p>;

  async function save(next: Roster): Promise<void> {
    if (undoToastIdRef.current) {
      toast.dismiss(undoToastIdRef.current);
      undoToastIdRef.current = null;
    }
    setRoster(next); // 낙관적 반영 — 세션 편집 화면과 같은 패턴
    setRoster(await saveRoster(next));
  }

  const removeWithUndo = (p: Roster['players'][number]) => {
    const before = roster;
    void save(removePlayer(roster, p.id));
    undoToastIdRef.current = toast.show(t('settings.roster.removeToast', { name: p.name }), {
      action: { label: t('settings.roster.undoAction'), onAction: () => { undoToastIdRef.current = null; void save(before); } },
    });
  };

  const full = roster.players.length >= LIMITS.rosterMax;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {roster.players.length === 0 ? (
        <p style={{ fontSize: '0.8125rem', color: 'var(--faint-text)' }}>{t('settings.roster.empty')}</p>
      ) : (
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6, padding: 0, margin: 0 }}>
          {roster.players.map((p) => (
            <li key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                aria-label={t('settings.roster.nameAriaLabel', { name: p.name })}
                defaultValue={p.name}
                maxLength={LIMITS.playerNameLen}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v.length > 0 && v !== p.name) void save(updatePlayer(roster, p.id, { name: v }));
                  // 빈 값·공백만 있는 값은 저장하지 않는다 — 그런데 입력칸은 uncontrolled(defaultValue)라
                  // 그대로 두면 화면(빈 칸)과 저장값(옛 이름)이 갈라진다. 화면을 저장값으로 되돌린다.
                  else e.target.value = p.name;
                }}
                style={{ ...inputStyle, flex: 1 }}
              />
              <select
                aria-label={t('settings.roster.classAriaLabel', { name: p.name })}
                value={p.klass ?? ''}
                onChange={(e) => {
                  const v = e.target.value as '' | PFClass;
                  // 미분류로 되돌리면 키를 지운다 — validateRoster 의 "없음 = 미분류" 교리.
                  void save(updatePlayer(roster, p.id, { klass: v === '' ? undefined : v }));
                }}
                style={{ ...inputStyle, width: 110 }}
              >
                <option value="">{t('settings.roster.unclassified')}</option>
                {PF_CLASSES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <button
                type="button"
                aria-label={t('settings.roster.removeAriaLabel', { name: p.name })}
                onClick={() => removeWithUndo(p)}
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
          aria-label={t('settings.roster.newNameAriaLabel')}
          placeholder={t('settings.roster.newNamePlaceholder')}
          value={newName}
          maxLength={LIMITS.playerNameLen}
          onChange={(e) => setNewName(e.target.value)}
          style={{ ...inputStyle, flex: 1 }}
        />
        <select aria-label={t('settings.roster.newClassAriaLabel')} value={newClass} onChange={(e) => setNewClass(e.target.value as '' | PFClass)} style={{ ...inputStyle, width: 110 }}>
          <option value="">{t('settings.roster.unclassified')}</option>
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
          {t('settings.roster.addButton')}
        </Button>
      </div>
      <p style={{ fontSize: '0.75rem', color: 'var(--faint-text)' }}>
        {t('settings.roster.countLine', {
          count: roster.players.length,
          max: LIMITS.rosterMax,
          fullNote: full ? t('settings.roster.fullSuffix') : '',
        })}
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
