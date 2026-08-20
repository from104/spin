// C6(2026-08-18 구조 개편) — **세션 전용 편집 화면** (`#/sessions/:id`). 드로어(SessionDrawer)의
// 후계다: phase 계층(질문 20문 ②)·목표 시간 배분(⑮)이 들어오면서 드로어 폭으로는 안 됐다.
//
// 화면이 하는 일 셋:
//  ① 세션 정보 — 이름·일시·장소·목표 총 시간, 그리고 총 시간 대 목표의 배분 게이지(강제 없음)
//  ② 구획(phase) 편집 — 종류·이름·목표 배분·순서·삭제(항목은 앞 구획에 병합 — session.ts
//     removePhase 의 규칙), 구획별 드릴 추가·시간 override·이동·제거
//  ③ 시연·내보내기 — 드로어 하단 그대로
//
// 저장은 드로어의 낙관 패턴 그대로다: setSession(즉시) → putSession → refresh. 편집 연산은
// 전부 model/session.ts 의 순수 헬퍼를 거친다 — 화면이 phases 를 손으로 주무르면 "빈 구획을
// 지워야 하나" 같은 규칙이 화면마다 갈라진다(그 헬퍼들의 존재 이유).
import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useLibrary } from '../../store/library/LibraryProvider.tsx';
import { useToast } from '../../store/toast/ToastProvider.tsx';
import { getSession, putSession } from '../../storage/sessionRepo.ts';
import { exportOneSession } from '../library/transfer.ts';
import type { SessionId } from '../../core/ids.ts';
import type { DrillSummary } from '../../model/summary.ts';
import {
  PHASE_KIND_LABELS,
  SESSION_PHASE_KINDS,
  addSessionItem,
  flattenSessionItems,
  movePhase,
  moveSessionItemFlat,
  phaseLabel,
  removePhase,
  removeSessionItem,
  resolveSession,
  updatePhase,
  updateSessionItem,
  type ResolvedPhase,
  type SessionPhaseKind,
  type TrainingSession,
} from '../../model/session.ts';
import { LIMITS } from '../../model/validate.ts';
import { newId } from '../../core/ids.ts';
import { loadRoster } from '../../storage/rosterRepo.ts';
import type { Player, Roster } from '../../model/roster.ts';
import { Button } from '../../ui/Button.tsx';
import { IconPlus } from '../../ui/icons.tsx';
import type { HomeNav } from '../home/nav.ts';
import { liveRegion } from '../../ui/LiveRegion.tsx';
import { useT } from '../../i18n/useT.ts';
import { useLocale } from '../../i18n/useLocale.ts';

export interface SessionEditorScreenProps {
  nav: HomeNav;
  sessionId: SessionId;
}

export function SessionEditorScreen({ nav, sessionId }: SessionEditorScreenProps) {
  const { drills, refresh } = useLibrary();
  const toast = useToast();
  const [session, setSession] = useState<TrainingSession | null>(null);
  const [missing, setMissing] = useState(false);
  const t = useT();

  useEffect(() => {
    let cancelled = false;
    setSession(null);
    setMissing(false);
    void getSession(sessionId).then((r) => {
      if (cancelled) return;
      if (r) setSession(r.session);
      else setMissing(true);
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const existing = useMemo(() => new Set(drills.map((d) => d.id)), [drills]);
  const resolved = useMemo(() => (session ? resolveSession(session, existing) : null), [session, existing]);

  async function save(next: TrainingSession): Promise<void> {
    setSession(next); // 낙관적 반영 — 입력 필드가 왕복 지연 없이 즉시 갱신된다(드로어 패턴)
    const saved = await putSession(next);
    setSession(saved);
    await refresh();
  }

  if (missing) {
    return (
      <Main>
        <p style={{ fontSize: '0.875rem', color: 'var(--faint-text)' }}>{t('sessionEditor.notFound')}</p>
        <Button variant="secondary" onClick={() => nav.goLibrary({ tab: 'sessions' })}>
          {t('sessionEditor.backToList')}
        </Button>
      </Main>
    );
  }
  if (!session || !resolved) {
    return (
      <Main>
        <p style={{ fontSize: '0.8125rem', color: 'var(--faint-text)' }}>{t('common.loading')}</p>
      </Main>
    );
  }

  const goal = session.goalTotalMin;
  const over = goal !== undefined && resolved.totalMin > goal;

  return (
    <Main>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 860, margin: '0 auto' }}>
        {/* ── ① 세션 정보 ─────────────────────────────────────────────────────────── */}
        <section aria-label={t('sessionEditor.infoSectionAriaLabel')} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
          <Field label={t('sessionEditor.nameFieldLabel')}>
            <input
              type="text"
              defaultValue={session.title}
              onBlur={(e) => e.target.value.trim() && e.target.value !== session.title && void save({ ...session, title: e.target.value.trim() })}
              style={inputStyle}
            />
          </Field>
          <Field label={t('sessionEditor.dateFieldLabel')}>
            <input
              type="datetime-local"
              defaultValue={session.scheduledAt !== undefined ? toLocalInputValue(session.scheduledAt) : ''}
              onBlur={(e) => {
                const ms = fromLocalInputValue(e.target.value);
                void save(ms === undefined ? omit(session, 'scheduledAt') : { ...session, scheduledAt: ms });
              }}
              style={inputStyle}
            />
          </Field>
          <Field label={t('sessionEditor.locationFieldLabel')}>
            <input
              type="text"
              defaultValue={session.location ?? ''}
              onBlur={(e) => e.target.value !== (session.location ?? '') && void save(e.target.value ? { ...session, location: e.target.value } : omit(session, 'location'))}
              style={inputStyle}
            />
          </Field>
          <Field label={t('sessionEditor.goalFieldLabel')}>
            <input
              type="number"
              min={0}
              max={480}
              defaultValue={goal ?? ''}
              onBlur={(e) => {
                const v = Math.round(Number(e.target.value));
                void save(Number.isFinite(v) && v > 0 ? { ...session, goalTotalMin: v } : omit(session, 'goalTotalMin'));
              }}
              style={inputStyle}
            />
          </Field>
          {/* 세션 메모(§0.5 미배송 빚, 2026-08-20) — PrintSessionPlan.tsx 는 이미 이 값을
              인쇄물 상단에 그린다(45행). 입력 자리가 없어 늘 빈칸이었을 뿐이다. */}
          <Field label={t('sessionEditor.noteFieldLabel')} style={{ gridColumn: '1 / -1' }}>
            <textarea
              rows={2}
              maxLength={LIMITS.sessionNoteLen}
              defaultValue={session.note ?? ''}
              onBlur={(e) => {
                const v = e.target.value;
                void save(v.trim().length > 0 ? { ...session, note: v } : omit(session, 'note'));
              }}
              style={{ ...inputStyle, minHeight: 44, padding: '0.4rem 0.75rem', resize: 'vertical' }}
            />
          </Field>
        </section>

        {/* 배분 게이지 — 강제 없음(질문 ⑮). 초과는 색으로만 말한다. */}
        <section aria-label={t('sessionEditor.allocationSectionAriaLabel')} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', fontWeight: 700 }}>
            <span style={{ color: 'var(--muted)' }}>{t('sessionEditor.allocationTotal')}</span>
            <span style={{ color: over ? 'var(--danger, #ef4444)' : 'var(--text)' }}>
              {t('sessionEditor.allocationTotalMin', { total: resolved.totalMin })}
              {goal !== undefined ? t('sessionEditor.allocationGoalSuffix', { goal, overNote: over ? t('sessionEditor.allocationOverNote') : '' }) : ''}
              {resolved.missingCount > 0 ? t('sessionEditor.allocationMissingSuffix', { count: resolved.missingCount }) : ''}
            </span>
          </div>
          {goal !== undefined && (
            <div aria-hidden style={{ height: 6, borderRadius: 3, background: 'var(--elev)', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, (resolved.totalMin / goal) * 100)}%`,
                  background: over ? 'var(--danger, #ef4444)' : 'var(--accent)',
                }}
              />
            </div>
          )}
        </section>

        <div style={{ height: 1, background: 'var(--border)' }} />

        {/* ── ①b 참가자 (C8 — 로스터 체크. 명단의 주인은 설정 > 선수 명단) ────────── */}
        <ParticipantChecklist session={session} onSave={(next) => void save(next)} />

        <div style={{ height: 1, background: 'var(--border)' }} />

        {/* ── ② 구획 편집 ─────────────────────────────────────────────────────────── */}
        <section aria-label={t('sessionEditor.phasesSectionAriaLabel')} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {resolved.phases.map((rp, pi) => (
            <PhaseCard
              key={rp.phase.id}
              resolved={rp}
              index={pi}
              count={resolved.phases.length}
              session={session}
              drills={drills}
              onSave={(next) => void save(next)}
            />
          ))}
          <Button
            variant="secondary"
            icon={<IconPlus size={14} />}
            onClick={() => void save({ ...session, phases: [...session.phases, { id: newId('ph'), kind: 'custom', items: [] }] })}
          >
            {t('sessionEditor.addPhaseButton')}
          </Button>
        </section>

        <div style={{ height: 1, background: 'var(--border)' }} />

        {/* ── ③ 시연·내보내기 ─────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" onClick={() => void exportOneSession(session).then(() => toast.show(t('sessionsScreen.exportToast', { title: session.title })))}>
            {t('sessionTab.exportMenuItem')}
          </Button>
          <Button variant="primary" fullWidth onClick={() => nav.presentSession(session.id)} style={{ height: 48 }}>
            {t('sessionEditor.presentButton')}
          </Button>
        </div>
      </div>
    </Main>
  );
}

// ── 참가자 체크리스트 (C8) ──────────────────────────────────────────────────────────────────
// 명단은 설정 > 선수 명단이 주인이고, 여기는 **읽고 체크만** 한다. participantIds 는 세션 v2
// 의 선택 필드 — 아무도 체크 안 하면 키를 지운다(미지정 = 키 없음 교리).
function ParticipantChecklist({ session, onSave }: { session: TrainingSession; onSave(next: TrainingSession): void }) {
  const [roster, setRoster] = useState<Roster | null>(null);
  const t = useT();
  useEffect(() => {
    let cancelled = false;
    void loadRoster().then((r) => {
      if (!cancelled) setRoster(r);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const checked = new Set(session.participantIds ?? []);
  const toggle = (id: Player['id']) => {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    const ids = [...next];
    onSave(ids.length > 0 ? { ...session, participantIds: ids } : omit(session, 'participantIds'));
  };

  return (
    <section aria-label={t('participantChecklist.sectionLabel')} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--faint-text)' }}>{t('participantChecklist.sectionLabel')}</h3>
        {roster && roster.players.length > 0 && (
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)' }}>
            {t('participantChecklist.countSuffix', { checked: checked.size, total: roster.players.length })}
            {/* PF2 는 경기에서 동시 출전 최대 2명(FIPFA) — 참가는 제한하지 않고 셈만 보여준다. */}
            {(() => {
              const pf2 = roster.players.filter((p) => checked.has(p.id) && p.klass === 'PF2').length;
              return pf2 > 0 ? t('participantChecklist.pf2Suffix', { count: pf2 }) : '';
            })()}
          </span>
        )}
      </div>
      {!roster ? (
        <p style={{ fontSize: '0.8125rem', color: 'var(--faint-text)' }}>{t('common.loading')}</p>
      ) : roster.players.length === 0 ? (
        <p style={{ fontSize: '0.8125rem', color: 'var(--faint-text)' }}>{t('participantChecklist.empty')}</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {roster.players.map((p) => (
            <label
              key={p.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                minHeight: 'var(--hit)',
                padding: '0 12px',
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: checked.has(p.id) ? 'var(--accent)' : 'var(--elev)',
                color: checked.has(p.id) ? 'var(--accent-ink-strong)' : 'var(--text)',
                fontSize: '0.8125rem',
                fontWeight: 600,
              }}
              className={checked.has(p.id) ? 'on-accent' : undefined}
            >
              <input type="checkbox" checked={checked.has(p.id)} onChange={() => toggle(p.id)} style={{ margin: 0 }} />
              {p.name}
              {p.klass && <span style={{ fontSize: '0.6875rem', opacity: 0.8 }}>{p.klass}</span>}
            </label>
          ))}
        </div>
      )}
    </section>
  );
}

// ── 구획 카드 ────────────────────────────────────────────────────────────────────────────────
function PhaseCard({
  resolved,
  index,
  count,
  session,
  drills,
  onSave,
}: {
  resolved: ResolvedPhase;
  index: number;
  count: number;
  session: TrainingSession;
  drills: DrillSummary[];
  onSave(next: TrainingSession): void;
}) {
  const { phase, items, totalMin } = resolved;
  const [addDrillId, setAddDrillId] = useState('');
  // 항목 메모·휴식 시간(§0.5 미배송 빚) — 상시 노출하면 항목이 많은 구획에서 화면이
  // 붐빈다. NotePanel 과 같은 결(필요할 때만 펼침) 로, 한 번에 하나만 편다.
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const t = useT();
  const locale = useLocale();
  const flat = flattenSessionItems(session);
  const flatIndexOf = (itemId: string) => flat.findIndex((it) => it.id === itemId);
  const planned = phase.plannedMin;
  const overPlanned = planned !== undefined && totalMin > planned;
  // 이미 편성된 드릴은 목록에서 뺀다 — 같은 드릴을 두 구획에 겹쳐 넣는 실수 방지(드로어 규칙 유지).
  const inSession = new Set(flat.map((it) => it.drillId));
  const addable = drills.filter((d) => !inSession.has(d.id));

  return (
    <section
      aria-label={t('phaseCard.sectionAriaLabel', { label: phaseLabel(phase, locale) })}
      style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
        <Field label={t('phaseCard.kindFieldLabel')}>
          <select
            value={phase.kind}
            onChange={(e) => onSave(updatePhase(session, phase.id, { kind: e.target.value as SessionPhaseKind }))}
            style={{ ...inputStyle, width: 'auto', minWidth: 110 }}
          >
            {SESSION_PHASE_KINDS.map((k) => (
              <option key={k} value={k}>
                {PHASE_KIND_LABELS[locale][k]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('phaseCard.titleFieldLabel')}>
          <input
            type="text"
            defaultValue={phase.title ?? ''}
            placeholder={PHASE_KIND_LABELS[locale][phase.kind]}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v === (phase.title ?? '')) return;
              onSave(updatePhase(session, phase.id, { title: v.length > 0 ? v : undefined }));
            }}
            style={{ ...inputStyle, width: 160 }}
          />
        </Field>
        <Field label={t('phaseCard.plannedFieldLabel')}>
          <input
            type="number"
            min={0}
            max={480}
            defaultValue={planned ?? ''}
            onBlur={(e) => {
              const v = Math.round(Number(e.target.value));
              onSave(updatePhase(session, phase.id, { plannedMin: Number.isFinite(v) && v > 0 ? v : undefined }));
            }}
            style={{ ...inputStyle, width: 100 }}
          />
        </Field>
        <span style={{ marginLeft: 'auto', fontSize: '0.8125rem', fontWeight: 700, color: overPlanned ? 'var(--danger, #ef4444)' : 'var(--muted)', paddingBottom: 10 }}>
          {t('phaseCard.subtotalMin', { total: totalMin })}
          {planned !== undefined ? t('phaseCard.subtotalPlannedSuffix', { planned, overNote: overPlanned ? t('phaseCard.subtotalOverNote') : '' }) : ''}
        </span>
        <div style={{ display: 'flex', gap: 4, paddingBottom: 4 }}>
          <IconBtn label={t('phaseCard.moveUpAriaLabel', { label: phaseLabel(phase, locale) })} disabled={index === 0} onClick={() => onSave(movePhase(session, phase.id, -1))}>
            ↑
          </IconBtn>
          <IconBtn label={t('phaseCard.moveDownAriaLabel', { label: phaseLabel(phase, locale) })} disabled={index === count - 1} onClick={() => onSave(movePhase(session, phase.id, 1))}>
            ↓
          </IconBtn>
          <IconBtn
            label={t('phaseCard.deleteAriaLabel', { label: phaseLabel(phase, locale) })}
            disabled={count === 1 && items.length > 0}
            onClick={() => {
              onSave(removePhase(session, phase.id));
              if (items.length > 0) liveRegion.say(t('phaseCard.deleteAnnounce'));
            }}
          >
            ✕
          </IconBtn>
        </div>
      </div>

      {items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((it) => {
            const fi = flatIndexOf(it.id);
            const expanded = expandedItemId === it.id;
            const hasNoteOrRest = !!it.note || !!it.restAfterMin;
            return (
              <div key={it.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '4px 8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: '0.8125rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {it.titleCache}
                    {it.missing && <span style={{ color: 'var(--danger, #ef4444)', marginLeft: 6, fontSize: '0.75rem' }}>{t('phaseCard.missingDrillBadge')}</span>}
                  </span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--muted)' }}>
                    <span className="sr-only">{t('phaseCard.itemDurationAriaLabel', { title: it.titleCache })}</span>
                    <input
                      type="number"
                      min={0}
                      max={480}
                      aria-label={t('phaseCard.itemDurationAriaLabel', { title: it.titleCache })}
                      defaultValue={it.durationOverrideMin ?? it.durationMinCache}
                      onBlur={(e) => {
                        const v = Math.round(Number(e.target.value));
                        if (!Number.isFinite(v) || v < 0) return;
                        onSave(updateSessionItem(session, it.id, { durationOverrideMin: v }));
                      }}
                      style={{ ...inputStyle, width: 72, minHeight: 36 }}
                    />
                    {t('phaseCard.minutesUnit')}
                  </label>
                  {/* 메모·휴식 시간(§0.5 미배송 빚, 2026-08-20) — PrintSessionPlan.tsx 가
                      이미 이 값들로 열/문단을 그린다(66·67행). 값이 있으면 손잡이 색을
                      바꿔 "이미 적어 뒀다" 는 것을 접힌 채로도 알린다. */}
                  <IconBtn
                    label={t(hasNoteOrRest ? 'phaseCard.itemNoteEditAriaLabel' : 'phaseCard.itemNoteAddAriaLabel', { title: it.titleCache })}
                    onClick={() => setExpandedItemId(expanded ? null : it.id)}
                  >
                    {hasNoteOrRest ? '◆' : '◇'}
                  </IconBtn>
                  <IconBtn label={t('phaseCard.itemMoveUpAriaLabel', { title: it.titleCache })} disabled={fi <= 0} onClick={() => onSave(moveSessionItemFlat(session, fi, fi - 1))}>
                    ↑
                  </IconBtn>
                  <IconBtn label={t('phaseCard.itemMoveDownAriaLabel', { title: it.titleCache })} disabled={fi < 0 || fi >= flat.length - 1} onClick={() => onSave(moveSessionItemFlat(session, fi, fi + 1))}>
                    ↓
                  </IconBtn>
                  <IconBtn label={t('phaseCard.itemRemoveAriaLabel', { title: it.titleCache })} onClick={() => onSave(removeSessionItem(session, it.id))}>
                    ✕
                  </IconBtn>
                </div>
                {expanded && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                    <Field label={t('phaseCard.itemNoteFieldLabel')} style={{ flex: 1, minWidth: 0 }}>
                      <input
                        type="text"
                        maxLength={LIMITS.itemNoteLen}
                        defaultValue={it.note ?? ''}
                        onBlur={(e) => onSave(updateSessionItem(session, it.id, { note: e.target.value.trim() || undefined }))}
                        style={inputStyle}
                      />
                    </Field>
                    <Field label={t('phaseCard.itemRestFieldLabel')} style={{ flex: 'none', width: 96 }}>
                      <input
                        type="number"
                        min={0}
                        max={LIMITS.restAfterMinMax}
                        defaultValue={it.restAfterMin ?? ''}
                        onBlur={(e) => {
                          const v = Math.round(Number(e.target.value));
                          onSave(updateSessionItem(session, it.id, { restAfterMin: Number.isFinite(v) && v > 0 ? v : undefined }));
                        }}
                        style={inputStyle}
                      />
                    </Field>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label className="sr-only" htmlFor={`add-${phase.id}`}>
          {t('phaseCard.addDrillLabel', { label: phaseLabel(phase, locale) })}
        </label>
        <select id={`add-${phase.id}`} value={addDrillId} onChange={(e) => setAddDrillId(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
          <option value="">{t('phaseCard.addDrillPlaceholder')}</option>
          {addable.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </select>
        <Button
          variant="secondary"
          icon={<IconPlus size={14} />}
          disabled={!addDrillId}
          onClick={() => {
            const d = drills.find((x) => x.id === addDrillId);
            if (!d) return;
            onSave(
              addSessionItem(
                session,
                { id: newId('it'), drillId: d.id, titleCache: d.title, durationMinCache: d.durationMin, categoryCache: d.drillType },
                phase.id,
              ),
            );
            setAddDrillId('');
          }}
        >
          {t('settings.roster.addButton')}
        </Button>
      </div>
    </section>
  );
}

// ── 소품 ────────────────────────────────────────────────────────────────────────────────────
function Main({ children }: { children: ReactNode }) {
  return (
    <main id="main" tabIndex={-1} style={{ flex: 1, overflowY: 'auto', outline: 'none', padding: '22px 30px 46px', background: 'var(--bg)' }}>
      {children}
    </main>
  );
}

function Field({ label, children, style }: { label: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', ...style }}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function IconBtn({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick(): void; children: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      style={{
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
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
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

/** datetime-local ↔ epoch ms. 드로어의 그 함수들 — 드로어 은퇴와 함께 여기로 이사했다. */
function toLocalInputValue(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInputValue(v: string): number | undefined {
  if (!v) return undefined;
  const ms = new Date(v).getTime();
  return Number.isFinite(ms) ? ms : undefined;
}

/** 선택 키 제거 — `{key: undefined}` 를 남기지 않는다(omitKey 교리). */
function omit<T extends object, K extends keyof T>(obj: T, key: K): T {
  const copy = { ...obj };
  delete copy[key];
  return copy;
}
