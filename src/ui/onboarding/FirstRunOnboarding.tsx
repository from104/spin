// 첫 실행 온보딩 석 장 (2026-09-16, SPIN 출시 프로젝트 T7).
//
// ── 왜 이것이 생겼나 ────────────────────────────────────────────────────────────────
// 2026-08-10 공개판에서 **두 카톡방이 서로 모른 채 같은 첫마디**를 했다. 김동수 "선수 배치 및
// 이동이 어려움" · 정성우 "선수를 코트에 어떻게 배치하나요. 더블클릭 해도 안되고 드래그도
// 안되네요". 한쪽에서는 옆 사람이 대신 사용법을 설명해야 했다. 그때 남긴 판정이 이 파일의
// 존재 이유다 — ***"도움말로 해결할 문제가 아니라 조작 자체의 문제였다."***
//
// 조작 쪽은 고쳤다(배치 경로가 셋이 됐다 — `features/editor/placement.ts`). 그런데 **첫 실행에
// 뜨는 것은 여전히 읽는 문서**였다: 앱이 뜨자마자 [도움말]의 [시작하기] 절이 통째로 열렸고,
// 거기에는 "SPIN 은 어떤 앱인가 → 화면 여섯 → 10분 따라하기 → 저장·백업·동기화의 차이" 가
// 차례로 들어 있다. 실기 프레임으로 확인했다(2026-09-16). **처음 온 코치에게 문서를 들이미는
// 것이 바로 위 판정이 실패라고 부른 그 형태다.**
//
// 그래서 문서 대신 **석 장**을 띄운다. 문서는 안 지운다 — 물음표로 언제든 열리고, 마지막 장이
// 그 자리를 알려 준다. 바뀐 것은 «처음 마주치는 것» 하나뿐이다.
//
// ── 석 장이 이것인 이유 ──────────────────────────────────────────────────────────────
// 헌장이 정한 차례 그대로다(T7 «선수 배치 → 드릴 저장 → 시연»). 셋은 **못 찾으면 앱을 못 쓰는
// 것**들이고, 그 밖의 것(팀·규칙·동기화·백업)은 못 찾아도 앱이 돌아가므로 여기 안 넣는다.
//  ① 놓기   — 제보가 걸린 바로 그 자리.
//  ② 남기기 — 전술판이 저장되지 않는다는 사실은 **잃고 나서야** 알게 되는 종류다.
//  ③ 보여주기 — 이 앱을 쓰는 이유. 여기까지 와야 «왜 스텝인가» 가 설명된다.
//
// ⚠️ 한 장에 문장 둘을 넘기지 마라. 석 장이 다시 문서가 되면 고친 것이 없다.
//
// ⚠️ 이 컴포넌트는 **prefs 를 안 본다.** 받는 것은 `open`·`onClose` 뿐이고 언제 뜰지·무엇을
// 저장할지는 AppShell 이 정한다(`SmallScreenNotice` 와 같은 규율 — 결정 25). 닫는 길은
// 넷(✕·Esc·백드롭·[시작하기])이지만 나가는 문은 `onClose` 하나다.
import { useEffect, useRef, useState } from 'react';
import { Modal } from '../Modal.tsx';
import { useT } from '../../i18n/useT.ts';

export interface FirstRunOnboardingProps {
  open: boolean;
  /** 어떤 경로로 닫혔든 한 번 부른다. 끝까지 봤는지는 **묻지 않는다** — 건너뛴 사람에게
   *  다음 실행에 또 띄우는 것은 안내가 아니라 방해다. */
  onClose(): void;
}

const TITLE_ID = 'first-run-onboarding-title';
const BODY_ID = 'first-run-onboarding-body';

/** 장마다 문안 키 한 쌍. **리터럴로 적는다** — `` t(`onboarding.step${n}.title`) `` 처럼 조립하면
 *  키 타입(i18n 이 유니온으로 잠가 둔 것)을 통과하지 못하고, 통과시키려 타입을 넓히면 **오타
 *  난 키가 조용히 지나가는** 문이 앱 전체에 생긴다. 장을 늘릴 때 여기와 i18n 세 벌을 같이 늘린다. */
const STEPS = [
  { title: 'onboarding.step1.title', body: 'onboarding.step1.body' },
  { title: 'onboarding.step2.title', body: 'onboarding.step2.body' },
  { title: 'onboarding.step3.title', body: 'onboarding.step3.body' },
] as const;
const PANELS = STEPS.length;

export function FirstRunOnboarding({ open, onClose }: FirstRunOnboardingProps) {
  const t = useT();
  const [page, setPage] = useState(0);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // 열릴 때마다 첫 장부터. 부모가 `open` 과 무관하게 상시 렌더하므로 언마운트로 안 씻긴다
  // (ChangelogModal·SmallScreenNotice 가 기록한 그 사실). 복귀 대상도 같은 자리에서 잡는다 —
  // 이 모달은 **여는 트리거가 없어**(앱이 스스로 띄운다) 기본 복귀 대상이 `<body>` 인데 body 는
  // 포커스를 못 받아 Tab 이 문서 처음부터 다시 시작한다(결정 29).
  useEffect(() => {
    if (!open) return;
    setPage(0);
    returnFocusRef.current = document.getElementById('main');
  }, [open]);

  const last = page >= PANELS - 1;
  const n = page + 1;

  return (
    <Modal
      open={open}
      onClose={onClose}
      titleId={TITLE_ID}
      title={t(STEPS[page]!.title)}
      descriptionId={BODY_ID}
      closeLabel={t('common.close')}
      returnFocusRef={returnFocusRef}
    >
      <p id={BODY_ID} style={{ margin: 0, color: 'var(--text)', fontSize: '0.9375rem', lineHeight: 1.7 }}>
        {t(STEPS[page]!.body)}
      </p>
      {/* 마지막 장에만 문서로 가는 길을 알린다. 첫 장에 두면 «읽을 것이 또 있다» 가 먼저 읽혀
          석 장을 건너뛰게 된다. */}
      {last && (
        <p style={{ margin: '0.75rem 0 0', color: 'var(--muted)', fontSize: '0.8125rem', lineHeight: 1.7 }}>
          {t('onboarding.helpHint')}
        </p>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: '1.5rem' }}>
        {/* 몇 장 중 몇 장째인가. 점 세 개를 그림으로만 두면 보조기기에 «1/3» 이 안 들리므로
            보이는 것은 점이고 읽히는 것은 글자다. */}
        <span aria-hidden="true" style={{ display: 'flex', gap: 6 }}>
          {Array.from({ length: PANELS }, (_, i) => (
            <span
              key={i}
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: i === page ? 'var(--accent)' : 'var(--border)',
              }}
            />
          ))}
        </span>
        <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
          {n} / {PANELS}
        </span>
        <span style={{ flex: 1 }} />
        {!last && (
          <button
            type="button"
            onClick={onClose}
            style={{
              minHeight: 'var(--hit)',
              padding: '0 0.75rem',
              background: 'none',
              border: 'none',
              color: 'var(--muted)',
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            {t('onboarding.skip')}
          </button>
        )}
        <button
          type="button"
          onClick={() => (last ? onClose() : setPage((p) => p + 1))}
          style={{
            minHeight: 'var(--hit)',
            padding: '0 1rem',
            borderRadius: 8,
            border: '1px solid var(--accent)',
            background: 'var(--accent)',
            color: 'var(--accent-ink)',
            fontSize: '0.875rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {last ? t('onboarding.done') : t('onboarding.next')}
        </button>
      </div>
    </Modal>
  );
}
