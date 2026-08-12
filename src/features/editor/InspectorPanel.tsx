// §6.10/프로토타입 359–398행 "드릴 정보 / 선수 명단 / 스텝" 우측 인스펙터. 312px 폭, 편집기
// 3영역 중 `<aside aria-label="드릴 속성">`(§7.5a).
import { useState } from 'react';
import type { CSSProperties, Dispatch, ReactNode } from 'react';
import { isId } from '../../core/ids.ts';
import type { ArrowId, ChairId, NoteId } from '../../core/ids.ts';
import { KNOWN_CATEGORIES, TEAM_COLOR_CHOICES, inkFor } from '../../core/colors.ts';
import { ARROW_STYLES, arrowColor } from '../../model/arrow.ts';
import type { Drill, DrillLevel, DrillStep } from '../../model/drill.ts';
import { DRILL_LEVELS } from '../../model/drill.ts';
import { COURT_DEFS } from '../../model/court.ts';
import { LIMITS } from '../../model/validate.ts';
import type { EditorAction } from '../../store/editor/actions.ts';
import { Button } from '../../ui/Button.tsx';
import { IconPlus } from '../../ui/icons.tsx';
import { liveRegion } from '../../ui/LiveRegion.tsx';

export interface InspectorPanelProps {
  drill: Drill;
  step: DrillStep;
  stepIndex: number;
  dispatch: Dispatch<EditorAction>;
  selection: ReadonlySet<string>;
  pendingPlayerId: ChairId | null;
  onArmPlayer(id: ChairId): void;
  onEraseIds(ids: string[], scope: 'onward' | 'thisStep'): void;
  /** 스텝 섹션(목록·복제·삭제·추가)을 낼지. 자유 전술판은 1장짜리라 false 다(§6.8 재편) —
   *  하단 트랜스포트만 감추고 여기를 놔두면 화면에 없는 2번째 스텝을 만들 수 있어, 판이
   *  조용히 여러 장이 된다(눈으로는 알 수 없다). 기본값은 드릴 편집 쪽인 true. */
  showSteps?: boolean;
}

const SECTION_LABEL: CSSProperties = { fontSize: '0.65625rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--faint-text)', marginBottom: 11, textTransform: 'uppercase' };
const inputStyle: CSSProperties = {
  minHeight: 'var(--hit)',
  padding: '0 0.6875rem',
  borderRadius: '0.5rem',
  border: '1px solid var(--border)',
  background: 'var(--elev)',
  color: 'var(--text)',
  fontSize: '0.78125rem',
  width: '100%',
};
const ROLE_OPTIONS = ['', 'GK', 'DF', 'WG', 'PM'];
// 스텝 시간 override 의 사람 단위(초) 범위. 기본 간격이 0.8~2.4s(PLAYBACK.stepIntervalMs)이므로
// 하한은 그보다 짧은 0.5, 상한은 한 스텝을 오래 세워 두고 설명하는 경우까지 60 이면 넉넉하다.
const STEP_SEC_MIN = 0.5;
const STEP_SEC_MAX = 60;

export function InspectorPanel({
  drill,
  step,
  stepIndex,
  dispatch,
  selection,
  pendingPlayerId,
  onArmPlayer,
  onEraseIds,
  showSteps = true,
}: InspectorPanelProps) {
  return (
    // 폭·테두리·스크롤은 **껍데기(InspectorHost)** 가 갖는다. 2026-08-12 결정 ③A 전에는 이
    // 컴포넌트가 가로 화면에서 스스로 312px 을 차지했는데, 그러면 같은 인스턴스를 오버레이와
    // 붙박이 사이에서 옮길 때 자기 자리 계산이 두 곳으로 갈라진다.
    // 위 여백은 **여기**가 갖는다. 맨 앞 구역이 showSteps 에 따라 갈리므로(스텝 메타 ↔ 드릴 정보)
    // 첫 구역이 자기 상단 패딩을 들고 있으면 전술판에서 그 17px 이 통째로 사라진다.
    <aside aria-label="드릴 속성" style={{ background: 'var(--panel)', paddingTop: 17 }}>
      {showSteps && (
        <>
          {/* ★ 맨 위다. 인스펙터를 여는 가장 잦은 이유가 "지금 이 스텝에 자막을 적는 것" 인데,
              오버레이 시트는 세로 화면에서 min(340px, 62%) 라 아래 구역은 굴려야 닿는다(2.2).
              제목·난이도는 드릴당 한 번 적고 마는 값이라 뒤로 물러난다. */}
          <StepMetaSection step={step} stepIndex={stepIndex} stepCount={drill.steps.length} dispatch={dispatch} />
          <Divider />
        </>
      )}
      <DrillInfoSection drill={drill} dispatch={dispatch} />
      <Divider />
      <RosterSection drill={drill} step={step} dispatch={dispatch} pendingPlayerId={pendingPlayerId} onArmPlayer={onArmPlayer} onEraseIds={onEraseIds} />
      <Divider />
      <SelectionSection drill={drill} step={step} selection={selection} dispatch={dispatch} onEraseIds={onEraseIds} />
      {showSteps && (
        <>
          <Divider />
          <StepsSection drill={drill} stepIndex={stepIndex} dispatch={dispatch} />
        </>
      )}
    </aside>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--border)', margin: '15px 17px' }} />;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)' }}>
      <span>{label}</span>
      {children}
    </label>
  );
}

// ── 3.1 스텝 메타 입력 ────────────────────────────────────────────────────────────────
//
// 리듀서(STEP_META)·히스토리 병합(COALESCE_TYPES)은 처음부터 다 있었고 **dispatch 하는 곳만
// 0** 이었다 — 그래서 시연이 코치에게 읽어 주는 문장(PresentRunner.tsx:497-501 이 step.name 을
// 크게, step.note 를 문단으로 읽는다)을 앱 안에서 만들 방법이 없었다. 여기가 그 입구다.
//
// ★ 세 입력 모두 **비제어(defaultValue) + `key={step.id}`**.
//   제어로 바꾸면 글자마다 React 가 DOM value 를 되쓰면서 한글 IME 조합에 손을 댄다 — 입에 문
//   젓가락으로 치는 사용자에게 조합이 끊기는 것은 그대로 오타다. 비제어의 대가가 *"스텝을
//   넘겨도 옛 스텝 글자가 남는다"* 인데, key 가 스텝마다 요소를 갈아 끼워 그것을 막는다.
//   (같은 함정을 :248 예상 시간 입력이 `key={drill.durationMin}` 으로 이미 알고 있다.)
//   되돌리기로 값이 바뀐 경우는 이 패널의 다른 비제어 입력들과 같다 — 화면에 옛 글자가 남는다.
//   key 를 epoch 로 바꾸면 해결되지만 그러면 판 조작마다 입력이 재마운트돼 포커스가 날아간다.
//
// ★ dispatch 는 blur 가 아니라 **change** 다(이 패널의 다른 입력과 다르다). 두 이유:
//   (1) 적는 동안 하단 칩 라벨·스텝 목록이 따라 움직여야 "무엇을 적고 있는지"가 판에서 보인다.
//   (2) STEP_META 는 COALESCE_TYPES 라 700ms/5s 창 안의 연속 타이핑이 되돌리기 **한 칸**으로
//       합쳐진다(history.ts coalesceKeyOf → `STEP_META:${id}`). 글자마다 undo 가 쌓이지 않는다.
function StepMetaSection({
  step,
  stepIndex,
  stepCount,
  dispatch,
}: {
  step: DrillStep;
  stepIndex: number;
  stepCount: number;
  dispatch: Dispatch<EditorAction>;
}) {
  const patch = (p: { name?: string; note?: string; durationMs?: number }) => dispatch({ type: 'STEP_META', id: step.id, patch: p });
  // 스텝 시간은 모델이 ms, 사람이 읽는 단위는 초다. 비워 두면 재생 속도 기본값을 쓴다
  // (model/playback.ts effectiveStepMs 의 `?? baseMs`).
  const sec = step.durationMs !== undefined ? String(step.durationMs / 1000) : '';
  return (
    <div style={{ padding: '0 17px' }}>
      <div style={SECTION_LABEL}>
        스텝 {stepIndex + 1} / {stepCount}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <Field label="스텝 이름">
          <input
            key={step.id}
            type="text"
            defaultValue={step.name}
            maxLength={LIMITS.stepNameLen}
            placeholder="예: 측면 전개"
            onChange={(e) => patch({ name: e.target.value })}
            style={inputStyle}
          />
        </Field>
        <Field label="스텝 메모">
          <textarea
            key={step.id}
            defaultValue={step.note}
            maxLength={LIMITS.noteLen}
            rows={3}
            placeholder="이 스텝에서 코치가 말할 문장"
            onChange={(e) => patch({ note: e.target.value })}
            style={{ ...inputStyle, minHeight: 72, padding: '0.5rem 0.6875rem', resize: 'vertical' }}
          />
        </Field>
        <div style={{ fontSize: '0.6875rem', color: 'var(--faint-text)', lineHeight: 1.45, marginTop: -4 }}>
          시연 화면이 이름과 메모를 코치에게 그대로 읽어 줍니다.
        </div>
        <Field label="스텝 시간(초)">
          <input
            key={step.id}
            type="number"
            inputMode="decimal"
            min={STEP_SEC_MIN}
            max={STEP_SEC_MAX}
            step={0.5}
            defaultValue={sec}
            placeholder="기본"
            title="비워 두면 재생 속도의 기본 간격을 씁니다."
            onChange={(e) => {
              const raw = e.target.value.trim();
              if (raw === '') {
                patch({ durationMs: undefined }); // 지우면 override 해제 — 기본 간격으로 돌아간다
                return;
              }
              const v = Number(raw);
              if (!Number.isFinite(v) || v <= 0) return; // 타이핑 도중의 '-' · '.' 는 아직 값이 아니다
              patch({ durationMs: Math.round(Math.min(Math.max(v, STEP_SEC_MIN), STEP_SEC_MAX) * 1000) });
            }}
            // 상한을 넘겨 적었으면 손을 뗄 때 실제 저장된 값으로 되돌려 보여 준다. 비제어라
            // 화면과 모델이 갈라질 수 있는 유일한 자리가 여기(클램프)다.
            onBlur={(e) => {
              e.target.value = step.durationMs !== undefined ? String(step.durationMs / 1000) : '';
            }}
            style={inputStyle}
          />
        </Field>
      </div>
    </div>
  );
}

function DrillInfoSection({ drill, dispatch }: { drill: Drill; dispatch: Dispatch<EditorAction> }) {
  return (
    <div style={{ padding: '0 17px' }}>
      <div style={SECTION_LABEL}>드릴 정보</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <Field label="제목">
          <input
            type="text"
            defaultValue={drill.title}
            maxLength={80}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== drill.title) dispatch({ type: 'META_SET', patch: { title: v } });
            }}
            style={inputStyle}
          />
        </Field>
        <Field label="카테고리">
          <select value={drill.category} onChange={(e) => dispatch({ type: 'META_SET', patch: { category: e.target.value } })} style={inputStyle}>
            {KNOWN_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="난이도">
          <select
            value={drill.level}
            onChange={(e) => dispatch({ type: 'META_SET', patch: { level: e.target.value as DrillLevel } })}
            style={inputStyle}
          >
            {DRILL_LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="예상 시간(분)">
          <input
            type="number"
            min={1}
            max={180}
            defaultValue={drill.durationMin}
            key={drill.durationMin}
            onBlur={(e) => {
              const v = Math.max(1, Number(e.target.value) || drill.durationMin);
              if (v !== drill.durationMin) dispatch({ type: 'META_SET', patch: { durationMin: v } });
            }}
            style={inputStyle}
          />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '9px 14px', fontSize: '0.78125rem' }}>
          <span style={{ color: 'var(--muted)' }}>코트</span>
          <span style={{ fontWeight: 600, textAlign: 'right' }}>{COURT_DEFS[drill.courtMode].label}</span>
          <span style={{ color: 'var(--muted)' }}>포메이션</span>
          <span style={{ fontWeight: 600, textAlign: 'right' }}>{drill.formation}</span>
        </div>
      </div>
    </div>
  );
}

function RosterSection({
  drill,
  step,
  dispatch,
  pendingPlayerId,
  onArmPlayer,
  onEraseIds,
}: {
  drill: Drill;
  step: DrillStep;
  dispatch: Dispatch<EditorAction>;
  pendingPlayerId: ChairId | null;
  onArmPlayer(id: ChairId): void;
  onEraseIds(ids: string[], scope: 'onward' | 'thisStep'): void;
}) {
  const [expanded, setExpanded] = useState<ChairId | null>(null);
  return (
    <div style={{ padding: '0 17px' }}>
      <div style={SECTION_LABEL}>선수 명단</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {drill.cast.chairs.map((def) => {
          const placed = step.chairs[def.id] !== undefined;
          const teamStyle = drill.teams[def.team];
          const color = def.color ?? (def.isGk ? teamStyle.gkColor : teamStyle.color);
          const open = expanded === def.id;
          return (
            <div key={def.id} style={{ opacity: placed ? 1 : 0.45 }}>
              <button
                type="button"
                onClick={() => setExpanded(open ? null : def.id)}
                aria-expanded={open}
                style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, width: '100%' }}
              >
                <span
                  aria-hidden
                  style={{
                    flex: 'none',
                    width: 19,
                    height: 26,
                    borderRadius: 5,
                    background: color,
                    border: '1.5px solid rgba(255,255,255,.85)',
                    color: inkFor(color),
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {def.number}
                </span>
                <span style={{ fontSize: '0.78125rem', fontWeight: 600, flex: 1, textAlign: 'left' }}>{def.name || (def.isGk ? 'GK' : `${teamStyle.label} ${def.number}`)}</span>
                <span style={{ fontSize: '0.6875rem', color: 'var(--faint-text)' }}>{placed ? (def.role ?? '') : '미배치'}</span>
              </button>
              {!placed && (
                <div style={{ padding: '0 0 8px 29px' }}>
                  <Button variant="secondary" onClick={() => onArmPlayer(def.id)} aria-pressed={pendingPlayerId === def.id}>
                    배치
                  </Button>
                </div>
              )}
              {open && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 0 12px 29px' }}>
                  <Field label="이름">
                    <input
                      type="text"
                      defaultValue={def.name ?? ''}
                      onBlur={(e) => dispatch({ type: 'CHAIR_DEF', id: def.id, patch: { name: e.target.value || undefined } })}
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="역할">
                    <select
                      value={def.role ?? ''}
                      onChange={(e) => dispatch({ type: 'CHAIR_DEF', id: def.id, patch: { role: e.target.value || undefined } })}
                      style={inputStyle}
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {r || '(기본값)'}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600 }}>색</span>
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'CHAIR_DEF', id: def.id, patch: { color: undefined } })}
                      title="기본값"
                      style={{ width: 26, height: 26, borderRadius: 7, border: !def.color ? '2px solid var(--accent)' : '1px dashed var(--border-strong)' }}
                    />
                    {TEAM_COLOR_CHOICES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => dispatch({ type: 'CHAIR_DEF', id: def.id, patch: { color: c } })}
                        aria-label={c}
                        style={{ width: 26, height: 26, borderRadius: 7, background: c, border: def.color === c ? '2px solid var(--accent)' : '1px solid var(--border)' }}
                      />
                    ))}
                  </div>
                  {placed && (
                    <Button variant="ghost" onClick={() => onEraseIds([def.id], 'onward')}>
                      코트에서 미배치
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SelectionSection({
  drill,
  step,
  selection,
  dispatch,
  onEraseIds,
}: {
  drill: Drill;
  step: DrillStep;
  selection: ReadonlySet<string>;
  dispatch: Dispatch<EditorAction>;
  onEraseIds(ids: string[], scope: 'onward' | 'thisStep'): void;
}) {
  if (selection.size !== 1) return null;
  const id = Array.from(selection)[0]!;

  if (isId(id, 'nt')) {
    const note = step.notes.find((n) => n.id === (id as NoteId));
    if (!note) return null;
    return (
      <div style={{ padding: '0 17px' }}>
        <div style={SECTION_LABEL}>선택한 메모</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Field label="내용">
            <textarea
              defaultValue={note.text}
              maxLength={600}
              rows={3}
              onBlur={(e) => dispatch({ type: 'NOTE_SET', note: { ...note, text: e.target.value } })}
              style={{ ...inputStyle, minHeight: 72, padding: '0.5rem 0.6875rem', resize: 'vertical' }}
            />
          </Field>
          <Field label="정렬">
            <select
              value={note.align ?? 'middle'}
              onChange={(e) => dispatch({ type: 'NOTE_SET', note: { ...note, align: e.target.value as 'start' | 'middle' | 'end' } })}
              style={inputStyle}
            >
              <option value="start">왼쪽</option>
              <option value="middle">가운데</option>
              <option value="end">오른쪽</option>
            </select>
          </Field>
          <Button variant="ghost" onClick={() => onEraseIds([note.id], 'thisStep')}>
            메모 삭제
          </Button>
        </div>
      </div>
    );
  }

  if (isId(id, 'ar')) {
    const arrow = step.arrows.find((a) => a.id === (id as ArrowId));
    if (!arrow) return null;
    const label = arrow.kind === 'pass' ? '패스 화살표' : arrow.kind === 'shot' ? '슛 화살표' : '이동 화살표';
    return (
      <div style={{ padding: '0 17px' }}>
        <div style={SECTION_LABEL}>선택한 화살표</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span aria-hidden style={{ width: 10, height: 10, borderRadius: '50%', background: arrowColor(arrow) }} />
            {label}
          </div>
          <div style={{ fontSize: '0.71875rem', color: 'var(--faint-text)' }}>두께 {ARROW_STYLES[arrow.kind].width}px</div>
          <Button variant="ghost" onClick={() => onEraseIds([arrow.id], 'thisStep')}>
            화살표 삭제
          </Button>
        </div>
      </div>
    );
  }

  if (isId(id, 'bl')) {
    return (
      <div style={{ padding: '0 17px' }}>
        <div style={SECTION_LABEL}>선택한 공</div>
        <Button variant="ghost" onClick={() => onEraseIds([id], 'onward')}>
          공 삭제
        </Button>
      </div>
    );
  }

  if (isId(id, 'cn')) {
    const cone = drill.cast.cones.find((c) => c.id === id);
    if (!cone) return null;
    return (
      <div style={{ padding: '0 17px' }}>
        <div style={SECTION_LABEL}>선택한 콘</div>
        <Button variant="ghost" onClick={() => onEraseIds([id], 'onward')}>
          콘 삭제
        </Button>
      </div>
    );
  }

  return null; // 휠체어는 위 선수 명단 섹션에서 편집한다.
}

function StepsSection({ drill, stepIndex, dispatch }: { drill: Drill; stepIndex: number; dispatch: Dispatch<EditorAction> }) {
  return (
    <div style={{ padding: '0 17px 20px' }}>
      <div style={SECTION_LABEL}>스텝</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {drill.steps.map((s, i) => {
          const active = s.id === (drill.steps[stepIndex]?.id ?? drill.steps[0]!.id);
          return (
            <div
              key={s.id}
              style={{
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 11,
                padding: '9px 10px',
                background: active ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
              }}
            >
              <button
                type="button"
                onClick={() => dispatch({ type: 'STEP_SELECT', id: s.id })}
                style={{ flex: 1, minWidth: 0, display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left' }}
              >
                <span
                  aria-hidden
                  style={{
                    flex: 'none',
                    width: 22,
                    height: 22,
                    borderRadius: 7,
                    background: active ? 'var(--accent)' : 'var(--elev)',
                    color: active ? 'var(--accent-ink-strong)' : 'var(--muted)',
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, marginBottom: 2 }}>{s.name}</span>
                  {s.note && <span style={{ display: 'block', fontSize: '0.71875rem', color: 'var(--muted)', lineHeight: 1.45 }}>{s.note}</span>}
                </span>
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <StepIconButton label="위로 이동" disabled={i === 0} onClick={() => dispatch({ type: 'STEP_REORDER', id: s.id, toIndex: i - 1 })}>
                  ↑
                </StepIconButton>
                <StepIconButton label="아래로 이동" disabled={i === drill.steps.length - 1} onClick={() => dispatch({ type: 'STEP_REORDER', id: s.id, toIndex: i + 1 })}>
                  ↓
                </StepIconButton>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <StepIconButton label="스텝 복제" onClick={() => dispatch({ type: 'STEP_DUPLICATE', id: s.id })}>
                  ⧉
                </StepIconButton>
                <StepIconButton
                  label="스텝 삭제"
                  disabled={drill.steps.length <= 1}
                  onClick={() => {
                    dispatch({ type: 'STEP_DELETE', id: s.id });
                    liveRegion.say(`스텝 ${i + 1} 삭제`);
                  }}
                >
                  ×
                </StepIconButton>
              </div>
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => dispatch({ type: 'STEP_ADD', afterIndex: stepIndex })}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            minHeight: 44,
            border: '1px dashed var(--border-strong)',
            borderRadius: 11,
            color: 'var(--faint-text)',
            fontSize: '0.75rem',
            fontWeight: 600,
          }}
        >
          <IconPlus size={14} />
          스텝 추가
        </button>
      </div>
    </div>
  );
}

function StepIconButton({ children, label, onClick, disabled }: { children: string; label: string; onClick(): void; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      style={{ width: 26, height: 22, borderRadius: 6, fontSize: '0.75rem', color: 'var(--muted)', opacity: disabled ? 0.35 : 1 }}
    >
      {children}
    </button>
  );
}
