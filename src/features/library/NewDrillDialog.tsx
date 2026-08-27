// §6.11 [새 드릴] — 이름과 코트를 먼저 묻는 다이얼로그 (2026-08-28 기현 지시:
// *"드릴 목록에서 [새 드릴]이 그냥 보드로 감. 내가 원한 건 드릴 이름 입력, 코트 고르는 모달이
// 나오고 ok 하면 스텝 1개 있는 드릴 편집으로 가는 것"*).
//
// ── 무엇이 뒤집혔나 ───────────────────────────────────────────────────────────────────
// 2026-08-09 재편에서 [새 드릴]은 **자유 전술판으로 가는 문**이 됐다("그린 뒤 [드릴로 저장]으로
// 승격"). 그 경로 자체는 남는다 — 판에서 즉흥으로 그리다 남기고 싶어지는 흐름이 실제로 있다.
// 다만 목록에서 [새 드릴]을 누른 사람은 **드릴을 만들 작정**으로 눌렀는데 이름도 코트도 못 고른
// 빈 판이 떴다. 두 흐름은 시작하는 마음이 다르고, 이제 문도 둘이다:
//   · 목록/헤더의 [새 드릴] → 이 다이얼로그 → 저장소에 태어난 드릴의 편집기(스텝 1개)
//   · 전술판의 [드릴로 저장] → 그리던 판을 그대로 드릴로 (그대로)
//
// ── 왜 app-shell 이 세우나 ────────────────────────────────────────────────────────────
// [새 드릴]은 목록 화면의 버튼이 아니라 **헤더의 주 액션**(AppShell 의 staticHeaderConfig)이고,
// 목록의 빈 상태 CTA 도 같은 `nav.newDrill()` 을 부른다. 진입점이 둘이므로 다이얼로그를 목록
// 화면 안에 두면 헤더에서 누른 경우를 못 받는다 — 그래서 마운트는 AppShell 이 하고, 이 파일은
// 그 자리에서 자족하도록 저장(useLibrary)까지 자기가 한다.
//
// ⚠️ 코트 크기 3단이 **풀 코트에서만 뜻이 있다**는 규칙은 편집기 [보드 설정] 모달과 같다
//    (court.ts COURT_DEFS 근거). 그래서 문구도 그쪽 i18n 키를 그대로 쓴다 — 같은 사실을 두
//    벌로 번역해 두면 한쪽만 고쳐지는 날이 온다.
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Modal } from '../../ui/Modal.tsx';
import { Button } from '../../ui/Button.tsx';
import { useLibrary } from '../../store/library/LibraryProvider.tsx';
import { COURT_DEFS, COURT_SIZES, COURT_SIZE_LABELS, DEFAULT_COURT_SIZE, courtDefFor } from '../../model/court.ts';
import type { CourtMode, CourtSize } from '../../model/court.ts';
import type { DrillId } from '../../core/ids.ts';
import { useT } from '../../i18n/useT.ts';
import { useLocale } from '../../i18n/useLocale.ts';

export interface NewDrillDialogProps {
  open: boolean;
  onClose: () => void;
  /** 만들어진 드릴의 id — 부른 쪽이 편집기로 데려간다. */
  onCreated: (id: DrillId) => void;
}

export function NewDrillDialog({ open, onClose, onCreated }: NewDrillDialogProps) {
  const t = useT();
  const locale = useLocale();
  const { createDrill } = useLibrary();
  const nameRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [courtMode, setCourtMode] = useState<CourtMode>('full');
  const [courtSize, setCourtSize] = useState<CourtSize>(DEFAULT_COURT_SIZE);
  const [busy, setBusy] = useState(false);

  // 열 때마다 새 종이로 돌아간다 — 지난번에 고른 코트가 남아 있으면 "왜 하프지?" 가 된다.
  useEffect(() => {
    if (!open) return;
    setTitle('');
    setCourtMode('full');
    setCourtSize(DEFAULT_COURT_SIZE);
    setBusy(false);
  }, [open]);

  const submit = () => {
    if (busy) return;
    setBusy(true);
    void (async () => {
      try {
        // 이름을 비운 채 [만들기]를 눌러도 막지 않는다 — 자리 표시자와 같은 기본 이름을 주고
        // 편집기(인스펙터)에서 고치게 한다. 만드는 문턱을 이름 하나로 막을 이유가 없다.
        const named = title.trim();
        const d = await createDrill({
          courtMode,
          courtSize,
          ...(named ? { title: named } : {}),
        });
        onCreated(d.id);
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      titleId="new-drill-dialog-title"
      title={t('newDrill.dialogTitle')}
      closeLabel={t('common.close')}
      initialFocusRef={nameRef}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)' }}>
          <span>{t('newDrill.nameLabel')}</span>
          <input
            ref={nameRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('newDrill.namePlaceholder')}
            maxLength={80}
            style={INPUT}
          />
        </label>

        {/* 형태·크기는 [보드 설정] 모달과 같은 2단 — 좁은 창에서는 auto-fit 이 알아서 1단으로 접는다. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, alignItems: 'start' }}>
          <div role="radiogroup" aria-label={t('editor.functionBar.courtModal.shapeGroupLabel')} style={COLUMN}>
            <p style={SECTION_LABEL}>{t('editor.functionBar.courtModal.shapeGroupLabel')}</p>
            {(['full', 'half', 'flat'] as const).map((m) => {
              const d = COURT_DEFS[m];
              const on = courtMode === m;
              return (
                <button key={m} type="button" role="radio" aria-checked={on} aria-label={d.label[locale]} title={d.desc[locale]} onClick={() => setCourtMode(m)} style={toggleStyle(on)}>
                  {d.label[locale]}
                </button>
              );
            })}
          </div>

          <div style={COLUMN}>
            <p style={SECTION_LABEL}>{t('editor.functionBar.courtModal.sizeGroupLabel')}</p>
            {courtMode !== 'full' ? (
              // 값은 계속 들고 다니되 판을 안 바꾸므로, 고르게 두면 판이 거짓말을 한다.
              <p style={HINT}>{t('editor.functionBar.courtModal.sizeInfoFullOnly', { size: COURT_SIZE_LABELS[locale][courtSize] })}</p>
            ) : (
              <div role="radiogroup" aria-label={t('editor.functionBar.courtModal.sizeGroupLabel')} style={COLUMN}>
                {COURT_SIZES.map((s) => {
                  const on = courtSize === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={t('editor.functionBar.courtModal.sizeRadioAriaLabel', { size: COURT_SIZE_LABELS[locale][s] })}
                      title={courtDefFor('full', s).desc[locale]}
                      onClick={() => setCourtSize(s)}
                      style={toggleStyle(on)}
                    >
                      {COURT_SIZE_LABELS[locale][s]}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button type="button" onClick={onClose}>
            {t('newDrill.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {t('newDrill.create')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

const COLUMN: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8 };
const SECTION_LABEL: CSSProperties = { margin: 0, fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)' };
const HINT: CSSProperties = { margin: 0, fontSize: '0.75rem', lineHeight: 1.5, color: 'var(--muted)' };
const INPUT: CSSProperties = {
  minHeight: 'var(--hit)',
  padding: '0 0.75rem',
  borderRadius: '0.6rem',
  border: '1px solid var(--border)',
  background: 'var(--elev)',
  color: 'var(--text)',
  fontSize: '0.8125rem',
  width: '100%',
};

function toggleStyle(on: boolean): CSSProperties {
  return {
    minHeight: 'var(--hit)',
    padding: '0 0.75rem',
    borderRadius: '0.6rem',
    // 고른 것은 편집기 [보드 설정] 의 라디오와 **같은 어휘**로 표시한다: accent 테두리 + accent
    // 글자 + 굵기. `color-mix` 를 배경에 쓰지 않는 이유는 취향이 아니다 — jsdom 이 `background`
    // 단축 속성 안의 `color-mix()` 를 파싱하다 죽어서 role 질의가 통째로 터진다(2026-08-28 실측).
    border: on ? '1.5px solid var(--accent)' : '1px solid var(--border)',
    backgroundColor: 'var(--elev)',
    color: on ? 'var(--accent-text)' : 'var(--text)',
    fontSize: '0.8125rem',
    fontWeight: on ? 700 : 500,
    textAlign: 'left',
  };
}
