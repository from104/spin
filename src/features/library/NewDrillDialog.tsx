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
// ── 이 파일에 둘이 산다 ──────────────────────────────────────────────────────────────
// `NewDrillDialog`(이름+코트 → `createDrill`)와 `SaveAsDrillDialog`(전술판 [저장] — 이름만).
// 한 파일인 이유는 **이름 칸을 공유**해서다(`NameField`) — 라벨·자리 표시자·길이 상한이 두
// 벌이 되면 한쪽만 고쳐지는 날이 온다. 저장 방식은 각자 다르다(하나는 여기서, 하나는 판을
// 아는 BoardScreen 에서) — 그쪽 머리말 참고.
//
// ⚠️ 코트 크기 3단이 **풀 코트에서만 뜻이 있다**는 규칙은 편집기 [보드 설정] 모달과 같다
//    (court.ts COURT_DEFS 근거). 그래서 문구도 그쪽 i18n 키를 그대로 쓴다 — 같은 사실을 두
//    벌로 번역해 두면 한쪽만 고쳐지는 날이 온다.
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';
import { Modal } from '../../ui/Modal.tsx';
import { OptionText, OPTION_STACK } from '../../ui/OptionText.tsx';
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
          // **빈 판으로 태어난다**(2026-08-28 기현 지시). 기본 포메이션 8대가 미리 깔려 있으면
          // 무엇을 그릴지 아는 사람은 매번 치우는 일부터 해야 한다 — 자유 전술판이 `empty` 를
          // 쓰는 이유(defaults.ts 그 주석)가 여기서도 그대로 성립한다. 채우고 싶으면
          // 편집기의 [포메이션으로 채우기]가 한 번에 놓는다. 반대로 치우는 쪽은 한 번이 아니다.
          empty: true,
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
        <NameField inputRef={nameRef} value={title} onChange={setTitle} />

        {/* 형태·크기는 [보드 설정] 모달과 같은 2단 — 좁은 창에서는 auto-fit 이 알아서 1단으로 접는다. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, alignItems: 'start' }}>
          <div role="radiogroup" aria-label={t('editor.functionBar.courtModal.shapeGroupLabel')} style={COLUMN}>
            <p style={SECTION_LABEL}>{t('editor.functionBar.courtModal.shapeGroupLabel')}</p>
            {(['full', 'half', 'flat'] as const).map((m) => {
              const d = COURT_DEFS[m];
              const on = courtMode === m;
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={d.label[locale]}
                  title={d.desc[locale]}
                  onClick={() => setCourtMode(m)}
                  style={{ ...toggleStyle(on), ...OPTION_STACK }}
                >
                  <OptionText label={d.label[locale]} desc={d.desc[locale]} />
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
                      style={{ ...toggleStyle(on), ...OPTION_STACK }}
                    >
                      <OptionText label={COURT_SIZE_LABELS[locale][s]} desc={courtDefFor('full', s).desc[locale]} />
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

/** §6.8 전술판 [저장] — **이름만** 묻고 곧장 편집기로 (2026-08-28 기현 지시:
 *  *"첫 화면의 [저장] 버튼은 이름 묻는 모달 띄우고 입력하면 바로 드릴 편집으로 넘어가"*).
 *
 *  코트를 안 묻는 이유: 판이 이미 코트를 들고 있다. 여기서 다시 고르게 하면 그 순간
 *  "고른 코트로 옮겨 담을 것인가" 라는, 답이 없는 질문(court.ts 의 그 좌표 사상 문제)이 생긴다.
 *
 *  ⚠️ **저장은 이 컴포넌트가 하지 않는다.** 전술판 승격은 `structuredClone(state.present)` 에
 *  새 id 를 다는 복사이고, 그 판을 아는 것은 BoardScreen 뿐이다 — 여기는 이름만 받아 넘긴다.
 *  실패해도 화면이 안 넘어가야 하므로 성공 여부는 부른 쪽이 판정한다(`onSubmit` 은 Promise).
 *
 *  [새 드릴] 과 한 파일에 사는 이유는 **이름 칸을 공유**해서다(`NameField`) — 라벨·자리
 *  표시자·길이 상한이 두 벌이 되면 한쪽만 고쳐지는 날이 온다. */
export interface SaveAsDrillDialogProps {
  open: boolean;
  onClose: () => void;
  /** 판이 들고 있던 제목. 비어 있으면 자리 표시자만 뜬다. */
  defaultTitle: string;
  /** 이름을 받아 실제로 저장한다. **성공했을 때만** true 를 돌려주면 그때 모달이 닫힌다. */
  onSubmit: (title: string) => Promise<boolean>;
}

export function SaveAsDrillDialog({ open, onClose, defaultTitle, onSubmit }: SaveAsDrillDialogProps) {
  const t = useT();
  const nameRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  // 열 때 판의 제목을 실어 준다 — 인스펙터에서 이미 이름을 붙여 둔 사람에게 빈 칸을 내밀면
  // 그 이름이 어디로 갔는지 알 수 없다. 커서가 칸에 서므로 그대로 눌러도, 고쳐 써도 된다.
  useEffect(() => {
    if (!open) return;
    setTitle(defaultTitle);
    setBusy(false);
    // 이름을 통째로 갈아 끼우는 것이 흔한 동작이라 열자마자 전체 선택해 둔다.
    nameRef.current?.select();
  }, [open, defaultTitle]);

  const submit = () => {
    if (busy) return;
    setBusy(true);
    void (async () => {
      try {
        if (await onSubmit(title.trim())) onClose();
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <Modal open={open} onClose={onClose} titleId="save-as-drill-dialog-title" title={t('board.saveDialog.title')} closeLabel={t('common.close')} initialFocusRef={nameRef}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <NameField inputRef={nameRef} value={title} onChange={setTitle} />
        <p style={HINT}>{t('board.saveDialog.hint')}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button type="button" onClick={onClose}>
            {t('newDrill.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {t('board.saveDialog.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** 두 다이얼로그가 함께 쓰는 이름 칸. 라벨·자리 표시자·길이 상한이 한 곳에 있다. */
function NameField({ inputRef, value, onChange }: { inputRef: RefObject<HTMLInputElement | null>; value: string; onChange: (v: string) => void }) {
  const t = useT();
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)' }}>
      <span>{t('newDrill.nameLabel')}</span>
      <input ref={inputRef} value={value} onChange={(e) => onChange(e.target.value)} placeholder={t('newDrill.namePlaceholder')} maxLength={80} style={INPUT} />
    </label>
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
