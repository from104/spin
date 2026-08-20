// C7(2026-08-18 구조 개편) — **드릴 메타 시트**. 질문 20문 ⑪("드릴 화면 메타 시트")·⑦(교육
// 필드 선별 부활)·⑧(USPSA 3필드)의 종착지다: v8 이 만든 축(유형·상황·변형)과 0.2.1 에서
// [속성] 폐기로 UI 를 잃었던 교육 필드(목적·코칭 포인트·인원·장비)·태그·난이도·소요시간이
// 여기서 다시 편집된다.
//
// **자리**: 화면 중앙 모달(C11, 기현님 지시 — 서랍은 내용이 길면 [×]가 스크롤에 밀려 닫기가
// 불편했다. CenterModal 은 헤더 고정·본문 스크롤). 여는 버튼은 하단 노트 패널 왼쪽의 ⓘ
// (EditorWorkspace 가 onDrillInfo 콜백으로 그린다 — 옛 스테이지 우상단 오버레이는 은퇴).
// 저장 경로는 dispatch(META_SET) 하나뿐이다 — 되돌리기(Ctrl+Z)에 다른 메타와 같은 통로로
// 실리고, useAutosave 의 CAS 낙관 잠금이 그대로 적용된다. 여기서 putDrill 을 직접 부르면
// 자동저장과 두 갈래 쓰기가 되어 충돌한다(계획서 C7 의 금지 조항).
//
// **선택 필드 비우기**: situation 은 `{ situation: undefined }` 로 지운다 — META_SET 리듀서가
// 명시적 undefined 를 "키 삭제" 로 처리한다(C7 에서 넣은 규칙, actions.ts 주석).
import { useId } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { CenterModal } from '../../ui/CenterModal.tsx';
import { useEditorDispatch, useEditorState } from '../../store/editor/EditorProvider.tsx';
import {
  DRILL_LEVELS,
  DRILL_LEVEL_LABELS,
  DRILL_TYPES,
  DRILL_TYPE_LABELS,
  DRILL_SITUATIONS,
  SITUATION_LABELS,
  type DrillLevel,
  type DrillSituation,
  type DrillType,
} from '../../model/drill.ts';
import { LIMITS } from '../../model/validate.ts';
import { useLocale } from '../../i18n/useLocale.ts';
import { useT } from '../../i18n/useT.ts';

export interface DrillMetaSheetProps {
  open: boolean;
  onClose(): void;
}

export function DrillMetaSheet({ open, onClose }: DrillMetaSheetProps) {
  const { present: drill } = useEditorState();
  const dispatch = useEditorDispatch();
  const ids = { type: useId(), situation: useId(), level: useId(), duration: useId() };
  const locale = useLocale();
  const t = useT();

  return (
    <CenterModal open={open} onClose={onClose} title={t('editor.workspace.drillInfoAriaLabel')} closeLabel={t('common.close')}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* ── 분류 (v8 두 축 + 난이도·소요시간) ─────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label={t('presentInfo.typeLabel')} htmlFor={ids.type}>
            <select
              id={ids.type}
              value={drill.drillType}
              onChange={(e) => dispatch({ type: 'META_SET', patch: { drillType: e.target.value as DrillType } })}
              style={inputStyle}
            >
              {DRILL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {DRILL_TYPE_LABELS[locale][t]}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('presentInfo.situationLabel')} htmlFor={ids.situation}>
            <select
              id={ids.situation}
              value={drill.situation ?? ''}
              onChange={(e) =>
                dispatch({
                  type: 'META_SET',
                  patch: { situation: e.target.value === '' ? undefined : (e.target.value as DrillSituation) },
                })
              }
              style={inputStyle}
            >
              <option value="">{t('presentInfo.unspecified')}</option>
              {DRILL_SITUATIONS.map((s) => (
                <option key={s} value={s}>
                  {SITUATION_LABELS[locale][s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('presentInfo.levelLabel')} htmlFor={ids.level}>
            <select
              id={ids.level}
              value={drill.level}
              onChange={(e) => dispatch({ type: 'META_SET', patch: { level: e.target.value as DrillLevel } })}
              style={inputStyle}
            >
              {DRILL_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {DRILL_LEVEL_LABELS[locale][l]}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('editor.drillMetaSheet.durationLabel')} htmlFor={ids.duration}>
            <input
              id={ids.duration}
              type="number"
              min={1}
              max={480}
              defaultValue={drill.durationMin}
              onBlur={(e) => {
                const v = Math.round(Number(e.target.value));
                if (Number.isFinite(v) && v > 0) dispatch({ type: 'META_SET', patch: { durationMin: v } });
              }}
              style={inputStyle}
            />
          </Field>
        </div>

        <Field label={t('editor.drillMetaSheet.tagsLabel', { max: LIMITS.tagCount })}>
          <input
            type="text"
            defaultValue={drill.tags.join(', ')}
            onBlur={(e) => {
              const tags = e.target.value
                .split(',')
                .map((t) => t.trim())
                .filter((t) => t.length > 0)
                .slice(0, LIMITS.tagCount)
                .map((t) => t.slice(0, LIMITS.tagLen));
              dispatch({ type: 'META_SET', patch: { tags } });
            }}
            style={inputStyle}
          />
        </Field>

        {/* ── 팀 이름(§0.5 미배송 빚, 2026-08-20) — drill.teams[side].label 은 코트 칩·
            시연·[코트] 진영 문구가 전부 읽는 값인데 지금까지 고칠 자리가 없었다. 이 드릴
            자신의 값을 바로 고친다(설정의 팀 **색상**과 다르다 — 그건 "미래에 만들 드릴"의
            기본값이라 이미 만든 드릴엔 반영되지 않는 반쪽 진실 문제가 있었고, 그래서 폐기
            결정이 났다. 이름은 드릴 자신의 값을 고치므로 그 문제 자체가 없다). 빈 값은
            커밋하지 않는다(HeaderTitleEditor 와 같은 규칙 — 이름 없는 팀을 만들지 않는다). */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label={t('editor.drillMetaSheet.homeTeamLabel')}>
            <input
              type="text"
              maxLength={LIMITS.teamLabelLen}
              defaultValue={drill.teams.home.label}
              onBlur={(e) => {
                const v = e.target.value.trim().slice(0, LIMITS.teamLabelLen);
                if (v.length > 0 && v !== drill.teams.home.label) {
                  dispatch({ type: 'META_SET', patch: { teams: { ...drill.teams, home: { ...drill.teams.home, label: v } } } });
                }
              }}
              style={inputStyle}
            />
          </Field>
          <Field label={t('editor.drillMetaSheet.awayTeamLabel')}>
            <input
              type="text"
              maxLength={LIMITS.teamLabelLen}
              defaultValue={drill.teams.away.label}
              onBlur={(e) => {
                const v = e.target.value.trim().slice(0, LIMITS.teamLabelLen);
                if (v.length > 0 && v !== drill.teams.away.label) {
                  dispatch({ type: 'META_SET', patch: { teams: { ...drill.teams, away: { ...drill.teams.away, label: v } } } });
                }
              }}
              style={inputStyle}
            />
          </Field>
        </div>

        <div style={{ height: 1, background: 'var(--border)' }} />

        {/* ── 서술 3필드 (USPSA: Purpose / Setup / Variation) ─────────────────────── */}
        <Field label={t('editor.drillMetaSheet.objectiveLabel', { max: LIMITS.objectiveLen })}>
          <textarea
            rows={2}
            maxLength={LIMITS.objectiveLen}
            defaultValue={drill.objective ?? ''}
            onBlur={(e) => dispatch({ type: 'META_SET', patch: { objective: e.target.value } })}
            style={textareaStyle}
          />
        </Field>
        <Field label={t('editor.drillMetaSheet.descriptionLabel', { max: LIMITS.descriptionLen })}>
          <textarea
            rows={3}
            maxLength={LIMITS.descriptionLen}
            defaultValue={drill.description ?? ''}
            onBlur={(e) => dispatch({ type: 'META_SET', patch: { description: e.target.value } })}
            style={textareaStyle}
          />
        </Field>
        <Field label={t('editor.drillMetaSheet.variationLabel', { max: LIMITS.variationLen })}>
          <textarea
            rows={2}
            maxLength={LIMITS.variationLen}
            defaultValue={drill.variation ?? ''}
            onBlur={(e) => {
              const v = e.target.value;
              dispatch({ type: 'META_SET', patch: { variation: v.length > 0 ? v : undefined } });
            }}
            style={textareaStyle}
          />
        </Field>

        <div style={{ height: 1, background: 'var(--border)' }} />

        {/* ── 교육 필드 (0.2.1 [속성] 폐기로 자리를 잃었던 것들의 부활 — 질문 ⑦) ── */}
        <Field label={t('editor.drillMetaSheet.coachingPointsLabel', { max: LIMITS.coachingPointCount })}>
          <textarea
            rows={3}
            defaultValue={(drill.coachingPoints ?? []).join('\n')}
            onBlur={(e) => {
              const points = e.target.value
                .split('\n')
                .map((s) => s.trim())
                .filter((s) => s.length > 0)
                .slice(0, LIMITS.coachingPointCount)
                .map((s) => s.slice(0, LIMITS.coachingPointLen));
              dispatch({ type: 'META_SET', patch: { coachingPoints: points } });
            }}
            style={textareaStyle}
          />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
          <Field label={t('editor.drillMetaSheet.playersNeededLabel')}>
            <input
              type="number"
              min={0}
              max={LIMITS.playersNeededMax}
              defaultValue={drill.playersNeeded ?? 0}
              onBlur={(e) => {
                const v = Math.round(Number(e.target.value));
                if (Number.isFinite(v) && v >= 0) dispatch({ type: 'META_SET', patch: { playersNeeded: Math.min(v, LIMITS.playersNeededMax) } });
              }}
              style={inputStyle}
            />
          </Field>
          <Field label={t('editor.drillMetaSheet.equipmentLabel', { max: LIMITS.equipmentLen })}>
            <input
              type="text"
              maxLength={LIMITS.equipmentLen}
              defaultValue={drill.equipment ?? ''}
              onBlur={(e) => dispatch({ type: 'META_SET', patch: { equipment: e.target.value } })}
              style={inputStyle}
            />
          </Field>
        </div>
      </div>
    </CenterModal>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  const content = (
    <>
      <span>{label}</span>
      {children}
    </>
  );
  const style: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)' };
  // select 는 label 중첩 연결이 안 먹는 브라우저 조합이 있어 htmlFor 를 쓴다.
  return htmlFor ? (
    <div style={style}>
      <label htmlFor={htmlFor} style={{ display: 'contents' }}>
        {content}
      </label>
    </div>
  ) : (
    <label style={style}>{content}</label>
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

const textareaStyle: CSSProperties = {
  ...inputStyle,
  padding: '0.5rem 0.75rem',
  resize: 'vertical',
  minHeight: 60,
};
