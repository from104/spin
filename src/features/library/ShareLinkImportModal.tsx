// 링크를 **손으로 붙여넣어** 받는 문(PLAN-SHARE-LINK §8, 2026-09-09 기현님 지시:
// *"드릴, 세션 목록에 '링크로 가져오기' 버튼과 그에 따른 모달 추가 — 그래야 일관된 UX"*).
//
// 왜 있나. 링크 받기는 `/s/:id#key` 착지 한 길뿐이었다(결정 9). 그 길은 링크를 **눌러서** 열 수
// 있을 때만 열린다 — 다른 기기에서 복사해 온 링크, 데스크톱 앱, 인앱 브라우저에서 "다른
// 브라우저로 열기" 를 거친 뒤에는 받을 방법이 아예 없었다. 보내는 [링크로 공유]는 카드마다
// 있는데 받는 버튼이 없어 짝도 안 맞았다.
//
// ⚠️ **판정은 `parseShareLink` 하나다**(share/link.ts). 여기서 정규식을 다시 쓰지 마라 —
//    링크 문법의 정본은 이미 있고, 두 벌이 되면 그 둘은 반드시 갈라진다(AGENTS §3). 그 함수가
//    전체 URL·경로만·알맹이만 세 꼴을 다 받으므로 사람이 무엇을 붙여넣든 여기서 판정이 끝난다.
//
// ⚠️ **이 모달은 서버를 부르지 않는다.** 여는 일도 저장하는 일도 전부 `ShareImportSheet` 몫이다
//    (L2) — 여기는 `{id, keyB64}` 를 뽑아 부른 쪽에 넘기고 닫힌다. 열쇠 없는 링크·오타를 여기서
//    막는 이유가 그것이다: 못 여는 암호문을 받아 오는 것은 남의 서버에 지우는 헛짐이다.
//
// ⚠️ 라우터로 `/s/:id` 를 밀어 착지를 흉내 내지 마라 — **열쇠는 라우터에 없다**(routes.ts).
//    주소로 돌리는 순간 `#` 뒤 43자가 증발해 늘 '열쇠가 맞지 않습니다' 가 뜬다.
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';
import { Modal } from '../../ui/Modal.tsx';
import { Button } from '../../ui/Button.tsx';
import { isImeKeyEvent } from '../../ui/keyboard.ts';
import { parseShareLink } from '../../share/link.ts';
import type { ShareLinkParts } from '../../share/link.ts';
import { useT } from '../../i18n/useT.ts';

export interface ShareLinkImportModalProps {
  open: boolean;
  onClose(): void;
  /** 판정을 통과한 링크. 부른 쪽이 이것으로 `ShareImportSheet` 를 띄운다(모달은 닫는다). */
  onOpen(parts: ShareLinkParts): void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

export function ShareLinkImportModal({ open, onClose, onOpen, returnFocusRef }: ShareLinkImportModalProps) {
  const t = useT();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState('');

  // 열 때마다 빈 칸으로 돌아간다 — 지난번에 실패한 링크가 남아 있으면 오류 문구부터 보게 된다.
  // ⚠️ 비우는 시점은 **닫힐 때**지 열릴 때가 아니다(2026-09-09 검수). 열릴 때 비우면 지난 입력과
  //    그 `role="alert"` 오류가 첫 프레임에 한 번 그려진 뒤 지워져, 눈에는 깜빡임으로 보이고
  //    보조기술에는 열 때마다 오류가 한 번 더 읽힌다. 닫힌 뒤의 비우기는 아무도 못 본다.
  useEffect(() => {
    if (open) return;
    setText('');
  }, [open]);

  const parts = parseShareLink(text);
  // 아직 아무것도 안 쓴 사람에게 "잘못된 링크" 를 들이밀지 않는다 — 빈 칸은 오류가 아니다.
  const invalid = text.trim() !== '' && parts === null;

  const submit = () => {
    if (!parts) return;
    onOpen(parts);
  };

  const paste = async () => {
    try {
      // ⚠️ 클립보드는 권한·보안 컨텍스트·사용자 제스처 셋 중 하나만 어긋나도 거절하고, 아예
      //    `navigator.clipboard` 가 없는 브라우저도 있다(그래서 `?.`). 실패는 **조용히** 삼키고
      //    입력칸에 커서만 세운다 — 여기서 오류 문구를 띄우면 손으로 붙여넣으면 되는 사람에게
      //    막다른 길처럼 보인다(붙여넣기는 편의지 유일한 길이 아니다).
      const clip = await navigator.clipboard?.readText();
      if (clip) setText(clip);
    } catch {
      /* 무시 — 아래 포커스로 손 붙여넣기를 안내한다 */
    }
    inputRef.current?.focus();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      titleId="share-link-import-title"
      title={t('library.importLink.title')}
      closeLabel={t('library.importLink.closeLabel')}
      returnFocusRef={returnFocusRef}
      initialFocusRef={inputRef}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)' }}>
          <span>{t('library.importLink.label')}</span>
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // 여러 줄이 필요한 칸이 아니다(링크 한 개) — Enter 는 줄바꿈이 아니라 [열기] 다.
              // ⚠️ IME 조합 중의 Enter 는 **한글 확정**이지 제출이 아니다(Modal.tsx 의 Esc 와 같은
              //    규율). 붙여넣은 링크에 한글은 없지만 이 칸에 무엇이든 칠 수 있다.
              if (isImeKeyEvent(e.nativeEvent)) return;
              if (e.key !== 'Enter' || e.shiftKey) return;
              e.preventDefault();
              submit();
            }}
            rows={2}
            placeholder={t('library.importLink.placeholder')}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            style={TEXTAREA}
          />
        </label>

        {/* 오류는 칸 **아래** 한 줄로만 말한다. `role="alert"` 이라 보조기술은 글자가 나타나는
            순간 읽어 준다 — 사람이 [열기] 를 눌러 보고서야 막힌 것을 알게 두지 않는다.
            색으로 오류를 표시하지 않는다(빨강 토큰이 없기도 하고, 색만으로 뜻을 나르면
            고대비·색각 이상에서 사라진다) — 본문색 `--text` 로 안내문보다 진하게만 둔다. */}
        {invalid ? (
          <p role="alert" style={{ ...HINT, color: 'var(--text)' }}>
            {t('library.importLink.invalid')}
          </p>
        ) : (
          <p style={HINT}>{t('library.importLink.hint')}</p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button type="button" onClick={() => void paste()}>
            {t('library.importLink.paste')}
          </Button>
          <Button type="submit" variant="primary" disabled={parts === null}>
            {t('library.importLink.open')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

const HINT: CSSProperties = { margin: 0, fontSize: '0.75rem', lineHeight: 1.5, color: 'var(--muted)' };

const TEXTAREA: CSSProperties = {
  minHeight: 'var(--hit)',
  padding: '0.5rem 0.75rem',
  borderRadius: '0.6rem',
  border: '1px solid var(--border)',
  background: 'var(--elev)',
  color: 'var(--text)',
  fontSize: '0.8125rem',
  lineHeight: 1.5,
  width: '100%',
  resize: 'vertical',
};
