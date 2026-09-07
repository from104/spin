// 메모 입력·수정 모달 (기현 지시 2026-08-17).
//
// *"메모가 배치는 되는데 내용을 고칠 수가 없다. 최초 배치시, 오른쪽 메뉴 "수정" 메뉴,
//  더블클릭시 입력·수정 모달 띄워서 메모 편집 할 수 있게. 메모 표시나 편집에 줄바꿈 가능하게"*
//
// ── 왜 필요했나 ──────────────────────────────────────────────────────────────────────
// 글을 고치는 길이 **인스펙터 한 곳뿐**이었다: 메모를 고르고 → [속성]을 열고 → [개체] 칸까지
// 내려가야 나오는 textarea. 코트에서 쪽지를 짚은 사람에게 그 경로는 보이지 않는다. 쪽지를
// 놓았는데 아무 데도 글을 쓸 자리가 없으니 "배치는 되는데 고칠 수가 없다" 가 된다.
// 이제 글은 **놓은 자리에서 바로** 열린다 — 배치 직후 자동으로, 그리고 나중에는 더블클릭이나
// 개체 메뉴 [수정] 으로. 인스펙터의 입력도 그대로 둔다(같은 NOTE_SET 을 쏜다): 키보드만 쓰는
// 사람에게는 그쪽이 더 짧은 길이고, 정렬은 아직 거기에만 있다.
//
// ── 왜 모달인가 ──────────────────────────────────────────────────────────────────────
// SVG 위 인라인 편집은 §6.4 판 회전과 좌표 변환을 둘 다 따라가야 해서 비싸다(noteChip.ts
// 머리말에 같은 판단이 적혀 있다). 모달은 회전과 무관하고, 이미 있는 `ui/Modal` 이 포커스
// 트랩·Esc·복귀를 다 갖고 있다 — 그 파일이 *"모달에 텍스트 편집기가 들어가는 라운드에서 이
// 가드가 없으면 한글 조합 취소가 모달을 통째로 닫는다"* 며 미리 달아 둔 IME 가드가 바로
// 이 화면을 위한 것이다. **여기가 그 첫 사용처다.**
import { useEffect, useId, useRef, useState } from 'react';
import { Modal } from '../../ui/Modal.tsx';
import { Button } from '../../ui/Button.tsx';
import { Segmented } from '../../ui/Segmented.tsx';
import { IconCheck } from '../../ui/icons.tsx';
import { isImeKeyEvent } from '../../ui/keyboard.ts';
import { LIMITS } from '../../model/validate.ts';
import { NOTE_COLOR_CHOICES } from '../../core/colors.ts';
import { inkFor } from '../../core/colors.ts';
import { NOTE_DEFAULT_SIZE_PX, NOTE_SIZE_CHOICES } from '../../render/objects/noteChip.ts';
import { useT } from '../../i18n/useT.ts';

export interface NoteEditModalProps {
  open: boolean;
  /** 열릴 때의 글. 열려 있는 동안 바깥에서 바뀌어도 따라가지 않는다 — 편집 중인 글을 덮으면
   *  방금 친 것이 사라진다. 다른 메모를 열 때는 호출부가 `key` 로 갈아끼운다. */
  initialText: string;
  /** §0.5 미배송 빚(2026-08-20) — 모델에는 처음부터 있었는데 고칠 자리가 없던 두 필드.
   *  기본값은 렌더 쪽(NoteLabel.tsx `size = 14`·`color = '#ffffff'`)과 같은 상수를 쓴다 —
   *  호출부가 `note.size ?? NOTE_DEFAULT_SIZE_PX` 로 넘기면 "안 만졌다" 상태가 정확히 맞는다. */
  initialSize: number;
  initialColor: string;
  /** 방금 놓은 쪽지인가. 그러면 [취소]가 **그 쪽지를 도로 치운다**(onCancel 이 그 일을 한다) —
   *  아니면 취소했는데 빈 쪽지가 판에 남아, 치우는 일이 하나 더 생긴다. 이미 있던 메모를
   *  고치는 중이면 false 이고 취소는 아무 일도 하지 않는다. */
  fresh: boolean;
  onSave(text: string, size: number, color: string): void;
  onCancel(): void;
}

/** NOTE_COLOR_CHOICES 와 **같은 순서·같은 길이**여야 한다 — hex 를 i18n 키에 그대로 못
 *  넣으므로(타입도 안 맞고, 대문자·기호가 섞인 키는 이 저장소 관례에도 안 맞는다) 인덱스로
 *  짝짓는다. */
const COLOR_LABEL_KEYS = [
  'editor.noteEditModal.color.white',
  'editor.noteEditModal.color.sky',
  'editor.noteEditModal.color.yellow',
  'editor.noteEditModal.color.red',
] as const;

const TEXTAREA_STYLE: React.CSSProperties = {
  width: '100%',
  minHeight: 132,
  padding: '0.6rem 0.7rem',
  borderRadius: '0.5rem',
  border: '1px solid var(--border)',
  background: 'var(--elev)',
  color: 'var(--text)',
  fontSize: '0.9375rem',
  lineHeight: 1.5,
  resize: 'vertical',
};

export function NoteEditModal({ open, initialText, initialSize, initialColor, fresh, onSave, onCancel }: NoteEditModalProps) {
  const t = useT();
  const [text, setText] = useState(initialText);
  const [size, setSize] = useState(initialSize);
  const [color, setColor] = useState(initialColor);
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const colorGroupId = useId();

  useEffect(() => {
    if (!open) return;
    setText(initialText);
    setSize(initialSize);
    setColor(initialColor);
    // 열리면 **글 칸에 선다.** Modal 은 자기 안의 첫 초점 대상(닫기 ✕)에 포커스를 주는데,
    // 부모 효과가 자식 효과보다 **나중에** 도는 React 규칙 때문에 여기서 그냥 focus() 하면
    // Modal 이 곧바로 도로 가져간다. 마이크로태스크로 한 틱 미뤄 그 뒤에 선다.
    // 이 화면은 "글을 쓰러" 여는 것이라, 열자마자 칠 수 있어야 문이 열린 것이다.
    queueMicrotask(() => {
      const el = ref.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      el.setSelectionRange(el.value.length, el.value.length);
    });
  }, [open, initialText, initialSize, initialColor]);

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onCancel}
      titleId="note-edit-title"
      title={fresh ? t('editor.noteEditModal.titleNew') : t('editor.noteEditModal.titleEdit')}
      closeLabel={t('common.close')}
    >
      <textarea
        ref={ref}
        aria-label={t('editor.noteEditModal.textareaAriaLabel')}
        value={text}
        maxLength={LIMITS.noteLen}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          // Enter 는 **줄바꿈**이다 — 이 모달이 생긴 이유의 절반이 줄바꿈이라 그 키를 저장에
          // 뺏길 수 없다. 저장 단축키는 Ctrl/⌘+Enter 로 둔다(조합 중에는 먹지 않는다: 한글
          // 조합을 끝내는 Enter 가 저장으로 새면 첫 낱말마다 모달이 닫힌다).
          // 조합 판정은 `isImeKeyEvent` 한 자리에 모여 있다(2026-09-08) — 여기서만 보던
          // `isComposing` 은 조합 첫 keydown(keyCode 229)·`key === 'Process'` 를 못 잡았다.
          // React 합성 이벤트에는 `isComposing` 이 없으므로 nativeEvent 를 넘긴다.
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !isImeKeyEvent(e.nativeEvent)) {
            e.preventDefault();
            onSave(text, size, color);
          }
        }}
        style={TEXTAREA_STYLE}
      />
      {/* 크기·색(§0.5 미배송 빚, 2026-08-20) — 모델엔 처음부터 있었는데 고칠 자리가 없던
          두 필드. 글과 같은 모달에서 함께 고친다(따로 자리를 만들면 표적이 하나 더 생긴다). */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)' }}>{t('editor.noteEditModal.sizeLabel')}</span>
          <Segmented
            ariaLabel={t('editor.noteEditModal.sizeLabel')}
            value={String(size)}
            onChange={(v) => setSize(Number(v))}
            options={NOTE_SIZE_CHOICES.map((s) => ({
              value: String(s),
              label: s === NOTE_SIZE_CHOICES[0] ? t('editor.noteEditModal.sizeSmall') : s === NOTE_DEFAULT_SIZE_PX ? t('editor.noteEditModal.sizeMedium') : t('editor.noteEditModal.sizeLarge'),
            }))}
            dense
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span id={colorGroupId} style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)' }}>
            {t('editor.noteEditModal.colorLabel')}
          </span>
          <div role="radiogroup" aria-labelledby={colorGroupId} style={{ display: 'flex', gap: 6 }}>
            {NOTE_COLOR_CHOICES.map((c, i) => {
              const active = c === color;
              return (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={t(COLOR_LABEL_KEYS[i]!)}
                  onClick={() => setColor(c)}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: c,
                    border: active ? '2px solid var(--accent)' : '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {active && <IconCheck size={13} style={{ color: inkFor(c) }} />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 12 }}>
        <span style={{ fontSize: '0.6875rem', color: 'var(--faint-text)' }}>{t('editor.noteEditModal.hint')}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" onClick={onCancel}>
            {t('editor.noteEditModal.cancel')}
          </Button>
          <Button variant="primary" onClick={() => onSave(text, size, color)}>
            {t('editor.noteEditModal.confirm')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
