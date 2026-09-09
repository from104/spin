// 팀 상세 — 헤더(이름·약칭·팀 색) + 네 절(선수 / 스태프 / 라인업 / 정보). PLAN-TEAM 결정 17.
// 팀 색은 팔레트 + 킷 배치라 위젯 하나가 통째로 맡는다(`KitPicker.tsx`, 2026-09-09).
//
// **저장은 이 파일 한 곳이다.** 아래 절 컴포넌트들은 `model/team.ts` 의 순수 헬퍼로 다음 팀
// 객체를 만들어 `onChange(next)` 로 올려보내고, IDB 쓰기(`putTeam`)는 여기서만 한다 — 쓰기 경로가
// 둘이 되면 낙관적 반영과 CAS(`expectedUpdatedAt`)가 서로를 덮는다.
//
// ⚠️ **낙관적 반영 + 저장본 되받기.** `putTeam` 은 `validateTeam` 을 지난 값을 돌려주므로, 보정이
//    일어났으면 화면도 보정된 값을 봐야 한다(teamRepo 머리말). 그래서 저장 뒤 상태를 반환값으로
//    한 번 더 덮는다 — RosterSection 이 쓰던 그 규칙이다.
//
// ⚠️ **[링크로 공유] 버튼을 만들지 않는다**(결정 12). 여기 있는 내보내는 길은 [내보내기](파일)과
//    [인쇄] 둘뿐이고, 드라이브 동기화는 사용자가 켜는 별도 기능이다.
//
// 전역 «현재 팀» 상태는 만들지 않는다(결정 17) — 무엇이 열려 있는지의 진실은 URL 이다.
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { Team } from '../../model/team.ts';
import { playerSessionCounts, removePlayer, removeStaff } from '../../model/team.ts';
import type { Staff } from '../../model/team.ts';
import type { Player } from '../../model/roster.ts';
import type { TeamId } from '../../core/ids.ts';
import { LIMITS } from '../../model/validate.ts';
import { getTeam, putTeam } from '../../storage/teamRepo.ts';
import { useLibrary } from '../../store/library/LibraryProvider.tsx';
import { useToast } from '../../store/toast/ToastProvider.tsx';
import { Button } from '../../ui/Button.tsx';
import { DELETE_UNDO_TOAST_MS } from '../../ui/Toast.tsx';
import { useT } from '../../i18n/useT.ts';
import { PlayerTable } from './PlayerTable.tsx';
import { StaffList } from './StaffList.tsx';
import { LineupBoard } from './LineupBoard.tsx';
import { KitPicker } from './KitPicker.tsx';
import { useIsNarrow } from '../../ui/useIsNarrow.ts';

export interface TeamDetailProps {
  teamId: TeamId;
  /** 상세에서 바꾼 값이 목록 카드에도 보여야 한다 — 화면을 나갈 때가 아니라 **저장할 때마다**
   *  알린다(목록은 자기 배열을 들고 있다). */
  onSaved(team: Team): void;
  onExport(team: Team): void;
  onPrint(team: Team): void;
}

export function TeamDetail({ teamId, onSaved, onExport, onPrint }: TeamDetailProps) {
  const t = useT();
  const toast = useToast();
  const { sessions } = useLibrary();
  // 넓은 창(≥ NARROW_MAX_PX)에서는 네 절을 2열로 — 왼쪽 선수·스태프, 오른쪽 라인업·정보(2026-09-09 기현님 지시).
  // 좁은 창은 한 열 그대로. 문턱은 레일·헤더와 같은 useIsNarrow 하나를 쓴다(문턱이 두 벌이면 어긋난다).
  // 조기 반환(없음·로딩)보다 앞에 두어야 훅 순서가 렌더마다 같다.
  const twoCol = !useIsNarrow();
  const [team, setTeam] = useState<Team | null>(null);
  const [missing, setMissing] = useState(false);
  // 삭제 undo 토스트는 다른 저장이 끼어들면 **반드시 거둔다** — 안 거두면 그 토스트가 쥔 옛
  // 스냅샷이 그 사이의 편집을 덮어써, 안전망이 데이터 손실 장치로 뒤집힌다(RosterSection 의 교훈).
  const undoToastIdRef = useRef<string | null>(null);
  /** 저장 요청 순번 — 늦게 도착한 응답이 최신 화면을 덮는 것을 막는다(아래 `save`). */
  const saveSeqRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    setTeam(null);
    setMissing(false);
    void getTeam(teamId).then((got) => {
      if (cancelled) return;
      if (got) setTeam(got);
      else setMissing(true);
    });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  if (missing) return <p style={hintStyle}>{t('team.detail.notFound')}</p>;
  if (!team) return <p style={hintStyle}>{t('team.loading')}</p>;
  const current = team;

  const save = (next: Team): void => {
    if (undoToastIdRef.current) {
      toast.dismiss(undoToastIdRef.current);
      undoToastIdRef.current = null;
    }
    setTeam(next); // 낙관적 반영 — 입력이 한 프레임도 멈추지 않아야 인라인 편집이 편집답다
    // ⚠️ **마지막 요청만 화면에 반영한다**(2026-09-09 검수). `putTeam` 은 비동기라, 짧은 사이에
    // 두 번 저장하면 먼저 보낸 것이 나중에 도착할 수 있고 그 `setTeam(saved)` 가 **더 최신인
    // 낙관 값을 옛 값으로 되돌린다**(색을 고르는 동안 눈앞에서 튀는 그 증상). 순번을 세어
    // 뒤처진 응답의 화면 반영만 버린다 — 저장 자체는 CAS 가 판정하므로 버리지 않는다.
    const seq = (saveSeqRef.current += 1);
    void putTeam(next)
      .then((saved) => {
        if (seq !== saveSeqRef.current) return;
        setTeam(saved);
        onSaved(saved);
      })
      .catch(() => toast.show(t('team.detail.saveFailToast')));
  };

  const removePlayerWithUndo = (p: Player): void => {
    const before = current;
    save(removePlayer(current, p.id));
    undoToastIdRef.current = toast.show(t('team.players.removeToast', { name: p.name }), {
      durationMs: DELETE_UNDO_TOAST_MS,
      action: {
        label: t('team.undoAction'),
        onAction: () => {
          undoToastIdRef.current = null;
          save(before);
        },
      },
    });
  };

  const removeStaffWithUndo = (s: Staff): void => {
    const before = current;
    save(removeStaff(current, s.id));
    undoToastIdRef.current = toast.show(t('team.staff.removeToast', { name: s.name }), {
      durationMs: DELETE_UNDO_TOAST_MS,
      action: {
        label: t('team.undoAction'),
        onAction: () => {
          undoToastIdRef.current = null;
          save(before);
        },
      },
    });
  };

  const counts = playerSessionCounts(current, sessions.map((r) => r.session));
  const colStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* ⚠️ 헤더 카드 둘이 아래 절들과 **같은 그리드** 안에 산다(2026-09-09 기현 지시:
          *"색 선택이 포함된 카드가 넓은 폭에서 절반 폭이 돼야하고"*). 별도 그리드를 하나 더
          만들지 않는 이유: 열 너비가 두 곳에서 계산되면 넓은 창에서 위·아래 카드의 세로선이
          어긋난다. 좁은 창에서는 한 열이라 기본 정보 → 팀 색 → 선수·스태프 → 라인업·정보 순이다.
          ── ⚠️ 2026-09-09: 이전에는 이름·약칭·색·[내보내기]·[인쇄]가 **한 장의 전폭 카드**였다.
          색이 팔레트 + 킷 3줄로 자라면서 그 카드가 화면 절반을 먹어, 지시대로 둘로 갈랐다. */}
      <div style={{ display: 'grid', gridTemplateColumns: twoCol ? 'minmax(0, 1fr) minmax(0, 1fr)' : 'minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
        <Section title={t('team.detail.sectionBasics')}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
            <Field label={t('team.detail.nameLabel')} style={{ flex: '2 1 160px' }}>
              <input
                type="text"
                defaultValue={current.name}
                maxLength={LIMITS.teamNameLen}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  // 이름 없는 팀을 만들지 않는다 — 빈 값이면 화면을 저장값으로 되돌린다.
                  if (v.length > 0 && v !== current.name) save({ ...current, name: v });
                  else e.target.value = current.name;
                }}
                style={inputStyle}
              />
            </Field>
            <Field label={t('team.detail.shortNameLabel')} style={{ flex: '1 1 90px', maxWidth: 130 }}>
              <input
                type="text"
                placeholder={t('team.detail.shortNamePlaceholder')}
                defaultValue={current.shortName ?? ''}
                maxLength={LIMITS.shortNameLen}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v === (current.shortName ?? '')) return;
                  // 빈 값이면 **키를 지운다** — `{shortName: ''}` 는 "약칭이 빈 문자열" 이라는 별개의 상태다.
                  const { shortName: _drop, ...rest } = current;
                  save(v.length > 0 ? { ...current, shortName: v } : rest);
                }}
                style={inputStyle}
              />
            </Field>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <Button data-tut="team-export" variant="secondary" onClick={() => onExport(current)}>
                {t('team.detail.exportButton')}
              </Button>
              <Button data-tut="team-print" variant="secondary" onClick={() => onPrint(current)}>
                {t('team.detail.printButton')}
              </Button>
            </div>
          </div>
        </Section>

        {/* ── ⚠️ 2026-09-09: 색 두 칸(팀 색·골키퍼 색)이 헤더에 있었다 ───────────────────
            *"팀 색은 홈, 어웨이, 중립 세트 정할 수 있고. 색 4개를 미리 선택하고 배치하는식으로"*
            지시로 팔레트 + 킷 배치(`KitPicker`)가 그 자리를 받았다. 그 두 칸이 지키던 규율
            — 색 선택기를 드래그하는 동안에는 저장하지 않는다(실측: 한 번 고르는 데 IDB 쓰기
            20건) — 은 사라지지 않고 `KitPicker` 머리말로 옮겨 갔다. */}
        <Section title={t('team.kits.sectionTitle')}>
          <KitPicker team={current} onChange={save} />
        </Section>

        <div style={colStyle}>
          <Section title={t('team.detail.sectionPlayers')}>
            <PlayerTable team={current} sessionCounts={counts} onChange={save} onRemove={removePlayerWithUndo} />
          </Section>

          <Section title={t('team.detail.sectionStaff')}>
            <StaffList team={current} onChange={save} onRemove={removeStaffWithUndo} />
          </Section>
        </div>

        <div style={colStyle}>
          <Section title={t('team.detail.sectionLineup')}>
            <LineupBoard team={current} onChange={save} />
          </Section>

          <Section title={t('team.detail.sectionInfo')}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
              <Field label={t('team.detail.leagueLabel')}>
                <input
                  type="text"
                  defaultValue={current.league ?? ''}
                  maxLength={LIMITS.teamLeagueLen}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v === (current.league ?? '')) return;
                    const { league: _drop, ...rest } = current;
                    save(v.length > 0 ? { ...current, league: v } : rest);
                  }}
                  style={inputStyle}
                />
              </Field>
              <Field label={t('team.detail.seasonLabel')}>
                <input
                  type="text"
                  defaultValue={current.season ?? ''}
                  maxLength={LIMITS.teamSeasonLen}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v === (current.season ?? '')) return;
                    const { season: _drop, ...rest } = current;
                    save(v.length > 0 ? { ...current, season: v } : rest);
                  }}
                  style={inputStyle}
                />
              </Field>
            </div>
            <p style={hintStyle}>{t('team.detail.seasonHint')}</p>
            <Field label={t('team.detail.noteLabel')}>
              <textarea
                rows={3}
                defaultValue={current.note ?? ''}
                maxLength={LIMITS.teamNoteLen}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v === (current.note ?? '')) return;
                  const { note: _drop, ...rest } = current;
                  save(v.length > 0 ? { ...current, note: v } : rest);
                }}
                style={{ ...inputStyle, minHeight: 72, padding: '0.5rem 0.75rem', resize: 'vertical' }}
              />
            </Field>
            {/* 팀 메모도 자유 입력이다 — 선수 메모와 같은 울타리(결정 6). */}
            <p style={hintStyle}>{t('team.players.notePrivacyHint')}</p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--panel)', padding: 16 }}>
      <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: '0 0 12px' }}>{title}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </section>
  );
}

function Field({ label, style, children }: { label: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600, ...style }}>
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
