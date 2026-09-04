// 작은 화면 안내 모달 — 폰·7인치 미만 태블릿에서 한 번 알리고 비켜서는 한 장
// (PLAN-0-6-3-LOADER-NOTICE, 2026-09-04 기현 지시: *"핸드폰·7인치 미만 태블릿은 사용을 권장하지
// 않는다는 안내 모달. 열 때마다 뜨되 [다시 보지 않기] 체크를 제공한다. 사용을 막지는 않는다."*).
//
// ⚠️ 이 컴포넌트는 **prefs 를 직접 안 본다.** 받는 것은 `open` 과 `onClose(dismissed)` 둘뿐이고,
// 무엇을 저장할지·언제 열지는 전부 AppShell 이 정한다. 그래야 단독으로 마운트해 볼 수 있고,
// "저장은 `onClose` 한 곳"(결정 25) 이라는 규칙을 이 파일이 어길 수단 자체가 없어진다.
//
// 닫는 길은 넷(✕ · Esc · 백드롭 · [계속하기])이지만 나가는 문은 `close()` 하나다. 경로마다
// 저장을 흩으면 Esc 로 닫은 사람만 체크가 무시되는 반쪽 상태가 생긴다 — **닫기 = 확인**이다.
// ⚠️ 문이 하나인 것만으로는 부족하다 — 그 문이 **언제 만들어진 값**을 읽는지가 같아야 한다.
// Esc 경로만 첫 렌더의 클로저를 붙잡으므로 체크 상태는 ref 로 읽는다(아래 `dismissedRef`).
//
// 초기 초점을 [계속하기]에 주지 않는다(결정 27). 확인 버튼에 커서를 세우면 스크린리더 사용자가
// 본문과 체크박스를 지나쳐 버튼에 서고, **체크박스가 있다는 것을 모른 채** 닫게 된다. Modal 의
// 기본(첫 포커스 가능 요소 = 닫기 ✕)에 그대로 둔다.
//
// 닫은 뒤 초점은 `returnFocusRef` 로 `#main` 에 돌려준다(결정 29). 이 모달은 **여는 트리거가
// 없어**(앱이 스스로 띄운다) Modal 의 기본 복귀 대상이 `<body>` 인데, body 는 포커스를 못 받아
// Tab 이 문서 처음부터 다시 시작한다. `#main` 은 첫 렌더에 아직 없을 수 있어 `open` 이 선 뒤
// effect 에서 채운다 — Modal 은 그 값을 **닫힐 때** 읽으므로 채우는 시점이 늦어도 안전하다.
//
// 형제 파일: `ChangelogModal.tsx` · `LanguageModal.tsx`(같은 자리, 같은 구조). 문안 정본은
// 계획서 §6 이고 키는 `src/i18n/{ko,en,ja}.ts` 의 `app.smallScreen.*` 다.
import { useEffect, useRef, useState } from 'react';
import { Modal } from '../ui/Modal.tsx';
import { useT } from '../i18n/useT.ts';

export interface SmallScreenNoticeProps {
  open: boolean;
  /** 닫힐 때 한 번 부른다. `dismissed` 는 [다시 보지 않기] 가 체크된 채 닫혔는지. */
  onClose(dismissed: boolean): void;
}

const TITLE_ID = 'small-screen-notice-title';
const BODY_ID = 'small-screen-notice-body';

export function SmallScreenNotice({ open, onClose }: SmallScreenNoticeProps) {
  const t = useT();
  const [dismissed, setDismissed] = useState(false);
  // ★ 같은 값을 ref 로도 든다 — `close` 가 읽는 것은 state 가 아니라 이쪽이다.
  // Esc 는 Modal 이 `open` 이 서는 순간에 건 document 리스너가 처리하고, 그 리스너는 그때의
  // `onClose` 클로저를 붙잡고 있다(`Modal.tsx` 가 머리말에 "onClose identity 변화로 트랩을
  // 재설정하지 않는다" 고 밝힌 그 성질). 렌더 본문에서 쓰는 ✕·백드롭·[계속하기]와 달리 Esc 만
  // 첫 렌더의 값을 보므로, state 를 그대로 넘기면 **Esc 로 닫은 사람의 체크만 조용히 버려진다.**
  // 그것이 바로 이 파일 머리말과 결정 25 가 금지하는 반쪽 상태다. ref 는 언제 읽어도 최신이라
  // 네 경로가 같은 답을 낸다. Modal 쪽 의존성을 늘려 고치지 않는 이유는 그러면 열려 있는 동안
  // 트랩 리스너가 재설정되어(포커스 복귀 대상·마지막 초점 기억) 6개 사용처의 계약이 흔들리기 때문이다.
  const dismissedRef = useRef(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // 열릴 때마다 체크는 꺼진 자리에서 시작한다. 부모는 `open` 과 무관하게 이 컴포넌트를 상시
  // 렌더하므로(ChangelogModal.tsx:97 이 기록한 그 사실) 언마운트로 상태가 씻기지 않는다.
  // 같은 effect 에서 복귀 대상도 잡는다 — 둘 다 "열리는 순간"에 해야 하는 일이다.
  useEffect(() => {
    if (!open) return;
    setDismissed(false);
    dismissedRef.current = false; // 둘은 항상 같이 움직인다 — 한쪽만 되돌리면 앞 회차의 체크가 남는다.
    returnFocusRef.current = document.getElementById('main');
  }, [open]);

  const close = () => onClose(dismissedRef.current);

  return (
    <Modal
      open={open}
      onClose={close}
      titleId={TITLE_ID}
      title={t('app.smallScreen.title')}
      descriptionId={BODY_ID}
      closeLabel={t('common.close')}
      returnFocusRef={returnFocusRef}
    >
      <p id={BODY_ID} style={{ margin: 0, color: 'var(--text)', fontSize: '0.875rem', lineHeight: 1.7 }}>
        {t('app.smallScreen.body')}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: '1.25rem' }}>
        {/* 네이티브 input + label — 체크 상태를 그림으로 흉내 내면 보조기기가 읽는 역할·상태와
            화면이 갈린다. 표적은 라벨 전체이고 높이는 `--hit` 하나로 맨다(AGENTS §1.7). */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            minHeight: 'var(--hit)',
            cursor: 'pointer',
            color: 'var(--text)',
            fontSize: '0.8125rem',
            fontWeight: 600,
          }}
        >
          <input
            type="checkbox"
            checked={dismissed}
            onChange={(e) => {
              dismissedRef.current = e.target.checked;
              setDismissed(e.target.checked);
            }}
            style={{ margin: 0 }}
          />
          {t('app.smallScreen.dismiss')}
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={close}
            style={{
              minHeight: 'var(--hit)',
              padding: '0 1.25rem',
              borderRadius: '0.6rem',
              border: '1px solid var(--border-strong)',
              background: 'var(--panel-2)',
              color: 'var(--text)',
              fontSize: '0.875rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {t('app.smallScreen.continue')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
