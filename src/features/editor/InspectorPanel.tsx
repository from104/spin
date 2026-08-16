// §6.10/프로토타입 359–398행 "드릴 정보 / 선수 명단 / 스텝" 우측 인스펙터. 312px 폭, 편집기
// 3영역 중 `<aside aria-label="드릴 속성">`(§7.5a).
import { useState } from 'react';
import type { CSSProperties, Dispatch, ReactNode } from 'react';
import { isId } from '../../core/ids.ts';
import type { ArrowId, ChairId, NoteId } from '../../core/ids.ts';
import { KNOWN_CATEGORIES, TEAM_COLOR_CHOICES, TEAM_COLOR_NAMES, inkFor } from '../../core/colors.ts';
import { ARROW_STYLE, arrowColor } from '../../model/arrow.ts';
import { arrowLabel } from '../../render/objects/ArrowPath.tsx';
import type { Drill, DrillLevel, DrillStep, TeamSide } from '../../model/drill.ts';
import { DRILL_LEVELS } from '../../model/drill.ts';
import { defaultDefense } from '../../model/rules.ts';
import { chairName } from '../../model/chairLabel.ts';
import { courtDefFor, COURT_SIZES, COURT_SIZE_LABELS, DEFAULT_COURT_SIZE, type CourtSize } from '../../model/court.ts';
import { LIMITS } from '../../model/validate.ts';
import type { EditorAction } from '../../store/editor/actions.ts';
import { Button } from '../../ui/Button.tsx';
import { IconPlus } from '../../ui/icons.tsx';
import { liveRegion } from '../../ui/LiveRegion.tsx';
import { PlacementPresets } from './PlacementPresets.tsx';

/** §6.4 코트 크기 3단 선택. **자유 전술판에서만** 내려온다(드릴은 코트가 불변이다 — 헤더의
 *  코트 세그먼트와 같은 규칙). `locked` 는 판이 리셋 상태가 **아니라는** 뜻이고, 그때는 select
 *  대신 잠금 사유를 읽는 텍스트가 선다.
 *
 *  ⚠️ 이 컨트롤이 **인스펙터 안**에 있는 이유는 첫 화면 표적 예산(§3, 상한 40 · 실측 여유 0)이다.
 *     하단 바나 헤더로 옮기면 `src/test/boardTargetBudget.test.tsx` 가 빨개진다. */
export interface CourtSizeSwitch {
  value: CourtSize;
  /** 판이 비어 있지 않아 크기를 바꿀 수 없다. */
  locked: boolean;
  onChange(size: CourtSize): void;
}

export interface InspectorPanelProps {
  drill: Drill;
  courtSizeSwitch?: CourtSizeSwitch;
  step: DrillStep;
  stepIndex: number;
  dispatch: Dispatch<EditorAction>;
  selection: ReadonlySet<string>;
  pendingPlayerId: ChairId | null;
  onArmPlayer(id: ChairId): void;
  onEraseIds(ids: string[], scope: 'onward' | 'thisStep'): void;
  /** §3.5 — 이 저장소에 **이미 쓰이고 있는** 태그(useKnownTags). 태그를 자유 텍스트로 두면
   *  '수비'·'수비 '·'수비연습' 이 각각 다른 태그가 되어 검색이 조용히 나빠지므로, 화면은
   *  기존 것을 칩으로 먼저 내놓는다. 비어 있으면(첫 드릴·전술판) 새로 만들기 칸만 남는다. */
  knownTags?: readonly string[];
  /** §5.4 [골대 원위치] — 휠체어에 밀린 골대를 **코트 정의 자리**로 되돌린다. 판 위의 다른
   *  것은 건드리지 않는다.
   *
   *  ⚠️ **optional 로 만들지 마라.** 이 버튼의 병력이 정확히 그 실패다: 4.7 이 하단 바에서
   *     [코트 비우기] 확인 모달 안으로 내렸고(예산), 6차 검증관은 "기능은 살아 있다" 로 통과
   *     시켰는데, **2026-08-13 기현님(이 앱의 주 사용자)이 "골대 원위치 버튼 어디있나?" 로
   *     신고했다.** 아무도 *"찾을 수 있는가"* 를 안 물은 것이다. optional 이면 조립부 하나가
   *     안 넘겼을 때 버튼이 소리 없이 사라지고, 그 상태로 전건 초록이 된다 — 필수로 두면
   *     tsc 가 대신 물어 준다. */
  onResetGoals(): void;
  /** 스텝 섹션(목록·복제·삭제·추가)을 낼지. 자유 전술판은 1장짜리라 false 다(§6.8 재편) —
   *  하단 트랜스포트만 감추고 여기를 놔두면 화면에 없는 2번째 스텝을 만들 수 있어, 판이
   *  조용히 여러 장이 된다(눈으로는 알 수 없다). 기본값은 드릴 편집 쪽인 true.
   *
   *  실질적으로 **"드릴 편집기 모드인가"** 를 뜻하게 됐다 — 3.2 교육 필드도 이 깃발을 탄다.
   *  전술판의 드릴은 목록(drillRepo)이 아니라 localStorage 스냅샷(storage/board.ts)에만 살고
   *  4차 PDF 계획서에 실리지 않으므로, 그 화면에서 목적·코칭 포인트는 적을 이유가 없는 칸이다. */
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
  courtSizeSwitch,
  step,
  stepIndex,
  dispatch,
  selection,
  pendingPlayerId,
  onArmPlayer,
  onEraseIds,
  onResetGoals,
  knownTags = [],
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
      <DrillInfoSection drill={drill} dispatch={dispatch} courtSizeSwitch={courtSizeSwitch} onResetGoals={onResetGoals} />
      {/* §5.4 배치 프리셋. **드릴 정보 바로 아래**다 — 프리셋이 무엇을 놓을지가 그 위의
          코트·포메이션 값에 달려 있어서, 읽은 자리에서 바로 누르는 순서가 된다.
          ⚠️ 이 구역을 판(하단 바·트레이)으로 옮기면 첫 화면 표적이 4개 늘어 예산 게이트가
          빨개진다(PlacementPresets.tsx 머리말 ⚠️⚠️ — 여유가 0 이다). */}
      <Divider />
      <PlacementPresets drill={drill} stepIndex={stepIndex} dispatch={dispatch} />
      {showSteps && (
        <>
          <Divider />
          <TeachingSection drill={drill} dispatch={dispatch} />
          <Divider />
          <TagsSection drill={drill} dispatch={dispatch} knownTags={knownTags} />
        </>
      )}
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

/** §6.4 — **코트 크기 3단을 고르는 유일한 UI.**
 *
 *  세 갈래다.
 *   ① 풀 코트 + 바꿀 수 있다(전술판이 비어 있다) → `<select>`.
 *   ② 풀 코트인데 잠겼거나(판이 더럽다) 드릴 편집이다 → 값을 **읽기 전용**으로 보여 준다.
 *   ③ 하프·플랫 → 값은 들고 다니지만 판을 바꾸지 않는다(court.ts COURT_DEFS 주석 근거 셋).
 *      그래서 select 를 내면 **판이 거짓말한다**(골라도 아무것도 안 변한다). 대신 그 사실을 적는다.
 *
 *  ⚠️ 크기를 바꾸면 판이 **그 크기의 빈 판으로 새로 선다**(BoardScreen.onCourtSizeChange).
 *     좌표를 비례로 옮기지 않는 이유는 `cloneToCourt` 머리말의 판단과 같다 — 화살표 ctrl 같은
 *     것 하나만 빠뜨려도 궤적만 어긋난 판이 조용히 만들어진다. 게이트가 pristine 이라
 *     **잃을 배치가 애초에 없다.** */
function CourtSizeField({ drill, sw }: { drill: Drill; sw?: CourtSizeSwitch }) {
  const size = drill.courtSize ?? DEFAULT_COURT_SIZE;
  const hintStyle: CSSProperties = { fontSize: '0.6875rem', color: 'var(--faint-text)', lineHeight: 1.45 };

  if (drill.courtMode !== 'full') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)' }}>
        <span>코트 크기</span>
        <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.78125rem' }}>{COURT_SIZE_LABELS[size]}</span>
        <span style={hintStyle}>규격 3단은 풀 코트에만 적용됩니다. 하프·플랫은 훈련용 구획이라 따라갈 규정값이 없습니다.</span>
      </div>
    );
  }

  if (!sw || sw.locked) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)' }}>
        <span>코트 크기</span>
        <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.78125rem' }}>{COURT_SIZE_LABELS[size]}</span>
        <span style={hintStyle}>
          {sw
            ? '코트 크기를 바꾸려면 먼저 코트를 비우세요 — 규격이 달라 배치를 옮겨 담을 수 없습니다.'
            : '코트 크기는 드릴을 만든 뒤에는 바꿀 수 없습니다.'}
        </span>
      </div>
    );
  }

  return (
    <>
      <Field label="코트 크기">
        <select value={size} onChange={(e) => sw.onChange(e.target.value as CourtSize)} style={inputStyle}>
          {COURT_SIZES.map((s) => (
            <option key={s} value={s}>
              {COURT_SIZE_LABELS[s]}
            </option>
          ))}
        </select>
      </Field>
      <span style={hintStyle}>바꾸면 그 규격의 빈 판이 새로 섭니다. 지금 판은 비어 있어 잃을 배치가 없습니다.</span>
    </>
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

function DrillInfoSection({
  drill,
  dispatch,
  courtSizeSwitch,
  onResetGoals,
}: {
  drill: Drill;
  dispatch: Dispatch<EditorAction>;
  courtSizeSwitch?: CourtSizeSwitch;
  onResetGoals(): void;
}) {
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
        <CourtSizeField drill={drill} sw={courtSizeSwitch} />
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '9px 14px', fontSize: '0.78125rem' }}>
          <span style={{ color: 'var(--muted)' }}>코트</span>
          <span style={{ fontWeight: 600, textAlign: 'right' }}>{courtDefFor(drill.courtMode, drill.courtSize).label}</span>
          <span style={{ color: 'var(--muted)' }}>포메이션</span>
          <span style={{ fontWeight: 600, textAlign: 'right' }}>{drill.formation}</span>
        </div>
        <SideField drill={drill} dispatch={dispatch} />
        <GoalResetField drill={drill} onResetGoals={onResetGoals} />
      </div>
    </div>
  );
}

/** 진영 — 골 지역 3인 반칙이 **어느 팀에 걸리는가**(기현 지시 2026-08-15).
 *
 *  *"수비측이 우리편 골에리어에 3명이 못 들어가는 거지. 공격은 제한 없어."*
 *
 *  ── 왜 여기인가 ────────────────────────────────────────────────────────────────
 *  자유 전술판에서는 오른쪽 기능 바에 [진영] 칸이 있다. 드릴 편집에는 그 기둥이 아직 없어
 *  (재설계 대기 중) **판 수준 설정이 사는 곳**인 여기로 온다 — 코트 크기 3단·골대 원위치가
 *  같은 이유로 이 구역에 있다. 두 화면이 같은 값을 만지므로 문구도 같은 말을 쓴다.
 *
 *  ── ⚠️ 점진 공개 금지(§8) ──────────────────────────────────────────────────────
 *  골대 원위치와 같은 규율이다: **버튼은 언제나 있고 비활성 여부와 설명만 바뀐다.** 판정도
 *  판 상태가 아니라 **코트 종류**다 — 플랫 코트에는 골 지역이 없어 진영이라는 개념이 없다. */
function SideField({ drill, dispatch }: { drill: Drill; dispatch: Dispatch<EditorAction> }) {
  const zones = courtDefFor(drill.courtMode, drill.courtSize).ruleZones;
  const has = zones.length > 0;
  const cur: TeamSide = drill.defense ?? defaultDefense(drill.courtMode);
  const goalName = drill.courtMode === 'half' ? '골' : '왼쪽 골';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <Button
        variant="secondary"
        fullWidth
        disabled={!has}
        onClick={() => dispatch({ type: 'META_SET', patch: { defense: cur === 'home' ? 'away' : 'home' } })}
      >
        진영 바꾸기
      </Button>
      <span style={{ fontSize: '0.6875rem', color: 'var(--faint-text)', lineHeight: 1.45 }}>
        {has
          ? `${goalName}을 지키는 팀은 ${drill.teams[cur].label} 입니다. 골 지역 3인 반칙은 수비 팀에만 걸립니다 — 공격은 제한이 없습니다.`
          : '플랫 코트에는 골 지역이 없어 진영이 없습니다.'}
      </span>
    </div>
  );
}

/** §5.4 [골대 원위치] — **찾을 수 있는 자리**(2026-08-13 기현님 실기 신고: *"골대 원위치 버튼
 *  어디있나?"*).
 *
 *  ── 왜 인스펙터인가 ────────────────────────────────────────────────────────────
 *  · 첫 화면 표적 예산이 40/40, **여유 0** 이다(src/test/boardTargetBudget.test.tsx 의 "서랍이
 *    둘 다 열린 실사용 상태" it 이 40 을 찍는다). 하단 바·헤더·스테이지 컨트롤은 전부 초기
 *    상태 DOM 이라 한 칸도 못 쓴다. 인스펙터는 **닫혀 있으면 DOM 에 아예 없어**(InspectorHost 의
 *    mode==='hidden' → null) 예산 밖이다.
 *  · 선례가 있다: §6.4 코트 크기 3단 선택도 같은 이유로 여기 산다. 인스펙터에는 이미 **판
 *    수준 설정**이 살고 있고, 골대 원위치는 그 이웃이다.
 *  · 자리는 [드릴 정보] 구역의 **맨 끝** — 바로 위 두 줄이 '코트 / 포메이션' 이다. 읽은 자리에서
 *    누른다. 아래로 더 내리지 않은 이유는 §5.4 배치 프리셋이 *"드릴 정보 바로 아래"* 를 자기
 *    근거로 들고 있어서다(그 사이에 구역을 끼우면 그 근거가 깨진다).
 *
 *  ── ⚠️ 점진 공개 금지(§8) ──────────────────────────────────────────────────────
 *  "골대가 밀렸을 때만 버튼이 나타난다" 로 만들지 마라. 발 마우스·입 젓가락 사용자는 버튼의
 *  **절대 위치**로 공간 기억을 만든다 — 표적이 사용 중에 이동하면 그 기억이 무너진다.
 *  그래서 여기서 바뀌는 것은 **비활성 여부와 설명뿐**이고, 그 판정도 판 상태가 아니라 **코트
 *  종류**다(플랫 코트에는 골대가 아예 없다 — COURT_DEFS.flat.goalPosts 가 []). 코트 종류는
 *  판이 비어 있을 때만 바뀌므로 "쓰는 도중에 움직이는 표적" 이 아니다.
 *  좌표·개수의 유일한 출처는 `courtDefFor` 다(리터럴 금지). */
function GoalResetField({ drill, onResetGoals }: { drill: Drill; onResetGoals(): void }) {
  const hasGoals = courtDefFor(drill.courtMode, drill.courtSize).goalPosts.length > 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <Button variant="secondary" fullWidth disabled={!hasGoals} onClick={onResetGoals}>
        골대 원위치
      </Button>
      <span style={{ fontSize: '0.6875rem', color: 'var(--faint-text)', lineHeight: 1.45 }}>
        {hasGoals
          ? '휠체어에 밀린 골대를 규격 자리로 되돌립니다. 판 위의 나머지는 그대로 둡니다.'
          : '플랫 코트에는 골대가 없습니다.'}
      </span>
    </div>
  );
}

// ── 3.2 교육 필드 + 3.3 훈련량 ────────────────────────────────────────────────────────────
//
// 결정 ⑦ = **(B) 중간** 이 정한 그대로다: 목적 · 코칭 포인트 · 필요 인원 · 필요 장비 +
// 반복/세트/인터벌. 성공 기준 · 변형(progression/regression) · 드릴간 참조는 **없다**(§8).
// `durationMin` 하나로는 *"3회 × 2세트"* 를 표현할 수 없고, 4차 PDF 세션 계획서의 실용성이
// 정확히 그 지점에서 갈린다 — 그래서 3.2 와 3.3 이 한 스키마 상승(v1→v2)에 함께 탔다.
//
// ★ 커밋 시점이 위 StepMetaSection 과 **반대로 blur** 다. 스텝 메타는 적는 동안 칩 라벨이
//   따라와야 해서 change 였지만, 이 값들을 읽는 것은 판이 아니라 계획서다 — 적는 동안 따라올
//   것이 없으므로 되돌리기 한 칸이 "한 번 고쳐 쓴 것" 과 같아지는 blur 가 맞고, 제목 · 예상
//   시간과도 같은 관용구가 된다.
//
// ★ 비제어(defaultValue) + `key={그 필드의 현재 값}`. 제어로 가면 글자마다 React 가 DOM value
//   를 되쓰며 한글 IME 조합을 건드린다(3.1 과 같은 이유). key 는 **모델이 스스로 바뀐** 경우
//   (되돌리기 · 클램프)에만 요소를 갈아 끼운다 — 커밋이 blur 라 그때 포커스는 이미 떠나 있다.
//
// ★ 커밋값을 blur 에서 **DOM 에 되쓴다**. 클램프(999 → 30)와 정규화(빈 줄 제거)로 화면과
//   모델이 갈라질 수 있는데, 값이 그대로면 dispatch 도 key 변경도 없어 되쓰기가 유일한 수단이다.
type MetaPatch = Extract<EditorAction, { type: 'META_SET' }>['patch'];

/** 0 = 미지정인 개수 칸(필요 인원 · 반복 · 세트 · 인터벌). 0 은 **빈 칸으로 보여 준다** —
 *  '0회' 라고 적힌 계획서는 거짓이고, 지울 수 없는 칸은 "안 정했다" 를 표현할 수 없다. */
function CountField({ label, value, max, onCommit }: { label: string; value: number; max: number; onCommit(v: number): void }) {
  const show = (v: number) => (v === 0 ? '' : String(v));
  return (
    <Field label={label}>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        step={1}
        key={value}
        defaultValue={show(value)}
        placeholder="미정"
        onBlur={(e) => {
          const raw = e.target.value.trim();
          const n = raw === '' ? 0 : Math.round(Number(raw));
          const v = Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : 0;
          e.target.value = show(v);
          if (v !== value) onCommit(v);
        }}
        style={inputStyle}
      />
    </Field>
  );
}

/** 화면의 여러 줄 ↔ 모델의 문자열 배열. validate.ts `sanitizeCoachingPoints` 와 **같은 규칙**이라
 *  저장 → 다시 읽기가 항등이다(다르면 손을 뗄 때와 다시 연 뒤의 글자가 달라진다). */
function parsePoints(text: string): string[] {
  return text
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, LIMITS.coachingPointCount)
    .map((s) => s.slice(0, LIMITS.coachingPointLen));
}

function TeachingSection({ drill, dispatch }: { drill: Drill; dispatch: Dispatch<EditorAction> }) {
  const set = (patch: MetaPatch) => dispatch({ type: 'META_SET', patch });
  const objective = drill.objective ?? '';
  const equipment = drill.equipment ?? '';
  const points = drill.coachingPoints ?? [];
  const pointsText = points.join('\n');
  return (
    <div style={{ padding: '0 17px' }}>
      <div style={SECTION_LABEL}>교육</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <Field label="목적">
          <textarea
            key={objective}
            defaultValue={objective}
            maxLength={LIMITS.objectiveLen}
            rows={2}
            placeholder="예: 측면에서 받아 골문 쪽으로 방향을 트는 습관"
            onBlur={(e) => {
              const v = e.target.value.trim().slice(0, LIMITS.objectiveLen);
              e.target.value = v;
              if (v !== objective) set({ objective: v });
            }}
            style={{ ...inputStyle, minHeight: 56, padding: '0.5rem 0.6875rem', resize: 'vertical' }}
          />
        </Field>
        <Field label="코칭 포인트">
          <textarea
            key={pointsText}
            defaultValue={pointsText}
            rows={3}
            placeholder={'한 줄에 하나씩\n예: 받기 전에 몸을 연다'}
            onBlur={(e) => {
              const next = parsePoints(e.target.value);
              e.target.value = next.join('\n');
              if (next.length !== points.length || next.some((s, i) => s !== points[i])) set({ coachingPoints: next });
            }}
            style={{ ...inputStyle, minHeight: 72, padding: '0.5rem 0.6875rem', resize: 'vertical' }}
          />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,2fr)', gap: '9px 10px' }}>
          <CountField
            label="필요 인원(명)"
            value={drill.playersNeeded ?? 0}
            max={LIMITS.playersNeededMax}
            onCommit={(v) => set({ playersNeeded: v })}
          />
          <Field label="필요 장비">
            <input
              type="text"
              key={equipment}
              defaultValue={equipment}
              maxLength={LIMITS.equipmentLen}
              placeholder="공 2 · 콘 6 · 조끼 8"
              onBlur={(e) => {
                const v = e.target.value.trim().slice(0, LIMITS.equipmentLen);
                e.target.value = v;
                if (v !== equipment) set({ equipment: v });
              }}
              style={inputStyle}
            />
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: '9px 10px' }}>
          <CountField label="반복(회)" value={drill.reps ?? 0} max={LIMITS.repsMax} onCommit={(v) => set({ reps: v })} />
          <CountField label="세트" value={drill.sets ?? 0} max={LIMITS.setsMax} onCommit={(v) => set({ sets: v })} />
          <CountField label="인터벌(초)" value={drill.intervalSec ?? 0} max={LIMITS.intervalSecMax} onCommit={(v) => set({ intervalSec: v })} />
        </div>
        <div style={{ fontSize: '0.6875rem', color: 'var(--faint-text)', lineHeight: 1.45, marginTop: -4 }}>
          코칭 포인트는 한 줄에 하나씩 적습니다. 비운 칸은 훈련 계획서에 나오지 않습니다.
        </div>
      </div>
    </div>
  );
}

// ── 3.5 태그 · 설명 ──────────────────────────────────────────────────────────────────────
//
// **태그는 자유 텍스트가 아니라 칩 선택식이다**(§7 3.5). 자유 텍스트로 두면 '수비'·'수비 '·
// '수비연습' 이 각각 다른 태그가 되고, 그 결과는 "태그가 늘었다" 가 아니라 **검색이 가끔 안
// 된다** 로 나타난다 — 사용자는 그것을 자기 탓으로 겪는다. 그래서 이미 쓰고 있는 태그를 먼저
// 칩으로 내놓고(useKnownTags), 새로 만드는 칸은 그 아래 한 단 내려 둔다.
//
// 상한은 validate 와 **같은 상수**를 읽는다(12개 / 24자). 화면이 먼저 막지 않으면 저장할 때
// 조용히 잘려서 "적었는데 없어졌다" 가 된다.
// 높이는 `--hit` 이다(§7.3 · §5.4) — 태그 고르기는 장식이 아니라 실제로 조준하는 표적이고,
// 이 앱의 주 사용자는 발 마우스·입 젓가락이다. 알약 모양이 커 보이더라도 32px 로 줄이지 마라.
const TAG_CHIP_BASE: CSSProperties = {
  minHeight: 'var(--hit)',
  padding: '0 0.75rem',
  borderRadius: 999,
  fontSize: '0.75rem',
  fontWeight: 600,
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

function TagsSection({ drill, dispatch, knownTags }: { drill: Drill; dispatch: Dispatch<EditorAction>; knownTags: readonly string[] }) {
  const [draft, setDraft] = useState('');
  const tags = drill.tags;
  const selected = new Set(tags);
  // 후보 = 이미 붙인 것 + 남들이 쓰는 것. 붙인 것을 먼저 세워야 "지금 이 드릴이 무엇인가" 가
  // 한 줄에서 읽히고, 목록이 길어져도 켜진 칩이 스크롤 아래로 밀려나지 않는다.
  const candidates = [...tags, ...knownTags.filter((t) => !selected.has(t))];
  const full = tags.length >= LIMITS.tagCount;

  const commit = (next: string[]) => dispatch({ type: 'META_SET', patch: { tags: next } });
  const toggle = (t: string) => {
    if (selected.has(t)) commit(tags.filter((x) => x !== t));
    else if (!full) commit([...tags, t]);
  };
  const addDraft = () => {
    const t = draft.trim().slice(0, LIMITS.tagLen);
    setDraft('');
    // 빈 값·중복·상한 초과는 **조용히 버린다**. 여기서 토스트를 띄우면 태그 하나 만드는 데
    // 화면 반대편에 알림이 뜨는데, 실패의 이유가 칩 목록에 이미 보인다(같은 칩이 켜져 있다).
    if (!t || selected.has(t) || full) return;
    commit([...tags, t]);
  };

  const description = drill.description ?? '';
  return (
    <div style={{ padding: '0 17px' }}>
      <div style={SECTION_LABEL}>태그 · 설명</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div role="group" aria-label="태그" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {candidates.map((t) => {
            const on = selected.has(t);
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                // 상한에 닿으면 **켜진 칩은 계속 누를 수 있어야 한다** — 끌 수 없으면 12개에서
                // 영영 못 빠져나온다.
                disabled={!on && full}
                onClick={() => toggle(t)}
                style={{
                  ...TAG_CHIP_BASE,
                  border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                  background: on ? 'var(--accent)' : 'var(--elev)',
                  color: on ? 'var(--accent-ink-strong)' : 'var(--text)',
                  opacity: !on && full ? 0.4 : 1,
                }}
              >
                {t}
              </button>
            );
          })}
          {candidates.length === 0 && <span style={{ fontSize: '0.6875rem', color: 'var(--faint-text)' }}>아직 만든 태그가 없습니다.</span>}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Field label="새 태그">
              <input
                type="text"
                value={draft}
                maxLength={LIMITS.tagLen}
                disabled={full}
                placeholder={full ? `태그는 ${LIMITS.tagCount}개까지` : '예: 수비 전환'}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  // ⚠️ 한글 조합 중의 Enter 는 **조합 확정**이지 제출이 아니다. 이 가드가 없으면
                  // '수비' 를 적다 확정하는 순간 '수'·'수비' 두 태그가 생긴다.
                  if (e.nativeEvent.isComposing) return;
                  e.preventDefault();
                  addDraft();
                }}
                style={inputStyle}
              />
            </Field>
          </div>
          <Button variant="secondary" onClick={addDraft} disabled={full || draft.trim().length === 0}>
            추가
          </Button>
        </div>
        <Field label="설명">
          <textarea
            key={description}
            defaultValue={description}
            maxLength={LIMITS.descriptionLen}
            rows={3}
            placeholder="이 드릴을 언제·왜 쓰는지 한두 문장"
            onBlur={(e) => {
              const v = e.target.value.trim().slice(0, LIMITS.descriptionLen);
              e.target.value = v;
              if (v !== description) dispatch({ type: 'META_SET', patch: { description: v } });
            }}
            style={{ ...inputStyle, minHeight: 72, padding: '0.5rem 0.6875rem', resize: 'vertical' }}
          />
        </Field>
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
                /* 44 리터럴이면 설정의 큰 터치 타깃(--hit: 44→56)을 켜도 이 행만 안 커진다
                   (2026-08-14 선행 수리 — '스텝 추가' 버튼과 같은 결함이었다). */
                style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 'var(--hit)', width: '100%' }}
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
                {/* §3.4 — 부르는 규칙은 model/chairLabel 이 쥔다. 트레이·시연 자막·4차 계획서가
                    같은 함수를 읽어야 같은 선수가 자리마다 다른 이름으로 불리지 않는다. */}
                <span style={{ fontSize: '0.78125rem', fontWeight: 600, flex: 1, textAlign: 'left' }}>{chairName(def, drill.teams)}</span>
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
                  {/* §3.4 — 이 칸이 트레이 손잡이 이름 · 시연 범례 · 4차 계획서를 한꺼번에 바꾼다.
                      · `key`+blur 되비침: 3.2 가 [교육] 칸에 붙인 것과 같은 두 겹이다. 없으면
                        되돌리기(Ctrl+Z) 뒤에도 칸에 방금 지운 글자가 남아 화면과 모델이 갈린다.
                      · 커밋값은 **언제나 구체값('')** 이다. `undefined` 를 실으면 얕은 병합
                        (`{...cur, ...patch}`)이 그 키를 undefined 인 채 남기고 structuredClone(IDB)
                        은 보존하는데 JSON 은 지운다 — 같은 드릴이 저장 경로에 따라 달라진다
                        (actions.ts 의 META_SET 금지와 같은 함정). 빈 문자열을 '이름 없음' 으로
                        읽는 판단은 model/chairLabel 의 `hasChairName` 한 곳이 한다. */}
                  <Field label="이름">
                    <input
                      type="text"
                      key={def.name ?? ''}
                      defaultValue={def.name ?? ''}
                      maxLength={LIMITS.chairNameLen}
                      placeholder={chairName({ ...def, name: '' }, drill.teams)}
                      onBlur={(e) => {
                        const v = e.target.value.trim().slice(0, LIMITS.chairNameLen);
                        e.target.value = v;
                        if (v !== (def.name ?? '')) dispatch({ type: 'CHAIR_DEF', id: def.id, patch: { name: v } });
                      }}
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
                        /* hex 를 라벨로 두면 스크린리더가 '빨강' 대신 "#d93a3a" 를 읽는다 (2026-08-14 선행 수리). */
                        aria-label={TEAM_COLOR_NAMES[c]}
                        style={{ width: 26, height: 26, borderRadius: 7, background: c, border: def.color === c ? '2px solid var(--accent)' : '1px solid var(--border)' }}
                      />
                    ))}
                  </div>
                  {placed && (
                    <Button variant="ghost" onClick={() => onEraseIds([def.id], 'onward')}>
                      코트에서 빼기
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
    const label = arrowLabel(arrow);
    return (
      <div style={{ padding: '0 17px' }}>
        <div style={SECTION_LABEL}>선택한 화살표</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span aria-hidden style={{ width: 10, height: 10, borderRadius: '50%', background: arrowColor(arrow) }} />
            {label}
          </div>
          <div style={{ fontSize: '0.71875rem', color: 'var(--faint-text)' }}>두께 {ARROW_STYLE.width}px</div>
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
          공 빼기
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
          콘 빼기
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
            // 44 리터럴이면 큰 터치 타깃(--hit: 44→56)을 켜도 이 버튼만 안 커진다 (2026-08-14 선행 수리).
            minHeight: 'var(--hit)',
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
