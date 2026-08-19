// §PLAN-STEP-EDITING.md §텍스트의 소속 — 스텝 노트 접이식 패널(기현님 확정 2026-08-17).
//
// ── 왜 보드 아래 접이식 패널인가 ──────────────────────────────────────────────────────
// 조사(RESEARCH-DRILL-EDITORS.md)가 가져온 것은 PPT 발표자 노트의 자리다 — 시연에서 코치가
// 그 스텝을 말로 풀 때 참고하는 글이지, 판 위에 늘 떠 있어야 하는 정보가 아니다. 그래서
// 기본은 **접힘**(얇은 토글 줄)이고, 펼치면 선택된 스텝의 note 를 고친다. EditorWorkspace 가
// TransportBar 바로 아래(가장 조용한 자리)에 꽂는다.
//
// ── 메모가 InspectorPanel [스텝] 목록(StepsSection)에서 이리로 온 이유 ─────────────────
// PLAN-STEP-EDITING.md §스텝 카드 "스텝 정보 최소화" 로 옛 StepsSection(이름·메모 편집,
// 위/아래·복제·삭제 버튼)이 철거된다 — 목록·복제·순서는 이미 StepSidebar 가 흡수했고
// (재설계 ②③④⑤), 메모(note)만 남아 있었다. 이 패널이 그 마지막 한 조각을 받는다. 이름은
// UI 에서 완전히 폐기한다(계획서 §스텝 카드) — 여기서 다시 만들지 않는다.
//
// ── 저장 경로는 그대로다 ─────────────────────────────────────────────────────────────
// STEP_META 리듀서 · COALESCE_TYPES(`STEP_META:${id}`, store/editor/history.ts) 는 이미
// 있다 — InspectorPanel 의 옛 [스텝 메모] 가 쓰던 것과 **같은 액션**이라 새로 만들 것이
// 없다. dispatch 는 **change 즉시**(blur 아님) — 두 이유가 옛 StepMetaSection 과 같다:
//   (1) 스텝을 도중에 바꿔도(사이드바 카드 탭) 마지막 글자까지 이미 리듀서에 들어가 있어야
//       유실이 없다. 700ms 뒤 blur 를 기다리면 그 사이 스텝을 넘긴 순간 글자가 증발한다.
//   (2) COALESCE_TYPES 라 700ms/5s 창 안의 연속 타이핑이 되돌리기 한 칸으로 합쳐진다 —
//       글자마다 dispatch 해도 undo 스택이 글자 수만큼 쌓이지 않는다.
//
// ── 비제어 + key={stepId} ────────────────────────────────────────────────────────────
// InspectorPanel 의 옛 [스텝 메모] 와 같은 이유(그 파일 StepMetaSection 머리말 참고):
// 제어 컴포넌트로 만들면 글자마다 React 가 DOM value 를 되쓰며 한글 IME 조합을 건드린다 —
// 입에 문 젓가락으로 치는 사용자에게 조합이 끊기는 것은 그대로 오타다. key 를 스텝 id 로
// 두면 스텝을 넘길 때만(모델이 스스로 바뀔 때만) textarea 가 새로 서고, defaultValue 가
// 그 스텝의 note 로 다시 채워진다 — "스텝을 바꾸면 내용이 따라 바뀐다" 는 요구가 이것이다.
//
// ── 접힘/펼침은 화면 상태다 ───────────────────────────────────────────────────────────
// InspectorHost 의 관행(핀만 prefs, 여닫힘은 로컬)을 봤다 — 이 패널에는 "핀" 개념 자체가
// 없으니 그 결의 더 단순한 쪽이다: 로컬 useState, 기본 접힘. prefs 에 얹지 않는 이유는
// InspectorHost 머리말과 같다 — 열어 둔 채 앱을 닫은 사람이 다음에 다른 스텝에서(또는
// 다른 기기에서) 판을 가린 채 만나는 것보다는, 화면을 열 때마다 조용한 줄 하나로 시작하는
// 편이 낫다.
//
// ── 자유 전술판에는 없다 ─────────────────────────────────────────────────────────────
// 스텝이 없는 화면이라 붙일 note 도 없다(InspectorPanel showSteps=false 와 같은 근거) —
// 렌더 자체를 EditorWorkspace 가 isBoard 로 가른다(StepSidebar 와 같은 자리).
import { useId, useState } from 'react';
import type { CSSProperties } from 'react';
import type { StepId } from '../../core/ids.ts';
import { LIMITS, noteFirstLine } from '../../model/validate.ts';
import { useT } from '../../i18n/useT.ts';

export interface NotePanelProps {
  stepId: StepId;
  note: string;
  onNoteChange(note: string): void;
}

const TOGGLE_ROW: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  minHeight: 'var(--hit)',
  padding: '0 17px',
  fontSize: '0.75rem',
  fontWeight: 700,
  color: 'var(--muted)',
  textAlign: 'left',
};

export function NotePanel({ stepId, note, onNoteChange }: NotePanelProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  // 첫 줄 미리보기 — 접힌 줄에 "노트가 있다" 는 것을 알리는 최소 단서다(점 대신 실제 글).
  // validate.ts 의 noteFirstLine 과 같은 규칙(검증 결함 수정, 2026-08-17): 내보내기 PNG
  // 캡션도 이제 같은 함수로 첫 줄을 뽑는다 — 짧은 이름표 자리가 두 곳에서 따로 계산되면
  // 한쪽만 고쳐질 때 드리프트가 생긴다.
  const preview = noteFirstLine(note);
  const hasNote = preview.length > 0;

  return (
    <div style={{ flex: 'none', borderTop: '1px solid var(--border)', background: 'var(--panel)' }}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls={panelId} style={TOGGLE_ROW}>
        {/* 여는 방향 표식. 이름에는 안 들어간다(aria-hidden) — StageControls [보기▾]와 같은 규칙. */}
        <span aria-hidden style={{ fontSize: '0.5625rem', lineHeight: 1, flex: 'none' }}>
          {open ? '▾' : '▸'}
        </span>
        <span style={{ flex: 'none' }}>{t('editor.notePanel.toggleLabel')}</span>
        {/* 접힌 상태 + 노트가 있을 때만 미리보기를 낸다 — 펼치면 textarea 자체가 그 역할을 한다. */}
        {!open && hasNote && (
          <span
            style={{
              flex: 1,
              minWidth: 0,
              fontWeight: 500,
              color: 'var(--faint-text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {preview}
          </span>
        )}
      </button>
      {open && (
        <div id={panelId} style={{ padding: '0 17px 14px' }}>
          <textarea
            key={stepId}
            aria-label={t('editor.notePanel.textareaAriaLabel')}
            defaultValue={note}
            maxLength={LIMITS.noteLen}
            rows={3}
            placeholder={t('editor.notePanel.placeholder')}
            onChange={(e) => onNoteChange(e.target.value)}
            style={{
              width: '100%',
              minHeight: 72,
              padding: '0.5rem 0.6875rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border)',
              background: 'var(--elev)',
              color: 'var(--text)',
              fontSize: '0.78125rem',
              resize: 'vertical',
            }}
          />
          {/* 지금은 평문이다 — md 렌더(굵게·목록 등)는 추후 지원 예정(계획서 §텍스트의 소속:
              "지금은 평문, 추후 md 렌더"). 상한을 넘겨도 조용히 잘리게만 두면 그 사실을 모르고
              계속 치는 사고가 나므로, maxLength 로 화면이 먼저 막는다(위 textarea). */}
          <div style={{ fontSize: '0.6875rem', color: 'var(--faint-text)', lineHeight: 1.45, marginTop: 6 }}>
            {t('editor.notePanel.plainTextNotice')}
          </div>
        </div>
      )}
    </div>
  );
}
