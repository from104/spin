// 언어 고르기 모달 — 레일의 지구본이 연다 (기현 지시 2026-09-02).
//
// *"언어 선택을 설정에서 빼서 왼쪽 바의 도움말 위 아이콘으로 배치하고 누르면 모달로 선택하게
//  해. 세로로 쌓이는 목록으로, 순서는 자동, 한국어, 영어, 일본어"*
//
// ── 왜 설정에서 뺐는가 ───────────────────────────────────────────────────────────────
// 언어는 설정 화면의 다른 항목들과 **등급이 다르다.** 나머지는 "앱을 쓰다가 가끔 손보는 것"
// 이지만, 언어는 **읽을 수 없어서 찾아가야 하는 것**이다. 설정 안에 있으면 그 화면까지 가는
// 길(레일의 [설정] → 스크롤 → 첫 섹션)이 전부 읽지 못하는 글자로 되어 있다. 레일의 아이콘
// 하나면 글자를 한 자도 안 읽고 도달한다.
//
// ── 왜 Segmented 가 아니라 세로 목록인가 ───────────────────────────────────────────
// 설정에서는 가로 분할 버튼(`Segmented`)이었다. 칸이 넷으로 늘면 각 칸이 좁아져 '한국어'·
// '日本語' 가 줄바꿈되거나 깎이고, 로케일이 더 늘면(계획에 있다) 그 자리에서 무너진다.
// 세로 목록은 항목이 늘어도 아래로만 자라고, 각 줄이 손가락 표적으로 충분히 크다.
//
// ── 왜 `LOCALE_NAMES` 를 번역하지 않는가 ────────────────────────────────────────────
// '한국어'·'English'·'日本語' 는 그 언어 자체의 고유명사다(i18n/locale.ts 의 그 주석). 지금
// UI 가 무슨 언어든 항상 저 표기로 보여야, 자기 모국어를 못 알아보는 사고가 안 난다.
// **[자동]만 번역한다** — 그건 언어 이름이 아니라 동작의 이름이라서다.
import { useT } from '../i18n/useT.ts';
import { LOCALE_NAMES, SUPPORTED_LOCALES } from '../i18n/locale.ts';
import type { Locale } from '../i18n/locale.ts';
import { Modal } from '../ui/Modal.tsx';
import { IconCheck } from '../ui/icons.tsx';
import { useSettingsActions, useSettingsState } from '../store/settings/SettingsProvider.tsx';
import type { RefObject } from 'react';

/** 화면에 서는 순서 — **자동 → 한국어 → 영어 → 일본어**(기현 지시).
 *
 *  `SUPPORTED_LOCALES` 를 그대로 쓰지 않고 여기서 다시 세우는 이유: 저 배열은 **판정용**이라
 *  순서가 뜻을 갖지 않는데(`detectLocale` 의 첫 매치), 이 목록의 순서는 지시로 정해진 값이다.
 *  둘을 같은 배열로 묶으면 판정 쪽을 만지는 사람이 화면 순서를 모르는 채로 바꾸게 된다.
 *
 *  ⚠️ 그래도 **빠짐은 막는다** — 아래 단언이 로케일이 늘었는데 여기 안 실린 경우를 잡는다. */
const ORDER: readonly Locale[] = ['ko', 'en', 'ja'];

if (import.meta.env?.DEV) {
  const missing = SUPPORTED_LOCALES.filter((l) => !ORDER.includes(l));
  if (missing.length > 0) {
    throw new Error(`LanguageModal.ORDER 에 빠진 로케일: ${missing.join(', ')}`);
  }
}

export interface LanguageModalProps {
  open: boolean;
  onClose(): void;
  /** 닫힐 때 포커스를 되돌릴 대상(레일의 지구본 버튼). */
  returnFocusRef?: RefObject<HTMLElement | null>;
}

const ROW: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  width: '100%',
  minHeight: 'var(--hit)',
  padding: '0 14px',
  border: '1px solid var(--border)',
  borderRadius: 12,
  background: 'transparent',
  color: 'var(--text)',
  fontSize: '0.9375rem',
  fontWeight: 600,
  textAlign: 'left',
};

export function LanguageModal({ open, onClose, returnFocusRef }: LanguageModalProps) {
  const t = useT();
  const { prefs } = useSettingsState();
  const { setPrefs } = useSettingsActions();

  const choose = (value: 'auto' | Locale) => () => {
    setPrefs({ language: value });
    // 고르면 닫는다 — 한 번 누르면 끝나는 명령이라 되돌아가 확인할 것이 없다. 결과는 모달이
    // 사라진 자리의 화면 글자가 곧바로 말해 준다.
    onClose();
  };

  const rows: { value: 'auto' | Locale; label: string }[] = [
    { value: 'auto', label: t('settings.language.auto') },
    ...ORDER.map((loc) => ({ value: loc, label: LOCALE_NAMES[loc] })),
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      titleId="language-modal-title"
      title={t('settings.language.title')}
      closeLabel={t('common.close')}
      returnFocusRef={returnFocusRef}
    >
      <p style={{ margin: '0 0 12px', color: 'var(--muted)', fontSize: '0.8125rem', lineHeight: 1.6 }}>
        {t('settings.language.desc')}
      </p>
      {/* `role="radiogroup"` 이 아니라 평범한 버튼 목록이다 — 라디오는 화살표로 옮겨 다니며
          고르는 물건이라 Tab 이 한 칸만 먹는데, 여기서는 네 줄을 Tab 으로 지나며 읽는 쪽이
          맞다(언어를 못 읽는 사람이 하나씩 짚어 보는 화면이다). 지금 선택은 `aria-current`
          와 체크 표시가 말한다. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((r) => {
          const on = prefs.language === r.value;
          return (
            <button
              key={r.value}
              type="button"
              aria-current={on ? 'true' : undefined}
              onClick={choose(r.value)}
              style={{
                ...ROW,
                borderColor: on ? 'var(--accent)' : 'var(--border)',
                color: on ? 'var(--accent)' : 'var(--text)',
              }}
            >
              <span aria-hidden style={{ display: 'flex', width: 18, opacity: on ? 1 : 0 }}>
                <IconCheck size={18} />
              </span>
              {r.label}
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
